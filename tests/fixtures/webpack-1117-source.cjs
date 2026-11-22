'use strict';
const assert = require('node:assert/strict');
const { between } = require('./webpack-source.cjs');

function sync(text, isolated = false) {
  let source = between(text, 'function a9(', 'var a7=');
  if (isolated) {
    const first = source.indexOf('async function({appServerConnection:e,');
    const last = source.indexOf('})(e)', first);
    assert(first >= 0 && last > first);
    source = source.slice(0, first) + '__fixtureNativeSync' + source.slice(last + 1);
  }
  return source;
}

function authorization(text) {
  return between(text, 'async function({executorId:e,getPrincipal:t,isWork:r,readAccess:n})', '}({executorId:i') + '}';
}

function pipe(text) {
  return between(text, 'function({codexHome:e=(0,tC.DnS)(),', '}({codexCliPath:') + '}';
}

function backendAccess(text) {
  return between(text, 'readAccess:async()=>{', '});if(null==o)').slice('readAccess:'.length);
}

function reconcile(text) {
  return between(text, 'function(e){var t;let r,n,i,s=e.env??process.env', '}({openPluginDetail:') + '}';
}

module.exports = { sync, authorization, pipe, backendAccess, reconcile };
