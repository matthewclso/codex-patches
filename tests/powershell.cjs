'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
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
