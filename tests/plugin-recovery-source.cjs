'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const asar = require('../lib/asar.cjs');
const app = require('../lib/app-patches.cjs');
let feature = require('../patches/browser-feature-recovery/index.cjs');
let runtime = require('../patches/runtime-sync-recovery/index.cjs');
const sourcePath = process.env.CODEX_SOURCE_ASAR;
let archive, source1007, source9446, source1013, source1016, source1021, source1023, selected;
// Fixture aliases are bound to one exact reviewed archive, never guessed.
const currentNames = { Q8:'$8', Ck:'Xk', Q:'X', Kgi:'bbi', Jgi:'Sbi', Qgi:'Ebi', $gi:'Dbi', yI:'II', f6:'p6', Wgi:'vbi', e_i:'Obi',
  sGr:'GJr', cGr:'KJr', lGr:'qJr', Ik:'pA', DHr:'tKr', IU:'nW', IHr:'uKr', D2:'S2', QN:'cP', JOn:'$kn', uzt:'pzt',
  lkn:'mAn', ukn:'hAn', zK:'qK',
  rc:'lc', ic:'uc', cc:'mc', lc:'hc', oc:'fc', ws:'ks', Qs:'ic', Aa:'Ia', dc:'_c', fc:'vc',
  jie:'sie', yd:'vf', La:'za', Ia:'Ra', Ra:'one', u:'p', hd:'mf', Yr:'xa', ai:'Ai', gd:'hf', ac:'dc', Kc:'Qc',
  Oie:'aie', sne:'Ane', Lo:'Ho', Cne:'yne', _d:'gf', ua:'bi', kie:'aie',
  M:'P', Ts:'As', Hs:'Js', Ks:'Qs', $s:'ac', Na:'rne', Mne:'tre', Ma:'La', nc:'cc',
  Us:'Ys', Ws:'Xs', Vs:'qs', Bs:'Ks' };
const latestNames = { ...currentNames,
  rc:'jc', ic:'Mc', cc:'Ic', lc:'Lc', oc:'Pc', ws:'Ls', Qs:'Ec', Aa:'eo', dc:'zc', fc:'Bc',
  jie:'Rie', yd:'Bd', La:'so', Ia:'oo', Ra:'Rte', hd:'Id', Yr:'Pa', ai:'Di', gd:'Ld', ac:'Nc', Kc:'bl',
  Oie:'Fie', sne:'Sne', Lo:'Xo', Cne:'wne', _d:'Rd', ua:'_i', kie:'Iie',
  Ts:'Rs', Hs:'gc', Ks:'bc', $s:'Dc', Na:'ro', Mne:'qne', Ma:'no', nc:'Ac',
  Us:'_c', Ws:'vc', Vs:'hc', Bs:'mc' };
const modernNames = { ...latestNames,
  Q8:'ty',Ck:'wc',Q:'U',Kgi:'VKt',Jgi:'UKt',Qgi:'qKt',$gi:'JKt',yI:'Ls',f6:'Jh',Wgi:'zKt',e_i:'YKt',
  sGr:'dRn',cGr:'fRn',lGr:'pRn',Ik:'Eu',DHr:'mLn',IU:'Kv',IHr:'TLn',D2:'OT',QN:'Xr',JOn:'H',uzt:'Mh',lkn:'EDt',ukn:'DDt',zK:'og',
  rc:'Ws',ic:'Gs',cc:'Js',lc:'Ure',oc:'qs',ws:'Ss',Qs:'Hs',Aa:'Ea',dc:'Zs',fc:'Kre',K:'q',
  jie:'sae',yd:'ed',La:'Pa',Ia:'Na',Ra:'Fa',u:'n',r:'i',hd:'Xu',Yr:'oa',ai:'mi',gd:'Zu',ac:'Ks',Kc:'Sc',
  Oie:'iae',sne:'bne',Lo:'Fo',Cne:'Sne',_d:'Qu',ua:'ii',kie:'aae',M:'L',Ts:'Cs',o:'l',Hs:'jre',Ks:'Vs',$s:'zre',Na:'ka',Mne:'Gne',Ma:'Oa',nc:'Vre',
  Us:'Mre',Ws:'Bs',Vs:'zs',Bs:'Rs' };
