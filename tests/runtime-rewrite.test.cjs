"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { IncomingRewriter, parse } = require("../patches/remote-fast-list/rewrite.cjs");
const wire = value => Buffer.from(JSON.stringify(value));
function chunks(message, count = 3) {
  const bytes = wire(message);
  return Array.from({ length: count }, (_, i) => wire({ type: "client_message_chunk", client_id: "phone",
    stream_id: "s", seq_id: 7, cursor: `cursor-${i}`, segment_id: i, segment_count: count,
    message_size_bytes: bytes.length, message_chunk_base64: bytes.subarray(
      Math.floor(i * bytes.length / count), Math.floor((i + 1) * bytes.length / count)).toString("base64") }));
}
test("changes only request parameters; preserves unsafe integer IDs and cursors exactly", () => {
  const input = Buffer.from('{"type":"client_message","client_id":"phone","stream_id":"s","seq_id":18446744073709551615,"cursor":"opaque","message":{"id":9007199254740993,"method":"thread/list","params":{"useStateDbOnly":false,"limit":50,"projectId":"p","cursor":"pagination","archived":true}}}');
  const output = new IncomingRewriter().push(input)[0].data.toString();
  assert.match(output, /"seq_id":18446744073709551615/);
  assert.match(output, /"id":9007199254740993/);
  const original = parse(input.toString());
  original.message.params.useStateDbOnly = true;
  assert.equal(output, JSON.stringify(original));
});
test("non-target, binary, notification, already-patched and malformed messages stay byte-exact", () => {
  const rewrite = new IncomingRewriter();
  for (const message of [ {id:1,method:"thread/read",params:{}}, {method:"thread/list",params:{}},
    {id:1,method:"thread/list",params:[]}, {id:1,method:"thread/list",params:{useStateDbOnly:true}} ]) {
    const input = wire({type:"client_message",client_id:"phone",message});
    assert.equal(rewrite.push(input)[0].data,input);
  }
  for (const input of [Buffer.from("not JSON"),wire({type:"ping",client_id:"phone"})])
    assert.equal(rewrite.push(input)[0].data,input);
  const binary = Buffer.from([0,255,128]);
  assert.deepEqual(rewrite.push(binary,true),[{data:binary,binary:true}]);
  for (const params of [null,undefined]) {
    const input=wire({type:"client_message",message:{id:1,method:"thread/list",params}});
    assert.equal(JSON.parse(rewrite.push(input)[0].data).message.params.useStateDbOnly,true);
  }
});
test("reassembles target chunks, retaining each segment's count, sequence and cursor", () => {
  const rewrite=new IncomingRewriter();
  const input=chunks({id:3,method:"thread/list",params:{cwd:"/same",trace:{x:1},searchTerm:"x"}},4);
  let output=[];
  for(const frame of input) output.push(...rewrite.push(frame));
  assert.equal(output.length,4);
  const envelopes=output.map(f=>JSON.parse(f.data));
  for(let i=0;i<4;i++) {
    const before=JSON.parse(input[i]);
    delete before.message_size_bytes; delete before.message_chunk_base64;
    const after={...envelopes[i]}; delete after.message_size_bytes; delete after.message_chunk_base64;
    assert.deepEqual(after,before);
  }
  const bytes=Buffer.concat(envelopes.map(e=>Buffer.from(e.message_chunk_base64,"base64")));
  assert.equal(envelopes[0].message_size_bytes,bytes.length);
  assert.deepEqual(JSON.parse(bytes),{id:3,method:"thread/list",params:{cwd:"/same",trace:{x:1},searchTerm:"x",useStateDbOnly:true}});
  assert.equal(rewrite.buffered,0);
});
test("non-target chunks remain original bytes", () => {
  const rewrite=new IncomingRewriter();
  const input=chunks({id:3,method:"thread/resume",params:{threadId:"t"}});
  const output=input.flatMap(f=>rewrite.push(f));
  output.forEach((f,i)=>assert.equal(f.data,input[i]));
});
test("chunk order, duplicates, corrupt sizes, bounds and timeout fail closed", () => {
  const input=chunks({id:3,method:"thread/list",params:{}},3);
  assert.throws(()=>new IncomingRewriter().push(input[1]));
  const duplicate=new IncomingRewriter(); duplicate.push(input[0]);
  assert.throws(()=>duplicate.push(input[0]));
  assert.throws(()=>new IncomingRewriter({maxBuffered:1}).push(input[0]));
  const expired=new IncomingRewriter({ttlMs:1}); expired.push(input[0]);
  assert.throws(()=>expired.expire(Date.now()+10));
  for (const patch of [{segment_count:1025},{message_size_bytes:0},{message_chunk_base64:"!!"}])
    assert.throws(()=>new IncomingRewriter().push(wire({...JSON.parse(input[0]),...patch})));
});
