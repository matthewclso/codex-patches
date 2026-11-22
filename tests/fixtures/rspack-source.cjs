'use strict';
const vm = require('node:vm');
const assert = require('node:assert/strict');
const asar = require('../../lib/asar.cjs');
const paths = {
  browser: 'webview/assets/async/24191.589dcc9878.js',
  theme: 'webview/assets/async/496175.cf5ad221c1.js',
  publisher: 'webview/assets/async/855047.832683be0d.js',
};
const cache=new Map();
function factories(text) {
  if(cache.has(text))return cache.get(text);
  const context = {};
  vm.runInNewContext(text.replaceAll('export const ', 'var '), context);
  assert(context.__webpack_modules__, 'Re-audit the Rspack registration boundary');
  cache.set(text,context.__webpack_modules__);
  return context.__webpack_modules__;
}
function factory(text, id) { const value=factories(text)[id]; assert(value, 'Missing reviewed module '+id); return value; }
function execute(fn, imports, expose='') {
  const exports = {};
  const load = id => { assert(Object.hasOwn(imports,id), 'Unexpected native dependency '+id); return imports[id]; };
  load.d = (target, getters, values) => {
    for (const [key,get] of Object.entries(getters)) Object.defineProperty(target,key,{get,enumerable:true});
    Object.assign(target, values);
  };
  const code=fn.toString(), name=code.slice(0,code.indexOf('('));
  vm.runInNewContext('({'+code.slice(0,-1)+expose+'}})['+JSON.stringify(name)+']', {} )({},exports,load);
  return exports;
}
function capability(text, query, policy, name, provider, source1117 = false) {
  const imports={
    y5DF:{i1:(_atom,callback)=>callback},DBCl:{JW5:{audioVisualizerEnabled:{key:'audio'},confettiEnabled:{key:'confetti'}}},
    OeLR:{Y$:value=>value},uppa:{uV:'provider'},Gg2s:{u9:'features'},OWtl:{u:{}},RxZZ:{},
    OMIV:{JW:'gate'},ZnQ7:{B:{'workspace-in-app-browser':'policy'}},
  };
  if(text.includes('n("zTeN")')) { imports.zTeN=imports.y5DF; }
  if(source1117)Object.assign(imports,{qmMi:imports.y5DF,UM8A:{B:{'workspace-in-app-browser':'policy'}},jt0U:{H:()=>({isLoading:false,isError:false,isCapable:true})}});
  const api=execute(factory(text,'ChYf'),imports,source1117?';t.descriptors=m;':text.includes('h=function(e)')?';t.descriptors=h;':';t.descriptors=p;');
  const raw=api.descriptors['browser.in-app'];
  assert.deepEqual(Array.from(raw.accessPolicies),['workspace-in-app-browser']);
  assert.equal(raw.settings.length,0);assert.equal(raw.statsig.length,0);
  api.descriptors.clientRestricted={...raw,supportedClients:['extension']};
  api.descriptors.other={...raw,requiresFirstPartyInference:provider!==undefined};
  return JSON.parse(JSON.stringify(api.G({name},{get:(key,host)=>{
    if(key==='features'){assert.equal(host,'local');return query;}
    if(key==='provider'){assert.equal(host.hostId,'local');assert.equal(host.failClosed,true);return provider;}
    if(key==='gate')return true;
    assert.equal(key,'policy');return policy;
  }})));
}
function browserHook(text, cap) {
  const imports={
    QosV:{c:()=>Array(22).fill(Symbol.for('react.memo_cache_sentinel'))},
    y5DF:{_U:key=>key==='cap'?cap:{allowed:true,isPending:false}},DBCl:{Szl:{runCodexInWsl:'wsl'},PAg:'wsl'},
    ChYf:{G:'cap'},EOo5:{tn:()=>({})},RxZZ:{iK:()=>false},kfGJ:{Qz:()=>({kind:'local'})},
    hZax:{Zj:()=>true},GGpr:{$:'requirements'},mMIg:{V:()=>({enabled:true,isLoading:false})},
  };
  if(text.includes('n("zTeN")'))imports.zTeN=imports.y5DF;
  if(text.includes('n("UOa8")'))imports.UOa8=imports.EOo5;
  if(text.includes('n("qmMi")'))imports.qmMi=imports.y5DF;
  return execute(factory(text,'yrds'),imports).I({hostId:'local'});
}
function externalBrowser(text) {
  const values=Object.values(factories(text)).filter(fn=>fn.toString().includes('isExternalBrowserUseGateEnabled:'));
  assert.equal(values.length,1);return values[0].toString();
}
function theme(text) {
  const table=factories(text),cache={};
  if (table.qBrZ) {
    const api=execute(table.qBrZ,{},';t.defaults={dark:o,light:n};');
    return {defaults:JSON.parse(JSON.stringify(api.defaults)),engine:(value,variant)=>JSON.parse(JSON.stringify(api.m(value,variant)))};
  }
  const load=id=>{
    if(cache[id])return cache[id];
    assert(table[id],'Missing native theme utility '+id);
    const fn=table[id],imports={};
    for(const [,dep] of fn.toString().matchAll(/\bi\("([^"]+)"\)/g))imports[dep]=load(dep);
    return cache[id]=execute(fn,imports,(id==='KvLy'||id==='BQgU')?';t.build=U;t.defaults={dark:o,light:n};':'');
  };
  const api=load(table.BQgU?'BQgU':'KvLy');
  return {defaults:JSON.parse(JSON.stringify(api.defaults)),engine:(value,variant)=>({variables:JSON.parse(JSON.stringify(api.build(value,variant)))})};
}
function updater(text) {
  if (factories(text).qBrZ) {
    const writer=execute(factory(text,'t7G8'),{}).Y.toString();
    if (factories(text).ncZO) {
      const body=factory(text,'ncZO').toString();
      const start=body.indexOf('function y(');
      assert(start>=0);
      return 'function F(e,t,i){const a={Y:'+writer+'},C={A:{}},g=U;return ('+body.slice(start,-1)+')(e,t,i)}';
    }
    const body=factory(text,'k1Wx').toString();
    const start=body.indexOf('e0:function('),end=body.indexOf(',e8:s',start);
    assert(start>=0&&end>start);
    return 'function F(e,t,i){const a={Y:'+writer+'},h={A:{}},u=U;return ('+body.slice(start+3,end)+')(e,t,i)}';
  }
  const source=factory(text,factories(text).BQgU?'BQgU':'KvLy').toString(),start=source.indexOf(factories(text).BQgU?'function F(':'function A('),end=source.indexOf('function j(',start);
  assert(start>=0&&end>start);return source.slice(start,end);
}
function applyTheme(text,engine) {
  return vm.runInNewContext(updater(text)+((factories(text).BQgU||factories(text).qBrZ)?';F':';A'),{U:(value,variant)=>engine(value,variant).variables,j:()=>false});
}
module.exports={paths,factories,factory,execute,capability,browserHook,externalBrowser,theme,updater,applyTheme};
function workspace(text) { return execute(factory(text,'vw1R'),{}).H; }
function publisher(archive, source1103=false, source7773=false, source1106=false, source1111=false, source1117=false) {
  if(source1117){
    const source=asar.readEntry(archive,'webview/assets/async/191628.7c4ce6e8ec.js').toString();
    assert.equal(asar.sha256(Buffer.from(source)), 'b5a8e6e497fd0ba7e89d88b99158852f2a5af50f564899e9729bec0844fa2b0a');
    const {between}=require('./webpack-source.cjs');
    const condition=between(source,'o||eo.isLoading||ec.isLoading||','||(nt.O1.dispatchMessage("electron-desktop-features-changed"');
    for(const pending of [true,false]){
      const ready={isLoading:false,status:'allowed'};
      const suppressed=vm.runInNewContext(condition,{o:false,eo:{isLoading:pending},ec:ready,c:true,ed:ready,ey:ready,eb:ready,z:'available',D:ready,eH:ready,ez:ready});
      assert.equal(suppressed,pending);
    }
    assert(source.includes('inAppBrowserUse:eo.available')&&source.includes('inAppBrowserUseAllowed:eo.allowed'));
    return;
  }
  const source=asar.readEntry(archive,source1111?'webview/assets/async/757723.3067c948bc.js':source1106?'webview/assets/async/92243.7ae2a0b971.js':source7773?'webview/assets/async/366057.08ca21677c.js':source1103?'webview/assets/async/366057.8dff3ed0b6.js':paths.publisher).toString();
  assert.equal(asar.sha256(Buffer.from(source)),source1111?'67cc5635a64f200b60e53cbf6b2fe74e4e8f0440c6ab0ccffd6c0056f849f3e4':source1106?'2090b888705be8a3fac914f21b672f27a2c3ce6f854ca1312449c53fbad244d9':source7773?'40a7a2cabfc767584f268a10a4201ccb0655ec3b87bd1e934195a83a3194994c':source1103?'d5e8a2fcbc633f7059f5089a6cc7a9320e8e88e0bc756942faf3209572284418':'0c77555cce0cb92e8d8594c60ff7333af8fb18662a856b719dfa1f05229cf1db');
  const start=source.indexOf(source1111?'l||er.isLoading||es.isLoading||':source1103?'l||ei.isLoading||er.isLoading||':'l||es.isLoading||er.isLoading||'),end=source.indexOf((source1111?'||(t$.O1.dispatchMessage':source1106?'||(tW.O1.dispatchMessage':source1103?'||(tH.O1.dispatchMessage':'||(t0.O1.dispatchMessage')+'("electron-desktop-features-changed"',start);
  assert(start>=0&&end>start);
  const condition=source.slice(start,end);let published=0;
  for(const pending of [true,false]){
    vm.runInNewContext(condition+'||publish()',source1111?{l:false,er:{isLoading:pending},es:{isLoading:false},c:true,eo:{isLoading:false},em:{isLoading:false},ev:{isLoading:false},B:'available',D:{status:'allowed'},eq:{status:'allowed'},eV:{status:'allowed'},publish:()=>published++}:source1106?{l:false,ei:{isLoading:pending},er:{isLoading:false},c:true,es:{isLoading:false},ep:{isLoading:false},ev:{isLoading:false},G:'available',L:{status:'allowed'},eU:{status:'allowed'},eq:{status:'allowed'},publish:()=>published++}:source1103?{l:false,ei:{isLoading:pending},er:{isLoading:false},c:true,es:{isLoading:false},ep:{isLoading:false},ev:{isLoading:false},V:'available',L:{status:'allowed'},eU:{status:'allowed'},eF:{status:'allowed'},publish:()=>published++}:{l:false,es:{isLoading:pending},er:{isLoading:false},c:true,eo:{isLoading:false},eg:{isLoading:false},e_:{isLoading:false},G:'available',L:{status:'allowed'},eF:{status:'allowed'},eq:{status:'allowed'},publish:()=>published++});
    assert.equal(published,pending?0:1);
  }
  assert(source.includes(source1111?'inAppBrowserUse:er.available':source1103?'inAppBrowserUse:ei.available':'inAppBrowserUse:es.available')&&source.includes(source1111?'inAppBrowserUseAllowed:er.allowed':source1103?'inAppBrowserUseAllowed:ei.allowed':'inAppBrowserUseAllowed:es.allowed'));
}
function css(archive, source1103=false, source1106=false, source1111=false, source1117=false) {
  if(source1117) return asar.readEntry(archive,'webview/assets/async/4d21324f5cf6.css').toString();
  const text=(source1111?['webview/assets/async/66582da7ee6b.css','webview/assets/async/1a537644288e.css']:source1106?['webview/assets/async/9ec44337a842.css','webview/assets/async/08001bfedda8.css']:source1103?['webview/assets/async/e77f816560c6.css','webview/assets/async/e9cca08fb35b.css']:['webview/assets/async/361a1f04b890.css','webview/assets/async/55fbafee337b.css']).map(path=>asar.readEntry(archive,path).toString()).join('\n');
  for(const name of Object.values(classes))assert(text.includes('.'+name),'Re-audit the native shell class '+name);
  return text;
}
const classes = {layout:'Layout-SYw9n4',page:'PageSurfaceLayout-oqnRfB',full:'FullHeightPageSurfaceLayout-nI_dSf',menu:'ApplicationMenuPageSurfaceLayout-yb71ay',topbar:'ApplicationMenuTopBar-SLuX8q',left:'LeftPanel-e8ghK3'};
module.exports.workspace=workspace;module.exports.publisher=publisher;module.exports.css=css;module.exports.classes=classes;
