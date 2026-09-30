'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readJson } = require('./evidence.cjs');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.stderr?.trim() || result.status}`);
  return result.stdout.trim();
}
function buildProposal(validation, wsl, runUrl) {
  const pkg = validation.package;
  if (!pkg?.identity?.packageVersion || !/^[a-f0-9]{64}$/.test(pkg.hashes?.archiveSha256 || '')) throw new Error('Verified package report is required.');
  const version = pkg.identity.packageVersion;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid package version.');
  const branch = `automation/codex-${version}-${pkg.hashes.archiveSha256.slice(0, 12)}`;
  const proposal = { schemaVersion: 1, status: 'review-required', package: pkg, candidate: validation.candidate || null,
    audit: validation.audit || null, checks: validation.checks || [], failureReason: validation.reason || null,
    wsl: wsl || { status: 'not-run', reason: 'No WSL evidence report was produced.' }, evidenceRun: runUrl,
    decisionRequired: 'Reproduce stock behavior and review all acceptance evidence before changing compatibility/current.json. This file does not enable installation.' };
  const checks = proposal.checks.map(c => `- ${c.name}: **${c.status}**`).join('\n');
  const body = `The official signed Windows x64 package changed to **${version}** (bundled CLI ${pkg.versions.cliVersion}).\n\n` +
    `This deterministic workflow inspected the downloaded stock source and attempted the existing patch composition. It generated a compatibility candidate for review; it did not add the build to the supported registry.\n\n` +
    `${checks || '- Existing source transformations require investigation.'}\n- Ubuntu 26.04 WSL2 hosted evidence: **${proposal.wsl.status}**${proposal.wsl.reason ? ` — ${proposal.wsl.reason}` : ''}\n\n` +
    `${validation.reason ? `Investigation needed: ${validation.reason}\n\n` : ''}` +
    `Review [the workflow run](${runUrl}) and its report artifacts. Confirm current stock-versus-patched behavior, WSL evidence, desktop browser/pet behavior, and mobile reconnect before adding the build to \`compatibility/current.json\`. Missing anchors are an investigation result and must not be treated as an upstream fix.\n\n` +
    `The candidate includes package hashes and test results only. App binaries and user data are excluded.\n`;
  return { branch, filename: `compatibility/candidates/${version}-${pkg.hashes.archiveSha256.slice(0, 12)}.json`,
    title: `Review Codex Windows ${version} compatibility`, body, proposal };
}
function shouldPropose(validation) {
  // A regression in tests for a reviewed package is a failed CI run, not a
  // newly released app. Do not open a misleading compatibility update PR.
  return validation.reviewedPackage !== true && !(validation.status === 'passed' && !validation.reviewRequired);
}
function propose(validationPath, wslPath, outDirectory) {
  const validation = readJson(validationPath);
  if (!shouldPropose(validation)) { console.log('Official package is already reviewed; no new package proposal needed.'); return; }
  const runUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const wsl = fs.existsSync(wslPath) ? readJson(wslPath) : null;
  const proposal = buildProposal(validation, wsl, runUrl);
  fs.mkdirSync(outDirectory, { recursive: true });
  const bodyFile = path.join(outDirectory, 'proposal.md');
  fs.writeFileSync(bodyFile, proposal.body);
  if (!process.env.GH_TOKEN || !process.env.GITHUB_REPOSITORY) throw new Error('GH_TOKEN and GITHUB_REPOSITORY are required to propose a compatibility update.');
  const existing = JSON.parse(run('gh', ['pr', 'list', '--repo', process.env.GITHUB_REPOSITORY, '--head', proposal.branch, '--state', 'all', '--json', 'url,state']));
  if (existing.length) { console.log('Package already has a review proposal: ' + existing[0].url); return; }
  // Branch contains public reports only; no downloaded executable is committed.
  run('git', ['switch', '-c', proposal.branch]);
  fs.mkdirSync(path.dirname(proposal.filename), { recursive: true });
  fs.writeFileSync(proposal.filename, JSON.stringify(proposal.proposal, null, 2) + '\n');
  run('git', ['add', '--', proposal.filename]);
  run('git', ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-m', proposal.title]);
  run('git', ['push', '--set-upstream', 'origin', proposal.branch]);
  const url = run('gh', ['pr', 'create', '--repo', process.env.GITHUB_REPOSITORY, '--head', proposal.branch, '--base', process.env.GITHUB_REF_NAME || 'main', '--draft', '--title', proposal.title, '--body-file', bodyFile]);
  console.log('Created draft compatibility proposal: ' + url);
}
if (require.main === module) {
  try {
    if (process.argv.length < 5) throw new Error('Usage: propose-update.cjs <validation.json> <wsl.json> <out-directory>');
    propose(process.argv[2], process.argv[3], process.argv[4]);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { buildProposal, shouldPropose };
