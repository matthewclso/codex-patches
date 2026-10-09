"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { WebSocket, WebSocketServer } = require("ws");
const { createRelay } = require("../patches/remote-fast-list/relay.cjs");
const listen=server=>new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
test("non-Remote-Control WebSockets remain byte-exact through the configured HTTP proxy", {timeout:10000}, async () => {
  const seen=[];
  const proxy=http.createServer((req,res)=>{seen.push(req.url);res.end("through-proxy");});
  const wss=new WebSocketServer({server:proxy,perMessageDeflate:false});
  await listen(proxy);
  const relay=await createRelay({upstreamBase:"http://127.0.0.1:54321/backend-api/",testLoopback:true,
    proxyEnv:{HTTP_PROXY:`http://127.0.0.1:${proxy.address().port}`}});
  let client,backend;
  try {
    assert.equal(await (await fetch(relay.baseUrl+"ordinary")).text(),"through-proxy");
    assert.equal(seen[0],"http://127.0.0.1:54321/backend-api/ordinary");
    const connected=once(wss,"connection");
    client=new WebSocket(relay.baseUrl.replace("http:","ws:")+"ordinary-websocket");
    [backend]=await connected; await once(client,"open");
    const bytes=Buffer.from(' {"type":"client_message","message":{"id":1,"method":"thread/list","params":{"useStateDbOnly":false}}} ');
    const received=once(client,"message");backend.send(bytes,{binary:false});
    assert.deepEqual((await received)[0],bytes);
    assert.equal(relay.counters.rewrites,0);
  } finally {client?.terminate();backend?.terminate();await relay.close();wss.close();await close(proxy);}
});
test("ordinary HTTP streams are delivered before the upstream response finishes", {timeout:10000}, async () => {
  let upstreamResponse;
  const server=http.createServer((_req,res)=>{upstreamResponse=res;res.writeHead(200,{"content-type":"text/event-stream"});res.write("data: first\n\n");});
  await listen(server);
  const relay=await createRelay({upstreamBase:`http://127.0.0.1:${server.address().port}/backend-api/`,testLoopback:true});
  try {
    const response=await fetch(relay.baseUrl+"events");const reader=response.body.getReader();
    assert.equal(Buffer.from((await reader.read()).value).toString(),"data: first\n\n");
    upstreamResponse.end("data: last\n\n");
    assert.equal(Buffer.from((await reader.read()).value).toString(),"data: last\n\n");
    assert.equal((await reader.read()).done,true);
  } finally {await relay.close();await close(server);}
});
test("HTTP preserves method, query, body and native auth; rejects browsers and escaping paths", async () => {
  const seen=[];
  const server=http.createServer(async(req,res)=>{
    let body=""; for await(const data of req) body+=data;
    seen.push({url:req.url,method:req.method,headers:req.headers,body});
    res.writeHead(201,{"x-native":"yes"}).end("native-response");
  });
  await listen(server);
  const relay=await createRelay({upstreamBase:`http://127.0.0.1:${server.address().port}/backend-api/`,testLoopback:true});
  try {
    const response=await fetch(relay.baseUrl+"wham/remote/control/enroll?x=1",{method:"POST",
      headers:{authorization:"Bearer fake", "chatgpt-account-id":"fixture"},body:"unchanged"});
    assert.equal(response.status,201); assert.equal(await response.text(),"native-response");
    assert.equal(response.headers.get("x-native"),"yes");
    assert.equal(seen[0].url,"/backend-api/wham/remote/control/enroll?x=1");
    assert.equal(seen[0].headers.authorization,"Bearer fake");
    assert.equal(seen[0].headers["chatgpt-account-id"],"fixture");
    assert.equal(seen[0].body,"unchanged");
    for (const [url,headers] of [[relay.baseUrl+"x",{origin:"https://evil.example"}],
      [relay.baseUrl.replace(/\/[a-f0-9]{64}\//,"/wrong/"),{}], [relay.baseUrl+"%2fescape",{}]])
      assert.equal((await fetch(url,{headers})).status,403);
    assert.equal(seen.length,1);
    await assert.rejects(()=>createRelay({upstreamBase:"http://evil.example/backend-api/"}));
    await assert.rejects(()=>createRelay({upstreamBase:"https://chatgpt.com@evil.example/backend-api/"}));
  } finally { await relay.close(); await close(server); }
});
test("native WebSocket traffic is rewritten only upstream-to-CLI; ping/pong and bytes pass through", async () => {
  const server=http.createServer();
  const wss=new WebSocketServer({server,autoPong:false,perMessageDeflate:false});
  await listen(server);
  const relay=await createRelay({upstreamBase:`http://127.0.0.1:${server.address().port}/backend-api/`,testLoopback:true});
  let client,backend;
  try {
    const connected=once(wss,"connection");
    client=new WebSocket(relay.baseUrl.replace("http:","ws:")+"wham/remote/control/server",{
      autoPong:false,headers:{authorization:"Bearer fake", "x-codex-remote-control-token":"native-token"}});
    [backend]=await connected;
    await once(client,"open");
    const receive=once(client,"message");
    backend.send(JSON.stringify({type:"client_message",client_id:"phone",seq_id:1,cursor:"opaque",
      message:{id:1,method:"thread/list",params:{useStateDbOnly:false,limit:10}}}));
    const [data,binary]=await receive;
    assert.equal(binary,false); assert.equal(JSON.parse(data).message.params.useStateDbOnly,true);
    const bytes=Buffer.from(' { "type":"server_message", "message":{"id":1,"result":null} } ');
    const returning=once(backend,"message"); client.send(bytes,{binary:false});
    assert.deepEqual((await returning)[0],bytes);
    const ping=once(client,"ping"); backend.ping("native-ping");
    assert.equal((await ping)[0].toString(),"native-ping");
    const pong=once(backend,"pong"); client.pong("native-ping");
    assert.equal((await pong)[0].toString(),"native-ping");
    const binaryEvent=once(client,"message");backend.send(Buffer.from([0,255]),{binary:true});
    const [binaryBytes,isBinary]=await binaryEvent; assert.equal(isBinary,true); assert.deepEqual(binaryBytes,Buffer.from([0,255]));
    assert.equal(relay.counters.rewrites,1);
  } finally { client?.terminate();backend?.terminate();await relay.close();wss.close();await close(server); }
});
test("upstream handshake rejection preserves native status, retry headers and body", async () => {
  const server=http.createServer();
  server.on("upgrade",(_req,socket)=>socket.end("HTTP/1.1 401 Unauthorized\r\nRetry-After: 42\r\nContent-Length: 6\r\nConnection: close\r\n\r\ndenied"));
  await listen(server);
  const relay=await createRelay({upstreamBase:`http://127.0.0.1:${server.address().port}/backend-api/`,testLoopback:true});
  let client;
  try {
    const result=new Promise((resolve,reject)=>{
      client=new WebSocket(relay.baseUrl.replace("http:","ws:")+"wham/remote/control/server");
      client.on("error",()=>{});
      client.on("unexpected-response",(_req,res)=>{
        let body="";res.on("data",data=>body+=data);res.on("error",reject);
        res.on("end",()=>resolve({status:res.statusCode,retry:res.headers["retry-after"],body}));
      });
    });
    assert.deepEqual(await result,{status:401,retry:"42",body:"denied"});
  } finally {client?.terminate();await relay.close();await close(server);}
});
test("outgoing filtering variations preserve native bytes and keep remote listing available", {timeout:10000}, async () => {
  const server=http.createServer(),wss=new WebSocketServer({server,perMessageDeflate:false});
  await listen(server);
  const relay=await createRelay({upstreamBase:`http://127.0.0.1:${server.address().port}/backend-api/`,
    testLoopback:true,additionalFilter:()=>false});
  let client,backend;
  try {
    const connected=once(wss,"connection");
    client=new WebSocket(relay.baseUrl.replace("http:","ws:")+"wham/remote/control/server");
    [backend]=await connected;await once(client,"open");
    const chunk=stream=>Buffer.from(JSON.stringify({type:"server_message_chunk",client_id:"phone",stream_id:stream,
      seq_id:1,segment_id:0,segment_count:2,message_size_bytes:4,message_chunk_base64:"e30="}));
    const first=chunk("a"),variation=chunk("b"),received=[];
    const flushed=new Promise(resolve=>backend.on("message",data=>{received.push(data);if(received.length===2)resolve();}));
    client.send(first,{binary:false});client.send(variation,{binary:false});
    await flushed;
    assert.deepEqual(received,[first,variation]);assert.equal(relay.counters.outgoingFilterFallbacks,1);
    const ordinary=Buffer.from(' {"type":"server_message","message":{"id":1,"result":null}} ');
    const reply=once(backend,"message");client.send(ordinary,{binary:false});
    assert.deepEqual((await reply)[0],ordinary);
    const listing=once(client,"message");
    backend.send(JSON.stringify({type:"client_message",message:{id:2,method:"thread/list",params:{limit:1}}}));
    assert.equal(JSON.parse((await listing)[0]).message.params.useStateDbOnly,true);
    assert.equal(client.readyState,WebSocket.OPEN);assert.equal(backend.readyState,WebSocket.OPEN);
  } finally {client?.terminate();backend?.terminate();await relay.close();wss.close();await close(server);}
});
