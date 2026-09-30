'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { auditArchive, listPatches } = require('../../lib/app-patches.cjs');
const { sha256, updateExecutableIntegrity } = require('../../lib/asar.cjs');
const { readJson } = require('./evidence.cjs');
function argument(name) { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1]) throw new Error('Missing argument: ' + name); return process.argv[index + 1]; }
function validate(appDirectory, packageReport, outDirectory) {
  fs.mkdirSync(outDirectory, { recursive: true });
  const report = { schemaVersion: 1, status: 'failed', reviewRequired: true,
    observedAt: new Date().toISOString(), package: packageReport, checks: [] };
  if (process.env.CODEX_CI_WINDOWS_TEST_OUTCOME) report.checks.push({ name: 'windows-toolkit-module-tests',
    status: process.env.CODEX_CI_WINDOWS_TEST_OUTCOME === 'success' ? 'passed' : 'failed' });
  try {
    assert.equal(packageReport.identity.name, 'OpenAI.Codex');
    assert.equal(packageReport.identity.architecture, 'x64');
    assert.equal(packageReport.verification.msixSignature, 'valid');
    assert.equal(packageReport.verification.publisher, 'matched-pin');
    const archivePath = path.join(appDirectory, 'resources', 'app.asar');
    const exeRelative = packageReport.files.executableRelativePath;
    assert(exeRelative && !path.isAbsolute(exeRelative) && !exeRelative.split(/[\\/]/).includes('..'), 'Invalid executable relative path');
    const exePath = path.join(appDirectory, exeRelative);
    const archive = fs.readFileSync(archivePath), executable = fs.readFileSync(exePath);
    assert.equal(sha256(archive), packageReport.hashes.archiveSha256);
    assert.equal(sha256(executable), packageReport.hashes.executableSha256);
    for (const [filename, key] of [['codex', 'cliLinuxSha256'], ['codex.exe', 'cliWindowsSha256'],
      ['codex-code-mode-host', 'codeModeLinuxSha256'], ['codex-code-mode-host.exe', 'codeModeWindowsSha256']])
      assert.equal(sha256(fs.readFileSync(path.join(appDirectory, 'resources', filename))), packageReport.hashes[key]);
    const audit = auditArchive(archive, listPatches().map(p => p.id));
    report.audit = audit.report;
    if (!audit.buffer) {
      report.status = 'needs-review';
      report.checks.push({ name: 'compose-existing-patches', status: 'blocked', reason: 'Target source modules changed or are missing. Existing implementations cannot be assumed correct.' });
      return report;
    }
    const updatedExe = updateExecutableIntegrity(executable, audit.sourceHeaderHash, audit.outputHeaderHash);
    report.checks.push({ name: 'archive-and-executable-composition', status: 'passed', outputArchiveSha256: audit.outputArchiveHash, outputExecutableSha256: sha256(updatedExe), outputHeaderSha256: audit.outputHeaderHash });
    // Tests execute functions taken from this downloaded stock archive. Hash/anchor
    // matching is only the prerequisite; it is not itself behavior evidence.
    const tests = spawnSync(process.execPath, ['--test', 'tests/app-patches-source.cjs'], {
      cwd: path.resolve(__dirname, '../..'), env: { ...process.env, CODEX_SOURCE_ASAR: archivePath, CODEX_SOURCE_EXE: exePath, CODEX_AUDIT_UNKNOWN: audit.report.supported ? '' : '1' },
      encoding: 'utf8', timeout: 180000,
    });
    fs.writeFileSync(path.join(outDirectory, 'app-source-tests.txt'), String(tests.stdout || '') + String(tests.stderr || ''));
    report.checks.push({ name: 'stock-and-patched-source-behavior', status: tests.status === 0 && !tests.error ? 'passed' : 'failed' });
    assert.equal(tests.status, 0, 'Actual downloaded stock/patched source behavior tests failed.');
    assert(!tests.error, 'Source behavior test process failed or timed out.');
    const known = audit.report.build;
    const supported = Boolean(known && known.packageVersion === packageReport.identity.packageVersion &&
      known.cliVersion === packageReport.versions.cliVersion &&
      known.executableSha256 === packageReport.hashes.executableSha256 &&
      known.cliLinuxSha256 === packageReport.hashes.cliLinuxSha256 &&
      known.cliWindowsSha256 === packageReport.hashes.cliWindowsSha256 &&
      known.codeModeLinuxSha256 === packageReport.hashes.codeModeLinuxSha256);
    report.status = supported ? 'passed' : 'needs-review';
    report.reviewRequired = !supported;
    if (report.checks.some(check => check.status === 'failed')) {
      report.status = 'failed'; report.reviewRequired = true; report.reason = 'Windows toolkit tests failed; package/WSL probes still ran independently.';
    }
    // Never amend the supported-build registry. A candidate is evidence for a PR.
    report.candidate = {
      packageVersion: packageReport.identity.packageVersion, appVersion: packageReport.versions.appVersion,
      cliVersion: packageReport.versions.cliVersion, archiveSha256: packageReport.hashes.archiveSha256,
      headerSha256: audit.sourceHeaderHash, executableSha256: packageReport.hashes.executableSha256,
      executableRelativePath: exeRelative,
      cliLinuxSha256: packageReport.hashes.cliLinuxSha256,
      cliWindowsSha256: packageReport.hashes.cliWindowsSha256,
      codeModeLinuxSha256: packageReport.hashes.codeModeLinuxSha256,
      codeModeWindowsSha256: packageReport.hashes.codeModeWindowsSha256,
      acceptance: 'candidate; source behavior checked; desktop and WSL acceptance require review',
      patches: Object.fromEntries(audit.report.patches.map(p => [p.id, { status: 'candidate', sourceSha256: p.beforeHash, targetPath: p.targetPath }])),
    };
    return report;
  } catch (error) { report.reason = error.message; return report; }
  finally { fs.writeFileSync(path.join(outDirectory, 'validation.json'), JSON.stringify(report, null, 2) + '\n'); }
}
if (require.main === module) {
  try {
    const report = validate(argument('--app-dir'), readJson(argument('--package-report')), argument('--out'));
    console.log(`Package compatibility: ${report.status}; supported registry unchanged.`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validate };
