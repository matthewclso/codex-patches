"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const {normalizeAccountRouting} = require("../patches/remote-fast-list/account-routing.cjs");
test("default backend origin remains upstream; residency, overrides and missing fields are untouched", () => {
  const input=Buffer.from('{"accounts":[{"workspace_backend_origin":"NO_CONSTRAINT","account_routing_override":"NO_CONSTRAINT"},{"workspace_backend_origin":"https://eu.example.invalid","account_routing_override":"RESIDENCY"},{"workspace_backend_origin":null},{}],"unknown":9007199254740993}');
  for (const [encoding,compress] of [["identity",v=>v],["gzip",zlib.gzipSync],["deflate",zlib.deflateSync],["br",zlib.brotliCompressSync],["zstd",zlib.zstdCompressSync]]) {
    const output=normalizeAccountRouting(compress(input),encoding,"https://chatgpt.com");
    assert.match(output.toString(),/9007199254740993/);
    const value=JSON.parse(output);
    assert.deepEqual(value.accounts,[{workspace_backend_origin:"https://chatgpt.com",account_routing_override:"NO_CONSTRAINT"},
      {workspace_backend_origin:"https://eu.example.invalid",account_routing_override:"RESIDENCY"},{workspace_backend_origin:null},{}]);
  }
  for (const input of ['{"accounts":[{}]}','{"accounts":{"old":{"workspace_backend_origin":"NO_CONSTRAINT"}}}'])
    assert.equal(normalizeAccountRouting(Buffer.from(input),"identity","https://chatgpt.com"),null);
});
