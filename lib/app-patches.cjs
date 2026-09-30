'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const asar = require('./asar.cjs');
const compatibility = require('../compatibility/current.json');
const modules = ['custom-pets', 'browser-wsl', 'browser-service-path'].map(id => require('../patches/' + id + '/index.cjs'));
function listPatches() {
  return modules.map(({ id, title, targetPath, sourceSha256, dependencies = [] }) => ({ id, title, targetPath, sourceSha256, dependencies, kind: 'app-code' }));
}
function select(ids) {
  assert(Array.isArray(ids) && ids.every(id => typeof id === 'string'), 'Patch selection must be an array of IDs');
  assert.equal(new Set(ids).size, ids.length, 'Duplicate patch selection');
  for (const id of ids) assert(modules.some(p => p.id === id), 'Unknown app patch: ' + id);
  const selected = modules.filter(p => ids.includes(p.id));
  for (const patch of selected) for (const id of patch.dependencies ?? []) assert(ids.includes(id), patch.id + ' requires ' + id);
  return selected;
}
function replaceExactlyOnce(source, before, after) {
  const start = source.indexOf(before);
  assert(start >= 0 && source.indexOf(before, start + before.length) === -1, 'Patch anchor missing or not unique');
  return source.slice(0, start) + after + source.slice(start + before.length);
}
function buildPlan(buffer, ids, allowUnknownForAudit) {
  const selected = select(ids), sourceArchiveHash = asar.sha256(buffer), archive = asar.parseArchive(buffer);
  const build = compatibility.builds.find(b => b.archiveSha256 === sourceArchiveHash) ?? null;
  assert(build || allowUnknownForAudit, 'Unsupported Codex archive SHA256: ' + sourceArchiveHash);
  if (build) assert.equal(archive.headerHash, build.headerSha256, 'Compatibility header hash mismatch');
  const replacements = new Map(), patches = [], changes = [];
  for (const patch of selected) {
    let definition = build?.patches[patch.id];
    if (build) assert(definition?.status === 'needed', 'App patch is not reviewed for this build: ' + patch.id);
    if (!build) {
      const candidates = [...new Map([patch, ...compatibility.builds.map(b => b.patches[patch.id]).filter(Boolean)].map(p => [p.targetPath + ':' + p.sourceSha256, p])).values()];
      const matches = candidates.filter(p => { try { return asar.sha256(asar.readEntry(archive, p.targetPath)) === p.sourceSha256; } catch { return false; } });
      assert(matches.length <= 1, 'Ambiguous audit targets for ' + patch.id);
      definition = matches[0] ?? candidates.find(p => { try { asar.readEntry(archive, p.targetPath); return true; } catch { return false; } }) ?? patch;
    }
    const targetPath = definition.targetPath;
    let data;
    try { data = asar.readEntry(archive, targetPath); }
    catch (error) {
      if (!allowUnknownForAudit) throw error;
      patches.push({ id: patch.id, status: 'review-required', targetPath, reason: error.message }); continue;
    }
    const beforeHash = asar.sha256(data), expected = definition.sourceSha256;
    if (beforeHash !== expected) {
      assert(allowUnknownForAudit, 'Unsupported target module hash: ' + targetPath);
      patches.push({ id: patch.id, status: 'review-required', targetPath, beforeHash, expectedHash: expected, reason: 'Module changed; re-audit stock behavior and anchors' }); continue;
    }
    const current = replacements.get(targetPath) ?? data;
    const source = current.toString('utf8'), updated = patch.apply(source, replaceExactlyOnce), result = Buffer.from(updated);
    if (patch.sourceType === 'commonjs') new vm.Script(updated, { filename: targetPath });
    assert(!result.equals(current), 'Patch did not change its target: ' + patch.id);
    replacements.set(targetPath, result);
    if (build && definition.outputSha256) assert.equal(asar.sha256(result), definition.outputSha256, 'Reviewed patch output hash mismatch: ' + patch.id);
    const row = { id: patch.id, status: build ? 'applicable' : 'source-unchanged-review-required', targetPath, beforeHash: asar.sha256(current), afterHash: asar.sha256(result), beforeSize: current.length, afterSize: result.length };
    patches.push(row); changes.push(row);
  }
  return {
    report: { schemaVersion: 1, supported: Boolean(build), reviewRequired: !build || patches.some(p => p.status === 'review-required'), sourceArchiveHash, sourceHeaderHash: archive.headerHash, build, selectedIds: selected.map(p => p.id), patches, changes },
    replacements,
  };
}
function inspectArchive(buffer, selectedIds, options = {}) {
  return buildPlan(buffer, selectedIds, options.allowUnknownForAudit === true).report;
}
function transformArchive(buffer, selectedIds) {
  const { report, replacements } = buildPlan(buffer, selectedIds, false);
  const result = replacements.size ? asar.replaceEntries(buffer, replacements) : Buffer.from(buffer);
  return { buffer: result, changes: report.changes, sourceHeaderHash: report.sourceHeaderHash, outputHeaderHash: asar.headerHash(result), sourceArchiveHash: report.sourceArchiveHash, outputArchiveHash: asar.sha256(result), build: report.build };
}
function auditArchive(buffer, selectedIds) {
  const { report, replacements } = buildPlan(buffer, selectedIds, true);
  // Audit outputs cannot be installed by transformArchive. A new build must be
  // reviewed and explicitly added to compatibility/current.json.
  if (report.patches.some(p => p.status === 'review-required')) return { report, buffer: null };
  const result = replacements.size ? asar.replaceEntries(buffer, replacements) : Buffer.from(buffer);
  return { report, buffer: result, sourceHeaderHash: report.sourceHeaderHash, outputHeaderHash: asar.headerHash(result), sourceArchiveHash: report.sourceArchiveHash, outputArchiveHash: asar.sha256(result) };
}
module.exports = { listPatches, inspectArchive, transformArchive, auditArchive, replaceExactlyOnce };
