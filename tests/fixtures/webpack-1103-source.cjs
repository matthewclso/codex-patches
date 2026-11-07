'use strict';
const assert=require('node:assert/strict');
const {between}=require('./webpack-source.cjs');
// Keep the native inline functions intact. Only the isolated queue test replaces
// its sync callee with a fixture; integration tests execute the native callee.
function sync(text, isolated=false) {
  let source=between(text,'function i8(','var i6=');
  if(isolated){
    const first=source.indexOf('async function({appServerConnection:e,'),last=source.indexOf('})(e)',first);
    assert(first>=0&&last>first);
    source=source.slice(0,first)+'__fixtureNativeSync'+source.slice(last+1);
  }
  return source;
}
function authorization(text) { return between(text,'async function({executorId:e,getPrincipal:t,isWork:r,readAccess:n})','}({executorId:t')+'}'; }
function pipe(text) {
  let source=between(text,'function({codexHome:e=(0,eu.DnS)(),','}({codexCliPath:tD(')+'}';
  // Ensure/configuration remains an injected dependency; don't execute its
  // default filesystem initializer during the isolated managed-pipe test.
  const first=source.indexOf('ensureNotifyConfig:t=async function('),last=source.indexOf(',codexCliPath:r,',first);
  assert(first>=0&&last>first);
  return source.slice(0,first)+'ensureNotifyConfig:t=__fixtureNotify'+source.slice(last);
}
module.exports={sync,authorization,pipe};
