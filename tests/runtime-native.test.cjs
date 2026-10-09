"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { once, EventEmitter } = require("node:events");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const readline = require("node:readline");
const { WebSocketServer } = require("ws");
const { AppServerRpc } = require("../patches/remote-fast-list/rpc.cjs");
const { createRelay } = require("../patches/remote-fast-list/relay.cjs");
const { pairing, SOURCE, prepare } = require("../patches/remote-fast-list/runtime.cjs");
const { ConnectorRouting } = require("../patches/connector-routing/index.cjs");
const { MAX_WIRE } = require("../patches/remote-fast-list/rewrite.cjs");
const BINARY = process.env.CODEX_RELAY_TEST_BINARY;

for(const mode of ["stock", "fresh", "reuse", "connectors", "connector-error"])test(`unmodified CLI native flow, ${mode === "stock" ? "stock native unfiltered-list regression" : mode === "reuse" ? "preserving an existing paired server" : mode === "connectors" ? "remote-first connector discovery alongside listing and reconnect" : mode === "connector-error" ? "connector startup timeout preserves native Remote Control errors and listing" : "fresh isolated enrollment"}`, {timeout:30000,skip:!BINARY || process.platform === "win32"}, async () => {
  const reuse = mode === "reuse", stock = mode === "stock";
  const connectors = mode.startsWith("connector"), failure = mode === "connector-error";
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"codex-relay-native-"));
  const home=path.join(dir,"home"),sqlite=path.join(dir,"sqlite");
  fs.mkdirSync(home,{mode:0o700});fs.mkdirSync(sqlite,{mode:0o700});
  const jwt="e30."+Buffer.from(JSON.stringify({email:"fixture@example.invalid",
    "https://api.openai.com/auth":{chatgpt_account_id:"fixture",chatgpt_user_id:"fixture-user",chatgpt_plan_type:"pro"}})).toString("base64url")+".sig";
  fs.writeFileSync(path.join(home,"auth.json"),JSON.stringify({auth_mode:"chatgpt",OPENAI_API_KEY:null,
    tokens:{id_token:jwt,access_token:"fake-access-token",refresh_token:"fake-refresh",account_id:"fixture"},
    last_refresh:new Date().toISOString()}),{mode:0o600});
  const enrollmentRequests=[];
  const refreshRequests=[];
  const server=http.createServer(async(req,res)=>{
    let body="";for await(const data of req) body+=data;
    if(req.url.endsWith("/wham/remote/control/server/enroll") || req.url.endsWith("/wham/remote/control/server/refresh")) {
      (req.url.endsWith("/enroll") ? enrollmentRequests : refreshRequests).push({url:req.url,headers:req.headers,body:JSON.parse(body)});
      res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({server_id:"srv_e_fixture",
        environment_id:"env_fixture",remote_control_token:"fake-server-token",expires_at:"3026-05-22T12:34:56Z"}));
    } else if(req.url.endsWith("/wham/accounts/check"))res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({
      accounts:[{id:"fixture",plan_type:"pro",workspace_backend_origin:stock ? "https://chatgpt.com" : "NO_CONSTRAINT",account_routing_override:"NO_CONSTRAINT"}],
      account_ordering:["fixture"],default_account_id:"fixture"}));
    else res.writeHead(200,{"content-type":"application/json"}).end("{}");
  });
  const wss=new WebSocketServer({server,perMessageDeflate:false});
  let backend;
  const pending=new Map();
  let connectedResolve;
  const connected=new Promise(resolve=>{connectedResolve=resolve;});
  const observed=[];
  const remoteNotifications=[];
  const remoteEvents=new EventEmitter();
  const sequenceByStream=new Map();
  const responseChunks=new Map();
  wss.on("connection",(ws,req)=>{
    backend=ws;
    observed.push({url:req.url,headers:req.headers});
    ws.on("message",data=>{
      const envelope=JSON.parse(data);
      if(connectors && envelope.stream_id && envelope.seq_id) {
        const key=JSON.stringify([envelope.client_id,envelope.stream_id]);
        assert.equal(envelope.seq_id,(sequenceByStream.get(key) ?? 0)+(envelope.segment_id > 0 ? 0 : 1),"Hidden context events must not create transport sequence gaps");
        sequenceByStream.set(key,envelope.seq_id);
        ws.send(JSON.stringify({type:"ack",client_id:envelope.client_id,stream_id:envelope.stream_id,seq_id:envelope.seq_id,
          ...(envelope.type.endsWith("_chunk") ? {segment_id:envelope.segment_id} : {})}));
      }
      if(envelope.type==="server_message_chunk") {
        const key=JSON.stringify([envelope.client_id,envelope.stream_id,envelope.seq_id]);
        const pieces=responseChunks.get(key) ?? [];
        pieces.push(Buffer.from(envelope.message_chunk_base64,"base64"));responseChunks.set(key,pieces);
        if(pieces.length<envelope.segment_count)return;
        responseChunks.delete(key);
        envelope.type="server_message";envelope.message=JSON.parse(Buffer.concat(pieces).toString());
      }
      if(envelope.type==="server_message" && envelope.message?.method) {
        remoteNotifications.push(envelope.message);remoteEvents.emit("notification",envelope.message);
      }
      if(envelope.type==="server_message" && envelope.message?.id != null) {
        const p=pending.get(envelope.message.id);
        if(p){clearTimeout(p.timer);pending.delete(envelope.message.id);p.resolve(envelope.message);}
      }
    });
    connectedResolve();
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const upstreamBase = `http://127.0.0.1:${server.address().port}/backend-api/`;
  let routing, observer;
  const relay=stock ? { baseUrl: upstreamBase, close: async () => {} }
    : await createRelay({testLoopback:true,upstreamBase, additionalRewrite: (message, envelope) => routing?.remoteRequest(message, envelope) ?? false,
      additionalFilter: connectors ? (message, envelope) => routing.remoteResponse(message, envelope) : undefined});
  const rpc=new AppServerRpc(BINARY,home,sqlite,["-c",`chatgpt_base_url=${JSON.stringify(relay.baseUrl)}`,
    "-c",'cli_auth_credentials_store="file"', ...(connectors ? ["-c","features.apps=false"] : [])],{isolatedRemoteControl:true});
  if(connectors) {
    routing=new ConnectorRouting({timeoutMs: failure ? 5 : 10000,
      sendNative: message => { if (!failure) rpc.child.stdin.write(JSON.stringify(message)+"\n"); },
      sendClient: () => { throw new Error("No desktop discovery requests in this fixture"); }});
    observer=readline.createInterface({input:rpc.child.stdout});
    observer.on("line",line=>{try{routing.response(JSON.parse(line));}catch{}});
  }
  let seq=0;
  function notification(predicate) {
    if(remoteNotifications.some(predicate))return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{remoteEvents.off("notification",listener);reject(new Error("Native notification timed out"));},5000);
      const listener=message=>{if(predicate(message)){clearTimeout(timer);remoteEvents.off("notification",listener);resolve();}};
      remoteEvents.on("notification",listener);
    });
  }
  function remote(message,{chunked=false,nearLimit=false}={}) {
    if(nearLimit) {
      const sample={type:"client_message",client_id:"fixture-phone",stream_id:"fixture-stream",
        seq_id:seq+1,cursor:`fixture-cursor-${seq+1}`,message};
      message.params.developerInstructions="x".repeat(MAX_WIRE-Buffer.byteLength(JSON.stringify(sample))-1);
    }
    const envelope={type:"client_message",client_id:"fixture-phone",stream_id:"fixture-stream",
      seq_id:++seq,cursor:`fixture-cursor-${seq}`,message};
    const result=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(message.id);reject(new Error(`Native remote timeout: ${message.method}`));},10000);
      pending.set(message.id,{resolve,reject,timer});
    });
    if(chunked) {
      const bytes=Buffer.from(JSON.stringify(message));
      for(let i=0;i<3;i++) backend.send(JSON.stringify({...envelope,type:"client_message_chunk",message:undefined,
        segment_id:i,segment_count:3,message_size_bytes:bytes.length,
        message_chunk_base64:bytes.subarray(Math.floor(i*bytes.length/3),Math.floor((i+1)*bytes.length/3)).toString("base64")}));
    } else backend.send(JSON.stringify(envelope));
    return result;
  }
  try {
    await rpc.initialize();
    const account=await rpc.request("account/read",{});
    if (!stock) assert.equal(account.workspaceRouting.backendOrigin,"https://chatgpt.com");
    assert.equal(account.workspaceRouting.accountRoutingOverride,"NO_CONSTRAINT");
    const projects=[];
    for(const name of ["Research","AI"]) projects.push((await rpc.request("project/create",{
      name,roots:[{path:dir}],idempotencyKey:crypto.randomUUID()})).project);
    const ids=[crypto.randomUUID(),crypto.randomUUID()];
    // The SQLite-only path still stats rollout files, but need not parse their history.
    for(let i=0;i<2;i++)fs.writeFileSync(path.join(dir,`missing-${i}.jsonl`),"invalid fixture history\n",{mode:0o600});
    // Only the temporary test database; never the user's database or histories.
    execFileSync(process.env.CODEX_PATCHES_PYTHON ?? "python3",["-c",
      "import sqlite3,json,sys,time; c=sqlite3.connect(sys.argv[1]); d=json.loads(sys.argv[2]); now=int(time.time()); c.executemany('INSERT INTO threads(id,rollout_path,created_at,updated_at,source,model_provider,cwd,title,sandbox_policy,approval_mode,has_user_event,project_id,preview) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[(x['id'],x['path'],now-i,now-i,'vscode','openai',x['cwd'],'DB-only relay witness','{\"type\":\"read-only\"}','never',1,x['projectId'],'DB-only relay witness') for i,x in enumerate(d)]); c.commit()",
      path.join(sqlite,"state_5.sqlite"),JSON.stringify(ids.map((id,i)=>({id,path:path.join(dir,`missing-${i}.jsonl`),
        cwd:dir,projectId:projects[i].id})))],{stdio:["pipe","pipe","pipe"]});
    const dbOnly=await rpc.request("thread/list",{useStateDbOnly:true,limit:10});
    assert.equal(dbOnly.data.length,2,"Fixture must exist in SQLite-only list");
    const ordinary=await rpc.request("thread/list",{useStateDbOnly:false,limit:10});
    assert.equal(ordinary.data.length,0,"Filesystem-first list must exclude these projection-only witnesses");
    if(reuse) {
      execFileSync(process.env.CODEX_PATCHES_PYTHON ?? "python3",["-c",
        "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('INSERT INTO remote_control_enrollments(websocket_url,account_id,app_server_client_name,server_id,environment_id,server_name,updated_at,remote_control_enabled) VALUES(?,?,?,?,?,?,?,?)',(sys.argv[2],'fixture','codex-project-sync','srv_e_fixture','env_fixture','fixture-server',1,1)); c.commit()",
        path.join(sqlite,"state_5.sqlite"),SOURCE]);
      const url=new URL(relay.baseUrl);
      const config={port:Number(url.port),capability:url.pathname.split("/")[1]};
      assert.equal(pairing(path.join(sqlite,"state_5.sqlite"),config,"apply",{clientName:"codex-project-sync"}).newMappings,1);
    }
    await rpc.request("remoteControl/enable",{ephemeral:true});
    let connectTimer;
    try { await Promise.race([connected,new Promise((_,reject)=>{
      connectTimer=setTimeout(()=>reject(new Error("Native remote handshake timed out")),10000);
    })]); } finally {clearTimeout(connectTimer);}
    assert.equal(enrollmentRequests.length,reuse ? 0 : 1);
    const first=reuse ? refreshRequests[0] : enrollmentRequests[0];
    assert.ok(first,"Existing pairing must refresh, not enroll a new server");
    assert.equal(first.headers.authorization,"Bearer fake-access-token");
    assert.equal(first.headers["chatgpt-account-id"],"fixture");
    if(!reuse)assert.equal(first.body.app_server_version,execFileSync(BINARY,["--version"],{encoding:"utf8"}).trim().replace(/^codex-cli /,""));
    else assert.equal(first.body.server_id,"srv_e_fixture");
    assert.equal(observed[0].headers.authorization,"Bearer fake-server-token");
    assert.equal(observed[0].headers["x-codex-protocol-version"],"3");
    const init=await remote({id:101,method:"initialize",params:{clientInfo:{name:"codex-tui",version:"fixture"},
      capabilities:{experimentalApi:true}}});
    assert.ok(init.result);
    backend.send(JSON.stringify({type:"client_message",client_id:"fixture-phone",stream_id:"fixture-stream",
      seq_id:++seq,cursor:`fixture-cursor-${seq}`,message:{method:"initialized"}}));
    if(connectors) {
      const installed=await remote({id:109,method:"app/installed",params:{forceRefresh:true}},{chunked:true});
      if(failure) {
        assert.equal(installed.id,109);
        assert.match(installed.error?.message ?? "",/thread not found/);
        assert.equal(observed.length,1,"A connector startup timeout must not drop the native socket");
      } else {
      assert.ok(!installed.error,JSON.stringify(installed.error));
      assert.deepEqual(installed.result.apps,[]);
      assert.ok(routing.contextId,"Remote-first discovery must create the native context through stdio");
      const loaded=await rpc.request("thread/loaded/list",{});
      assert.ok(loaded.data.includes(routing.contextId));
      assert.ok(!remoteNotifications.some(message=>message.params?.thread?.id===routing.contextId),
        "Internal discovery context must stay hidden from remote clients");
      const large=await remote({id:110,method:"thread/start",params:{ephemeral:true,developerInstructions:""}},{nearLimit:true});
      assert.ok(!large.error,JSON.stringify(large.error));
      assert.equal(large.result.thread.ephemeral,true);
      await notification(message=>message.params?.thread?.id===large.result.thread.id);
      await remote({id:111,method:"thread/unsubscribe",params:{threadId:large.result.thread.id}});
      }
    }
    for(let i=0;i<2;i++) {
      const list=await remote({id:102+i,method:"thread/list",params:{useStateDbOnly:false,projectId:projects[i].id,limit:10}},
        {chunked:i===1});
      assert.ok(!list.error,JSON.stringify(list.error));
      assert.deepEqual(list.result.data.map(t=>t.id),[ids[i]],
        stock ? "Stock native project-filtered listing already selects the SQLite path" : "Relay must return the requested project's SQLite witnesses");
      assert.equal(list.result.data[0].projectId,projects[i].id);
    }
    const names=await remote({id:104,method:"project/list",params:{}});
    assert.deepEqual(names.result.data.map(p=>p.name).sort(),["AI","Research"]);
    const page=await remote({id:106,method:"thread/list",params:{useStateDbOnly:false,limit:1}});
    assert.equal(page.result.data.length, stock ? 0 : 1,
      "Unfiltered native listing must still differ from the SQLite path before this patch is classified needed");
    if (!stock) {
      assert.ok(page.result.nextCursor);
      const next=await remote({id:107,method:"thread/list",params:{cursor:page.result.nextCursor,limit:1}});
      assert.equal(next.result.data.length,1);
      assert.deepEqual(new Set([page.result.data[0].id,next.result.data[0].id]),new Set(ids));
    }
    const denied=await remote({id:105,method:"userVerification/enroll",params:{}});
    assert.equal(denied.error.data.type,"unavailable");
    assert.equal(denied.error.data.reason,"providerUnavailable");
    if (!stock) assert.equal(relay.counters.rewrites,4 + Number(connectors) + Number(connectors && !failure));
    assert.equal(observed.length,1,"Remote requests use native socket, not stdio forwarding");
    const reconnect=once(wss,"connection");
    backend.close(1000,"fixture reconnect");
    let reconnectTimer;
    try { await Promise.race([reconnect,new Promise((_,reject)=>{
      reconnectTimer=setTimeout(()=>reject(new Error("Native reconnect timed out")),10000);
    })]); } finally {clearTimeout(reconnectTimer);}
    assert.equal(observed[1].headers["x-codex-subscribe-cursor"],`fixture-cursor-${seq}`);
    assert.equal(enrollmentRequests.length,reuse ? 0 : 1,"Reconnection must reuse enrollment");
    const resumed=await remote({id:108,method:"thread/list",params:{limit:10}});
    assert.deepEqual(new Set(resumed.result.data.map(t=>t.id)),new Set(stock ? [] : ids));
    if (!stock) {
      assert.equal(relay.counters.rewrites,5 + Number(connectors) + Number(connectors && !failure));
      assert.ok(relay.counters.routingNormalizations>=1);
    }
    await rpc.request("remoteControl/disable",{ephemeral:true});
  } finally {
    for(const p of pending.values())clearTimeout(p.timer);
    routing?.close();observer?.close();
    await rpc.close();
    backend?.terminate();
    await relay.close();
    wss.close();server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

for (const shutdown of ["eof", "signal"]) test(`stock project path regression crosses proxy, relay and unmodified CLI; ${shutdown} cleans up owned children`, {
  timeout: 30000, skip: !BINARY || process.platform === "win32",
}, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-patches-stack-"));
  fs.chmodSync(directory, 0o700);
  const home = path.join(directory, "home"), sqlite = path.join(directory, "sqlite");
  const stockHome = path.join(directory, "stock-home"), stockSqlite = path.join(directory, "stock-sqlite");
  for (const file of [home, sqlite, stockHome, stockSqlite]) fs.mkdirSync(file, { mode: 0o700 });
  const runtime = { schemaVersion: 1, realCli: BINARY,
    cliSha256: crypto.createHash("sha256").update(fs.readFileSync(BINARY)).digest("hex"),
    cliVersion: execFileSync(BINARY, ["--version"], { encoding: "utf8" }).trim(),
    codexHome: home, sqliteHome: sqlite, stateRoot: path.join(directory, "state"), node: process.execPath,
    distro: "FixtureUbuntu", relayEnabled: true, rewriteProjectPaths: true, connectorRouting: true,
    primaryRuntimeCacheHome: path.join(directory, "desktop-cache") };
  const runtimeFile = path.join(directory, "runtime.json");
  fs.writeFileSync(runtimeFile, JSON.stringify(runtime), { mode: 0o600 });
  const relayConfig = await prepare(path.join(runtime.stateRoot, "relay"));
  const unc = "\\\\wsl.localhost\\FixtureUbuntu" + directory.replaceAll("/", "\\");
  const stock = new AppServerRpc(BINARY, stockHome, stockSqlite);
  const proxy = path.join(__dirname, "../patches/wsl-project-paths/proxy.py");
  let rpc;
  try {
    await stock.initialize();
    await assert.rejects(() => stock.request("project/create", { name: "Stock invalid root",
      roots: [{ path: unc }], idempotencyKey: crypto.randomUUID() }),
      error => Boolean(error.rpcError), "Stock CLI must reject the Windows UNC root before this workaround is classified needed");
    await stock.close();
    assert.equal(execFileSync(proxy, ["--version"], { encoding: "utf8", env: { ...process.env, XDG_CACHE_HOME: runtime.primaryRuntimeCacheHome, CODEX_PATCHES_RUNTIME_CONFIG: runtimeFile } }).trim(), runtime.cliVersion);
    rpc = new AppServerRpc(proxy, home, sqlite, [], { processEnv: { XDG_CACHE_HOME: runtime.primaryRuntimeCacheHome, CODEX_PATCHES_RUNTIME_CONFIG: runtimeFile } });
    await rpc.initialize();
    const result = await rpc.request("project/create", { name: "Proxy fixture",
      roots: [{ path: unc }], idempotencyKey: crypto.randomUUID() });
    assert.equal(result.project.roots[0].path, directory);
    await rpc.request("project/delete", { projectId: result.project.id });
    if (shutdown === "signal") {
      rpc.child.kill("SIGTERM");
      const result = await rpc.exit;
      const signal = rpc.child.signalCode;
      rpc = null;
      assert.ok([0, 143].includes(result), `Proxy exit must be supervised; code=${result}, signal=${signal}`);
      assert.equal(signal, null, "Python must shut down cleanly rather than aborting its interpreter");
    } else await rpc.close();
    rpc = null;
    const rebound = await createRelay(relayConfig);
    await rebound.close();
  } finally {
    if (rpc) await rpc.close();
    if (stock.child.exitCode == null) await stock.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
