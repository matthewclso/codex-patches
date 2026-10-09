'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const asar = require('../lib/asar.cjs');
const app = require('../lib/app-patches.cjs');
const feature = require('../patches/browser-feature-recovery/index.cjs');
const runtime = require('../patches/runtime-sync-recovery/index.cjs');
const sourcePath = process.env.CODEX_SOURCE_ASAR;
let archive;
function source(patch) {
  archive ??= asar.parseArchive(fs.readFileSync(sourcePath));
  const bytes = asar.readEntry(archive, patch.targetPath);
  assert.equal(asar.sha256(bytes), patch.sourceSha256);
  return bytes.toString();
}
function between(s, first, last) {
  const i=s.indexOf(first), j=s.indexOf(last,i+first.length);
  assert(i>=0&&j>i, 'Missing reviewed source boundary: '+first);
  return s.slice(i,j);
}
const sourceTest = (name, fn) => test(name, {skip: !sourcePath && 'Set CODEX_SOURCE_ASAR to pristine 26.1002 archive'}, t => {
  archive ??= asar.parseArchive(fs.readFileSync(sourcePath));
  if (!asar.listEntries(archive.tree).some(e => e.path === feature.targetPath)) { t.skip('Recovery modules apply only to reviewed 26.1002 source'); return; }
  return fn();
});
function capability(s, query, policy, name='browser.in-app') {
  const expr = between(s,'Q8=Ck(Q,',';function n_i(').replace(/^Q8=/,'').replace(/\}\)\)\)\(\)\}var t_i$/,'');
  // Extract the actual capability callback, including aggregate policy checks.
  const code=expr.slice(0,expr.indexOf('},{isEqual:$gi})')+'},{isEqual:$gi})'.length);
  const raw=vm.runInNewContext('('+between(s,'"browser.in-app":','"chatgpt.seat-access":').slice('"browser.in-app":'.length).replace(/,$/,'')+')');
  const flatten=vm.runInNewContext(between(s,'function Kgi(','var Jgi;')+';Kgi');
  const descriptors=flatten({'browser.in-app':raw,other:raw});
  assert.deepEqual(Array.from(descriptors['browser.in-app'].accessPolicies),['workspace-in-app-browser']);
  assert.equal(descriptors['browser.in-app'].settings.length,0);assert.equal(descriptors['browser.in-app'].statsig.length,0);
  assert(between(s,'function sGr(','function cGr(').includes('a={name:`browser.in-app`}'));
  const sandbox = { Q:{},Ck:(_q,fn)=>fn,Qgi:vm.runInNewContext('('+between(s,'function Qgi(','function $gi(')+')'),$gi:()=>{},yI:'local',f6:'features',Wgi:{'workspace-in-app-browser':'policy'},e_i:descriptors };
  const fn=vm.runInNewContext(code,sandbox);
  return JSON.parse(JSON.stringify(fn({name},{get:(key,host)=>{if(key==='features'){assert.equal(host,'local');return query}return policy}})));
}
sourceTest('actual browser capability: transient errors retain confirmed config, unknown waits, explicit disables and policy win', () => {
  const stock=source(feature), patched=feature.apply(stock,app.replaceExactlyOnce), allowed={isLoading:false,isError:false,isCapable:true};
  const q={isLoading:false,isError:true,error:Error('App server request expired while queued'),data:[{name:'in_app_browser',enabled:true}]};
  assert.equal(capability(stock,q,allowed).isCapable,false);
  assert.deepEqual(capability(patched,q,allowed),{isLoading:false,isError:true,isCapable:true});
  assert.deepEqual(capability(patched,{...q,data:undefined},allowed),{isLoading:true,isError:true,isCapable:false});
  assert.equal(capability(patched,{...q,data:[{name:'in_app_browser',enabled:false}]},allowed).isCapable,false);
  assert.equal(capability(patched,{...q,error:Error('Permission denied')},allowed).isCapable,false);
  for (const data of [undefined,q.data]) {
    const denied=capability(patched,{...q,data},{...allowed,isCapable:false});
    assert.equal(denied.isCapable,false);assert.equal(denied.isLoading,false);
  }
  for(const query of [{isLoading:false,isError:false,data:[]},{isLoading:false,isError:false,data:[{name:'in_app_browser',enabled:false}]},q]) {
    assert.deepEqual(capability(patched,query,allowed,'other'),capability(stock,query,allowed,'other'));
  }
  // Unknown query must become a loading Browser gate, so the stock publisher
  // cannot send a false disable event to destructive plugin reconciliation.
  const run=(text,cap)=>{
    const sandbox={lGr:{c:()=>Array(22).fill(Symbol.for('react.memo_cache_sentinel'))}, Q8:'cap', DHr:'requirements', QN:{},
      Ik:key=>key==='cap'?cap:{allowed:true,isPending:false}, IU:()=>true, IHr:()=>({enabled:true,isLoading:false}), D2:()=>({}),JOn:()=>false,uzt:()=>({kind:'local'}),
      cGr:vm.runInNewContext('('+between(text,'function cGr(','var lGr;')+')')};
    return vm.runInNewContext('('+between(text,'function sGr(','function cGr(')+')',sandbox)({hostId:'local'});
  };
  assert.deepEqual(JSON.parse(JSON.stringify(run(patched,{isLoading:true,isCapable:false}))),{allowed:false,available:false,isLoading:true,reason:'loading'});
  assert.equal(run(stock,{isLoading:true,isCapable:false}).reason,'browser-pane-disabled');
  assert.deepEqual(JSON.parse(JSON.stringify(run(patched,{isLoading:false,isCapable:false}))),{allowed:false,available:false,isLoading:false,reason:'browser-pane-disabled'});
});
function syncSandbox(text, options={}) {
  let calls=0, delays=[], pipe='expired', writes=[];
  const connection={hostConfig:{kind:'local'}};
  const sandbox={rc:new WeakMap,ic:new WeakMap,setTimeout:(fn,ms)=>{delays.push(ms);pipe='current';queueMicrotask(fn)},
    lc:async e=>{calls++;writes.push({pipe,reload:e.reloadUserConfig});if(options.failAlways||calls<=(options.failures??1))throw Error(options.message??'Timed out waiting for MCP response to config/batchWrite');return{selection:{pipe},cuaReplEnabled:false}}};
  vm.runInNewContext(between(text,'function cc(','async function lc(')+';globalThis.sync=cc;',sandbox);
  return {sandbox,connection,calls:()=>calls,delays,writes};
}
sourceTest('actual runtime sync: retry fresh pipe, bound timeout retries, keep permanent failures and serialize writes', async()=>{
  const stock=source(runtime),patched=runtime.apply(stock,app.replaceExactlyOnce);
  const before=syncSandbox(stock);await assert.rejects(before.sandbox.sync({appServerConnection:before.connection}));assert.equal(before.calls(),1);
  const after=syncSandbox(patched);const result=await after.sandbox.sync({appServerConnection:after.connection});
  assert.equal(result.selection.pipe,'current');assert.equal(after.calls(),2);assert.deepEqual(after.delays,[1000]);
  const exhausted=syncSandbox(patched,{failAlways:true});await assert.rejects(exhausted.sandbox.sync({appServerConnection:exhausted.connection}));assert.equal(exhausted.calls(),3);assert.deepEqual(exhausted.delays,[1000,2000]);
  const denied=syncSandbox(patched,{failAlways:true,message:'Permission denied'});await assert.rejects(denied.sandbox.sync({appServerConnection:denied.connection}));assert.equal(denied.calls(),1);
  const concurrent=syncSandbox(patched,{failures:0});await Promise.all([concurrent.sandbox.sync({appServerConnection:concurrent.connection}),concurrent.sandbox.sync({appServerConnection:concurrent.connection})]);assert.equal(concurrent.calls(),2);
});
sourceTest('actual local chat runtime recovery coalesces refresh, reloads app-managed config and preserves remote hosts', async()=>{
  const patched=runtime.apply(source(runtime),app.replaceExactlyOnce), ctx=syncSandbox(patched,{failures:0});
  let features={browserUseTinysky:false};
  Object.assign(ctx.sandbox,{oc:async()=>null,K:()=>features,ws:async()=>({}),Qs:async()=>({worker:'current'}),Aa:{legacy:'disabled'}});
  vm.runInNewContext(between(patched,'async function dc(','var fc=')+';globalThis.config=dc;',ctx.sandbox);
  const requests=Array.from({length:5},()=>ctx.sandbox.config({appServerConnection:ctx.connection}));
  await Promise.all(requests);assert.equal(ctx.calls(),1);assert.equal(ctx.writes[0].reload,true);
  await ctx.sandbox.config({appServerConnection:ctx.connection});assert.equal(ctx.calls(),1,'Failed reconciliation must not force a new write on every chat after recovery succeeds');
  features={browserUseTinysky:false};await ctx.sandbox.config({appServerConnection:ctx.connection});assert.equal(ctx.calls(),2,'Current features invalidate a previous recovery');
  ctx.sandbox.ic.set(ctx.connection,Promise.resolve());await ctx.sandbox.config({appServerConnection:ctx.connection});assert.equal(ctx.calls(),3,'New reconciliation generation invalidates recovery');
  await ctx.sandbox.config({appServerConnection:{hostConfig:{kind:'ssh'}},desktopFeatureAvailability:{browserUseTinysky:false}});assert.equal(ctx.calls(),3);
});
sourceTest('actual bundled reconciler retries failed signature on focus, skips successful signature and follows latest disables',async()=>{
  const stock=source(runtime),patched=runtime.apply(stock,app.replaceExactlyOnce);
  async function exercise(text,keepFail=false) {
    let count=0,syncs=0,external=0,names=[],failed=true;
    const sandbox={process:{env:{},platform:'win32'},r:{Zo:()=> 'market'},La:()=> 'root',Ia:()=> 'resources',Ra:()=>new Set(),s:{},u:{t:{Dev:'dev',Prod:'prod'}},
      hd:[{name:'browser',isAvailable:({features})=>features.inAppBrowserUseAllowed}],Yr:{},ai:()=>true,gd:()=>({info(){},warning(){}}),
      yd:()=>undefined,ac:()=>{},Kc:async()=>{},cc:async()=>{syncs++},Oie:async()=>{},sne:async()=>{external++;return null},
      Lo:async e=>{if(text!==stock)assert.equal(e.throwOnReconcileFailure,true);count++;names.push(e.marketplacePluginNames);if(failed){failed=keepFail;throw Error('Timed out waiting for MCP response to marketplace/add')}return{hadReconcileFailure:false,hadUnknownChromeExtensionSyncState:false}},
      Cne:async()=>{},_d:new Set(),ua:{},kie:'dev'};
    const factory=vm.runInNewContext('('+between(text,'function jie(','function yd(')+')',sandbox);
    const instance=factory({env:{},resourcesPath:'r',runtimeMarketplaceRoot:'m',codexHome:'home',buildFlavor:'prod',isPackaged:true,appVersion:'version',globalState:{get:()=>null},getLocalAppServerConnection:()=>({listPlugins:async()=>({marketplaces:[]})})});
    await instance.reconcileExternalPluginState();assert.equal(count,0,'Focus before availability must skip destructive reconciliation');
    await instance.setDesktopFeatureAvailability({inAppBrowserUseAllowed:true});assert.equal(count,1);
    await instance.reconcileExternalPluginState();
    if(text===stock) return {count};
    if(keepFail){assert.equal(count,2);assert.equal(syncs,0);assert.equal(external,1,'Focus must retain stock external reconciliation even when recovery fails');return{count};}
    assert.equal(count,2);assert.equal(syncs,1);
    await instance.reconcileExternalPluginState();assert.equal(count,2);assert.equal(syncs,1);
    await instance.setDesktopFeatureAvailability({inAppBrowserUseAllowed:false});assert.equal(count,3);assert.deepEqual(Array.from(names.at(-1)),[]);
    await Promise.all([instance.setDesktopFeatureAvailability({inAppBrowserUseAllowed:true}),instance.setDesktopFeatureAvailability({inAppBrowserUseAllowed:false}),instance.reconcileExternalPluginState()]);
    assert.deepEqual(Array.from(names.at(-1)),[],'Serialized reconciliation must finish with the latest confirmed feature state');
    return {count};
  }
  assert.equal((await exercise(stock)).count,1);await exercise(patched);await exercise(patched,true);
});
sourceTest('actual sync and native config generator refresh current executable and managed pipe after timed-out write',async()=>{
  const patched=runtime.apply(source(runtime),app.replaceExactlyOnce);
  let generation=0, pipe='old-pipe', calls=[];
  const connection={hostConfig:{kind:'local'},listPlugins:async()=>({marketplaces:[]}),sendAppServerRequest:async(method,request)=>{
    assert.equal(method,'config/batchWrite');calls.push(JSON.parse(JSON.stringify(request)));
    if(calls.length===1){pipe='current-pipe';throw Error('Timed out waiting for MCP response to config/batchWrite')}
  }};
  const sandbox={rc:new WeakMap,M:{default:{env:{}}},K:()=>({}),Ts(){},o:{_t:()=>true},ua:{},r:{ts:'cua_repl',as:'node_repl'},nc:[],Aa:{'mcp_servers.cua_repl':{enabled:false}},
    ws:async()=>({codexHome:'home',marketplaceName:'market',browserServicePluginVersion:'version',desktopFeatureAvailability:{},runtimePaths:{platform:'win32',nodeReplPath:'current-repl-'+(++generation)},shouldUseWslPaths:true,browserBackends:['iab'],computerUse:true,computerUsePaths:{},cuaReplSurfaces:[]}),
    Hs:async()=>pipe,Ks:{info(){}},$s:options=>({'mcp_servers.node_repl':{command:options.runtimePaths.nodeReplPath,env:{SKY_CUA_NATIVE_PIPE_DIRECTORY:options.computerUseNativePipePath}}}),Na:async()=>false,Mne:async()=>{},Ma(){},Ia:()=> 'resources',setTimeout:fn=>queueMicrotask(fn)};
  vm.runInNewContext(between(patched,'async function Qs(','function $s(')+between(patched,'function cc(','async function dc(')+';globalThis.sync=cc;',sandbox);
  await sandbox.sync({appServerConnection:connection,appVersion:'version'});
  assert.equal(calls.length,2);
  const worker=request=>request.edits.find(e=>e.keyPath==='mcp_servers.node_repl').value;
  assert.equal(worker(calls[0]).command,'current-repl-1');assert.equal(worker(calls[0]).env.SKY_CUA_NATIVE_PIPE_DIRECTORY,'old-pipe');
  assert.equal(worker(calls[1]).command,'current-repl-2');assert.equal(worker(calls[1]).env.SKY_CUA_NATIVE_PIPE_DIRECTORY,'current-pipe');
  assert.equal(calls[1].reloadUserConfig,true);
});
sourceTest('actual managed pipe runtime coalesces repeated readiness requests without restarting an active turn',async()=>{
  const stock=source(runtime);let starts=0,disposed=0,closed=0;
  const sandbox={process:{env:{},platform:'win32'},Vs:null,o:{bt:()=> 'helper',xt:()=> 'transport'},Bs:()=>({info(){},warning(){}})};
  const factory=vm.runInNewContext('('+between(stock,'function Us(','var Ws=')+')',sandbox);
  const server={pipePath:'fixture-pipe',dispose:async()=>{disposed++},closeActiveTurn:async()=>{closed++;return true},hasActiveTurn:()=>true};
  const bridge=factory({codexHome:'fixture',platform:'win32',resourcesPath:'resources',ensureNotifyConfig:async()=>({configChanged:false}),startServer:async()=>{starts++;return server}});
  bridge.setDesktopFeatureAvailability({computerUse:true});
  const pipes=await Promise.all(Array.from({length:8},()=>bridge.ensureReadyPipePath()));
  assert(pipes.every(p=>p==='fixture-pipe'));assert.equal(starts,1);assert.equal(closed,0);
  await bridge.ensureReadyPipePath();assert.equal(starts,1);assert.equal(bridge.hasActiveTurn('turn'),true);
  bridge.dispose();await Promise.resolve();assert.equal(disposed,1);assert.equal(closed,0);
});
sourceTest('actual availability publisher does not send a Browser disable while capability discovery is pending',()=>{
  const entry=asar.listEntries(archive.tree).find(e=>/^webview\/assets\/app-initial-[^/]+\.js$/.test(e.path));assert(entry);
  const initial=asar.readEntry(archive,entry.path).toString();
  const condition=between(initial,'s||se.isLoading||ce.isLoading||le.isLoading||','||(oh.dispatchMessage(`electron-desktop-features-changed`');
  let published=0;
  const run=pending=>vm.runInNewContext(condition+'||publish()',{
    s:false,se:{isLoading:pending},ce:{isLoading:false},le:{isLoading:false},ge:{isLoading:false},ve:{isLoading:false},P:'available',O:{status:'allowed'},ze:{status:'allowed'},Be:{status:'allowed'},publish:()=>{published++},
  });
  run(true);assert.equal(published,0);run(false);assert.equal(published,1);
  assert(initial.includes('inAppBrowserUse:se.available')&&initial.includes('inAppBrowserUseAllowed:se.allowed'));
});
