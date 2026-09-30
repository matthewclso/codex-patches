'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const windows = process.platform === 'win32', root = path.resolve(__dirname, '..');
const literal = text => "'" + text.replaceAll("'", "''") + "'";
function powershell(code) {
  const executable = path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const result = spawnSync(executable, ['-NoLogo','-NoProfile','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);" + code, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return JSON.parse(result.stdout.trim());
}
test('Windows PowerShell 5.1 preserves UTF8 JSON through initial creation and replacement', { skip: !windows }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-patches-资料-')), filename = path.join(directory, 'settings.json');
  try {
    const result = powershell(`. ${literal(path.join(root, 'scripts/Common.ps1'))};$value=@{home='D:\\资料\\Example User';title='宠物'};Write-JsonFile ${literal(filename)} $value;$value.title='更新';Write-JsonFile ${literal(filename)} $value;$read=Read-JsonFile ${literal(filename)};@{value=$read;temporaryFiles=@(Get-ChildItem -LiteralPath ${literal(directory)} -Filter '*.tmp').Count;version=$PSVersionTable.PSVersion.Major}|ConvertTo-Json -Compress`);
    assert.equal(result.version, 5); assert.deepEqual(result.value, { home: 'D:\\资料\\Example User', title: '更新' }); assert.equal(result.temporaryFiles, 0);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('Windows native argument transport preserves empty, quoted, Unicode and trailing-backslash values', { skip: !windows }, () => {
  const expected = ['', 'plain', 'with space', 'quote"value', 'D:\\trail space\\', '资料'];
  const result = powershell(`. ${literal(path.join(root, 'scripts/Common.ps1'))};$output=Invoke-Native -Executable ${literal(process.execPath)} -Arguments (@('-e','process.stdout.write(JSON.stringify(process.argv.slice(1)))')+@(${expected.map(literal).join(',')}));$output`);
  assert.deepEqual(result, expected);
});
test('all shipped PowerShell files parse in Windows PowerShell 5.1', { skip: !windows }, () => {
  const names = [path.join(root, 'codex-patches.ps1'), ...fs.readdirSync(path.join(root, 'scripts')).filter(name => name.endsWith('.ps1')).map(name => path.join(root, 'scripts', name))];
  const result = powershell(`$all=@();foreach($file in @(${names.map(literal).join(',')})){$errors=$null;$tokens=$null;[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)|Out-Null;foreach($entry in $errors){$all+=@{file=$file;error=$entry.Message}}};@{errors=@($all)}|ConvertTo-Json -Compress`);
  assert.deepEqual(result.errors, []);
});

test('private directory setup is repeatable without requiring audit-policy privileges', { skip: !windows }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-patches-acl-'));
  try {
    const result = powershell(`. ${literal(path.join(root, 'scripts/Common.ps1'))};Set-PrivateDirectory ${literal(directory)};Set-PrivateDirectory ${literal(directory)};$acl=[IO.Directory]::GetAccessControl(${literal(directory)});@{protected=$acl.AreAccessRulesProtected;rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|ForEach-Object{$_.IdentityReference.Value})}|ConvertTo-Json -Compress`);
    assert.equal(result.protected, true);
    assert.equal(result.rules.length, 3);
    assert(result.rules.includes('S-1-5-18'));
    assert(result.rules.includes('S-1-5-32-544'));
    assert(!result.rules.includes('S-1-1-0'));
  } finally { fs.rmSync(directory, {recursive:true,force:true}); }
});

test('installed bootstrap checks the complete snapshot before executing its launcher or Launch.ps1', { skip: !windows }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-patches-bootstrap-资料-'));
  const deployment = path.join(directory, 'versions', 'fixture'), toolkit = path.join(deployment, 'toolkit');
  const bootstrap = path.join(directory, 'launch.ps1'), rootMarker = path.join(directory, 'root-executed'), launchMarker = path.join(directory, 'launch-executed'), tripwire = path.join(directory, 'tripwire');
  const source = fs.readFileSync(path.join(root, 'scripts', 'Install.ps1'), 'utf8');
  const body = source.match(/\$bootstrap = @'\r?\n([\s\S]*?)\r?\n'@/);
  assert(body, 'Install.ps1 must define the exact installed bootstrap');
  const hash = content => crypto.createHash('sha256').update(content).digest('hex');
  const rootScript = "param([string]$Command,[string]$InstallRoot)\n[IO.File]::WriteAllText((Join-Path $InstallRoot 'root-executed'),'executed')\n. (Join-Path $PSScriptRoot 'scripts\\Launch.ps1')\n";
  const launchScript = "[IO.File]::WriteAllText((Join-Path $InstallRoot 'launch-executed'),'executed')\n";
  const files = { 'codex-patches.ps1': rootScript, 'scripts/Launch.ps1': launchScript };
  const receipt = JSON.stringify({ schemaVersion: 1, toolkitFiles: Object.entries(files).map(([name, content]) => ({path: name, outputSha256: hash(content)})) });
  const invoke = () => powershell(`try { & ${literal(bootstrap)} -InstallRoot ${literal(directory)};@{success=$true} | ConvertTo-Json -Compress } catch { @{success=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress }`);
  const reset = () => {
    for (const marker of [rootMarker, launchMarker, tripwire]) fs.rmSync(marker, {force:true});
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(toolkit, name), content);
    fs.writeFileSync(path.join(deployment, 'receipt.json'), receipt);
  };
  try {
    fs.mkdirSync(path.join(toolkit, 'scripts'), {recursive:true});
    fs.writeFileSync(bootstrap, body[1]);
    fs.writeFileSync(path.join(directory, 'active.json'), JSON.stringify({schemaVersion:1,deployment}));
    fs.writeFileSync(path.join(deployment, 'install.json'), JSON.stringify({receiptSha256:hash(receipt)}));
    reset();
    assert.deepEqual(invoke(), {success:true});
    assert(fs.existsSync(rootMarker)); assert(fs.existsSync(launchMarker));
    for (const name of Object.keys(files)) {
      reset();
      const injection = "[IO.File]::WriteAllText((Join-Path $InstallRoot 'tripwire'),'unsafe execution')\n";
      fs.writeFileSync(path.join(toolkit, name), name === 'codex-patches.ps1' ? rootScript.replace('\n', '\n' + injection) : injection + launchScript);
      const result = invoke();
      assert.equal(result.success, false, name); assert.match(result.error, /Runtime source changed/, name);
      assert(!fs.existsSync(tripwire), name); assert(!fs.existsSync(rootMarker), name); assert(!fs.existsSync(launchMarker), name);
    }
    reset();
    fs.writeFileSync(path.join(toolkit, 'extra.ps1'), "[IO.File]::WriteAllText((Join-Path $InstallRoot 'tripwire'),'unsafe execution')");
    assert.match(invoke().error, /Runtime source file set changed/);
    assert(!fs.existsSync(rootMarker)); assert(!fs.existsSync(launchMarker)); assert(!fs.existsSync(tripwire));
    fs.rmSync(path.join(toolkit, 'extra.ps1')); reset();
    fs.appendFileSync(path.join(deployment, 'receipt.json'), ' ');
    assert.match(invoke().error, /Installation receipt changed/);
    assert(!fs.existsSync(rootMarker)); assert(!fs.existsSync(launchMarker));
  } finally { fs.rmSync(directory, {recursive:true,force:true}); }
});
