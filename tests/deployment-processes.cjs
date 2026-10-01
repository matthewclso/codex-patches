'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const windows = process.platform === 'win32';
const python = process.env.CODEX_PATCHES_PYTHON ?? 'python3';
const literal = text => "'" + text.replaceAll("'", "''") + "'";
function powershell(code) {
  const result = spawnSync(path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoLogo', '-NoProfile', '-EncodedCommand', Buffer.from("$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);" + code, 'utf16le').toString('base64')],
    { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return JSON.parse(result.stdout.trim());
}
function linux(deployment, expected) {
  const result = spawnSync(python, [path.join(root, 'tools/deployment-processes.py'), deployment,
    ...(expected ? ['--terminate', JSON.stringify(expected)] : [])], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return JSON.parse(result.stdout);
}
async function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-processes-'));
  const deployment = path.join(directory, 'deployment with spaces');
  const children = [];
  fs.mkdirSync(deployment);
  for (const name of ['app-server', 'exec']) fs.writeFileSync(path.join(directory, name), idle);
  return {
    directory, deployment,
    copy(name) {
      const destination = path.join(deployment, name);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(process.execPath, destination);
      return destination;
    },
    async start(executable, args, options = {}) {
      const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
      const closed = new Promise(resolve => child.once('close', resolve));
      children.push({ child, closed });
      // Every fixture signals readiness after loading its executable/script.
      await new Promise((resolve, reject) => {
        child.stdout.once('data', resolve);
        child.once('error', reject);
        child.once('exit', code => reject(new Error('Fixture exited before ready: ' + code)));
      });
      return child;
    },
    async cleanup() {
      for (const { child } of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await Promise.all(children.map(({ closed }) => closed));
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
const idle = "process.stdout.write('ready');setInterval(()=>{},1000)";
const alive = child => { try { process.kill(child.pid, 0); return true; } catch { return false; } };

test('backend detection distinguishes actual subcommands from prompts, option values and help tooling', () => {
  const cases = [
    [['app-server'], true],
    [['--strict-config', '-c', 'model="test model"', 'app-server', '--listen', 'stdio://'], true],
    [['--model', 'app-server', 'exec', 'prompt'], false],
    [['exec', 'app-server'], false],
    [['review', 'please inspect app-server behavior'], false],
    [['--enable', 'app-server'], false],
    [['--', 'app-server'], false],
    [['app-server', '--help'], false],
    [['app-server', 'generate-ts'], false],
    [['--help', 'app-server'], false],
  ];
  let result;
  if (windows) {
    const invocations = cases.map(([args]) => `Test-WindowsAppServerCommand ((@('codex.exe',${args.map(literal).join(',')})|ForEach-Object {Quote-NativeArgument $_}) -join ' ')`).join(';');
    result = powershell(`. ${literal(path.join(root, 'scripts/Common.ps1'))};. ${literal(path.join(root, 'scripts/Maintain.ps1'))};ConvertTo-Json -InputObject @(${invocations}) -Compress`);
  } else {
    const code = "import importlib.util,json,sys;sys.dont_write_bytecode=True;spec=importlib.util.spec_from_file_location('processes',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);print(json.dumps([m.app_server(args) for args in json.loads(sys.argv[2])]))";
    const output = spawnSync(python, ['-c', code, path.join(root, 'tools/deployment-processes.py'), JSON.stringify(cases.map(([args]) => args))], { encoding: 'utf8', timeout: 10000 });
    assert.equal(output.status, 0, output.stderr);
    result = JSON.parse(output.stdout);
  }
  assert.deepEqual(result, cases.map(([, expected]) => expected));
});

test('Windows activation distinguishes old app/backend from independent tools and force closes only blockers', { skip: !windows }, async () => {
  const f = await fixture();
  const dot = `. ${literal(path.join(root, 'scripts/Maintain.ps1'))};function Get-DeploymentProcesses([string]$Deployment){Get-WindowsDeploymentProcesses $Deployment};`;
  const scan = (deployment = f.deployment) => powershell(`${dot}ConvertTo-Json -InputObject @(Get-DeploymentProcesses ${literal(deployment)}) -Compress`);
  const activate = force => powershell(`${dot}try { Assert-DeploymentCanActivate ${literal(f.deployment)} 'prepared-copy' ${force ? '-ForceClose' : ''} 6>$null;@{allowed=$true}|ConvertTo-Json -Compress } catch { @{allowed=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress }`);
  try {
    const app = await f.start(f.copy('app/ChatGPT.exe'), ['-e', idle]);
    const cli = f.copy('app/resources/codex.exe');
    const backend = await f.start(cli, ['app-server'], { cwd: f.directory });
    const review = await f.start(process.execPath, ['-e', idle, '--', '--cli=' + cli]);
    const worker = await f.start(f.copy('app/resources/cua_node/bin/node_repl.exe'), ['-e', idle]);
    const command = await f.start(cli, ['exec', 'app-server'], { cwd: f.directory });
    const unrelated = await f.start(process.execPath, ['-e', idle, 'app-server']);
    const records = scan();
    const blockerIds = [app.pid, backend.pid].sort();
    assert.deepEqual(records.filter(p => p.activationBlocker).map(p => p.pid).sort(), blockerIds);
    const alias = powershell(`ConvertTo-Json ((New-Object -ComObject Scripting.FileSystemObject).GetFolder(${literal(f.deployment)}).ShortPath)`);
    assert.deepEqual(scan(alias).filter(p => p.activationBlocker).map(p => p.pid).sort(), blockerIds, '8.3 paths must identify the same blocking processes');
    for (const child of [review, worker, command]) assert.equal(records.find(p => p.pid === child.pid)?.activationBlocker, false);
    assert(!records.some(p => p.pid === unrelated.pid));
    const blocked = activate(false);
    assert.equal(blocked.allowed, false);
    assert.match(blocked.error, /ChatGPT\.exe \(PID \d+\)/);
    assert.match(blocked.error, /codex\.exe \(PID \d+\)/);
    assert.match(blocked.error, /install -ForceClose/);
    assert(alive(app)); assert(alive(backend));
    // A stale process identity must not be terminated, even when its PID matches.
    powershell(`${dot}$p=@(Get-DeploymentProcesses ${literal(f.deployment)}|Where-Object {$_.pid -eq ${app.pid}});$p[0].startToken='stale';Stop-DeploymentBlockers ${literal(f.deployment)} $p 6>$null;@{done=$true}|ConvertTo-Json -Compress`);
    assert(alive(app));
    assert.deepEqual(activate(true), { allowed: true });
    assert(!scan().some(p => p.activationBlocker));
    for (const child of [review, worker, command, unrelated]) assert(alive(child), 'ForceClose must preserve independent processes');
    assert.deepEqual(activate(false), { allowed: true });
    assert.equal(powershell(`${dot}ConvertTo-Json (Test-DeploymentInUse ${literal(f.deployment)})`), true, 'Cleanup must retain a deployment still used by tools');
    // Even explicitly passing helper records to termination must revalidate roles.
    powershell(`${dot}Stop-DeploymentBlockers ${literal(f.deployment)} @(Get-DeploymentProcesses ${literal(f.deployment)}) 6>$null;@{done=$true}|ConvertTo-Json -Compress`);
    for (const child of [review, worker, command]) assert(alive(child));
  } finally { await f.cleanup(); }
});

test('ForceClose is rejected outside install before any command runs', { skip: !windows }, () => {
  const result = powershell(`try { & ${literal(path.join(root, 'codex-patches.ps1'))} uninstall -Apply -ForceClose;@{rejected=$false}|ConvertTo-Json -Compress } catch { @{rejected=$true;error=$_.Exception.Message}|ConvertTo-Json -Compress }`);
  assert.equal(result.rejected, true);
  assert.match(result.error, /available only with install/);
});

test('WSL activation detects owned backends and protects independent review, worker and working-directory users', { skip: windows }, async () => {
  const f = await fixture();
  try {
    const cli = f.copy('app/resources/codex');
    const backend = await f.start(cli, ['app-server'], { cwd: f.directory });
    const review = await f.start(process.execPath, ['-e', idle, '--', '--cli=' + cli]);
    const worker = await f.start(f.copy('app/resources/node'), ['-e', idle]);
    const command = await f.start(cli, ['exec', 'app-server'], { cwd: f.directory });
    const cwdUser = await f.start(process.execPath, ['-e', idle], { cwd: f.deployment });
    const unrelated = await f.start(process.execPath, ['-e', idle, 'app-server']);
    const records = linux(f.deployment);
    assert.deepEqual(records.filter(p => p.activationBlocker).map(p => p.pid), [backend.pid]);
    for (const child of [review, worker, command, cwdUser]) assert.equal(records.find(p => p.pid === child.pid)?.activationBlocker, false);
    assert(!records.some(p => p.pid === unrelated.pid));
    const stale = { ...records.find(p => p.pid === backend.pid), startToken: 'stale' };
    assert.deepEqual(linux(f.deployment, [stale]), []); assert(alive(backend));
    assert.deepEqual(linux(f.deployment, records).map(p => p.pid), [backend.pid]);
    assert(!linux(f.deployment).some(p => p.activationBlocker));
    for (const child of [review, worker, command, cwdUser, unrelated]) assert(alive(child));
    assert(linux(f.deployment).length >= 4, 'Cleanup must retain copies still used by independent tools');
  } finally { await f.cleanup(); }
  assert.deepEqual(linux(f.deployment), []);
});

test('WSL supervisor through stable symlink and relay runner block activation, and ForceClose handles a stuck backend', { skip: windows }, async () => {
  const f = await fixture();
  try {
    const proxy = path.join(f.deployment, 'toolkit/patches/wsl-project-paths/proxy.py');
    const relay = path.join(f.deployment, 'toolkit/patches/remote-fast-list/runner.cjs');
    const link = path.join(f.directory, 'codex-patches-proxy');
    fs.mkdirSync(path.dirname(proxy), { recursive: true });
    fs.mkdirSync(path.dirname(relay), { recursive: true });
    fs.writeFileSync(proxy, "import signal,time\nsignal.signal(signal.SIGTERM,signal.SIG_IGN)\nprint('ready',flush=True)\ntime.sleep(60)\n");
    fs.writeFileSync(relay, idle);
    fs.symlinkSync(proxy, link);
    const supervisor = await f.start(python, [link, 'app-server']);
    const runner = await f.start(process.execPath, [relay]);
    const records = linux(f.deployment);
    assert.deepEqual(records.filter(p => p.activationBlocker).map(p => p.pid).sort(), [supervisor.pid, runner.pid].sort());
    assert.deepEqual(linux(f.deployment, records).map(p => p.pid).sort(), [supervisor.pid, runner.pid].sort());
    assert.deepEqual(linux(f.deployment), []);
    assert.deepEqual(linux(f.deployment, records), [], 'Exited processes can be safely retried');
  } finally { await f.cleanup(); }
});
