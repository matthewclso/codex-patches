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
  const exports=execute(factory(text,'yrds'),{
    QosV:{c:()=>Array(22).fill(Symbol.for('react.memo_cache_sentinel'))},
    y5DF:{_U:key=>key==='cap'?cap:{allowed:true,isPending:false}},DBCl:{Szl:{runCodexInWsl:'wsl'},PAg:'wsl'},
    ChYf:{G:'cap'},EOo5:{tn:()=>({})},RxZZ:{iK:()=>false},kfGJ:{Qz:()=>({kind:'local'})},
    hZax:{Zj:()=>true},GGpr:{$:'requirements'},mMIg:{V:()=>({enabled:true,isLoading:false})},
  });
  return exports.I({hostId:'local'});
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
    return cache[id]=execute(fn,imports,id==='KvLy'?';t.build=U;t.defaults={dark:o,light:n};':'');
  };
  const api=load('KvLy');
  return {defaults:JSON.parse(JSON.stringify(api.defaults)),engine:(value,variant)=>({variables:JSON.parse(JSON.stringify(api.build(value,variant)))})};
}
function updater(text) {
  const source=factory(text,'KvLy').toString(),start=source.indexOf('function A('),end=source.indexOf('function j(',start);
  assert(start>=0&&end>start);return source.slice(start,end);
}
function applyTheme(text,engine) {
  return vm.runInNewContext(updater(text)+';A',{U:(value,variant)=>engine(value,variant).variables,j:()=>false});
}
module.exports={paths,factories,factory,execute,capability,browserHook,externalBrowser,theme,updater,applyTheme};
function workspace(text) { return execute(factory(text,'vw1R'),{}).H; }
function publisher(archive) {
  const source=asar.readEntry(archive,paths.publisher).toString();
  assert.equal(asar.sha256(Buffer.from(source)),'0c77555cce0cb92e8d8594c60ff7333af8fb18662a856b719dfa1f05229cf1db');
  const start=source.indexOf('l||es.isLoading||er.isLoading||'),end=source.indexOf('||(t0.O1.dispatchMessage("electron-desktop-features-changed"',start);
  assert(start>=0&&end>start);
  const condition=source.slice(start,end);let published=0;
  for(const pending of [true,false]){
    vm.runInNewContext(condition+'||publish()',{l:false,es:{isLoading:pending},er:{isLoading:false},c:true,eo:{isLoading:false},eg:{isLoading:false},e_:{isLoading:false},G:'available',L:{status:'allowed'},eF:{status:'allowed'},eq:{status:'allowed'},publish:()=>published++});
    assert.equal(published,pending?0:1);
  }
  assert(source.includes('inAppBrowserUse:es.available')&&source.includes('inAppBrowserUseAllowed:es.allowed'));
}
function css(archive) {
  const text=['webview/assets/async/361a1f04b890.css','webview/assets/async/55fbafee337b.css'].map(path=>asar.readEntry(archive,path).toString()).join('\n');
  for(const name of Object.values(classes))assert(text.includes('.'+name),'Re-audit the native shell class '+name);
  return text;
}
const classes = {layout:'Layout-SYw9n4',page:'PageSurfaceLayout-oqnRfB',full:'FullHeightPageSurfaceLayout-nI_dSf',menu:'ApplicationMenuPageSurfaceLayout-yb71ay',topbar:'ApplicationMenuTopBar-SLuX8q',left:'LeftPanel-e8ghK3'};
module.exports.workspace=workspace;module.exports.publisher=publisher;module.exports.css=css;module.exports.classes=classes;
