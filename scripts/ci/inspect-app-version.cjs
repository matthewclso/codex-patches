'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseArchive, readEntry } = require('../../lib/asar.cjs');
function appVersion(filename) {
  const pkg = JSON.parse(readEntry(parseArchive(fs.readFileSync(filename)), 'package.json').toString('utf8'));
  assert(/^\d+\.\d+\.\d+$/.test(pkg.version), 'Unexpected internal Codex app version.');
  return pkg.version;
}
if (require.main === module) {
  try { console.log(appVersion(process.argv[2])); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { appVersion };
