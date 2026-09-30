'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const asar = require('../lib/asar.cjs');
const { inspectArchive, transformArchive, auditArchive } = require('../lib/app-patches.cjs');
const compatibility = require('../compatibility/current.json');
function archiveFixture() {
  const data = Buffer.from('original module'), other = Buffer.from('untouched');
  const integrity = bytes => ({ algorithm: 'SHA256', hash: asar.sha256(bytes), blockSize: 4, blocks: Array.from({ length: Math.ceil(bytes.length / 4) }, (_, i) => asar.sha256(bytes.subarray(i * 4, (i + 1) * 4))) });
  const tree = { files: { 'module.js': { size: data.length, offset: '0', integrity: integrity(data) }, 'other.bin': { size: other.length, offset: String(data.length), integrity: integrity(other) }, 'native.node': { size: 12, unpacked: true, integrity: integrity(Buffer.alloc(12)) } } };
  return asar.serializeArchive(tree, Buffer.concat([data, other]));
}
function executableFixture(hash) {
  const bytes = Buffer.alloc(2048), pe = 0x80, optional = pe + 24, section = optional + 240, root = 0x200;
  bytes.write('MZ', 0); bytes.writeUInt32LE(pe, 0x3c); bytes.write('PE\0\0', pe, 'ascii'); bytes.writeUInt16LE(1, pe + 6); bytes.writeUInt16LE(240, pe + 20); bytes.writeUInt16LE(0x20b, optional);
  bytes.writeUInt32LE(0x1000, optional + 128); bytes.writeUInt32LE(1024, optional + 132);
  bytes.write('.rsrc', section); bytes.writeUInt32LE(1024, section + 8); bytes.writeUInt32LE(0x1000, section + 12); bytes.writeUInt32LE(1024, section + 16); bytes.writeUInt32LE(root, section + 20);
  bytes.writeUInt16LE(1, root + 12); bytes.writeUInt32LE(0x80000000 + 96, root + 16); bytes.writeUInt32LE(0x80000000 + 24, root + 20);
  bytes.writeUInt16LE(1, root + 24 + 12); bytes.writeUInt32LE(0x80000000 + 128, root + 24 + 16); bytes.writeUInt32LE(0x80000000 + 48, root + 24 + 20);
  bytes.writeUInt16LE(1, root + 48 + 14); bytes.writeUInt32LE(1033, root + 48 + 16); bytes.writeUInt32LE(72, root + 48 + 20);
  for (const [at, value] of [[96, 'Integrity'], [128, 'ElectronAsar']]) { bytes.writeUInt16LE(value.length, root + at); bytes.write(value, root + at + 2, 'utf16le'); }
  const record = Buffer.from(JSON.stringify([{ file: 'resources\\app.asar', alg: 'SHA256', value: hash }]));
  bytes.writeUInt32LE(0x1000 + 192, root + 72); bytes.writeUInt32LE(record.length, root + 76); record.copy(bytes, root + 192);
  record.copy(bytes, 1600); // Identical decoy outside the PE resource directory.
  return bytes;
}
test('ASAR replacement appends data and preserves other metadata and all original payload', () => {
  const original = archiveFixture(), before = asar.parseArchive(original), replacement = Buffer.from('expanded patched module');
  const result = asar.replaceEntries(original, new Map([['module.js', replacement]])), after = asar.parseArchive(result);
  assert(asar.readEntry(after, 'module.js').equals(replacement));
  assert.deepEqual(after.tree.files['other.bin'], before.tree.files['other.bin']);
  assert.deepEqual(after.tree.files['native.node'], before.tree.files['native.node']);
  assert(after.payload.subarray(0, before.payload.length).equals(before.payload));
});
test('ASAR parser and replacement reject malformed bounds and source integrity', () => {
  const truncated = archiveFixture().subarray(0, 30);
  assert.throws(() => asar.parseArchive(truncated), /Truncated/);
  const original = archiveFixture(), parsed = asar.parseArchive(original);
  parsed.tree.files['module.js'].integrity.hash = '0'.repeat(64);
  const corrupt = asar.serializeArchive(parsed.tree, parsed.payload);
  assert.throws(() => asar.replaceEntries(corrupt, new Map([['module.js', Buffer.from('bad')]])), /integrity mismatch/);
});
test('PE updater locates named resource, preserves decoy and all bytes outside hash', () => {
  const before = 'a'.repeat(64), after = 'b'.repeat(64), original = executableFixture(before), result = asar.updateExecutableIntegrity(original, before, after);
  const resource = asar.executableResources(original)[0];
  assert.deepEqual(resource.names, ['Integrity', 'ElectronAsar', 1033]);
  const offset = original.subarray(resource.offset, resource.offset + resource.size).indexOf(Buffer.from(before)) + resource.offset;
  assert(result.subarray(0, offset).equals(original.subarray(0, offset)));
  assert(result.subarray(offset + 64).equals(original.subarray(offset + 64)));
  assert.equal(result.toString('ascii', offset, offset + 64), after);
  assert.throws(() => asar.updateExecutableIntegrity(original, 'c'.repeat(64), after), /does not match/);
});
test('unknown archive cannot be installed, and audit remains review required', () => {
  const original = archiveFixture();
  assert.throws(() => transformArchive(original, []), /Unsupported Codex archive/);
  const report = inspectArchive(original, ['custom-pets'], { allowUnknownForAudit: true });
  assert.equal(report.supported, false); assert.equal(report.reviewRequired, true);
  assert.equal(auditArchive(original, ['custom-pets']).buffer, null);
  assert.throws(() => inspectArchive(original, ['unknown'], { allowUnknownForAudit: true }), /Unknown app patch/);
  assert.equal(inspectArchive(original, ['browser-service-path'], { allowUnknownForAudit: true }).patches[0].status, 'review-required');
});
test('modules sharing a target validate independent hashes before deterministic composition', () => {
  const browser = require('../patches/browser-service-path/index.cjs');
  const memberships = require('../patches/project-memberships/index.cjs');
  const source = Buffer.from('const y=null,g=false,m={platform:"linux"},o={st:x=>x},u={setThreadAssignmentsEnabled(){}},K=()=>({localProjectTaskMembership:false});const services=' + browser.before + ';' + memberships.before + ';');
  const integrity = { algorithm: 'SHA256', hash: asar.sha256(source), blockSize: source.length, blocks: [asar.sha256(source)] };
  const original = asar.serializeArchive({ files: { 'fixture.js': { offset: '0', size: source.length, integrity } } }, source);
  const apply = patch => Buffer.from(patch.apply(source.toString(), require('../lib/app-patches.cjs').replaceExactlyOnce));
  const build = { archiveSha256: asar.sha256(original), headerSha256: asar.headerHash(original), patches: Object.fromEntries([browser, memberships].map(patch => [patch.id, {
    status: 'needed', targetPath: 'fixture.js', sourceSha256: asar.sha256(source), outputSha256: asar.sha256(apply(patch)),
  }])) };
  compatibility.builds.push(build);
  try {
    for (const selection of [[], [browser.id], [memberships.id], [browser.id, memberships.id]]) {
      const result = transformArchive(original, selection), output = asar.readEntry(asar.parseArchive(result.buffer), 'fixture.js').toString();
      assert.equal(output.includes(browser.after), selection.includes(browser.id));
      assert.equal(output.includes(memberships.after), selection.includes(memberships.id));
      for (const change of result.changes) assert.equal(change.sourceHash, asar.sha256(source));
    }
    const composed = transformArchive(original, [browser.id, memberships.id]);
    assert.notEqual(composed.changes[1].beforeHash, composed.changes[1].sourceHash);
    assert.equal(composed.changes[1].standaloneOutputHash, build.patches[memberships.id].outputSha256);
    build.patches[memberships.id].outputSha256 = composed.changes[1].afterHash;
    assert.throws(() => transformArchive(original, [browser.id, memberships.id]), /Reviewed patch output hash mismatch: project-memberships/);
  } finally { compatibility.builds.splice(compatibility.builds.indexOf(build), 1); }
});
