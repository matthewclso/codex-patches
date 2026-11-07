'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const windows = process.platform === 'win32';
const literal = value => "'" + value.replaceAll("'", "''") + "'";

function powershell(code) {
  const result = spawnSync(path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoLogo', '-NoProfile', '-EncodedCommand', Buffer.from("$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);" + code, 'utf16le').toString('base64')],
    { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return JSON.parse(result.stdout.trim());
}

function fixture() {
  // Hosted Windows TEMP can use an 8.3 alias; Get-ChildItem returns long paths.
  const directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'codex-cleanup-')));
  const versions = path.join(directory, 'versions');
  const deployments = {};
  for (const name of ['active', 'locked', 'unused', 'protected']) {
    const deployment = path.join(versions, name);
    const runtime = path.join(directory, 'runtime', name, 'runtime.json');
    fs.mkdirSync(path.join(deployment, 'app', 'resources'), { recursive: true });
    fs.mkdirSync(path.dirname(runtime), { recursive: true });
    fs.writeFileSync(runtime, '{"private":"retained"}');
    const install = JSON.stringify({ runtimeConfig: runtime, stateRoot: path.join(directory, 'runtime') });
    const receipt = '{"schemaVersion":1,"fixture":"ownership"}\n';
    fs.writeFileSync(path.join(deployment, 'install.json'), install);
    fs.writeFileSync(path.join(deployment, 'receipt.json'), receipt);
    fs.writeFileSync(path.join(deployment, 'app', 'resources', 'payload.bin'), 'unused code');
    deployments[name] = { deployment, runtime, install, receipt };
  }
  const unknown = path.join(versions, 'unrecognized');
  fs.mkdirSync(unknown);
  fs.writeFileSync(path.join(unknown, 'keep.txt'), 'unowned');
  const data = path.join(directory, 'user-data.json');
  fs.writeFileSync(data, 'shared user data');
  const dot = `
    . ${literal(path.join(root, 'scripts/Common.ps1'))};
    . ${literal(path.join(root, 'scripts/Maintain.ps1'))};
    $InstallRoot=${literal(directory)};$Apply=$true;
    function Get-ActiveRuntime { @{active=@{deployment=${literal(deployments.active.deployment)}}} }
    function Test-DeploymentInUse([string]$Deployment) { $Deployment -eq ${literal(deployments.protected.deployment)} }
    $script:RuntimeCalls=@();
    # Exercise actual Windows deletion; replace only the WSL transport boundary.
    function Invoke-WslPython([string]$Code,[string[]]$Arguments) {
      $script:RuntimeCalls+=@{path=$Arguments[0];mode=$Arguments[2]};
      if($Arguments[2] -eq 'remove') {
        $name=Split-Path (Split-Path $Arguments[0] -Parent) -Leaf;
        if(Test-Path -LiteralPath (Join-Path ${literal(versions)} $name)) { throw 'Runtime configuration removed before Windows deployment.' }
        [IO.File]::Delete($Arguments[0]);
      }
    }
  `;
  return { directory, deployments, unknown, data, dot,
    cleanup() { fs.rmSync(directory, { recursive: true, force: true }); } };
}

for (const lock of ['nested file', 'app working directory', 'deployment working directory']) {
  test(`cleanup skips a locked ${lock}, preserves retry metadata and continues`, { skip: !windows }, () => {
    const f = fixture(), old = f.deployments.locked;
    const lockPath = lock === 'nested file' ? path.join(old.deployment, 'app/resources/payload.bin') :
      lock === 'app working directory' ? path.join(old.deployment, 'app') : old.deployment;
    const acquire = lock === 'nested file' ? `$handle=[IO.File]::Open(${literal(lockPath)},'Open','Read','Read');` :
      `$previous=[Environment]::CurrentDirectory;[Environment]::CurrentDirectory=${literal(lockPath)};`;
    const release = lock === 'nested file' ? '$handle.Dispose();' : '[Environment]::CurrentDirectory=$previous;';
    try {
      const result = powershell(`${f.dot}
        ${acquire}
        try {
          # The deletion must terminate on a lock even under Continue.
          $ErrorActionPreference='Continue';
          $messages=@(Remove-OldDeployments 6>&1 | ForEach-Object { $_.ToString() });
          $first=@{
            messages=$messages;
            install=[IO.File]::ReadAllText(${literal(path.join(old.deployment, 'install.json'))});
            receipt=[IO.File]::ReadAllText(${literal(path.join(old.deployment, 'receipt.json'))});
            runtime=Test-Path -LiteralPath ${literal(old.runtime)};
            unused=Test-Path -LiteralPath ${literal(f.deployments.unused.deployment)};
            unusedRuntime=Test-Path -LiteralPath ${literal(f.deployments.unused.runtime)};
          };
        } finally { ${release} }
        $ErrorActionPreference='Stop';
        $retry=@(Remove-OldDeployments 6>&1 | ForEach-Object { $_.ToString() });
        @{first=$first;retry=$retry;exists=Test-Path -LiteralPath ${literal(old.deployment)};
          runtime=Test-Path -LiteralPath ${literal(old.runtime)};calls=@($script:RuntimeCalls)} | ConvertTo-Json -Depth 6 -Compress;
      `);
      assert(result.first.messages.some(message => /In-use deployment skipped: locked.*retry cleanup -Apply/.test(message)));
      assert(!result.first.messages.includes('Removed locked'));
      assert(result.first.messages.includes('Removed unused'));
      assert.equal(result.first.install, old.install);
      assert.equal(result.first.receipt, old.receipt);
      assert.equal(result.first.runtime, true);
      assert.equal(result.first.unused, false);
      assert.equal(result.first.unusedRuntime, false);
      assert(result.retry.includes('Removed locked'));
      assert.equal(result.exists, false);
      assert.equal(result.runtime, false);
      assert.equal(result.calls.filter(call => call.path === old.runtime && call.mode === 'remove').length, 1);
      for (const name of ['active', 'protected']) {
        assert(fs.existsSync(f.deployments[name].deployment), `${name} deployment must be retained`);
        assert(fs.existsSync(f.deployments[name].runtime), `${name} runtime must be retained`);
      }
      assert.equal(fs.readFileSync(path.join(f.unknown, 'keep.txt'), 'utf8'), 'unowned');
      assert.equal(fs.readFileSync(f.data, 'utf8'), 'shared user data');
    } finally { f.cleanup(); }
  });
}

