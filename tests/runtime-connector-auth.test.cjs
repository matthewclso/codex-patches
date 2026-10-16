'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { AppServerRpc } = require('../patches/remote-fast-list/rpc.cjs');
const binary = process.env.CODEX_RELAY_TEST_BINARY;

test('stock hosted Apps transport loses managed authentication at a loopback backend', {
  skip: !binary || process.platform === 'win32', timeout: 45000,
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-connector-auth-'));
  const home = path.join(root, 'home'), sqlite = path.join(home, 'sqlite');
  fs.mkdirSync(sqlite, { recursive: true, mode: 0o700 });
  const jwt = 'e30.' + Buffer.from(JSON.stringify({
    'https://api.openai.com/auth': { chatgpt_account_id: 'fixture', chatgpt_user_id: 'fixture-user', chatgpt_plan_type: 'pro' },
  })).toString('base64url') + '.sig';
  fs.writeFileSync(path.join(home, 'auth.json'), JSON.stringify({
    auth_mode: 'chatgpt', OPENAI_API_KEY: null,
    tokens: { id_token: jwt, access_token: 'fake-access-token', refresh_token: 'fake-refresh', account_id: 'fixture' },
    last_refresh: new Date().toISOString(),
  }), { mode: 0o600 });
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    requests.push({ path: req.url.split('?')[0], hasAuthorization: !!req.headers.authorization, managedToken: req.headers.authorization === 'Bearer fake-access-token' });
    res.setHeader('content-type', 'application/json');
    let message; try { message = JSON.parse(body); } catch {}
    if (message?.method === 'initialize') res.end(JSON.stringify({
      jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'fixture', version: '1' } },
    }));
    else if (message?.id != null) res.end(JSON.stringify({
      jsonrpc: '2.0', id: message.id, result: message.method === 'tools/list' ? { tools: [] } : message.method === 'resources/list' ? { resources: [] } : {},
    }));
    else res.end('{}');
  });
  let rpc;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    rpc = new AppServerRpc(binary, home, sqlite, [
      '-c', `chatgpt_base_url="http://127.0.0.1:${server.address().port}/backend-api"`,
      '-c', 'features.apps=true', '-c', 'cli_auth_credentials_store="file"',
    ], { processEnv: { CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED: '1' } });
    await rpc.initialize();
    const { thread } = await rpc.request('thread/start', { ephemeral: true });
    const status = await rpc.request('mcpServerStatus/list', { threadId: thread.id, limit: 100 });
    assert(requests.some(r => r.path.endsWith('/wham/accounts/check') && r.managedToken), 'The fixture must load managed account credentials');
    const apps = requests.filter(r => r.path === '/backend-api/ps/mcp');
    assert(apps.length > 0, 'The stock hosted Apps transport must actually run');
    assert(apps.every(r => !r.hasAuthorization), 'Managed auth now reaches the loopback Apps endpoint; reassess connector-routing applicability');
    assert(requests.some(r => r.path.startsWith('/.well-known/')), 'The stock transport must expose its OAuth discovery fallback');
    const hosted = status.data.find(s => s.name === 'codex_apps');
    assert(hosted, 'Native status must include the hosted Apps extension');
    assert.notEqual(hosted.authStatus, 'bearerToken', 'Native Apps managed auth changed; reassess the workaround');
  } finally {
    try { await rpc?.close(); }
    finally {
      server.closeAllConnections();
      if (server.listening) await new Promise(resolve => server.close(resolve));
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});
