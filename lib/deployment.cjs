'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { transformArchive } = require('./app-patches.cjs');
const { sha256, updateExecutableIntegrity } = require('./asar.cjs');
const { resolveSelection } = require('./selection.cjs');
const compatibility = require('../compatibility/current.json');
const hashFile = file => sha256(fs.readFileSync(file));
function walk(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const rel = prefix + entry.name, full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Unexpected link in application tree: ' + rel);
    if (entry.isDirectory()) return walk(full, rel + '/');
    if (!entry.isFile()) throw new Error('Unexpected application entry: ' + rel);
    return [rel];
  });
}
function identify(source) {
  const archive = fs.readFileSync(path.join(source, 'resources/app.asar'));
  const build = compatibility.builds.find(b => b.archiveSha256 === sha256(archive));
  if (!build) throw new Error('Unsupported installed Codex build. Run inspect and review its compatibility report; launch stock explicitly if needed.');
  const binaries = {
    [build.executableRelativePath]: build.executableSha256,
    'resources/codex.exe': build.cliWindowsSha256,
    'resources/codex': build.cliLinuxSha256,
    'resources/codex-code-mode-host': build.codeModeLinuxSha256,
    'resources/codex-code-mode-host.exe': build.codeModeWindowsSha256,
    'resources/cua_node/bin/node.exe': build.nodeWindowsSha256
  };
  for (const [file, expected] of Object.entries(binaries)) {
    if (!expected || hashFile(path.join(source, file)) !== expected) throw new Error('Unreviewed binary: ' + file);
  }
  return { build, archive };
}
function buildCopy({ source, destination, config, packageFullName, packageFamilyName, toolkitRoot }) {
  source = path.resolve(source); destination = path.resolve(destination);
  if (source === destination || destination.startsWith(source + path.sep)) throw new Error('Output must be outside the installed package');
  if (fs.existsSync(destination)) throw new Error('Output already exists; generated copies are immutable');
  const { build, archive } = identify(source), selection = resolveSelection(config, build);
  const transformed = transformArchive(archive, selection.appPatches);
  const stage = destination + '.staging-' + crypto.randomUUID();
  try {
    fs.mkdirSync(stage, { recursive: true });
    const appDirectory = path.join(stage, 'app');
    const originalFiles = walk(source), files = [];
    fs.mkdirSync(appDirectory);
    for (const relative of originalFiles) {
      const original = path.join(source, relative), copy = path.join(appDirectory, relative);
      fs.mkdirSync(path.dirname(copy), { recursive: true });
      // Copy bytes into separate files. No hard links back into the Store package.
      fs.copyFileSync(original, copy);
      const sourceSha256 = hashFile(original);
      if (hashFile(copy) !== sourceSha256) throw new Error('Source changed while copying: ' + relative);
      files.push({ path: relative, sourceSha256, outputSha256: sourceSha256 });
    }
    fs.writeFileSync(path.join(appDirectory, 'resources/app.asar'), transformed.buffer);
    const executable = path.join(appDirectory, build.executableRelativePath);
    fs.writeFileSync(executable, updateExecutableIntegrity(fs.readFileSync(executable), transformed.sourceHeaderHash, transformed.outputHeaderHash));
    for (const file of files) file.outputSha256 = hashFile(path.join(appDirectory, file.path));
    for (const file of files) if (!['resources/app.asar', build.executableRelativePath].includes(file.path) && file.sourceSha256 !== file.outputSha256) throw new Error('Unrelated copy bytes changed');
    if (hashFile(path.join(source, 'resources/app.asar')) !== build.archiveSha256 || hashFile(path.join(source, build.executableRelativePath)) !== build.executableSha256) throw new Error('Installed source changed during build');
    // Snapshot runtime and launch code so a later git pull cannot alter a running deployment.
    const runtime = path.join(stage, 'toolkit');
    fs.mkdirSync(runtime);
    for (const item of ['bin','lib','patches','scripts','tools','compatibility','package.json','package-lock.json','codex-patches.ps1','config.example.json']) {
      fs.cpSync(path.join(toolkitRoot, item), path.join(runtime, item), { recursive: true, dereference: false, filter: file => !file.split(path.sep).includes('__pycache__') && !file.endsWith('.pyc') });
    }
    if (fs.existsSync(path.join(toolkitRoot, 'node_modules/ws'))) fs.cpSync(path.join(toolkitRoot, 'node_modules/ws'), path.join(runtime, 'node_modules/ws'), { recursive: true });
    const toolkitFiles = walk(runtime).map(file => ({ path:file, outputSha256:hashFile(path.join(runtime,file)) }));
    const revision = spawnSync('git', ['-C', toolkitRoot, 'rev-parse', 'HEAD'], { encoding:'utf8', windowsHide:true });
    const dirty = revision.status === 0 ? spawnSync('git', ['-C', toolkitRoot, 'status', '--porcelain'], { encoding:'utf8', windowsHide:true }) : null;
    const receipt = { schemaVersion:1, createdAt:new Date().toISOString(), packageFullName, packageFamilyName,
      toolkitVersion:JSON.parse(fs.readFileSync(path.join(runtime,'package.json'),'utf8')).version ?? null,
      toolkitRevision:revision.status === 0 ? revision.stdout.trim() : null,
      toolkitWorkingTreeDirty:dirty ? Boolean(dirty.stdout.trim()) : null,
      toolkitFingerprint:sha256(Buffer.from(JSON.stringify(toolkitFiles))),
      source, packageVersion:build.packageVersion, appVersion:build.appVersion, cliVersion:build.cliVersion,
      executableRelativePath:build.executableRelativePath, selection,
      sourceArchiveSha256:build.archiveSha256, outputHeaderSha256:transformed.outputHeaderHash,
      changes:transformed.changes, files, toolkitFiles };
    fs.writeFileSync(path.join(stage, 'receipt.json'), JSON.stringify(receipt,null,2)+'\n');
    fs.renameSync(stage, destination);
    return receipt;
  } catch(error) { fs.rmSync(stage, { recursive:true, force:true }); throw error; }
}
function verifyCopy(directory, { full = false } = {}) {
  const receipt = JSON.parse(fs.readFileSync(path.join(directory,'receipt.json'),'utf8').replace(/^\uFEFF/,''));
  if (receipt.schemaVersion !== 1) throw new Error('Unsupported receipt');
  const safePaths = list => { const names = list.map(f => f.path); if (new Set(names).size !== names.length || names.some(n => typeof n !== 'string' || n.startsWith('/') || n.includes('\\') || n.split('/').includes('..'))) throw new Error('Unsafe or duplicate receipt paths'); return names.sort(); };
  safePaths(receipt.files);
  const critical = ['resources/app.asar', receipt.executableRelativePath,'resources/codex','resources/codex.exe','resources/codex-code-mode-host','resources/codex-code-mode-host.exe','resources/cua_node/bin/node.exe','chrome.dll'];
  const files = full ? receipt.files : receipt.files.filter(file => critical.includes(file.path));
  for (const file of files) if (hashFile(path.join(directory,'app',file.path)) !== file.outputSha256) throw new Error('Generated app changed: '+file.path);
  const toolkitPaths = safePaths(receipt.toolkitFiles);
  if (JSON.stringify(walk(path.join(directory,'toolkit')).sort()) !== JSON.stringify(toolkitPaths)) throw new Error('Runtime source file set changed');
  for (const file of receipt.toolkitFiles) if (hashFile(path.join(directory,'toolkit',file.path)) !== file.outputSha256) throw new Error('Runtime source changed: '+file.path);
  if (full && JSON.stringify(walk(path.join(directory,'app')).sort()) !== JSON.stringify(safePaths(receipt.files))) throw new Error('Generated app file set changed');
  return { valid:true, filesVerified:files.length, toolkitFilesVerified:receipt.toolkitFiles.length, receipt };
}
module.exports = { identify, buildCopy, verifyCopy, hashFile, walk };