test('cleanup preview preserves payloads, metadata and runtime configuration', { skip: !windows }, () => {
  const f = fixture();
  try {
    const result = powershell(`${f.dot}$Apply=$false;$messages=@(Remove-OldDeployments 6>&1|ForEach-Object{$_.ToString()});@{messages=$messages;calls=@($script:RuntimeCalls)}|ConvertTo-Json -Depth 4 -Compress`);
    assert(result.messages.some(message => message.startsWith('Would remove unused.')));
    assert.deepEqual(result.calls, []);
    for (const entry of Object.values(f.deployments)) {
      assert(fs.existsSync(path.join(entry.deployment, 'app/resources/payload.bin')));
      assert.equal(fs.readFileSync(path.join(entry.deployment, 'install.json'), 'utf8'), entry.install);
      assert.equal(fs.readFileSync(path.join(entry.deployment, 'receipt.json'), 'utf8'), entry.receipt);
      assert(fs.existsSync(entry.runtime));
    }
  } finally { f.cleanup(); }
});

test('cleanup propagates unrelated deletion failures and preserves retry information', { skip: !windows }, () => {
  const f = fixture(), old = f.deployments.locked;
  try {
    const result = powershell(`${f.dot}
      function Remove-Item {
        [CmdletBinding()]param([string]$LiteralPath,[switch]$Recurse,[switch]$Force)
        throw [IO.IOException]::new('fixture unrelated I/O failure');
      }
      try { Remove-OldDeployments 6>$null;@{failed=$false}|ConvertTo-Json -Compress }
      catch { @{failed=$true;error=$_.Exception.Message;calls=@($script:RuntimeCalls)}|ConvertTo-Json -Depth 4 -Compress }
    `);
    assert.equal(result.failed, true);
    assert.match(result.error, /fixture unrelated I\/O failure/);
    assert(!result.calls.some(call => call.mode === 'remove'));
    assert.equal(fs.readFileSync(path.join(old.deployment, 'install.json'), 'utf8'), old.install);
    assert.equal(fs.readFileSync(path.join(old.deployment, 'receipt.json'), 'utf8'), old.receipt);
    assert(fs.existsSync(old.runtime));
  } finally { f.cleanup(); }
});

test('runtime cleanup validates ownership before removal and supports a non-mutating check', { skip: windows }, () => {
  const source = fs.readFileSync(path.join(root, 'scripts/Maintain.ps1'), 'utf8');
  const code = source.match(/\$runtimeCleanup = @'\r?\n([\s\S]*?)\r?\n'@/)[1];
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-runtime-cleanup-'));
  const runtime = path.join(directory, 'deployments', 'old', 'runtime.json');
  const invoke = (filename, mode) => spawnSync('python3', ['-c', code, filename, directory, mode], { encoding: 'utf8', timeout: 10000 });
  try {
    fs.mkdirSync(path.dirname(runtime), { recursive: true });
    fs.writeFileSync(runtime, 'private configuration');
    assert.equal(invoke(runtime, 'check').status, 0);
    assert.equal(fs.readFileSync(runtime, 'utf8'), 'private configuration');
    const outside = path.join(directory, 'runtime.json');
    fs.writeFileSync(outside, 'unowned');
    assert.match(invoke(outside, 'remove').stderr, /Unrecognized runtime path/);
    fs.symlinkSync(path.dirname(runtime), path.join(directory, 'deployments', 'link'), 'dir');
    assert.match(invoke(path.join(directory, 'deployments', 'link', 'runtime.json'), 'remove').stderr, /Unrecognized runtime path/);
    assert.equal(invoke(runtime, 'remove').status, 0);
    assert(!fs.existsSync(path.dirname(runtime)));
    assert.equal(fs.readFileSync(outside, 'utf8'), 'unowned');
    assert.equal(invoke(runtime, 'remove').status, 0, 'retry tolerates an already absent configuration');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
