'use strict';
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
function readJson(filename) { return JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '')); }
function npmPacks(value) {
  const packs = Array.isArray(value) ? value : value?.files ? [value] : Object.values(value || {});
  if (!packs.length || packs.some(pack => !Array.isArray(pack.files) || typeof pack.filename !== 'string')) throw new Error('Invalid npm pack JSON.');
  return packs;
}
function requireEvidence(report) {
  if (!report || !['passed', 'failed', 'unsupported', 'not-run'].includes(report.status))
    throw new Error('Evidence report has no valid status.');
  if (report.status !== 'passed') throw new Error(`WSL acceptance ${report.status}: ${report.reason || 'No acceptance evidence.'}`);
  const stages = report.stages || [];
  for (const stage of ['wsl2-import', 'ubuntu-boot', 'wsl-tests-and-stock-app-server']) {
    const result = stages.find(s => s.name === stage);
    if (!result || result.exitCode !== 0 || result.timedOut) throw new Error('Missing successful WSL stage: ' + stage);
  }
  return true;
}
function artifactIsSourceOnly(files) {
  const forbidden = /(?:^|\/)(?:node_modules|\.git|\.artifacts|\.work|state|generated|legacy-backup)(?:\/|$)|(?:^|\/)(?:auth\.json|config\.local\.json|runtime\.json|\.env(?:\.[^/]+)?)(?:$)|\.(?:zip|tgz|msix|asar|exe|dll|sqlite(?:-wal|-shm)?|db|lnk)$/i;
  for (const file of files) if (forbidden.test(file.path || file)) throw new Error('Release contains local data or a proprietary/generated binary: ' + (file.path || file));
  return true;
}
if (require.main === module) {
  if (process.argv[2] === 'gate') {
    try { requireEvidence(readJson(process.argv[3])); console.log('WSL2 acceptance evidence passed.'); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  } else if (process.argv[2] === 'pack') {
    try {
      const packs = npmPacks(readJson(process.argv[3]));
      artifactIsSourceOnly(packs.flatMap(p => p.files));
      console.log('Release package contains source and public metadata only.');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  } else if (process.argv[2] === 'tree') {
    try {
      const result = spawnSync('git', ['ls-tree', '-rz', '--name-only', 'HEAD'], { encoding: 'utf8' });
      if (result.error || result.status !== 0) throw new Error('Cannot inspect tracked release tree.');
      artifactIsSourceOnly(result.stdout.split('\0').filter(Boolean));
      console.log('Tracked release tree contains source and public metadata only.');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  } else if (process.argv[2] === 'pack-filename') {
    try {
      const packs = npmPacks(readJson(process.argv[3]));
      if (packs.length !== 1) throw new Error('Expected exactly one release tarball.');
      console.log(packs[0].filename);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  } else { console.error('Usage: evidence.cjs gate <wsl.json> | pack <npm-pack.json> | tree | pack-filename <npm-pack.json>'); process.exitCode = 1; }
}
module.exports = { readJson, requireEvidence, artifactIsSourceOnly, npmPacks };
