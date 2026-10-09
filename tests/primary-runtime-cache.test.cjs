"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {cacheEnvironment}=require("../patches/primary-runtime-cache/index.cjs");
const {AppServerRpc}=require("../patches/remote-fast-list/rpc.cjs");
const BINARY=process.env.CODEX_RELAY_TEST_BINARY;
test("cache alignment preserves disabled behavior and refuses an explicit conflicting cache preference",()=>{
  const inherited={CODEX_HOME:"/home/shared/.codex",XDG_CACHE_HOME:"/cache/existing",OTHER:"preserve"};
  assert.equal(cacheEnvironment({},inherited),inherited);
  assert.throws(()=>cacheEnvironment({primaryRuntimeCacheHome:"relative"},{}),/absolute/);
  assert.throws(()=>cacheEnvironment({primaryRuntimeCacheHome:"/cache/desktop"},inherited),/conflicts/);
  assert.deepEqual(cacheEnvironment({primaryRuntimeCacheHome:"/cache/desktop"},{OTHER:"preserve"}),{OTHER:"preserve",XDG_CACHE_HOME:"/cache/desktop"});
  assert.equal(inherited.XDG_CACHE_HOME,"/cache/existing");
});
test("stock Linux CLI rejects the misplaced reserved marketplace and accepts it at its aligned cache root",{skip:!BINARY || process.platform==="win32",timeout:45000},async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"codex-primary-cache-"));
  const desktopCache=path.join(root,"desktop-cache"),linuxCache=path.join(root,"linux-cache");
  const marketplace=path.join(desktopCache,"codex-runtimes/codex-primary-runtime/plugins/openai-primary-runtime");
  fs.mkdirSync(path.join(marketplace,".agents/plugins"),{recursive:true});
  fs.writeFileSync(path.join(marketplace,".agents/plugins/marketplace.json"),JSON.stringify({name:"openai-primary-runtime",plugins:[]}));
  fs.mkdirSync(linuxCache);fs.writeFileSync(path.join(linuxCache,"preserved"),"existing cache");
  try{
    for(const fixed of [false,true]){
      const home=path.join(root,fixed?"fixed-home":"stock-home"),sqlite=path.join(home,"sqlite");
      fs.mkdirSync(sqlite,{recursive:true,mode:0o700});
      const env=fixed?cacheEnvironment({primaryRuntimeCacheHome:desktopCache},{CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED:"1"}):{XDG_CACHE_HOME:linuxCache};
      const rpc=new AppServerRpc(BINARY,home,sqlite,["-c","features.apps=false"],{processEnv:env});
      try{
        await rpc.initialize();
        if(fixed){
          const result=await rpc.request("marketplace/add",{source:marketplace});
          assert.equal(result.marketplaceName,"openai-primary-runtime");
        }else await assert.rejects(rpc.request("marketplace/add",{source:marketplace}),error=>{assert.match(error.rpcError?.message??"",/reserved/);return true;});
      }finally{await rpc.close();}
    }
    assert.equal(fs.readFileSync(path.join(linuxCache,"preserved"),"utf8"),"existing cache");
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
