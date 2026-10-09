"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { PassThrough, Writable } = require("node:stream");
const { ConnectorRouting, routeThread, BACKEND } = require("../patches/connector-routing/index.cjs");
const { jsonLines, writer } = require("../patches/connector-routing/stdio.cjs");
const { IncomingRewriter, parse, QUIET, MAX_WIRE } = require("../patches/remote-fast-list/rewrite.cjs");
function fixture(options = {}) {
  const native = [], client = [];
  const routing = new ConnectorRouting({ sendNative: v => native.push(v), sendClient: v => client.push(v), ...options });
  return { native, client, routing };
}
test("chat routing preserves explicit endpoint selection, other config, and non-target requests", () => {
  for (const method of ["thread/start", "thread/resume", "thread/fork"]) {
    const request = { id: 1, method, params: { config: { model: "fixture", features: { apps: false } }, cwd: "/work" } };
    assert.equal(routeThread(request), true);
    assert.deepEqual(request.params.config, { model: "fixture", features: { apps: false }, chatgpt_base_url: BACKEND });
    assert.equal(request.params.cwd, "/work");
  }
  for (const request of [{id:1,method:"thread/read",params:{}}, {method:"thread/start"},
    {id:1,method:"thread/start",params:[]}, {id:1,method:"thread/start",params:{config:[]}},
    {id:1,method:"thread/start",params:{config:{chatgpt_base_url:"https://explicit.invalid"}}}]) {
    const before = JSON.stringify(request);
    assert.equal(routeThread(request), false);
    assert.equal(JSON.stringify(request), before);
  }
});
test("legacy directory listing retains native routing", async () => {
  const {routing,native}=fixture();
  const request={id:1,method:"app/list",params:{forceRefetch:true}};
  assert.equal(routing.request(request),false);
  assert.equal(await routing.remoteRequest(request),false);
  assert.equal(native.length,0);
  routing.close();
});
test("parallel threadless discovery uses one non-persistent native context and hides only its lifecycle", () => {
  const {native, client, routing} = fixture();
  for (const method of ["app/read", "app/installed", "mcpServerStatus/list"])
    assert.equal(routing.request({id:method,method,params:{forceRefresh:true}}), true);
  assert.equal(native.length, 1);
  assert.equal(native[0].params.ephemeral, true);
  assert.deepEqual(native[0].params.config,{chatgpt_base_url:BACKEND});
  assert.equal(routing.response({id:native[0].id,result:{thread:{id:"internal"}}}),true);
  assert.equal(native.length, 4);
  for (const request of native.slice(1)) assert.equal(request.params.threadId,"internal");
  assert.equal(routing.response({method:"thread/started",params:{thread:{id:"internal"}}}),true);
  assert.equal(routing.response({method:"thread/started",params:{thread:{id:"visible"}}}),false);
  assert.equal(routing.response({id:12,method:"attestation/generate",params:{threadId:"internal"}}),false);
  assert.equal(routing.request({id:4,method:"app/list",params:{threadId:"visible"}}),false);
  assert.equal(routing.response({id:4,result:{apps:[]}}),false);
  assert.deepEqual(client,[]);
  routing.close();
  assert.equal(native.at(-1).method,"thread/unsubscribe");
});
test("failed and late context startup returns an error, preserves request IDs, and unsubscribes late contexts", () => {
  const {native,client,routing}=fixture();
  const id=JSON.rawJSON("9007199254740993");
  routing.request({id,method:"app/installed",params:{}});
  const expired=native[0].id;
  routing.fail();
  assert.match(JSON.stringify(client[0]), /"id":9007199254740993/);
  assert.equal(client[0].error.code,-32603);
  routing.request({id:2,method:"app/read",params:{appIds:[]}});
  assert.notEqual(native.at(-1).id,expired);
  assert.equal(routing.response({id:expired,result:{thread:{id:"late"}}}),true);
  assert.equal(native.at(-1).method,"thread/unsubscribe");
  assert.equal(routing.response({method:"thread/started",params:{thread:{id:"late"}}}),true);
  routing.close();
});
test("JSONL adaptation preserves non-target bytes, fragmented lines, CRLF, and large integer IDs", () => {
  const stream=new PassThrough(), output=[];
  const detach=jsonLines(stream, raw=>output.push(raw), message=> {
    if (!routeThread(message))return false;
    output.push(Buffer.from(JSON.stringify(message)+"\n"));return true;
  });
  const first=' {"id":9007199254740993,"method":"thread/read","params":{}}\r\n';
  const second='{"id":18446744073709551615,"method":"thread/start","params":{}}\n';
  stream.write(Buffer.from(first.slice(0,8)));
  stream.write(Buffer.from(first.slice(8)+second));
  assert.equal(output[0].toString(),first);
  assert.match(output[1].toString(), /"id":18446744073709551615/);
  assert.equal(parse(output[1].toString()).params.config.chatgpt_base_url,BACKEND);
  detach();stream.destroy();
});
test("remote routing shares native chat overrides while preserving segmented delivery metadata and listing", async () => {
  const {routing}=fixture();
  const rewrite=new IncomingRewriter({additionalRewrite: message=>routing.remoteRequest(message)});
  const payload=Buffer.from('{"id":9007199254740993,"method":"thread/resume","params":{"threadId":"visible","config":{"model":"fixture"}}}');
  const input=Array.from({length:3},(_,i)=>Buffer.from(JSON.stringify({type:"client_message_chunk",client_id:"phone",
    stream_id:"stream",seq_id:9,cursor:`cursor-${i}`,segment_id:i,segment_count:3,message_size_bytes:payload.length,
    message_chunk_base64:payload.subarray(Math.floor(i*payload.length/3),Math.floor((i+1)*payload.length/3)).toString("base64")})));
  const frames=[];
  for (const frame of input) frames.push(...(await rewrite.pushAsync(frame)).map(frame=>JSON.parse(frame.data)));
  const decoded=Buffer.concat(frames.map(frame=>Buffer.from(frame.message_chunk_base64,"base64"))).toString();
  assert.match(decoded, /"id":9007199254740993/);
  assert.equal(parse(decoded).params.config.chatgpt_base_url,BACKEND);
  frames.forEach((frame,i)=>{assert.equal(frame.cursor,`cursor-${i}`);assert.equal(frame.seq_id,9);assert.equal(frame.segment_count,3);});
  const list=JSON.parse((await rewrite.pushAsync(Buffer.from(JSON.stringify({type:"client_message",message:{id:2,method:"thread/list",params:{limit:1}}}))))[0].data);
  assert.deepEqual(list.message.params,{limit:1,useStateDbOnly:true});
  routing.close();
});
test("remote-first discovery waits for the native context and failures stay scoped to the native request", async () => {
  const {native,routing}=fixture();
  const request={id:1,method:"app/installed",params:{forceRefresh:true}};
  const waiting=routing.remoteRequest(request);
  assert.equal(native.length,1);
  assert.equal(request.params.threadId,undefined);
  routing.response({id:native[0].id,result:{thread:{id:"context"}}});
  assert.equal(await waiting,true);
  assert.equal(request.params.threadId,"context");
  routing.close();
  const failed=fixture();
  const unavailable={id:2,method:"app/read",params:{appIds:[]}};
  const rejected=failed.routing.remoteRequest(unavailable);
  failed.routing.response({id:failed.native[0].id,error:{code:-32603,message:"fixture"}});
  assert.equal(await rejected,true);
  assert.equal(unavailable.params.threadId,failed.routing.unavailableContext);
  failed.routing.close();
});
test("JSONL writers pause the source until a slow consumer drains", async () => {
  const source=new PassThrough();let complete;
  const sink=new Writable({highWaterMark:1,write(_chunk,_encoding,callback){complete=callback;}});
  const write=writer(source,sink);
  source.resume();
  write(Buffer.from("payload"));
  assert.equal(source.isPaused(),true);
  complete();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(source.isPaused(),false);
  write.close();source.destroy();sink.destroy();
});
test("remote broadcasts wait for context identity, including late replies, and hide only internal notifications", async () => {
  for (const late of [false,true]) {
    const {routing,native}=fixture();
    routing.request({id:1,method:"app/installed",params:{}});
    const id=native[0].id;
    if(late)routing.fail();
    const waiting=routing.remoteResponse({method:"thread/started",params:{thread:{id:"internal",ephemeral:true}}});
    routing.response({id,result:{thread:{id:"internal"}}});
    assert.equal(await waiting,QUIET);
    const ordinary={method:"thread/started",params:{thread:{id:"ordinary"}}};
    assert.equal(await routing.remoteResponse(ordinary),false);
    assert.equal(await routing.remoteResponse({id:2,result:{thread:{id:"internal"}}}),false);
    routing.close();
  }
});
test("a context that never replies cannot stall or disconnect ordinary ephemeral broadcasts", async () => {
  const {routing}=fixture({timeoutMs:5});
  const keepAlive=setTimeout(()=>{},1000);
  try {
    routing.request({id:1,method:"app/installed",params:{}});
    const ordinary={method:"thread/started",params:{thread:{id:"ordinary",ephemeral:true}}};
    assert.equal(await routing.remoteResponse(ordinary),false);
    await Promise.all([...routing.settling.values()].map(item=>item.promise));
    assert.equal(await routing.remoteResponse(ordinary),false);
    // Defensive identity timeout must also retain the native notification.
    routing.settling.set("missing",{promise:new Promise(()=>{}),resolve:()=>{}});
    assert.equal(await routing.remoteResponse(ordinary),false);
  } finally {routing.close();clearTimeout(keepAlive);}
});
test("outgoing filtering preserves ordinary response bytes and native sequence boundaries for hidden lifecycle messages", async () => {
  const {routing,native}=fixture();
  routing.request({id:1,method:"app/installed",params:{}});
  routing.response({id:native[0].id,result:{thread:{id:"internal"}}});
  const filter=new IncomingRewriter({envelopeType:"server_message",additionalRewrite:message=>routing.remoteResponse(message)});
  const ordinary=Buffer.from(' {"type":"server_message","message":{"id":9007199254740993,"result":{"data":[1]}}} ');
  assert.equal((await filter.pushAsync(ordinary))[0].data,ordinary);
  const payload=Buffer.from(JSON.stringify({method:"thread/started",params:{thread:{id:"internal"}}}));
  for(let i=0;i<2;i++) {
    const frame=Buffer.from(JSON.stringify({type:"server_message_chunk",client_id:"phone",stream_id:"stream",seq_id:9,
      cursor:`cursor-${i}`,segment_id:i,segment_count:2,message_size_bytes:payload.length,
      message_chunk_base64:payload.subarray(Math.floor(i*payload.length/2),Math.floor((i+1)*payload.length/2)).toString("base64")}));
    const result=await filter.pushAsync(frame);
    if(i===0)assert.deepEqual(result,[]);
    else assert.deepEqual(JSON.parse(result[0].data),{type:"pong",status:"active",client_id:"phone",stream_id:"stream",seq_id:9,cursor:"cursor-1"});
  }
  routing.close();
});
test("expired discovery contexts recover on the next request while ordinary replies remain unchanged", async () => {
  const {routing,native}=fixture();
  routing.request({id:1,method:"app/installed",params:{}});
  routing.response({id:native[0].id,result:{thread:{id:"old"}}});
  assert.equal(routing.response({id:1,error:{code:-32600,message:"thread not found: old"}}),false);
  assert.equal(routing.contextId,null);
  routing.request({id:2,method:"app/installed",params:{}});
  assert.equal(native.at(-1).method,"thread/start");
  routing.response({id:native.at(-1).id,result:{thread:{id:"new"}}});
  const remote={id:3,method:"app/installed",params:{}};
  await routing.remoteRequest(remote,{client_id:"phone"});
  assert.equal(remote.params.threadId,"new");
  assert.equal(await routing.remoteResponse({id:3,error:{code:-32600,message:"thread not found: new"}},{client_id:"phone"}),false);
  assert.equal(routing.contextId,null);
  // A failed discovery can finish after a replacement context has started.
  const failed={id:4,method:"app/installed",params:{}};
  const waiting=routing.remoteRequest(failed,{client_id:"phone"});
  routing.fail();
  await waiting;
  assert.equal(failed.params.threadId,routing.unavailableContext);
  routing.request({id:5,method:"app/installed",params:{}});
  routing.response({id:native.at(-1).id,result:{thread:{id:"replacement"}}});
  await routing.remoteResponse({id:4,error:{code:-32600,message:"thread not found: unavailable"}},{client_id:"phone"});
  assert.equal(routing.contextId,"replacement");
  routing.close();
});
test("healthy recovery remains available beyond 128 historical contexts and retains bounded tombstones", () => {
  const {routing,native,client}=fixture();
  for(let i=0;i<260;i++) {
    routing.request({id:i,method:"app/installed",params:{}});
    const start=native.at(-1);
    assert.equal(start.method,"thread/start");
    routing.response({id:start.id,result:{thread:{id:`context-${i}`}}});
    assert.equal(routing.contextId,`context-${i}`);
    // A generic invalid-request error is not evidence of a missing context.
    routing.response({id:i,error:{code:-32600,message:"invalid params"}});
    assert.equal(routing.contextId,`context-${i}`);
    routing.response({method:"thread/closed",params:{threadId:`context-${i}`}});
    assert.equal(routing.contextId,null);
  }
  assert.equal(client.length,0);assert.equal(routing.hidden.size,128);
  assert.equal(routing.hidden.has("context-259"),true);
  routing.close();
});
test("outgoing shape changes and stalled chunks flush native bytes in order and restore pass-through", async () => {
  const frame=(segment,stream="a")=>Buffer.from(JSON.stringify({type:"server_message_chunk",client_id:"phone",stream_id:stream,
    seq_id:1,segment_id:segment,segment_count:2,message_size_bytes:4,message_chunk_base64:Buffer.from("{}").toString("base64")}));
  for(const variation of [frame(0,"b"),frame(1,"b"),Buffer.from('{"type":"server_message","message":{"id":1,"result":null}}'),Buffer.from("malformed")]) {
    const rewrite=new IncomingRewriter({envelopeType:"server_message",passThroughOnError:true});
    const first=frame(0);
    assert.deepEqual(await rewrite.pushAsync(first),[]);
    const flushed=await rewrite.pushAsync(variation);
    assert.deepEqual(flushed.map(f=>f.data),[first,variation]);
    assert.equal(rewrite.bypassed,true);assert.equal(rewrite.buffered,0);assert.equal(rewrite.originals.size,0);
    const next=frame(1);assert.equal((await rewrite.pushAsync(next))[0].data,next);
  }
  const rewrite=new IncomingRewriter({envelopeType:"server_message",passThroughOnError:true,ttlMs:5});
  const first=frame(0);await rewrite.pushAsync(first);
  assert.throws(()=>rewrite.expire(Date.now()+10),/expired/);
  assert.deepEqual(rewrite.bypass().map(f=>f.data),[first]);
  assert.equal(rewrite.assemblies.size,0);
});
test("a near-limit remote request is segmented without losing its native cursor, sequence or request ID", async () => {
  const {routing}=fixture();
  const request={type:"client_message",client_id:"phone",stream_id:"stream",seq_id:7,cursor:"native-cursor",
    message:{id:5,method:"thread/start",params:{developerInstructions:""}}};
  const overhead=Buffer.byteLength(JSON.stringify(request));
  request.message.params.developerInstructions="x".repeat(MAX_WIRE-overhead-1);
  const rewrite=new IncomingRewriter({additionalRewrite:(message,envelope)=>routing.remoteRequest(message,envelope)});
  const frames=await rewrite.pushAsync(Buffer.from(JSON.stringify(request)));
  assert.ok(frames.length>1);
  frames.forEach(frame=>assert.ok(frame.data.length<=MAX_WIRE));
  const envelopes=frames.map(frame=>JSON.parse(frame.data));
  const decoded=parse(Buffer.concat(envelopes.map(e=>Buffer.from(e.message_chunk_base64,"base64"))).toString());
  assert.equal(decoded.id,5);assert.equal(decoded.params.config.chatgpt_base_url,BACKEND);
  assert.equal(decoded.params.developerInstructions,request.message.params.developerInstructions);
  envelopes.forEach(e=>{assert.equal(e.seq_id,7);assert.equal(e.cursor,"native-cursor");assert.equal(e.segment_count,frames.length);});
  routing.close();
});
test("local bootstrap pauses chunk expiry without forgiving an incomplete message after reads resume", () => {
  const rewrite=new IncomingRewriter({ttlMs:5});
  const frame=Buffer.from(JSON.stringify({type:"client_message_chunk",client_id:"phone",stream_id:"stream",seq_id:1,
    segment_id:0,segment_count:2,message_size_bytes:4,message_chunk_base64:Buffer.from("{}").toString("base64")}));
  rewrite.push(frame);
  const start=Date.now();
  rewrite.suspendExpiry(start);
  assert.doesNotThrow(()=>rewrite.expire(start+60000));
  rewrite.resumeExpiry(start+60000);
  assert.doesNotThrow(()=>rewrite.expire(start+60001));
  assert.throws(()=>rewrite.expire(start+60010),/expired/);
});
