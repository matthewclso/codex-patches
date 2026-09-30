'use strict';
// Source-bound regression tests use the user's installed/downloaded archive.
// No complete proprietary source is stored in this repository or test outputs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { Readable } = require('node:stream');
const { spawnSync } = require('node:child_process');
const asar = require('../lib/asar.cjs');
const app = require('../lib/app-patches.cjs');
const petPatch = require('../patches/custom-pets/index.cjs');
const browserPatch = require('../patches/browser-wsl/index.cjs');
const servicePatch = require('../patches/browser-service-path/index.cjs');
const sourcePath = process.env.CODEX_SOURCE_ASAR;
const auditUnknown = process.env.CODEX_AUDIT_UNKNOWN === '1';
function compose(bytes, selected) {
  if (!auditUnknown) return app.transformArchive(bytes, selected);
  const result = app.auditArchive(bytes, selected);
  assert(result.buffer, 'Candidate modules changed; source audit must be updated before composing');
  if (!result.report.supported) {
    assert.equal(result.report.reviewRequired, true);
    assert.throws(() => app.transformArchive(bytes, selected), /Unsupported Codex archive/);
  }
  return { ...result, changes: result.report.changes, build: result.report.build };
}
let original, archive;
function packed(name) { return asar.readEntry(archive, name).toString('utf8'); }
function setup() { if (!original) { original = fs.readFileSync(sourcePath); archive = asar.parseArchive(original); } }
function between(source, first, last) {
  const start = source.indexOf(first), end = source.indexOf(last, start + first.length);
  assert(start >= 0 && end > start, 'Missing source boundaries: ' + first);
  return source.slice(start, end);
}
const sourceTest = (name, fn) => test(name, { skip: !sourcePath && 'Set CODEX_SOURCE_ASAR to a pristine Codex app.asar' }, async () => { setup(); await fn(); });
function packedRequire(name, cache = new Map()) {
  if (cache.has(name)) return cache.get(name).exports;
  const module = { exports: {} }; cache.set(name, module);
  const req = target => target.startsWith('.') ? packedRequire(path.posix.join(path.posix.dirname(name), target), cache) : require(target);
  vm.runInThisContext('(function(require,module,exports){' + packed(name) + '\n})', { filename: name })(req, module, module.exports);
  return module.exports;
}
function pathHelpers() {
  const network = packed('.vite/build/application-network-startup-D74LEWDz.js');
  return between(network, 'function fe(', 'var _e=class') + between(network, 'function vr(', 'function yr(');
}
async function petCase(loader, home, unix) {
  const o = { rt: () => home }, sandbox = { Buffer, Response, n: packedRequire('.vite/build/zod-ClKgiFhi.js'), o, Vn: () => 'Ubuntu', eB: { default: () => 'probe-pet' } };
  vm.createContext(sandbox);
  const bootstrap = packed(petPatch.targetPath), fsUtils = 'let ' + between(bootstrap, 'W={async readFile(', 'async function $a(');
  vm.runInContext(pathHelpers() + ';Object.assign(o,{zt:ge});' + fsUtils + loader + ';globalThis.api={load:oB,loadAvatar:sB,install:lB};', sandbox);
  const platform = unix ? path.posix : path.win32, normalizedHome = unix ? o.zt(home) : home, petRoot = platform.join(normalizedHome, 'pets'), legacyRoot = platform.join(normalizedHome, 'avatars');
  // Minimal valid PNG header for the actual stock dimension checker.
  const image = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(image); image.write('IHDR', 12); image.writeUInt32BE(1536, 16); image.writeUInt32BE(2288, 20);
  const files = new Map();
  for (const [root, name, metadata] of [[petRoot, 'probe-pet', 'pet.json'], [legacyRoot, 'legacy-pet', 'avatar.json']]) {
    files.set(platform.join(root, name, metadata), Buffer.from(JSON.stringify({ displayName: name, spriteVersionNumber: 2, spritesheetPath: 'spritesheet.png' })));
    files.set(platform.join(root, name, 'spritesheet.png'), image);
  }
  const calls = [], host = {
    platformPath: async () => platform,
    createDirectory: async target => { calls.push(['mkdir', target]); assert([petRoot, platform.join(petRoot, 'probe-pet')].includes(target), 'Malformed pet directory: ' + target); },
    readDirectory: async target => { calls.push(['readdir', target]); if (target === petRoot || target === legacyRoot) return [{ name: target === petRoot ? 'probe-pet' : 'legacy-pet', isDirectory: () => true, isSymbolicLink: () => false }]; throw new Error('Missing directory: ' + target); },
    readFile: async target => { calls.push(['read', target]); const data = files.get(target); assert(data, 'Missing file: ' + target); return Readable.toWeb(Readable.from([data])); },
    stat: async target => { assert(files.has(target)); return { mtimeMs: 1 }; },
    writeFile: async target => { calls.push(['write', target]); },
  };
  const found = await sandbox.api.load({ appServerClient: host });
  const ids = Array.from(found.avatars, pet => pet.id).sort();
  if (ids.length) {
    for (const id of ids) assert.equal((await sandbox.api.loadAvatar({ appServerClient: host, avatarId: id })).id, id);
    const count = calls.length;
    for (const id of ['custom:../outside', 'custom:/tmp/outside', 'custom:.']) assert.equal(await sandbox.api.loadAvatar({ appServerClient: host, avatarId: id }), null);
    assert.equal(calls.length, count, 'Traversal must fail before filesystem calls');
  }
  const installCalls = [];
  const installHost = { platformPath: host.platformPath, createDirectory: async target => installCalls.push(['mkdir', target]), readDirectory: async () => [], writeFile: async target => installCalls.push(['write', target]) };
  await sandbox.api.install({ appServerClient: installHost, name: 'Probe', spritesheet: { extension: 'png', bytes: image, spriteVersionNumber: 2 } });
  return { ids, installCalls, expectedInstall: [ ['mkdir', petRoot], ['mkdir', platform.join(petRoot, 'probe-pet')], ['write', platform.join(petRoot, 'probe-pet', 'spritesheet.png')], ['write', platform.join(petRoot, 'probe-pet', 'pet.json')] ] };
}
sourceTest('actual pet loader: stock fails Windows home under POSIX; patch fixes all three paths and retains traversal checks', async () => {
  const bootstrap = packed(petPatch.targetPath), loader = 'let ' + between(bootstrap, 'tB=1536,', 'function vB('), patched = petPatch.apply(loader, app.replaceExactlyOnce);
  const windows = 'D:\\Profiles\\Example User\\.codex';
  const stock = await petCase(loader, windows, true);
  assert.deepEqual(stock.ids, []); assert.notDeepEqual(stock.installCalls, stock.expectedInstall);
  for (const [home, unix] of [[windows, true], [windows, false], ['/mnt/d/Profiles/Example User/.codex', true], ['\\\\wsl.localhost\\Ubuntu-26.04\\mnt\\d\\Profiles\\Example User\\.codex', true]]) {
    const result = await petCase(patched, home, unix);
    assert.deepEqual(result.ids, ['custom:legacy-pet', 'custom:probe-pet']);
    assert.deepEqual(result.installCalls, result.expectedInstall);
  }
  assert.deepEqual((await petCase(loader, windows, false)).ids, ['custom:legacy-pet', 'custom:probe-pet']);
});
sourceTest('actual in-app eligibility preserves all prerequisites across 256 cases and external browser gate', () => {
  const source = packed(browserPatch.targetPath), patched = browserPatch.apply(source, app.replaceExactlyOnce);
  const stockFn = vm.runInNewContext('(' + browserPatch.before + ')'), patchedFn = vm.runInNewContext('(' + browserPatch.after + ')');
  const names = ['areRequirementsPending', 'isBrowserAgentGateEnabled', 'isBrowserAndComputerUseAllowed', 'isBrowserEnabled', 'isBrowserUseEnabled', 'isLoading', 'runCodexInWsl'];
  let changed = 0;
  for (let mask = 0; mask < 256; mask++) {
    const options = Object.fromEntries(names.map((name, index) => [name, Boolean(mask & (1 << index))])); options.windowType = mask & 128 ? 'chrome-extension' : 'default';
    const before = stockFn(options), after = patchedFn(options);
    if (before !== after) { changed++; assert.equal(before, 'wsl-disabled'); assert.equal(after, 'available'); assert.equal(options.runCodexInWsl, true); }
  }
  assert(changed > 0);
  const external = between(source, 'function _Br(', 'var vBr;');
  assert(patched.includes(external), 'External browser gate changed');
});
function generator(source, platform, useWsl, servicePath, backends) {
  const fn = between(source, 'function cc(', 'function lc('), native = vm.runInNewContext(pathHelpers() + ';vr');
  const sandbox = {
    tc: { info: () => {}, warning: () => {} }, r: { Jo: () => true, Vt: () => servicePath.slice(0, -'/scripts/browser-service.mjs'.length), yo: 'browser', Bo: 'request', Wo: 'trusted-services', Go: options => options },
    o: { st: native, zt: value => value }, d: { t: { Dev: 'dev', resolve: () => 'release', isInternal: () => false } }, P: { default: { env: {} } },
    uc: value => value, lc: () => ({}), nc: {}, rc: {}, ha: () => ({}),
    Ui: 'trace', In: 'backends', Ln: 'tinysky', Vi: 'iab-origin', Hi: 'chrome-origin', da: 'sky-origin', Lee: 'flavor', Ree: 'version', ic: 'iab', ac: 'chrome', oc: 'sky', pa: 'sky-pipe', $s: 'host-pipe',
  };
  const code = vm.runInNewContext('(' + fn + ')', sandbox);
  return code({ appVersion: 'version', codexHome: 'home', marketplaceName: 'market', availableBrowserUseBackends: backends, browserUseTinysky: false, computerUse: false, enforceModelCheck: true, computerUseNativePipePath: null, computerUsePaths: {}, hostServicesPipePath: null, includePrivateProcessEnv: false, runtimePaths: { platform, nodePath: 'node', nodeReplPath: 'repl', codexCliPath: 'cli', nodeModuleDirs: [] }, shouldUseWslPaths: useWsl });
}
sourceTest('actual trusted-service generator fixes native Windows mount paths only under WSL and retains all other generated fields', () => {
  const source = packed(servicePatch.targetPath), patched = servicePatch.apply(source, app.replaceExactlyOnce);
  let changed = 0, cases = 0;
  for (const platform of ['win32', 'linux', 'darwin']) for (const useWsl of [false, true]) for (const root of ['/mnt/c/Profile User/.codex', '/mnt/d/Other/.codex', 'C:\\Profile User\\.codex', '/home/user/.codex', '\\\\wsl.localhost\\Ubuntu\\home\\user\\.codex']) for (const backends of [[], ['iab'], ['chrome']]) {
    const servicePath = root + '/scripts/browser-service.mjs', before = generator(source, platform, useWsl, servicePath, backends), after = generator(patched, platform, useWsl, servicePath, backends); cases++;
    const beforeServices = before.extraEnv['trusted-services'], afterServices = after.extraEnv['trusted-services'];
    if (beforeServices !== afterServices) { changed++; assert.equal(platform, 'win32'); assert.equal(useWsl, true); assert(backends.length > 0); assert.equal(JSON.parse(afterServices).browser, vm.runInNewContext(pathHelpers() + ';vr')(servicePath, null)); }
    after.extraEnv['trusted-services'] = beforeServices;
    assert.deepEqual(JSON.parse(JSON.stringify(after)), JSON.parse(JSON.stringify(before)), 'Unrelated generator option changed');
  }
  assert.equal(cases, 90); assert(changed > 0);
  const regression = generator(source, 'win32', true, '/mnt/c/User/.codex/scripts/browser-service.mjs', ['iab']);
  assert.equal(JSON.parse(regression.extraEnv['trusted-services']).browser, '/mnt/c/User/.codex/scripts/browser-service.mjs');
});
sourceTest('all valid app-patch combinations are deterministic, source-gated and preserve unrelated entries', () => {
  const combinations = [[], ['custom-pets'], ['browser-wsl'], ['custom-pets', 'browser-wsl'], ['browser-wsl', 'browser-service-path'], ['custom-pets', 'browser-wsl', 'browser-service-path']];
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-patch-syntax-'));
  try {
    for (const selected of combinations) {
      const result = compose(original, selected), resultAgain = compose(original, selected);
      assert(result.buffer.equals(resultAgain.buffer)); assert.equal(result.changes.length, selected.length);
      const output = asar.parseArchive(result.buffer), changedPaths = new Set(result.changes.map(change => change.targetPath));
      for (const { path: name, entry } of asar.listEntries(archive.tree)) {
        if (!changedPaths.has(name)) { assert.deepEqual(asar.lookup(output.tree, name), entry); if (!entry.unpacked && !entry.link) assert(asar.readEntry(archive, name).equals(asar.readEntry(output, name))); }
      }
      for (const change of result.changes) {
        const patch = app.listPatches().find(p => p.id === change.id), extension = patch.id === 'browser-wsl' ? '.mjs' : '.cjs', filename = path.join(directory, patch.id + extension);
        fs.writeFileSync(filename, asar.readEntry(output, change.targetPath));
        const syntax = spawnSync(process.execPath, ['--check', filename], { encoding: 'utf8' });
        assert.equal(syntax.status, 0, syntax.stderr);
      }
      if (selected.length) assert.throws(() => app.transformArchive(result.buffer, selected), /Unsupported Codex archive/);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
sourceTest('actual executable integrity updater changes only the recorded header hash', () => {
  if (!process.env.CODEX_SOURCE_EXE) return;
  const executable = fs.readFileSync(process.env.CODEX_SOURCE_EXE), result = compose(original, ['custom-pets', 'browser-wsl', 'browser-service-path']);
  if (result.build) assert.equal(asar.sha256(executable), result.build.executableSha256);
  else assert.equal(auditUnknown, true);
  const corrected = asar.updateExecutableIntegrity(executable, result.sourceHeaderHash, result.outputHeaderHash);
  const delta = []; for (let i = 0; i < executable.length; i++) if (executable[i] !== corrected[i]) delta.push(i);
  assert(delta.length > 0 && delta.length <= 64); assert(delta.at(-1) - delta[0] < 64);
  const resource = asar.executableResources(corrected).find(r => r.names.some(n => typeof n === 'string' && n.toLowerCase() === 'electronasar'));
  assert(corrected.subarray(resource.offset, resource.offset + resource.size).includes(Buffer.from(result.outputHeaderHash)));
});
