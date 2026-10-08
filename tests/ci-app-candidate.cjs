'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { candidatePatches, isVerifiedPackageSource } = require('../scripts/ci/validate-package.cjs');
test('shared-target CI candidates retain pristine source and independent output hashes', () => {
  const result = candidatePatches([
    { id: 'first', targetPath: 'main.js', sourceHash: 'pristine', beforeHash: 'pristine', standaloneOutputHash: 'first-only', afterHash: 'first-only' },
    { id: 'second', targetPath: 'main.js', sourceHash: 'pristine', beforeHash: 'first-only', standaloneOutputHash: 'second-only', afterHash: 'composed' },
  ]);
  assert.equal(result.second.sourceSha256, 'pristine');
  assert.equal(result.second.outputSha256, 'second-only');
  assert.equal(result.first.sourceSha256, result.second.sourceSha256);
});
test('package trust requires a verified MSIX or verified Store content and rejects incomplete evidence', () => {
  assert.equal(isVerifiedPackageSource({ verification: { msixSignature: 'valid' } }), true);
  const store = { source: { kind: 'installed-store-package' }, verification: {
    msixSignature: 'not-run', executableSignature: 'valid', installedPackageSignature: 'Store',
    installedPackageStatus: 'Ok', installedPackageContentIntegrity: true,
  } };
  assert.equal(isVerifiedPackageSource(store), true);
  for (const key of Object.keys(store.verification)) {
    const changed = structuredClone(store); delete changed.verification[key];
    assert.equal(isVerifiedPackageSource(changed), false, key);
  }
  for (const [key, value] of [['installedPackageSignature', 'Developer'], ['installedPackageStatus', 'Modified'],
    ['installedPackageContentIntegrity', false], ['installedPackageContentIntegrity', 'true'], ['executableSignature', 'invalid']]) {
    const changed = structuredClone(store); changed.verification[key] = value;
    assert.equal(isVerifiedPackageSource(changed), false, key);
  }
  const changed = structuredClone(store); delete changed.source;
  assert.equal(isVerifiedPackageSource(changed), false);
  assert.equal(isVerifiedPackageSource({ verification: { executableSignature: 'valid' } }), false);
});
