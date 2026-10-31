'use strict';
const vm = require('node:vm');
const assert = require('node:assert/strict');
const asar = require('../../lib/asar.cjs');
// Register pristine module factories, omitting only the application entry call.
// This lets source tests use native utility exports without starting Electron.
function webpackRequire(archive) {
  const read = name => asar.readEntry(archive, name).toString();
  const core = read('.vite/build/early-bootstrap.js');
  const entry = 'var o=r(74456);module.exports=o';
  assert.equal(core.split(entry).length, 2, 'Re-audit the Webpack entry boundary');
  const module = { exports: {} };
  vm.runInNewContext(core.replace(entry, 'module.exports=r'), { module, require, process, Buffer, TextEncoder, TextDecoder, URL, URLSearchParams, console, setTimeout, clearTimeout });
  const loader = module.exports;
  for (const { path } of asar.listEntries(archive.tree).filter(e => /^\.vite\/build\/early-bootstrap-\d+-[^/]+\.js$/.test(e.path))) {
    const exports = {};
    vm.runInNewContext(read(path), { exports, require, process, Buffer, TextEncoder, TextDecoder, URL, URLSearchParams, console, setTimeout, clearTimeout });
    Object.assign(loader.m, exports.modules);
  }
  return loader;
}
module.exports = { webpackRequire };
function between(text, first, last) {
  const start=text.indexOf(first), end=text.indexOf(last,start+first.length);
  assert(start>=0&&end>start,'Missing Webpack source boundaries: '+first);
  return text.slice(start,end);
}
function serviceFunction(text) { return between(text,'function({appVersion:e,codexHome:t,marketplaceName:r,browserServicePluginVersion:n,','}({appVersion:t,browserUseTinysky:')+'}'; }
function serviceSandbox(paths, servicePath, create=options=>options) {
  return {sM:{info(){},warning(){}},ec:{QKy:()=>true,vgM:()=>servicePath.slice(0,-'/scripts/browser-service.mjs'.length),ytA:'trusted-services',POg:create},
    e$:{x:{Dev:'dev',resolve:()=> 'release',isInternal:()=>false}},eU:()=>({env:{}}),rF:{kJ:'browser'},eg:{cB6:paths.cB,MV$:paths.MV},
    ea:{tno:'backends',vy_:'tinysky',TsC:'flavor',Y0x:'version',OuO:'identity',b$E:'tools-pipe',$Q0:'verifier'},
    tY:'trace',tQ:'iab-origin',tJ:'chrome-origin',rq:'sky-origin',rH:'sky-pipe',rU:'service-app',r$:'native-pipe',sx:'host-pipe',sL:()=>({}),sO:[],sF:[]};
}
module.exports.between=between;
module.exports.serviceFunction=serviceFunction;
module.exports.serviceSandbox=serviceSandbox;
