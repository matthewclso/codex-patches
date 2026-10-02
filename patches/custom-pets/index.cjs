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
