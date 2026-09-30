'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { AppServerRpc } = require('../../patches/remote-fast-list/rpc.cjs');

async function probe(binary) {
  assert.equal(process.platform, 'linux', 'This probe must run in the Ubuntu WSL guest.');
  assert(binary && fs.existsSync(binary), 'Bundled stock Linux CLI is required.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-patches-ci-'));
  const home = path.join(dir, 'home'), sqlite = path.join(dir, 'sqlite');
  fs.mkdirSync(home, { mode: 0o700 }); fs.mkdirSync(sqlite, { mode: 0o700 });
  const rpc = new AppServerRpc(binary, home, sqlite, ['-c', 'cli_auth_credentials_store="file"']);
  const observations = [];
  try {
    const initialized = await rpc.initialize('codex-patches-ci');
    assert(initialized && typeof initialized === 'object');
    observations.push({ method: 'initialize', status: 'passed' });
    const name = 'Isolated CI project';
    const created = await rpc.request('project/create', {
      name, roots: [{ path: dir }], idempotencyKey: crypto.randomUUID(),
    });
    assert(created.project?.id, 'project/create did not return an ID');
    assert.equal(created.project.name, name);
    observations.push({ method: 'project/create', status: 'passed' });
    const listed = await rpc.request('thread/list', { limit: 10, useStateDbOnly: true });
    assert(Array.isArray(listed.data), 'thread/list did not return a data array');
    observations.push({ method: 'thread/list', status: 'passed', useStateDbOnly: true });
    const account = await rpc.request('account/read', {});
    assert.equal(account.account, null, 'Probe must remain unauthenticated.');
    observations.push({ method: 'account/read', status: 'passed', authenticated: false });
    return { schemaVersion: 1, status: 'passed', observations,
      scope: 'Bundled stock CLI under Ubuntu WSL2 with temporary home/database and no user credentials.' };
  } finally {
    await rpc.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
if (require.main === module) {
  const cli = process.argv[process.argv.indexOf('--cli') + 1];
  const out = process.argv[process.argv.indexOf('--out') + 1];
  if (!process.argv.includes('--cli') || !process.argv.includes('--out')) {
    console.error('Usage: node probe-app-server.cjs --cli <stock Linux CLI> --out <JSON>');
    process.exitCode = 1;
  } else probe(cli).then(report => {
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    console.log('Stock WSL app-server RPC probe passed.');
  }, error => {
    fs.writeFileSync(out, JSON.stringify({ schemaVersion: 1, status: 'failed', reason: error.message }, null, 2) + '\n');
    console.error('Stock WSL app-server RPC probe failed: ' + error.message);
    process.exitCode = 1;
  });
}
module.exports = { probe };
