'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const compatibility = require('../compatibility/current.json');
const asar = require('../lib/asar.cjs');
const deployment = require('../lib/deployment.cjs');
const { ids, resolveSelection } = require('../lib/selection.cjs');
const config = (values = {}) => ({ schemaVersion: 1, patches: values });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-deployment-test-')), source = path.join(root, 'source'), toolkit = path.join(root, 'toolkit'), destination = path.join(root, 'output');
  const write = (base, name, data) => { const filename = path.join(base, name); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, data); };
  const bytes = Buffer.from('pristine archive fixture'), integrity = { algorithm: 'SHA256', hash: asar.sha256(bytes), blockSize: bytes.length, blocks: [asar.sha256(bytes)] }, archive = asar.serializeArchive({ files: { 'fixture.js': { offset: '0', size: bytes.length, integrity } } }, bytes);
  write(source, 'resources/app.asar', archive);
  const binaries = { 'ChatGPT.exe': 'executable', 'resources/codex.exe': 'windows-cli', 'resources/codex': 'linux-cli', 'resources/codex-code-mode-host': 'code-mode-host', 'resources/codex-code-mode-host.exe': 'windows-code-mode-host', 'resources/cua_node/bin/node.exe': 'windows-node', 'chrome.dll': 'chrome-engine' };
  for (const [name, value] of Object.entries(binaries)) write(source, name, value);
  const build = { packageVersion: 'fixture', appVersion: 'fixture', cliVersion: 'fixture', archiveSha256: asar.sha256(archive), headerSha256: asar.headerHash(archive), executableRelativePath: 'ChatGPT.exe', executableSha256: asar.sha256(Buffer.from(binaries['ChatGPT.exe'])), cliWindowsSha256: asar.sha256(Buffer.from(binaries['resources/codex.exe'])), cliLinuxSha256: asar.sha256(Buffer.from(binaries['resources/codex'])), codeModeLinuxSha256: asar.sha256(Buffer.from(binaries['resources/codex-code-mode-host'])), codeModeWindowsSha256: asar.sha256(Buffer.from(binaries['resources/codex-code-mode-host.exe'])), nodeWindowsSha256: asar.sha256(Buffer.from(binaries['resources/cua_node/bin/node.exe'])), patches: {} };
  for (const dir of ['bin', 'lib', 'patches', 'scripts', 'tools', 'compatibility']) write(toolkit, dir + '/fixture.cjs', 'module.exports = true;');
  for (const name of ['package.json','package-lock.json','codex-patches.ps1','config.example.json']) write(toolkit, name, '{}');
  write(toolkit, 'node_modules/ws/index.js', 'module.exports = true;');
  compatibility.builds.push(build);
  return { root, source, toolkit, destination, build, cleanup() { compatibility.builds.splice(compatibility.builds.indexOf(build), 1); fs.rmSync(root, { recursive: true, force: true }); } };
}
test('selection honors independent auto/disabled states and rejects unsupported explicit requests', () => {
  const build = { patches: { 'custom-pets': { status: 'needed' }, 'browser-wsl': { status: 'needed' }, 'browser-service-path': { status: 'needed' } }, runtimePatches: { 'wsl-project-paths': { status: 'needed' }, 'remote-fast-list': { status: 'retired' } } };
  const selected = resolveSelection(config({ 'custom-pets': 'disabled' }), build);
  assert.deepEqual(selected.selected, ['browser-wsl', 'browser-service-path', 'wsl-project-paths']);
  assert.deepEqual(selected.appPatches, ['browser-wsl', 'browser-service-path']);
  assert.throws(() => resolveSelection(config({ 'remote-fast-list': 'enabled' }), build), /no reviewed implementation/);
  assert.deepEqual(resolveSelection(config({ 'browser-wsl': 'disabled' }), build).appPatches, ['custom-pets', 'browser-service-path']);
  assert.throws(() => resolveSelection(config({ unknown: 'enabled' }), build), /Unknown patch/);
  assert.throws(() => resolveSelection(config({ 'custom-pets': 'sometimes' }), build), /Invalid mode/);
});
test('generic declared dependencies remain enforced', () => {
  const module = require('../patches/custom-pets/index.cjs');
  module.dependencies = ['browser-wsl'];
  try {
    const build = { patches: { 'custom-pets': { status: 'needed' }, 'browser-wsl': { status: 'needed' } } };
    assert.throws(() => resolveSelection(config({ 'browser-wsl': 'disabled' }), build), /custom-pets requires browser-wsl/);
  } finally { delete module.dependencies; }
});
test('build rejects unsupported source, modified runtime binaries and output beneath source', () => {
  const f = fixture();
  try {
    assert.equal(deployment.identify(f.source).build, f.build);
    fs.writeFileSync(path.join(f.source, 'resources/codex.exe'), 'changed CLI');
    assert.throws(() => deployment.identify(f.source), /Unreviewed binary: resources\/codex.exe/);
    assert.throws(() => deployment.buildCopy({ source: f.source, destination: path.join(f.source, 'nested-output') }), /outside the installed package/);
    fs.writeFileSync(path.join(f.source, 'resources/app.asar'), 'unknown archive');
    assert.throws(() => deployment.identify(f.source), /Unsupported installed Codex build/);
  } finally { f.cleanup(); }
});
test('inspection reports an unknown update without authorizing installation or changing source', () => {
  const f=fixture();
  try {
    const archive=fs.readFileSync(path.join(f.source,'resources/app.asar'));
    const parsed=asar.parseArchive(archive);
    parsed.tree.note='unknown update';
    const unknown=asar.serializeArchive(parsed.tree,parsed.payload);
    fs.writeFileSync(path.join(f.source,'resources/app.asar'),unknown);
    const configPath=path.join(f.root,'selection.json');fs.writeFileSync(configPath,JSON.stringify(config()));
    const report=require('../bin/toolkit.cjs').main(['inspect','--source='+f.source,'--config='+configPath]);
    assert.equal(report.supported,false);
    assert.equal(report.appAudit.reviewRequired,true);
    assert(report.appAudit.patches.every(p=>p.status==='review-required'));
    assert(fs.readFileSync(path.join(f.source,'resources/app.asar')).equals(unknown));
    assert.throws(()=>deployment.identify(f.source),/Unsupported installed/);
  } finally { f.cleanup(); }
});
test('generated snapshot is independent and detects app or runtime tampering', () => {
  const f = fixture();
  try {
    const receipt = deployment.buildCopy({ source: f.source, destination: f.destination, config: config(Object.fromEntries(ids.map(id => [id, 'disabled']))), packageFullName: 'fixture-package', packageFamilyName: 'fixture-family', toolkitRoot: f.toolkit });
    assert(receipt.toolkitFiles.some(file => file.path === 'codex-patches.ps1'));
    assert(receipt.toolkitFiles.some(file => file.path === 'node_modules/ws/index.js'));
    assert.equal(deployment.verifyCopy(f.destination, { full: true }).valid, true);
    assert.throws(() => deployment.buildCopy({ source: f.source, destination: f.destination }), /Output already exists/);
    const sourceCli = path.join(f.source, 'resources/codex'), copiedCli = path.join(f.destination, 'app/resources/codex');
    fs.writeFileSync(copiedCli, 'tampered copy');
    assert.equal(fs.readFileSync(sourceCli, 'utf8'), 'linux-cli', 'Copy must not share source file contents');
    assert.throws(() => deployment.verifyCopy(f.destination), /Generated app changed: resources\/codex/);
    fs.writeFileSync(copiedCli, fs.readFileSync(sourceCli));
    const runtime = path.join(f.destination, 'toolkit/lib/fixture.cjs');
    fs.writeFileSync(runtime, 'tampered runtime');
    assert.throws(() => deployment.verifyCopy(f.destination), /Runtime source changed/);
    fs.writeFileSync(runtime, 'module.exports = true;');
    const shadow = path.join(f.destination, 'toolkit/node_modules/ws.js');
    fs.writeFileSync(shadow, 'module.exports = false;');
    assert.throws(() => deployment.verifyCopy(f.destination), /Runtime source file set changed/);
    fs.unlinkSync(shadow);
    const receiptPath = path.join(f.destination, 'receipt.json');
    const savedReceipt = fs.readFileSync(receiptPath);
    const duplicate = JSON.parse(savedReceipt); duplicate.toolkitFiles.push(duplicate.toolkitFiles[0]);
    fs.writeFileSync(receiptPath, JSON.stringify(duplicate));
    assert.throws(() => deployment.verifyCopy(f.destination), /Unsafe or duplicate receipt paths/);
    fs.writeFileSync(receiptPath, savedReceipt);
    fs.writeFileSync(path.join(f.destination, 'app/extra.bin'), 'unrecorded');
    assert.throws(() => deployment.verifyCopy(f.destination, { full: true }), /file set changed/);
  } finally { f.cleanup(); }
});
