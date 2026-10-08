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
let petPatch = require('../patches/custom-pets/index.cjs');
let browserPatch = require('../patches/browser-wsl/index.cjs');
let servicePatch = require('../patches/browser-service-path/index.cjs');
let membershipPatch = require('../patches/project-memberships/index.cjs');
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
let original, archive, sourcePlan, currentSource, latestSource, newestSource, source7945, source1002;

function modulePath(patch) { return sourcePlan.patches.find(p => p.id === patch.id).targetPath; }
function packed(name) { return asar.readEntry(archive, name).toString('utf8'); }
function setup() {
  if (original) return;
  original = fs.readFileSync(sourcePath);
  archive = asar.parseArchive(original);
  sourcePlan = app.inspectArchive(original, app.listPatches().map(p => p.id), { allowUnknownForAudit: true });
  // Fixture names are selected only for the exact reviewed source archive.
  source1002 = sourcePlan.sourceArchiveHash === '76fe7078248c00e4e03dd2177a4275ec9ce158a9dd43452a4f0427d39a4ed012';
  source7945 = source1002 || sourcePlan.sourceArchiveHash === '611d6da979d8bbabfec97dd90dcce27a9522e7016e6ccf135d59cab693ab08da';
  newestSource = source7945 || sourcePlan.sourceArchiveHash === '644fec616f2fbd203266d806c2ed9a26869abb84e76fbd6f5a33469e8cfd1686';
  latestSource = newestSource || sourcePlan.sourceArchiveHash === 'af98213984ec4556778ef9276193d51460153fb9b30fded882d503637b84abba';
  currentSource = latestSource || sourcePlan.sourceArchiveHash === '7a65bbbdf265aaa130a6670f1d310e7113646f9b86b2e9602e82fee400a92856';
  [petPatch, browserPatch, servicePatch, membershipPatch] = [petPatch, browserPatch, servicePatch, membershipPatch].map(p =>
    app.patchForSource(p.id, sourcePlan.patches.find(row => row.id === p.id).sourceHash));
}
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
  const network = packed(source1002 ? '.vite/build/application-network-startup-Bt0a8E1L.js' : newestSource ? '.vite/build/application-network-startup-BEAX-hka.js' : latestSource ? '.vite/build/application-network-startup-ouXbhtc5.js' : currentSource ? '.vite/build/application-network-startup-DN7Ktmlk.js' : '.vite/build/application-network-startup-D74LEWDz.js');
  if (currentSource) return between(network, 'function pe(', 'var ve=class') + between(network, 'function yr(', 'function br(');
  return between(network, 'function fe(', 'var _e=class') + between(network, 'function vr(', 'function yr(');
}
async function petCase(loader, home, unix) {
  const o = { rt: () => home, at: () => home }, sandbox = { Buffer, Response, n: packedRequire('.vite/build/zod-ClKgiFhi.js'), o, Vn: () => 'Ubuntu', [source1002 ? 'Gz' : source7945 ? 'rB' : latestSource ? 'nB' : currentSource ? 'rB' : 'eB']: { default: () => 'probe-pet' } };
  vm.createContext(sandbox);
  const bootstrap = packed(modulePath(petPatch)), fsUtils = 'let ' + between(bootstrap, 'W={async readFile(', source1002 ? 'async function Ga(' : currentSource ? 'async function qa(' : 'async function $a(');
  vm.runInContext(pathHelpers() + ';Object.assign(o,{'+ (latestSource ? 'Vt' : 'zt') + ':' + (currentSource ? '_e' : 'ge') + '});' + fsUtils + loader + ';globalThis.api=' + (source1002 ? '{load:Zz,loadAvatar:Qz,install:eB}' : source7945 ? '{load:lB,loadAvatar:uB,install:fB}' : latestSource ? '{load:cB,loadAvatar:lB,install:dB}' : currentSource ? '{load:lB,loadAvatar:uB,install:fB}' : '{load:oB,loadAvatar:sB,install:lB}') + ';', sandbox);
  const platform = unix ? path.posix : path.win32, normalizedHome = unix ? (latestSource ? o.Vt : o.zt)(home) : home, petRoot = platform.join(normalizedHome, 'pets'), legacyRoot = platform.join(normalizedHome, 'avatars');
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
  const bootstrap = packed(modulePath(petPatch)), loader = 'let ' + between(bootstrap, source1002 ? 'Kz=1536,' : source7945 ? 'iB=1536,' : latestSource ? 'rB=1536,' : currentSource ? 'iB=1536,' : 'tB=1536,', source1002 ? 'function lB(' : source7945 ? 'function xB(' : latestSource ? 'function bB(' : currentSource ? 'function xB(' : 'function vB('), patched = petPatch.apply(loader, app.replaceExactlyOnce);
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
  const source = packed(modulePath(browserPatch)), patched = browserPatch.apply(source, app.replaceExactlyOnce);
  const stockFn = vm.runInNewContext('(' + browserPatch.before + ')'), patchedFn = vm.runInNewContext('(' + browserPatch.after + ')');
  const names = ['areRequirementsPending', 'isBrowserAgentGateEnabled', 'isBrowserAndComputerUseAllowed', 'isBrowserEnabled', 'isBrowserUseEnabled', 'isLoading', 'runCodexInWsl'];
  let changed = 0;
  for (let mask = 0; mask < 256; mask++) {
    const options = Object.fromEntries(names.map((name, index) => [name, Boolean(mask & (1 << index))])); options.windowType = mask & 128 ? 'chrome-extension' : 'default';
    const before = stockFn(options), after = patchedFn(options);
    if (before !== after) { changed++; assert.equal(before, 'wsl-disabled'); assert.equal(after, 'available'); assert.equal(options.runCodexInWsl, true); }
  }
  assert(changed > 0);
  const external = between(source, source1002 ? 'function iGr(' : newestSource ? 'function HBr(' : latestSource ? 'function VBr(' : currentSource ? 'function HBr(' : 'function _Br(', source1002 ? 'var aGr;' : newestSource ? 'var UBr;' : latestSource ? 'var HBr;' : currentSource ? 'var UBr;' : 'var vBr;');
  assert(patched.includes(external), 'External browser gate changed');
});
function generator(source, platform, useWsl, servicePath, backends) {
  const fn = between(source, source1002 ? 'function $s(' : currentSource ? 'function rc(' : 'function cc(', source1002 ? 'function ec(' : currentSource ? 'function ic(' : 'function lc('), native = vm.runInNewContext(pathHelpers() + (currentSource ? ';yr' : ';vr'));
  const sandbox = {
    tc: { info: () => {}, warning: () => {} }, r: { Jo: () => true, Vt: () => servicePath.slice(0, -'/scripts/browser-service.mjs'.length), yo: 'browser', Bo: 'request', Wo: 'trusted-services', Go: options => options },
    o: { st: native, zt: value => value }, d: { t: { Dev: 'dev', resolve: () => 'release', isInternal: () => false } }, P: { default: { env: {} } },
    uc: value => value, lc: () => ({}), nc: {}, rc: {}, ha: () => ({}),
    Ui: 'trace', In: 'backends', Ln: 'tinysky', Vi: 'iab-origin', Hi: 'chrome-origin', da: 'sky-origin', Lee: 'flavor', Ree: 'version', ic: 'iab', ac: 'chrome', oc: 'sky', pa: 'sky-pipe', $s: 'host-pipe',
  };
  if (currentSource) Object.assign(sandbox, { Xs: sandbox.tc, r: { Zo: () => true, Ut: () => servicePath.slice(0, -'/scripts/browser-service.mjs'.length), So: 'browser', Uo: 'request', qo: 'trusted-services', Jo: options => options }, ac: () => '', ic: () => ({}), Zs: [], Qs: [], Wi: 'trace', Gn: 'backends', Kn: 'tinysky', Hi: 'iab-origin', Ui: 'chrome-origin', xa: 'sky-origin', Dee: 'flavor', Oee: 'version', $s: 'iab', ec: 'chrome', tc: 'sky', Da: () => ({}) });
  if (latestSource) Object.assign(sandbox, {
    r: { es: () => true, Wt: () => servicePath.slice(0, -'/scripts/browser-service.mjs'.length), To: 'browser', Ko: 'request', Xo: 'trusted-services', Zo: options => options },
    o: { lt: native, Vt: value => value }, Ki: 'trace', qn: 'backends', Jn: 'tinysky', Wi: 'iab-origin', Gi: 'chrome-origin', Sa: 'sky-origin', Eee: 'flavor', Dee: 'version', Oa: () => ({}),
  });
  if (source1002) Object.assign(sandbox, {
    Ks: sandbox.Xs, u: sandbox.d, M: sandbox.P, tc: () => '', ec: () => ({}), qs: [], Js: [],
    r: { fs: () => true, Bt: () => servicePath.slice(0, -'/scripts/browser-service.mjs'.length), Lo: 'browser', is: 'request', cs: 'trusted-services', ls: options => options },
    Ui: 'trace', Un: 'backends', Wn: 'tinysky', Vi: 'iab-origin', Hi: 'chrome-origin', ya: 'sky-origin', kee: 'flavor', Aee: 'version', Ys: 'iab', Xs: 'chrome', Zs: 'sky', Ta: () => ({}),
  });
  const code = vm.runInNewContext('(' + fn + ')', sandbox);
  return code({ appVersion: 'version', codexHome: 'home', marketplaceName: 'market', availableBrowserUseBackends: backends, browserUseTinysky: false, computerUse: false, enforceModelCheck: true, computerUseNativePipePath: null, computerUsePaths: {}, hostServicesPipePath: null, includePrivateProcessEnv: false, runtimePaths: { platform, nodePath: 'node', nodeReplPath: 'repl', codexCliPath: 'cli', nodeModuleDirs: [] }, shouldUseWslPaths: useWsl });
}
sourceTest('actual trusted-service generator fixes native Windows mount paths only under WSL and retains all other generated fields', () => {
  const source = packed(modulePath(servicePatch)), patched = servicePatch.apply(source, app.replaceExactlyOnce);
  let changed = 0, cases = 0;
  for (const platform of ['win32', 'linux', 'darwin']) for (const useWsl of [false, true]) for (const root of ['/mnt/c/Profile User/.codex', '/mnt/d/Other/.codex', 'C:\\Profile User\\.codex', '/home/user/.codex', '\\\\wsl.localhost\\Ubuntu\\home\\user\\.codex']) for (const backends of [[], ['iab'], ['chrome']]) {
    const servicePath = root + '/scripts/browser-service.mjs', before = generator(source, platform, useWsl, servicePath, backends), after = generator(patched, platform, useWsl, servicePath, backends); cases++;
    const beforeServices = before.extraEnv['trusted-services'], afterServices = after.extraEnv['trusted-services'];
    if (beforeServices !== afterServices) { changed++; assert.equal(platform, 'win32'); assert.equal(useWsl, true); assert(backends.length > 0); assert.equal(JSON.parse(afterServices).browser, vm.runInNewContext(pathHelpers() + (currentSource ? ';yr' : ';vr'))(servicePath, null)); }
    after.extraEnv['trusted-services'] = beforeServices;
    assert.deepEqual(JSON.parse(JSON.stringify(after)), JSON.parse(JSON.stringify(before)), 'Unrelated generator option changed');
  }
  assert.equal(cases, 90); assert(changed > 0);
  const regression = generator(source, 'win32', true, '/mnt/c/User/.codex/scripts/browser-service.mjs', ['iab']);
  assert.equal(JSON.parse(regression.extraEnv['trusted-services']).browser, '/mnt/c/User/.codex/scripts/browser-service.mjs');
});
sourceTest('actual native membership synchronizer migrates and persists explicit projects for new chats, moves and clearing', async () => {
  const source = packed(modulePath(membershipPatch)), patched = membershipPatch.apply(source, app.replaceExactlyOnce);
  const gate = text => between(text, source1002 ? 'f=()=>{d.setThreadAssignmentsEnabled(' : 'f=()=>{u.setThreadAssignmentsEnabled(', source1002 ? '};f(),this.disposables.add(ri(f))' : latestSource ? '};f(),this.disposables.add(oi(f))' : currentSource ? '};f(),this.disposables.add(ii(f))' : '};f(),this.disposables.add(ri(f))').slice('f=()=>{'.length);
  const enable = (text, flag) => {
    let enabled;
    vm.runInNewContext('(function(' + (source1002 ? 'd' : 'u') + ',' + (latestSource ? 'K' : currentSource ? 'q' : 'K') + '){' + gate(text) + '})')({ setThreadAssignmentsEnabled: value => { enabled = value; } }, () => ({ localProjectTaskMembership: flag }));
    return enabled;
  };
  assert.equal(enable(source, false), false); assert.equal(enable(source, true), true);
  assert.equal(enable(patched, false), true); assert.equal(enable(patched, true), true);
  const keys = { THREAD_PROJECT_ASSIGNMENTS: 'assignments', PROJECTLESS_THREAD_IDS: 'projectless', LOCAL_PROJECTS: 'projects', APP_SERVER_PROJECTS_MIGRATION_BY_HOST: 'migration' };
  const record = {
    assignments: { engineering: { projectKind: 'local', projectId: 'legacy-engineering' }, research: { projectKind: 'local', projectId: 'legacy-research' }, archived: { projectKind: 'local', projectId: 'legacy-research' }, absent: { projectKind: 'local', projectId: 'legacy-engineering' } },
    projectless: [], projects: { 'legacy-engineering': { name: 'Engineering' }, 'legacy-research': { name: 'Research' } },
    migration: { 'local:canonical': { version: 1, projectsMigrated: true, threadAssignmentsMigrated: false } },
  };
  // Deliberately share cwd: identity must come from the recorded assignment.
  const threads = new Map(['engineering', 'research', 'archived', 'unassigned', 'new', 'disabled-new', 'remote'].map(id => [id, { id, projectId: null, cwd: '/same/directory', archived: id === 'archived' }]));
  const projectIds = { 'legacy-engineering': 'server-engineering', 'legacy-research': 'server-research' };
  const calls = [], signal = { throwIfAborted() {} };
  let enabled = enable(source, false);
  const context = { h3: 100, g3: 8, V: { setTimeout: async () => {} }, o: { Gt: error => error?.code }, r: {
    Xo: keys, es: id => id, u: ['cli', 'vscode', 'exec', 'mcp', 'unknown'],
    s: (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null),
  } };
  if (currentSource) { context.l4 = 100; context.u4 = 8; context.r.$o = keys; }
  if (latestSource) { context.r.ns = keys; context.o.qt = context.o.Gt; }
  if (source1002) { context.d4 = 100; context.f4 = 8; context.ne = context.V; context.r.ms = keys; context.r.Wi = context.r.u; context.r.c = context.r.s; context.r.vs = id => id; }
  const synchronizerSource = between(source, source1002 ? 'hVe=class{' : latestSource ? 'gBe=class{' : currentSource ? 'hBe=class{' : 'pVe=class{', source1002 ? '},gVe=' : latestSource ? '},_Be=' : currentSource ? '},gBe=' : '},mVe=').slice(4) + '}';
  const helpers = between(source, source1002 ? 'async function u4(' : currentSource ? 'async function c4(' : 'async function m3(', source1002 ? 'var d4=' : currentSource ? 'var l4=' : 'var h3=');
  const Synchronizer = vm.runInNewContext(helpers + '\n(' + synchronizerSource + ')', context);
  const state = { get: key => record[key], set: (key, value) => { record[key] = value; }, update: (key, fn) => { record[key] = fn(record[key]); } };
  const connection = { sendAppServerRequest: async (method, params) => {
    calls.push({ method, params: JSON.parse(JSON.stringify(params)) });
    if (method === 'thread/list') return { data: [...threads.values()].filter(t => !t.archived).map(t => ({ ...t })), nextCursor: null };
    if (method === 'thread/read') return { thread: { ...threads.get(params.threadId) } };
    assert.equal(method, 'thread/metadata/update');
    assert(['server-engineering', 'server-research', ''].includes(params.projectId));
    threads.get(params.threadId).projectId = params.projectId || null;
    return {};
  } };
  const sync = new Synchronizer(state, connection, id => projectIds[id], () => enabled, id => Object.keys(projectIds).find(key => projectIds[key] === id));
  const updates = () => calls.filter(call => call.method === 'thread/metadata/update');
  const assignment = id => ({ projectKind: 'local', projectId: id });
  const write = async (threadId, value, ready = true, host = 'local') => sync.write(threadId, value, async () => {
    if (value) record.assignments[threadId] = value; else delete record.assignments[threadId];
  }, async () => ready, signal, undefined, host);
  await sync.migrate('local:canonical', signal);
  await write('disabled-new', assignment('legacy-engineering'));
  assert.equal(calls.length, 0); assert.equal(threads.get('disabled-new').projectId, null);
  enabled = enable(patched, false);
  await sync.migrate('local:canonical', signal);
  assert.equal(threads.get('engineering').projectId, 'server-engineering');
  assert.equal(threads.get('research').projectId, 'server-research');
  assert.equal(threads.get('disabled-new').projectId, 'server-engineering');
  assert.equal(threads.get('unassigned').projectId, null);
  assert.equal(threads.get('archived').projectId, null);
  assert(record.migration['local:canonical'].pendingThreadAssignmentIds.includes('archived'));
  assert(record.migration['local:canonical'].pendingThreadAssignmentIds.includes('absent'));
  assert.equal(record.migration['local:canonical'].threadAssignmentsMigrated, true);
  assert.equal(record.migration['local:canonical'].threadAssignmentsReadMigrated, true);
  const beforeRepeat = updates().length;
  await sync.migrate('local:canonical', signal); assert.equal(updates().length, beforeRepeat);
  await write('new', assignment('legacy-research')); assert.equal(threads.get('new').projectId, 'server-research');
  await write('new', assignment('legacy-engineering')); assert.equal(threads.get('new').projectId, 'server-engineering');
  await write('new', null); assert.equal(threads.get('new').projectId, null); assert.equal(updates().at(-1).params.projectId, '');
  const beforeGuards = updates().length;
  await write('new', assignment('legacy-research'), false); // Backend not ready.
  await write('remote', assignment('legacy-engineering'), true, 'remote-host');
  assert.equal(updates().length, beforeGuards);
  enabled = false; await write('new', assignment('legacy-engineering')); assert.equal(updates().length, beforeGuards);

  // Exercise the actual initial-project getter used by readCreationInputs.
  const start = vm.runInNewContext('({' + between(source, 'async getThreadStartProjectId(e){', 'async writeThreadAssignment(') + '})').getThreadStartProjectId;
  let ready = 0;
  const backend = { threadAssignmentsEnabled: false, projectSupport: 'supported', ensureProjectsReady: async () => { ready++; }, threadAssignments: sync };
  assert.equal(await start.call(backend, assignment('legacy-engineering')), null); assert.equal(ready, 0);
  backend.threadAssignmentsEnabled = true;
  assert.equal(await start.call(backend, assignment('legacy-engineering')), 'server-engineering');
  backend.projectSupport = 'unsupported'; assert.equal(await start.call(backend, assignment('legacy-engineering')), null);
  assert.equal(await start.call(backend, { projectKind: 'remote', projectId: 'other' }), null);
  const rendererPath = asar.listEntries(archive.tree).find(entry => /^webview\/assets\/app-initial-[^/]+\.js$/.test(entry.path)).path;
  const creation = vm.runInNewContext('({' + between(packed(rendererPath), 'async readCreationInputs(e,t){', 'async readPrewarmInputs(') + '})', {
    [source1002 ? 'wu' : newestSource ? 've' : latestSource ? '_e' : currentSource ? 'Se' : 'qc']: { threadProjectAssignments: { getThreadStartProjectId: value => start.call(backend, value) } },
  }).readCreationInputs;
  const runtime = { params: { hostId: 'local' }, readInputs: async () => ({ hasDesktopRuntime: true }) };
  const inputs = { projectAssignment: assignment('legacy-research'), memoryPreferences: { useMemories: false } };
  backend.projectSupport = 'supported'; backend.threadAssignmentsEnabled = false;
  assert.equal((await creation.call(runtime, inputs)).projectId, null);
  backend.threadAssignmentsEnabled = true;
  assert.equal((await creation.call(runtime, inputs)).projectId, 'server-research');
  runtime.params.hostId = 'remote-host'; assert.equal((await creation.call(runtime, inputs)).projectId, undefined);
});
sourceTest('all valid app-patch combinations are deterministic, source-gated and preserve unrelated entries', () => {
  const ids = app.listPatches().map(p => p.id);
  const combinations = Array.from({ length: 1 << ids.length }, (_, mask) => ids.filter((_, index) => mask & (1 << index)));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-patch-syntax-'));
  try {
    for (const selected of combinations) {
      const result = compose(original, selected), resultAgain = compose(original, selected);
      assert(result.buffer.equals(resultAgain.buffer)); assert.equal(result.changes.length, selected.length);
      const reviewed = result.build?.composedApp;
      if (reviewed && JSON.stringify(selected) === JSON.stringify(reviewed.selectedIds)) {
        assert.equal(result.outputArchiveHash, reviewed.archiveSha256);
        assert.equal(result.outputHeaderHash, reviewed.headerSha256);
        if (process.env.CODEX_SOURCE_EXE) {
          const executable = asar.updateExecutableIntegrity(fs.readFileSync(process.env.CODEX_SOURCE_EXE), result.sourceHeaderHash, result.outputHeaderHash);
          assert.equal(asar.sha256(executable), reviewed.executableSha256);
        }
      }
      for (const change of result.changes) {
        assert.equal(change.sourceHash, asar.sha256(asar.readEntry(archive, change.targetPath)));
        const patch = app.patchForSource(change.id, change.sourceHash);
        assert.equal(change.standaloneOutputHash, asar.sha256(Buffer.from(patch.apply(packed(change.targetPath), app.replaceExactlyOnce))));
      }
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
  const executable = fs.readFileSync(process.env.CODEX_SOURCE_EXE), result = compose(original, app.listPatches().map(p => p.id));
  if (result.build) assert.equal(asar.sha256(executable), result.build.executableSha256);
  else assert.equal(auditUnknown, true);
  const corrected = asar.updateExecutableIntegrity(executable, result.sourceHeaderHash, result.outputHeaderHash);
  const delta = []; for (let i = 0; i < executable.length; i++) if (executable[i] !== corrected[i]) delta.push(i);
  assert(delta.length > 0 && delta.length <= 64); assert(delta.at(-1) - delta[0] < 64);
  const resource = asar.executableResources(corrected).find(r => r.names.some(n => typeof n === 'string' && n.toLowerCase() === 'electronasar'));
  assert(corrected.subarray(resource.offset, resource.offset + resource.size).includes(Buffer.from(result.outputHeaderHash)));
});
