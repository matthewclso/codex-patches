'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const python = process.env.CODEX_PATCHES_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const sourceTool = path.join(root, 'tools/legacy-source-cleanup.py');
const windows = process.platform === 'win32';
const literal = text => "'" + text.replaceAll("'", "''") + "'";
function powershell(code) {
  const executable = path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const input = "$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);" + code;
  const result = spawnSync(executable, ['-NoLogo','-NoProfile','-EncodedCommand',Buffer.from(input,'utf16le').toString('base64')], {encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.error?.message ?? result.stderr);
  return JSON.parse(result.stdout.trim());
}
function sourceFixture() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'codex-legacy-source-'));
  const home=path.join(directory,'home'), base=path.join(home,'.local/share/codex-wsl-patch-src'), version=path.join(base,'0.159.0');
  fs.mkdirSync(home);
  const references=[{version:'0.159.0',repository:'https://github.com/openai/codex.git',localPath:path.join(version,'codex'),buildScript:path.join(version,'build.sh')}];
  const invoke=(mode='plan',extra=[])=>spawnSync(python,[sourceTool,mode,'--home='+home,'--references='+JSON.stringify(references),...extra],{encoding:'utf8',timeout:15000});
  const create=()=>{fs.mkdirSync(path.join(version,'codex/codex-rs'),{recursive:true});fs.writeFileSync(path.join(version,'build.sh'),'cargo build\n');fs.writeFileSync(path.join(version,'codex/codex-rs/Cargo.toml'),'[workspace]\n');};
  return {directory,home,base,version,references,invoke,create,cleanup(){fs.rmSync(directory,{recursive:true,force:true});}};
}
// Source cleanup runs inside WSL; Windows exercises the PowerShell inventory.
test('historical Rust source plan records absent manifests without creating paths',{skip:windows},()=>{
  const f=sourceFixture();
  try {
    const result=f.invoke();assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),[{version:'0.159.0',path:f.version,status:'absent'}]);
    assert(!fs.existsSync(f.base));
    f.references[0].localPath=path.join(f.directory,'unrelated');
    assert.match(f.invoke().stderr,/outside the recognized layout/);
    assert(!fs.existsSync(f.base));
  } finally {f.cleanup();}
});
test('historical Rust source removal requires unchanged inventory and preserves unreferenced siblings',{skip:windows},()=>{
  const f=sourceFixture();
  try {
    f.create();const sibling=path.join(f.base,'user-work');fs.mkdirSync(sibling);fs.writeFileSync(path.join(sibling,'keep.txt'),'unrelated');
    const archive=path.join(f.directory,'private-archive');fs.mkdirSync(archive);
    const planned=f.invoke();assert.equal(planned.status,0,planned.stderr);const records=JSON.parse(planned.stdout);
    assert.equal(records[0].status,'removable');assert(fs.existsSync(f.version));
    fs.appendFileSync(path.join(f.version,'build.sh'),'changed\n');
    const refused=f.invoke('remove',['--expected='+JSON.stringify(records),'--archive='+archive]);
    assert.notEqual(refused.status,0);assert.match(refused.stderr,/inventory changed/);assert(fs.existsSync(f.version));assert(!fs.existsSync(path.join(archive,'source-cleanup.json')));
    const current=JSON.parse(f.invoke().stdout);
    const removed=f.invoke('remove',['--expected='+JSON.stringify(current),'--archive='+archive]);
    assert.equal(removed.status,0,removed.stderr);assert.equal(JSON.parse(removed.stdout).removedCount,1);
    assert(!fs.existsSync(f.version));assert.equal(fs.readFileSync(path.join(sibling,'keep.txt'),'utf8'),'unrelated');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(archive,'source-cleanup.json'),'utf8')).inventory,current);
  } finally {f.cleanup();}
});
test('historical source links are refused without traversing external data',{skip:windows},()=>{
  const f=sourceFixture();
  try {
    f.create();const outside=path.join(f.directory,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'keep.txt'),'external');
    fs.symlinkSync(outside,path.join(f.version,'linked'),windows?'junction':'dir');
    const result=f.invoke();assert.notEqual(result.status,0);assert.match(result.stderr,/contains links/);
    assert.equal(fs.readFileSync(path.join(outside,'keep.txt'),'utf8'),'external');assert(fs.existsSync(f.version));
  } finally {f.cleanup();}
});
test('running processes prevent historical source removal',{skip:windows},async()=>{
  const f=sourceFixture();f.create();
  const child=spawn(process.execPath,['-e','setTimeout(()=>{},30000)',path.join(f.version,'build.sh')],{stdio:'ignore'});
  try {
    await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
    const result=f.invoke();assert.notEqual(result.status,0);assert.match(result.stderr,/still in use/);assert(fs.existsSync(f.version));
  } finally {child.kill();await new Promise(resolve=>child.once('close',resolve));f.cleanup();}
});
test('Windows cleanup archives nested audits and probe state while excluding bundled app code',{skip:!windows},()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'codex-legacy-audits-'));
  const legacy=path.join(directory,'.codex-wsl-launcher'),archive=path.join(directory,'private-archive');
  const files={
    'remote-relay/activation-20260930.md':'activation audit',
    'remote-relay/deployment.json':'{"status":"fixture"}',
    'browser-copy/r1/path-fix-revision3/artifact-hashes.json':'{"hash":"fixture"}',
    'browser-copy/r1/probe-state-20260930/config.toml':'dated probe configuration',
    'pet-copy/r1/verification/probe-state/state_5.sqlite':'database fixture',
    'pet-copy/r1/verification/probe-state/skills/fixture/tool.py':'fixture data',
    'browser-sandbox/profile.dat':'browser data',
    'rollback/history.json':'{"rollback":true}',
    'remote-relay/node_modules/ws/package.json':'bundled module',
    'pet-copy/r1/app/resources/package.json':'bundled application',
    'remote-relay/runner.cjs':'executable patch',
  };
  for(const [name,content]of Object.entries(files)){const filename=path.join(legacy,name);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,content);}
  const dot=`. ${literal(path.join(root,'scripts/Common.ps1'))};. ${literal(path.join(root,'scripts/Cleanup-Legacy.ps1'))};`;
  try {
    const result=powershell(`${dot}$inventory=@(Get-LegacyAuditInventory ${literal(legacy)});Set-PrivateDirectory ${literal(archive)};Copy-LegacyAuditInventory ${literal(legacy)} ${literal(archive)} $inventory;@{paths=@($inventory|ForEach-Object{$_.relativePath});private=[IO.Directory]::GetAccessControl(${literal(archive)}).AreAccessRulesProtected}|ConvertTo-Json -Compress`);
    const expected=Object.keys(files).filter(name=>!name.includes('/app/')&&!name.includes('/node_modules/')&&!name.endsWith('.cjs')).sort();
    assert.deepEqual(result.paths.sort(),expected);assert.equal(result.private,true);
    for(const name of expected){assert.equal(fs.readFileSync(path.join(archive,name),'utf8'),files[name]);assert(fs.existsSync(path.join(legacy,name)));}
    assert(!fs.existsSync(path.join(archive,'remote-relay/runner.cjs')));
    fs.appendFileSync(path.join(legacy,'remote-relay/deployment.json'),'changed');
    const changed=powershell(`${dot}$inventory=@(Get-LegacyAuditInventory ${literal(legacy)});[IO.File]::AppendAllText(${literal(path.join(legacy,'remote-relay/deployment.json'))},'concurrent');$refused=$false;try{Copy-LegacyAuditInventory ${literal(legacy)} ${literal(path.join(directory,'changed-archive'))} $inventory}catch{$refused=$true};@{refused=$refused;sourceExists=Test-Path ${literal(legacy)}}|ConvertTo-Json -Compress`);
    assert.equal(changed.refused,true);assert.equal(changed.sourceExists,true);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
test('Windows cleanup refuses links inside excluded app directories',{skip:!windows},()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'codex-legacy-link-')),legacy=path.join(directory,'.codex-wsl-launcher'),outside=path.join(directory,'outside');
  try {
    fs.mkdirSync(path.join(legacy,'copy/app'),{recursive:true});fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'keep.json'),'external');
    fs.symlinkSync(outside,path.join(legacy,'copy/app/linked'),'junction');
    const result=powershell(`. ${literal(path.join(root,'scripts/Common.ps1'))};. ${literal(path.join(root,'scripts/Cleanup-Legacy.ps1'))};$refused=$false;try{Get-LegacyAuditInventory ${literal(legacy)}|Out-Null}catch{$refused=$true};@{refused=$refused}|ConvertTo-Json -Compress`);
    assert.equal(result.refused,true);assert.equal(fs.readFileSync(path.join(outside,'keep.json'),'utf8'),'external');
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
