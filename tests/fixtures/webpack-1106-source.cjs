'use strict';
const assert=require('node:assert/strict');
const {between}=require('./webpack-source.cjs');
// Keep the native inline functions intact. Only the isolated queue test replaces
// its sync callee with a fixture; integration tests execute the native callee.
function sync(text, isolated=false) {
  let source=between(text,'function sw(','var sv=');
  if(isolated){
    const first=source.indexOf('async function({appServerConnection:e,'),last=source.indexOf('})(e)',first);
    assert(first>=0&&last>first);
    source=source.slice(0,first)+'__fixtureNativeSync'+source.slice(last+1);
  }
  return source;
}
function authorization(text) { return between(text,'async function({executorId:e,getPrincipal:t,isWork:n,readAccess:r})','}({executorId:t')+'}'; }
function pipe(text) {
  let source=between(text,'function({codexHome:e=(0,eh.DnS)(),','}({codexCliPath:tJ(')+'}';
  // Ensure/configuration remains an injected dependency; don't execute its
  // default filesystem initializer during the isolated managed-pipe test.
  const first=source.indexOf('ensureNotifyConfig:t=async function('),last=source.indexOf(',codexCliPath:n,',first);
  assert(first>=0&&last>first);
  return source.slice(0,first)+'ensureNotifyConfig:t=__fixtureNotify'+source.slice(last);
}
function backendAccess(text) {
  return between(text,'readAccess:async()=>{','});return null!=r').slice('readAccess:'.length);
}
module.exports={sync,authorization,pipe,backendAccess};
