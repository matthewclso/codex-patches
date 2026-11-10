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
function capability(text, query, policy, name, provider) {
  const imports={
    y5DF:{i1:(_atom,callback)=>callback},DBCl:{JW5:{audioVisualizerEnabled:{key:'audio'},confettiEnabled:{key:'confetti'}}},
    OeLR:{Y$:value=>value},uppa:{uV:'provider'},Gg2s:{u9:'features'},OWtl:{u:{}},RxZZ:{},
    OMIV:{JW:'gate'},ZnQ7:{B:{'workspace-in-app-browser':'policy'}},
  };
  if(text.includes('n("zTeN")')) { imports.zTeN=imports.y5DF; }
  const api=execute(factory(text,'ChYf'),imports,';t.descriptors=p;');
  const raw=api.descriptors['browser.in-app'];
  assert.deepEqual(Array.from(raw.accessPolicies),['workspace-in-app-browser']);
  assert.equal(raw.settings.length,0);assert.equal(raw.statsig.length,0);
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
  return execute(factory(text,'yrds'),imports).I({hostId:'local'});
}
function externalBrowser(text) {
  const values=Object.values(factories(text)).filter(fn=>fn.toString().includes('isExternalBrowserUseGateEnabled:'));
  assert.equal(values.length,1);return values[0].toString();
}
function theme(text) {
  const table=factories(text),cache={};
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
  const source=factory(text,factories(text).BQgU?'BQgU':'KvLy').toString(),start=source.indexOf(factories(text).BQgU?'function F(':'function A('),end=source.indexOf('function j(',start);
  assert(start>=0&&end>start);return source.slice(start,end);
}
function applyTheme(text,engine) {
  return vm.runInNewContext(updater(text)+(factories(text).BQgU?';F':';A'),{U:(value,variant)=>engine(value,variant).variables,j:()=>false});
}
module.exports={paths,factories,factory,execute,capability,browserHook,externalBrowser,theme,updater,applyTheme};
function workspace(text) { return execute(factory(text,'vw1R'),{}).H; }
function publisher(archive, source1103=false, source7773=false) {
  const source=asar.readEntry(archive,source7773?'webview/assets/async/366057.08ca21677c.js':source1103?'webview/assets/async/366057.8dff3ed0b6.js':paths.publisher).toString();
  assert.equal(asar.sha256(Buffer.from(source)),source7773?'40a7a2cabfc767584f268a10a4201ccb0655ec3b87bd1e934195a83a3194994c':source1103?'d5e8a2fcbc633f7059f5089a6cc7a9320e8e88e0bc756942faf3209572284418':'0c77555cce0cb92e8d8594c60ff7333af8fb18662a856b719dfa1f05229cf1db');
  const start=source.indexOf(source1103?'l||ei.isLoading||er.isLoading||':'l||es.isLoading||er.isLoading||'),end=source.indexOf((source1103?'||(tH.O1.dispatchMessage':'||(t0.O1.dispatchMessage')+'("electron-desktop-features-changed"',start);
  assert(start>=0&&end>start);
  const condition=source.slice(start,end);let published=0;
  for(const pending of [true,false]){
    vm.runInNewContext(condition+'||publish()',source1103?{l:false,ei:{isLoading:pending},er:{isLoading:false},c:true,es:{isLoading:false},ep:{isLoading:false},ev:{isLoading:false},V:'available',L:{status:'allowed'},eU:{status:'allowed'},eF:{status:'allowed'},publish:()=>published++}:{l:false,es:{isLoading:pending},er:{isLoading:false},c:true,eo:{isLoading:false},eg:{isLoading:false},e_:{isLoading:false},G:'available',L:{status:'allowed'},eF:{status:'allowed'},eq:{status:'allowed'},publish:()=>published++});
    assert.equal(published,pending?0:1);
  }
  assert(source.includes(source1103?'inAppBrowserUse:ei.available':'inAppBrowserUse:es.available')&&source.includes(source1103?'inAppBrowserUseAllowed:ei.allowed':'inAppBrowserUseAllowed:es.allowed'));
}
function css(archive, source1103=false) {
  const text=(source1103?['webview/assets/async/e77f816560c6.css','webview/assets/async/e9cca08fb35b.css']:['webview/assets/async/361a1f04b890.css','webview/assets/async/55fbafee337b.css']).map(path=>asar.readEntry(archive,path).toString()).join('\n');
  for(const name of Object.values(classes))assert(text.includes('.'+name),'Re-audit the native shell class '+name);
  return text;
}
const classes = {layout:'Layout-SYw9n4',page:'PageSurfaceLayout-oqnRfB',full:'FullHeightPageSurfaceLayout-nI_dSf',menu:'ApplicationMenuPageSurfaceLayout-yb71ay',topbar:'ApplicationMenuTopBar-SLuX8q',left:'LeftPanel-e8ghK3'};
module.exports.workspace=workspace;module.exports.publisher=publisher;module.exports.css=css;module.exports.classes=classes;
