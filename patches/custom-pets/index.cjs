'use strict';
const assert = require('node:assert/strict');
const replacements = [
  ['let n=o.rt({preferWsl:t}),r=await e.platformPath(),', 'let r=await e.platformPath(),n=codexPetHome(r,t),'],
  ['let i=o.rt({preferWsl:n}),a=await e.platformPath();', 'let a=await e.platformPath(),i=codexPetHome(a,n);'],
  ['let a=await e.platformPath(),s=o.rt({preferWsl:r}),', 'let a=await e.platformPath(),s=codexPetHome(a,r),'],
];
const helper = 'function codexPetHome(e,t){let n=o.rt({preferWsl:t});return e.sep===`/`?o.zt(n):n}';
function apply(source, replace) {
  assert(!source.includes('codexPetHome'), 'Pet helper is already present or collides');
  for (const [before, after] of replacements) source = replace(source, before, after);
  return replace(source, 'async function oB(', helper + 'async function oB(');
}
module.exports = {
  id: 'custom-pets', title: 'Custom pet discovery, selection and installation in WSL',
  targetPath: '.vite/build/bootstrap-Bj_1Kfw1.js',
  sourceSha256: '3e36ecd7908d2b39dfbd57e223fe798c159ea7fda67c9fbe3e4822fae1b9be98',
  apply, replacements, helper, sourceType: 'commonjs',
};

module.exports.revisions = [{
  targetPath: '.vite/build/bootstrap-CYu4H4X5.js',
  sourceSha256: '9b9d3c9e8312dba970daf31fd3950b3f2bd760a89e1d7bf480c4efefb3d2b102',
  apply(source, replace) {
    assert(!source.includes('codexPetHome'), 'Pet helper is already present or collides');
    for (const [before, after] of replacements) source = replace(source, before, after);
    return replace(source, 'async function lB(', helper + 'async function lB(');
  },
}];

module.exports.revisions.push({
  targetPath: '.vite/build/bootstrap-CZlEGA2m.js',
  sourceSha256: '343072f02e604fe06f7864a72b1cbcc6004a8a318c66982995a188ee97430a3b',
  apply(source, replace) {
    assert(!source.includes('codexPetHome'), 'Pet helper is already present or collides');
    for (const [before, after] of replacements) source = replace(source, before.replace('o.rt(', 'o.at('), after);
    const currentHelper = helper.replace('o.rt(', 'o.at(').replace('o.zt(', 'o.Vt(');
    return replace(source, 'async function cB(', currentHelper + 'async function cB(');
  },
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/bootstrap-BXPOZU-a.js',
  sourceSha256: '8f9b7c13fe8868e4c03cee49f0b244adc673f4a4f619ed796d4ca4e5040ead43',
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/bootstrap-C8gUBg5L.js',
  sourceSha256: '1f726d0e3103d81501551546d3b6e70f1fc10646f9326e00fe68605f144c5f4f',
  apply(source, replace) {
    assert(!source.includes('codexPetHome'), 'Pet helper is already present or collides');
    for (const [before, after] of replacements) source = replace(source, before.replace('o.rt(', 'o.at('), after);
    const currentHelper = helper.replace('o.rt(', 'o.at(').replace('o.zt(', 'o.Vt(');
    return replace(source, 'async function lB(', currentHelper + 'async function lB(');
  },
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/bootstrap-Dz9A8y86.js',
  sourceSha256: 'a70497f5ffa764fe74f4de7ac05a5f73aff8d1e2f44de4476d1d9a684af43ddd',
  apply(source, replace) {
    assert(!source.includes('codexPetHome'), 'Pet helper is already present or collides');
    for (const [before, after] of replacements) source = replace(source, before.replace('o.rt(', 'o.at('), after);
    const currentHelper = helper.replace('o.rt(', 'o.at(').replace('o.zt(', 'o.Vt(');
    return replace(source, 'async function Zz(', currentHelper + 'async function Zz(');
  },
});