const oct16Names = { ...modernNames,
  Q8:'sy',Ck:'Yl',Q:'J',Kgi:'fJt',Jgi:'gJt',Qgi:'vJt',$gi:'yJt',yI:'Do',f6:'Eh',Wgi:'uJt',e_i:'bJt',
  sGr:'KBn',cGr:'qBn',lGr:'JBn',Ik:'Nc',DHr:'Gzn',IU:'Qv',IHr:'oBn',QN:'wo',JOn:'Rs',uzt:'sh',lkn:'nEt',ukn:'rEt',zK:'Rh',
  rc:'Gs',ic:'Ks',cc:'Ys',oc:'Js',ws:'Cs',Qs:'Us',Aa:'Da',dc:'Qs',fc:'Kre',Ra:'Ia',Ia:'Fa',ai:'hi',ac:'qs',Kc:'Oc',M:'R',Ts:'ws',Ks:'Hs',nc:'Vre',ua:'sa',Lo:'Io',Bs:'zs',Vs:'Bs',Ws:'Vs',Na:'Aa',Ia:'Pa',
};
const oct21Names = { ...oct16Names,
  Q8:'mx',Ck:'H',Q:'V',Kgi:'gBt',Jgi:'vBt',Qgi:'SBt',$gi:'CBt',yI:'Er',f6:'Hg',Wgi:'mBt',e_i:'wBt',
  sGr:'PPn',cGr:'FPn',lGr:'IPn',Ik:'ns',DHr:'NNn',IU:'ox',IHr:'JNn',D2:'VO',QN:'$n',JOn:'ms',uzt:'sht',lkn:'$gt',ukn:'e_t',zK:'r_',
  rc:'Oc',ic:'kc',cc:'Mc',lc:'Fae',oc:'jc',ws:'ic',Qs:'Ec',Aa:'Do',dc:'Ic',fc:'zae',K:'va',
  jie:'yce',yd:'ku',La:'Ao',Ia:'Ao',Ra:'wre',hd:'Tu',ai:'Sa',gd:'Eu',ac:'Ac',Kc:'uoe',Oie:'gce',sne:'cie',Lo:'bs',Cne:'uie',_d:'Du',ua:'mo',kie:'_ce',
  M:'I',Ts:'ac',Hs:'bae',Ks:'Tc',$s:'jae',Na:'xre',Mne:'Iie',Ma:'Oo',nc:'Nae',Us:'xae',Ws:'wc',Vs:'Cc',Bs:'Sc',Xs:'Pc',Zs:'Fc',Gre:'Lae',
};
const oct23Names = { ...oct21Names,
  Q8:'fx',Ck:'U',Q:'Q',Kgi:'rPt',Jgi:'aPt',Qgi:'lPt',$gi:'uPt',yI:'Bs',f6:'Tg',Wgi:'tPt',e_i:'dPt',
  sGr:'Bjn',cGr:'Vjn',lGr:'Hjn',Ik:'An',DHr:'zAn',IU:'Xb',IHr:'ejn',D2:'zO',QN:'ko',JOn:'Eo',uzt:'kNt',lkn:'qlt',ukn:'Jlt',zK:'Bg',
  rc:'Sc',ic:'Cc',cc:'Ec',lc:'Eoe',oc:'Tc',ws:'ec',Qs:'bc',Aa:'Po',dc:'jc',fc:'Aoe',K:'fa',
  jie:'yle',yd:'_u',La:'Lo',Ia:'Lo',Ra:'nie',hd:'pu',ai:'ga',gd:'mu',ac:'wc',Kc:'tse',Oie:'oae',sne:'Bie',Lo:'Ds',Cne:'Hie',_d:'hu',ua:'xo',kie:'_le',
  M:'L',Ts:'tc',Hs:'doe',Ks:'yc',$s:'Soe',Na:'$re',Mne:'Tae',Ma:'Fo',nc:'Doe',Us:'foe',Ws:'vc',Vs:'_c',Bs:'gc',Xs:'kc',Zs:'Ac',Gre:'Ooe',
};
const names = () => source1023 ? oct23Names : source1021 ? oct21Names : source1016 ? oct16Names : source1013 ? modernNames : source9446 ? latestNames : currentNames;
const named = text => source1007 ? text.replace(/[A-Za-z_$][\w$]*/g, name => names()[name] ?? name) : text;
const context = values => source1007 ? Object.fromEntries(Object.entries(values).map(([key,value]) => [names()[key] ?? key, value])) : values;
function setup(t) {
  if (selected) return true;
  const bytes=fs.readFileSync(sourcePath); archive=asar.parseArchive(bytes);
  source1023=asar.sha256(bytes)==='99ed83950473e34e642f2942226bf40ce9b65e9910afbe8e406120459823c02d';
  source1021=source1023 || asar.sha256(bytes)==='04862a659c6a90fc50514d8c0b8016709d97dece58839726c57495ed72f1d9f0';
  source1016=source1021 || asar.sha256(bytes)==='760eae730e57438a0693cab4aba5ed8b7eb0ea1c5b7a7dc26dd0e84c2398810f';
  source1013=source1016 || ['163a18c84db57ad5c50222b313dc4d11d45febc03ec065b516ba9f0380f2eb3f',
    'bbec1d64e135b718a154b31655bb8ad9a39472bac1b2cabba991a9d97a339dd8'].includes(asar.sha256(bytes));
  source9446=source1013 || asar.sha256(bytes)==='356c13dc715816436fa1cf31e9f77863f62ea7b7cacc465b397313246eb29325';
  source1007=source9446 || asar.sha256(bytes)==='c5fdef328cfa2ad9095786f9c3a7aaa447e68834d31299d6ef2592da02029038';
  const entries=asar.listEntries(archive.tree);
  if (![feature,...feature.revisions??[]].some(p=>entries.some(e=>e.path===p.targetPath))) {
    const known=require('../compatibility/current.json').builds.find(b=>b.archiveSha256===asar.sha256(bytes));
    assert(known && !known.patches[feature.id], 'Missing recovery source in an unknown or recovery-enabled build');
    t.skip('This older reviewed build predates the recovery patches'); return false;
  }
  const plan=app.inspectArchive(bytes,[feature.id,runtime.id],{allowUnknownForAudit:true});
  [feature,runtime]=[feature,runtime].map(p=>{const row=plan.patches.find(r=>r.id===p.id);assert(row?.sourceHash,'Missing reviewed recovery module');return app.patchForSource(p.id,row.sourceHash)});
  selected=true; return true;
}
function source(patch) {
  archive ??= asar.parseArchive(fs.readFileSync(sourcePath));
  const bytes = asar.readEntry(archive, patch.targetPath);
  assert.equal(asar.sha256(bytes), patch.sourceSha256);
  return bytes.toString();
}
function between(s, first, last) {
  first=named(first);last=named(last);
  const i=s.indexOf(first), j=s.indexOf(last,i+first.length);
  assert(i>=0&&j>i, 'Missing reviewed source boundary: '+first);
  return s.slice(i,j);
}
const sourceTest = (name, fn) => test(name, {skip: !sourcePath && 'Set CODEX_SOURCE_ASAR to a pristine reviewed archive'}, t => {
  if (!setup(t)) return;
  return fn();
});
function capability(s, query, policy, name='browser.in-app', provider) {
  const expr = between(s,'Q8=Ck(Q,','},{isEqual:$gi})').slice(named('Q8=').length);
  // Extract the actual callback with its current policy and config dependencies.
  const code=expr+named('},{isEqual:$gi})');
  const raw=vm.runInNewContext('('+between(s,'"browser.in-app":','"chatgpt.seat-access":').slice('"browser.in-app":'.length).replace(/,$/,'')+')');
  const flatten=vm.runInNewContext(between(s,'function Kgi(','var Jgi;')+named(';Kgi'));
  const descriptors=flatten({'browser.in-app':raw,other:provider===undefined?raw:{...raw,requiresFirstPartyInference:true}});
  assert.deepEqual(Array.from(descriptors['browser.in-app'].accessPolicies),['workspace-in-app-browser']);
  assert.equal(descriptors['browser.in-app'].settings.length,0);assert.equal(descriptors['browser.in-app'].statsig.length,0);
  assert(between(s,'function sGr(','function cGr(').includes('a={name:`browser.in-app`}'));
  const sandbox = context({ Q:{},Ck:(_q,fn)=>fn,Qgi:vm.runInNewContext('('+between(s,'function Qgi(','function $gi(')+')'),$gi:()=>{},yI:'local',f6:'features',Wgi:{'workspace-in-app-browser':'policy'},e_i:descriptors });
  if (source1016) Object.assign(sandbox,source1023?{Lg:'provider-gate',yg:'provider-config',ng:value=>value}:source1021?{e_:'provider-gate',Ig:'provider-config',dg:value=>value}:{Fh:'provider-gate',xh:'provider-config',Xm:value=>value});
  const fn=vm.runInNewContext(code,sandbox);
  return JSON.parse(JSON.stringify(fn({name},{get:(key,host)=>{if(key==='provider-gate')return true;if(key==='provider-config'){assert.equal(host.hostId,'local');assert.equal(host.failClosed,true);return provider}if(key==='features'){assert.equal(host,'local');return query}return policy}})));
}
sourceTest('actual browser capability: transient errors retain confirmed config, unknown waits, explicit disables and policy win', () => {
  const stock=source(feature), patched=feature.apply(stock,app.replaceExactlyOnce), allowed={isLoading:false,isError:false,isCapable:true};
  const q={isLoading:false,isError:true,error:Error('App server request expired while queued'),data:[{name:'in_app_browser',enabled:true}]};
  assert.equal(capability(stock,q,allowed).isCapable,false);
  assert.deepEqual(capability(patched,q,allowed),{isLoading:false,isError:true,isCapable:true});
  assert.deepEqual(capability(patched,{...q,data:undefined},allowed),{isLoading:true,isError:true,isCapable:false});
  assert.equal(capability(patched,{...q,data:[{name:'in_app_browser',enabled:false}]},allowed).isCapable,false);
  for(const message of ['Permission denied','Unauthorized','HTTP 403 Forbidden','HTTP 401'])assert.equal(capability(patched,{...q,error:Error(message)},allowed).isCapable,false);
  for(const message of ['fetch failed','ECONNRESET','socket hang up','service unavailable','aborted'])assert.equal(capability(patched,{...q,error:Error(message)},allowed).isCapable,true);
  const workspace=vm.runInNewContext('('+between(stock,'function lkn(','var ukn;')+')',context({zK:()=>true}));
  const pendingPolicy=workspace({getAccount:()=>({authMethod:'chatgpt',accountId:'account',authenticatedAccountId:'account',plan:'enterprise'}),getAccountInfoError:()=>false,permissions:['browser'],getWorkspaceSettings:()=>({isLoading:true,isError:false})});
  assert.equal(pendingPolicy.isLoading,true);assert.equal(capability(patched,{...q,data:undefined},pendingPolicy).isLoading,true);
  for (const data of [undefined,q.data]) {
    const denied=capability(patched,{...q,data},{...allowed,isCapable:false});
    assert.equal(denied.isCapable,false);assert.equal(denied.isLoading,false);
  }
  for(const query of [{isLoading:false,isError:false,data:[]},{isLoading:false,isError:false,data:[{name:'in_app_browser',enabled:false}]},q]) {
    assert.deepEqual(capability(patched,query,allowed,'other'),capability(stock,query,allowed,'other'));
  }
  if (source1016) {
    const confirmed={isLoading:false,isError:false,data:[{name:'in_app_browser',enabled:true}]};
    for(const provider of [{isError:false,data:{config:{model_provider:'openai'}}},{isError:false,data:{config:{model_provider:'custom'}}},{isError:false},{isError:true}]) {
      const native=capability(stock,confirmed,allowed,'other',provider);
      assert.deepEqual(capability(patched,confirmed,allowed,'other',provider),native,'The native first-party inference restriction must remain unchanged');
      assert.equal(native.isCapable,provider.data?.config.model_provider==='openai');
    }
  }
  // Unknown query must become a loading Browser gate, so the stock publisher
  // cannot send a false disable event to destructive plugin reconciliation.
  const run=(text,cap)=>{
    const sandbox=context({lGr:{c:()=>Array(22).fill(Symbol.for('react.memo_cache_sentinel'))}, Q8:'cap', DHr:'requirements', QN:{},
      Ik:key=>key==='cap'?cap:{allowed:true,isPending:false}, IU:()=>true, IHr:()=>({enabled:true,isLoading:false}), D2:()=>({}),JOn:()=>false,uzt:()=>({kind:'local'}),
      cGr:vm.runInNewContext('('+between(text,'function cGr(','var lGr;')+')')});
    return vm.runInNewContext('('+between(text,'function sGr(','function cGr(')+')',sandbox)({hostId:'local'});
  };
  assert.deepEqual(JSON.parse(JSON.stringify(run(patched,{isLoading:true,isCapable:false}))),{allowed:false,available:false,isLoading:true,reason:'loading'});
  assert.equal(run(stock,{isLoading:true,isCapable:false}).reason,'browser-pane-disabled');
  assert.deepEqual(JSON.parse(JSON.stringify(run(patched,{isLoading:false,isCapable:false}))),{allowed:false,available:false,isLoading:false,reason:'browser-pane-disabled'});
});
function syncSandbox(text, options={}) {
  let calls=0, delays=[], pipe='expired', writes=[];
  const connection={hostConfig:{kind:'local'}};
  const sandbox=context({rc:new WeakMap,ic:new WeakMap,setTimeout:(fn,ms)=>{delays.push(ms);pipe='current';queueMicrotask(fn)},
    lc:async e=>{calls++;writes.push({pipe,reload:e.reloadUserConfig});if(options.failAlways||calls<=(options.failures??1))throw Error(options.message??'Timed out waiting for MCP response to config/batchWrite');return{selection:{pipe},cuaReplEnabled:false}}});
  vm.runInNewContext(between(text,'function cc(','async function lc(')+named(';globalThis.sync=cc;'),sandbox);
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
  Object.assign(ctx.sandbox,context({oc:async()=>null,K:()=>features,ws:async()=>({}),Qs:async()=>({worker:'current'}),Aa:{legacy:'disabled'}}));
  if (source1013 && !source1016) Object.assign(ctx.sandbox,{
    Ys:vm.runInNewContext('('+between(patched,'function Ys(','async function Xs(')+')',{n:{o:'fixture-app'}}),
    Kn:'identity',Gn:'tools-pipe',qn:'verifier',L:{default:{env:{CODEX_APP_TOOLS_PIPE_PATH:'current-app-pipe',BROWSER_USE_ACCESS_VERIFYING_IDENTITY:'current-verifier'}}},
  });
  if (source1016) Object.assign(ctx.sandbox,{
    [source1023?'kc':source1021?'Pc':'Xs']:vm.runInNewContext('('+between(patched,'function Xs(',source1023?'async function koe(':source1021?'async function Rae(':'async function Zs(')+')',{n:{o:'fixture-app'}}),
    Jn:'identity',qn:'tools-pipe',Yn:'verifier',R:{default:{env:{CODEX_APP_TOOLS_PIPE_PATH:'current-app-pipe',BROWSER_USE_ACCESS_VERIFYING_IDENTITY:'current-verifier'}}},
  });
  if (source1021) {
    ctx.connection.getAuthenticatedPrincipal=async()=>null;
    Object.assign(ctx.sandbox,{[source1023?'Oc':'Nc']:JSON.stringify(['fixture-app','api-key']),[source1023?'vi':'Si']:'identity',[source1023?'_i':'xi']:'tools-pipe',[source1023?'yi':'Ci']:'verifier',[source1023?'L':'I']:{default:{env:{CODEX_APP_TOOLS_PIPE_PATH:'current-app-pipe',BROWSER_USE_ACCESS_VERIFYING_IDENTITY:'current-verifier'}}}});
  }
  vm.runInNewContext(between(patched,'async function dc(','var fc=')+named(';globalThis.config=dc;'),ctx.sandbox);
  const requests=Array.from({length:5},()=>ctx.sandbox.config({appServerConnection:ctx.connection}));
  await Promise.all(requests);assert.equal(ctx.calls(),1);assert.equal(ctx.writes[0].reload,true);
  await ctx.sandbox.config({appServerConnection:ctx.connection});assert.equal(ctx.calls(),1,'Failed reconciliation must not force a new write on every chat after recovery succeeds');
  features={browserUseTinysky:false};await ctx.sandbox.config({appServerConnection:ctx.connection});assert.equal(ctx.calls(),2,'Current features invalidate a previous recovery');
  ctx.sandbox[named('ic')].set(ctx.connection,Promise.resolve());await ctx.sandbox.config({appServerConnection:ctx.connection});assert.equal(ctx.calls(),3,'New reconciliation generation invalidates recovery');
  await ctx.sandbox.config({appServerConnection:{hostConfig:{kind:'ssh'}},desktopFeatureAvailability:{browserUseTinysky:false}});assert.equal(ctx.calls(),3);
  if (source1013 && !source1021) {
    ctx.sandbox[named('Qs')]=async()=>({'mcp_servers.node_repl':{env:{}}});
    for(const text of [source(runtime),patched]) {
      const config=vm.runInNewContext('('+between(text,'async function dc(','var fc=')+')',ctx.sandbox);
      delete ctx.connection.getCachedAuthenticatedPrincipal;
      await assert.rejects(config({appServerConnection:ctx.connection,requireWorkBrowserIdentity:true}),/requires an authenticated account/);
      ctx.connection.getCachedAuthenticatedPrincipal=()=>({accountId:'fixture-account',userId:'fixture-user'});
      const output=await config({appServerConnection:ctx.connection,requireWorkBrowserIdentity:true});
      assert.deepEqual(JSON.parse(JSON.stringify(output['mcp_servers.node_repl'].env)),{
        identity:JSON.stringify(['fixture-app','fixture-account','fixture-user']),'tools-pipe':'current-app-pipe',verifier:'current-verifier',
      });
      await config({appServerConnection:{hostConfig:{kind:'ssh'}},desktopFeatureAvailability:{browserUseTinysky:false},requireWorkBrowserIdentity:true});
    }
  }
  if (source1021) for (const text of [source(runtime),patched]) {
    const seen=[];
    ctx.sandbox[named('Qs')]=async options=>{seen.push(options);return {'mcp_servers.node_repl':{env:{}}}};
    const config=vm.runInNewContext('('+between(text,'async function dc(','var fc=')+')',ctx.sandbox);
    const principal={accountId:'fixture-account',userId:'fixture-user'}, anonymous=ctx.sandbox[source1023?'Oc':'Nc'];
    ctx.connection.getAuthenticatedPrincipal=async()=>null;
    assert.equal((await config({appServerConnection:ctx.connection}))['mcp_servers.node_repl'].env.identity,anonymous);
    ctx.connection.getAuthenticatedPrincipal=async()=>principal;
    const output=await config({appServerConnection:ctx.connection,hostServicesPipePath:'current-pipe'});
    assert.equal(output['mcp_servers.node_repl'].env.identity,JSON.stringify(['fixture-app','fixture-account','fixture-user']));
    assert.equal(output['mcp_servers.node_repl'].env['tools-pipe'],'current-app-pipe');assert.equal(output['mcp_servers.node_repl'].env.verifier,'current-verifier');
    assert.equal(seen.at(-1).hostServicesPipePath,'current-pipe');
    ctx.connection.getAuthenticatedPrincipal=async()=>{throw Error('fixture unavailable')};
    assert.equal((await config({appServerConnection:ctx.connection}))['mcp_servers.node_repl'].env.identity,anonymous);
    for(const audio of [false,true]) {
      await config({appServerConnection:{hostConfig:{kind:'ssh'}},desktopFeatureAvailability:{browserUseTinysky:false,computerAudio:audio},hostServicesPipePath:'remote-pipe'});
      assert.equal(seen.at(-1).hostServicesPipePath,audio?null:'remote-pipe');
    }
    const authorize=vm.runInNewContext('('+between(text,source1023?'async function koe(':'async function Rae(','async function Zs(')+')',{[source1023?'Oc':'Nc']:anonymous,[source1023?'kc':'Pc']:ctx.sandbox[source1023?'kc':'Pc']});
    let current=null,reads=0;const options={getPrincipal:()=>current,readAccess:async()=>{reads++;return true}};
    assert.equal(await authorize({...options,executorId:anonymous,isWork:false}),true);
    assert.equal(await authorize({...options,executorId:anonymous,isWork:true}),false);assert.equal(reads,0);
    current=principal;const executorId=ctx.sandbox[source1023?'kc':'Pc'](principal);
    assert.equal(await authorize({...options,executorId,isWork:false}),true);assert.equal(reads,0);
    assert.equal(await authorize({...options,executorId,isWork:true}),true);assert.equal(reads,1);
    assert.equal(await authorize({...options,executorId,isWork:true,readAccess:async()=>false}),false);
    assert.equal(await authorize({...options,executorId:'other-account',isWork:false}),null);
    assert.equal(await authorize({...options,executorId,isWork:true,readAccess:async()=>{current={...principal,userId:'changed'};return true}}),false,'Account changes during authorization must fail closed');
  }
  if (source1016) for (const text of [source(runtime),patched]) {
    let response={ok:true,json:async()=>({settings:{localBrowserUse:false}})}, requests=0;
    const signal=new AbortController().signal, beforeSend=()=>{}, network=()=>{};
    const access=vm.runInNewContext('('+between(text,'async function Zs(','async function dc(')+')',{
      [source1023?'v':'_']:{[source1023?'Gt':source1021?'Wt':'ht']:async(options,fetch)=>{
        requests++;assert.equal(options.path,'/wham/work/settings');assert.equal(options.request.signal,signal);
        assert.equal(options.beforeSend,beforeSend);assert.equal(fetch,network);return response;
      }},[source1023?'Ooe':source1021?'Lae':'Gre']:{parse:value=>value},
    });
    const options={appServerClient:ctx.connection,beforeSend,fetchApplicationNetwork:network,signal};
    assert.equal(await access(options),false,'Native Work policy denial must remain authoritative');
    response={ok:true,json:async()=>({settings:{localBrowserUse:true}})};assert.equal(await access(options),true);
    for(const status of [401,403]) { response={ok:false,status};await assert.rejects(access(options),/Work browser access is unavailable/); }
    assert.equal(requests,4);
  }

});
sourceTest('actual bundled reconciler retries failed signature on focus, skips successful signature and follows latest disables',async()=>{
  const stock=source(runtime),patched=runtime.apply(stock,app.replaceExactlyOnce);
  async function exercise(text,keepFail=false,partial=false) {
    let count=0,syncs=0,external=0,migrations=0,names=[],failed=true,warnings=[];
    const sandbox=context({process:{env:{},platform:'win32'},r:{Zo:()=> 'market'},La:()=> 'root',Ia:()=> 'resources',Ra:()=>new Set(),s:{},u:{t:{Dev:'dev',Prod:'prod'}},
      hd:[{name:'browser',migrate:async()=>{migrations++},isAvailable:({features})=>features.inAppBrowserUseAllowed}],Yr:{},ai:()=>true,gd:()=>({info(){},warning:(_name,details)=>warnings.push(String(details?.sensitive?.error??''))}),
      yd:()=>undefined,ac:()=>{},Kc:async()=>{},cc:async()=>{syncs++},Oie:async()=>{},sne:async()=>{external++;return null},
      Lo:async e=>{count++;names.push(e.marketplacePluginNames);if(failed){failed=keepFail;if(partial)return{hadReconcileFailure:true,hadUnknownChromeExtensionSyncState:false};throw Error('Timed out waiting for MCP response to marketplace/add')}return{hadReconcileFailure:false,hadUnknownChromeExtensionSyncState:false}},
      Cne:async()=>{},_d:new Set(),ua:{},kie:'dev'});
    if (source1007) Object.assign(sandbox,{r:{$o:()=> 'market'},l:{S:'managed'},mf:sandbox.mf,Qc:async()=>{},aie:'dev',iie:async()=>{}});
    if (source9446) sandbox.Fie=async()=>{};
    if (source1013) Object.assign(sandbox,{i:{[source1023?'Qo':source1021?'$o':source1016?'ns':'ts']:()=> 'market'},u:{S:'managed'},n:{i:{Dev:'dev',Prod:'prod'}}});
    const factory=vm.runInNewContext('('+between(text,'function jie(','function yd(')+')',sandbox);
    const instance=factory({env:{},resourcesPath:'r',runtimeMarketplaceRoot:'m',codexHome:'home',buildFlavor:'prod',isPackaged:true,appVersion:'version',globalState:{get:()=>null},getLocalAppServerConnection:()=>({listPlugins:async()=>({marketplaces:[]})})});
    await instance.reconcileExternalPluginState();assert.equal(count,0,'Focus before availability must skip destructive reconciliation');
    await instance.setDesktopFeatureAvailability({inAppBrowserUseAllowed:true});assert.equal(count,1, warnings.join('; '));
    await instance.reconcileExternalPluginState();
    if(text===stock) return {count};
    if(keepFail){assert.equal(count,2);assert.equal(syncs,0);assert.equal(external,1,'Focus must retain stock external reconciliation even when recovery fails');return{count};}
    assert.equal(count,2);assert.equal(syncs,partial?2:1);assert.equal(migrations,partial?2:1);
    await instance.reconcileExternalPluginState();assert.equal(count,2);assert.equal(syncs,partial?2:1);assert.equal(migrations,partial?2:1);
    await instance.setDesktopFeatureAvailability({inAppBrowserUseAllowed:false});assert.equal(count,3);assert.deepEqual(Array.from(names.at(-1)),[]);
    await Promise.all([instance.setDesktopFeatureAvailability({inAppBrowserUseAllowed:true}),instance.setDesktopFeatureAvailability({inAppBrowserUseAllowed:false}),instance.reconcileExternalPluginState()]);
    assert.deepEqual(Array.from(names.at(-1)),[],'Serialized reconciliation must finish with the latest confirmed feature state');
    return {count};
  }
  assert.equal((await exercise(stock)).count,1);await exercise(patched);await exercise(patched,true);await exercise(patched,false,true);
});
sourceTest('actual sync and native config generator refresh current executable and managed pipe after timed-out write',async()=>{
  const patched=runtime.apply(source(runtime),app.replaceExactlyOnce);
  let generation=0, pipe='old-pipe', calls=[];
  const connection={hostConfig:{kind:'local'},listPlugins:async()=>({marketplaces:[]}),sendAppServerRequest:async(method,request)=>{
    assert.equal(method,'config/batchWrite');calls.push(JSON.parse(JSON.stringify(request)));
    if(calls.length===1){pipe='current-pipe';throw Error('Timed out waiting for MCP response to config/batchWrite')}
  }};
  const sandbox=context({rc:new WeakMap,M:{default:{env:{}}},K:()=>({}),Ts(){},o:{_t:()=>true},ua:{},r:{ts:'cua_repl',as:'node_repl'},nc:[],Aa:{'mcp_servers.cua_repl':{enabled:false}},
    ws:async()=>({codexHome:'home',marketplaceName:'market',browserServicePluginVersion:'version',desktopFeatureAvailability:{},runtimePaths:{platform:'win32',nodeReplPath:'current-repl-'+(++generation)},shouldUseWslPaths:true,browserBackends:['iab'],computerUse:true,computerUsePaths:{},cuaReplSurfaces:[]}),
    Hs:async()=>pipe,Ks:{info(){}},$s:options=>({'mcp_servers.node_repl':{command:options.runtimePaths.nodeReplPath,env:{SKY_CUA_NATIVE_PIPE_DIRECTORY:options.computerUseNativePipePath}}}),Na:async()=>false,Mne:async()=>{},Ma(){},Ia:()=> 'resources',setTimeout:fn=>queueMicrotask(fn)});
  if (source1007) Object.assign(sandbox,{c:{yt:()=>true},r:{rs:'cua_repl',ss:'node_repl'},xa:{}});
  if (source9446 && !source1016) sandbox.Pa={};
  if (source1013) Object.assign(sandbox,{l:source1023?{Bt:()=>true}:source1021?{zt:()=>true}:{St:()=>true},i:source1023?{ns:'cua_repl',os:'node_repl'}:source1021?{rs:'cua_repl',ss:'node_repl'}:source1016?{os:'cua_repl',us:'node_repl'}:{as:'cua_repl',ls:'node_repl'},oa:{}});
  if(source1023) sandbox.woe=[];
  vm.runInNewContext(between(patched,'async function Qs(','function $s(')+between(patched,'function cc(',source1013?'var Gre=':'async function dc(')+named(';globalThis.sync=cc;'),sandbox);
  await sandbox.sync({appServerConnection:connection,appVersion:'version'});
  assert.equal(calls.length,2);
  const worker=request=>request.edits.find(e=>e.keyPath==='mcp_servers.node_repl').value;
  assert.equal(worker(calls[0]).command,'current-repl-1');assert.equal(worker(calls[0]).env.SKY_CUA_NATIVE_PIPE_DIRECTORY,'old-pipe');
  assert.equal(worker(calls[1]).command,'current-repl-2');assert.equal(worker(calls[1]).env.SKY_CUA_NATIVE_PIPE_DIRECTORY,'current-pipe');
  assert.equal(calls[1].reloadUserConfig,true);
});
sourceTest('actual managed pipe runtime coalesces repeated readiness requests without restarting an active turn',async()=>{
  const stock=source(runtime);let starts=0,disposed=0,closed=0;
  const sandbox=context({process:{env:{},platform:'win32'},Vs:null,o:{bt:()=> 'helper',xt:()=> 'transport'},Bs:()=>({info(){},warning(){}})});
  if (source1007) sandbox.c={St:()=> 'helper',Ct:()=> 'transport'};
  if (source1013) sandbox.l=source1021?{W:()=> 'helper',G:()=> 'transport'}:{Et:()=> 'helper',Tt:()=> 'transport'};
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
  const entry=source1023?{path:'webview/assets/app-runtime-22dba69f1f94.js'}:source1021?{path:'webview/assets/app-runtime-e61614157c23.js'}:asar.listEntries(archive.tree).find(e=>/^webview\/assets\/app-initial-[^/]+\.js$/.test(e.path));assert(entry);
  const initial=asar.readEntry(archive,entry.path).toString();
  if(source1021)assert.equal(asar.sha256(Buffer.from(initial)),source1023?'e0758add2aa39e02b9adffd1277509ede5604cb9120e60de8aa1a625c251f918':'76de4e780865c9c73282a604deec2be28e9e9199836692cee2d72d3ea97fc4ed');
  const condition=between(initial,source1023?'s||ye.isLoading||be.isLoading||':source1021?'p||De.isLoading||Oe.isLoading||':source1016?'f||_e.isLoading||ve.isLoading||':source1013?'f||ge.isLoading||_e.isLoading||':source1007?'s||le.isLoading||ue.isLoading||de.isLoading||':'s||se.isLoading||ce.isLoading||le.isLoading||',source1023?'||(Mt.dispatchMessage(`electron-desktop-features-changed`':source1021?'||(ft.dispatchMessage(`electron-desktop-features-changed`':source1016?'||(Ei.dispatchMessage(`electron-desktop-features-changed`':source1013?'||(hs.dispatchMessage(`electron-desktop-features-changed`':source1007?'||(Ho.dispatchMessage(`electron-desktop-features-changed`':'||(oh.dispatchMessage(`electron-desktop-features-changed`');
  let published=0;
  const run=pending=>vm.runInNewContext(condition+'||publish()',source1023 ? {s:false,ye:{isLoading:pending},be:{isLoading:false},c:true,xe:{isLoading:false},Oe:{isLoading:false},je:{isLoading:false},re:'available',M:{status:'allowed'},Ze:{status:'allowed'},Qe:{status:'allowed'},publish:()=>{published++}} : source1021 ? {p:false,De:{isLoading:pending},Oe:{isLoading:false},m:true,P:{isLoading:false},Fe:{isLoading:false},Re:{isLoading:false},le:'available',ie:{status:'allowed'},rt:{status:'allowed'},it:{status:'allowed'},publish:()=>{published++}} : source1016 ? {f:false,_e:{isLoading:pending},ve:{isLoading:false},p:true,ye:{isLoading:false},Ee:{isLoading:false},Oe:{isLoading:false},U:'available',L:{status:'allowed'},Je:{status:'allowed'},Ye:{status:'allowed'},publish:()=>{published++}} : source1013 ? {f:false,ge:{isLoading:pending},_e:{isLoading:false},p:true,ve:{isLoading:false},Te:{isLoading:false},De:{isLoading:false},H:'available',I:{status:'allowed'},Je:{status:'allowed'},Ye:{status:'allowed'},publish:()=>{published++}} : source1007 ? {s:false,le:{isLoading:pending},ue:{isLoading:false},de:{isLoading:false},ve:{isLoading:false},be:{isLoading:false},I:'available',A:{status:'allowed'},Ve:{status:'allowed'},He:{status:'allowed'},publish:()=>{published++}} : {
    s:false,se:{isLoading:pending},ce:{isLoading:false},le:{isLoading:false},ge:{isLoading:false},ve:{isLoading:false},P:'available',O:{status:'allowed'},ze:{status:'allowed'},Be:{status:'allowed'},publish:()=>{published++},
  });
  run(true);assert.equal(published,0);run(false);assert.equal(published,1);
  assert(initial.includes(source1023?'inAppBrowserUse:ye.available':source1021?'inAppBrowserUse:De.available':source1016?'inAppBrowserUse:_e.available':source1013?'inAppBrowserUse:ge.available':source1007?'inAppBrowserUse:le.available':'inAppBrowserUse:se.available')&&initial.includes(source1023?'inAppBrowserUseAllowed:ye.allowed':source1021?'inAppBrowserUseAllowed:De.allowed':source1016?'inAppBrowserUseAllowed:_e.allowed':source1013?'inAppBrowserUseAllowed:ge.allowed':source1007?'inAppBrowserUseAllowed:le.allowed':'inAppBrowserUseAllowed:se.allowed'));
});
