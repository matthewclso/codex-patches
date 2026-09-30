'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { candidatePatches } = require('../scripts/ci/validate-package.cjs');
test('shared-target CI candidates retain pristine source and independent output hashes', () => {
  const result = candidatePatches([
    { id: 'first', targetPath: 'main.js', sourceHash: 'pristine', beforeHash: 'pristine', standaloneOutputHash: 'first-only', afterHash: 'first-only' },
    { id: 'second', targetPath: 'main.js', sourceHash: 'pristine', beforeHash: 'first-only', standaloneOutputHash: 'second-only', afterHash: 'composed' },
  ]);
  assert.equal(result.second.sourceSha256, 'pristine');
  assert.equal(result.second.outputSha256, 'second-only');
  assert.equal(result.first.sourceSha256, result.second.sourceSha256);
});
