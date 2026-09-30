'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { requireEvidence, artifactIsSourceOnly } = require('./evidence.cjs');
test('unsupported nested virtualization cannot satisfy WSL acceptance', () => {
  assert.throws(() => requireEvidence({ status: 'unsupported', reason: 'Nested virtualization unavailable' }), /unsupported/);
  assert.throws(() => requireEvidence({ status: 'passed', stages: [] }), /Missing successful/);
});
test('WSL acceptance requires guest boot, import, and test execution', () => {
  const report = { status: 'passed', stages: ['wsl2-import', 'ubuntu-boot', 'wsl-tests-and-stock-app-server'].map(name => ({ name, exitCode: 0, timedOut: false })) };
  assert.equal(requireEvidence(report), true);
  report.stages[2].timedOut = true;
  assert.throws(() => requireEvidence(report), /Missing successful/);
});
test('toolkit release excludes copied app, private state, and generated artifacts', () => {
  assert.equal(artifactIsSourceOnly([{ path: 'patches/custom-pets/index.cjs' }, { path: 'compatibility/current.json' }]), true);
  for (const filename of ['app/Codex.exe', 'resources/app.asar', 'state/pairing.json', '.artifacts/report.json', 'data/state_5.sqlite'])
    assert.throws(() => artifactIsSourceOnly([{ path: filename }]), /Release contains/);
});
const { buildProposal } = require('./propose-update.cjs');
test('automation proposes a candidate without enabling an unknown package', () => {
  const validation = { status: 'needs-review', reviewRequired: true, package: {
    identity: { packageVersion: '26.930.1234.0' }, versions: { cliVersion: '0.159.0' },
    hashes: { archiveSha256: 'a'.repeat(64) },
  }, checks: [{ name: 'source-behavior', status: 'passed' }], candidate: { acceptance: 'pending' } };
  const result = buildProposal(validation, { status: 'unsupported', reason: 'Nested virtualization unavailable.' }, 'https://github.com/example/repo/actions/runs/1');
  assert.match(result.filename, /^compatibility\/candidates\//);
  assert.equal(result.proposal.status, 'review-required');
  assert.equal(result.proposal.wsl.status, 'unsupported');
  assert.match(result.body, /did not add the build to the supported registry/);
  assert.throws(() => buildProposal({ package: { identity: { packageVersion: 'malicious/version' }, hashes: { archiveSha256: 'a'.repeat(64) } } }), /Invalid package version/);
});
const { npmPacks } = require('./evidence.cjs');
test('release payload parses both npm 11 and npm 12 JSON formats', () => {
  const pack = { filename: 'codex-patches-0.1.0.tgz', files: [{ path: 'lib/asar.cjs' }] };
  assert.deepEqual(npmPacks([pack]), [pack]);
  assert.deepEqual(npmPacks({ 'codex-patches': pack }), [pack]);
  assert.throws(() => npmPacks({ error: 'bad' }), /Invalid npm pack/);
});
const { requirePackageEvidence } = require('./evidence.cjs');
test('candidate/source composition or failed unit tests cannot establish reviewed package acceptance', () => {
  assert.equal(requirePackageEvidence({ status: 'passed', reviewRequired: false, checks: [{ status: 'passed' }] }), true);
  assert.throws(() => requirePackageEvidence({ status: 'needs-review', reviewRequired: true, checks: [{ status: 'passed' }] }), /Compatibility review/);
  assert.throws(() => requirePackageEvidence({ status: 'passed', checks: [{ status: 'failed' }] }), /successful checks/);
});
