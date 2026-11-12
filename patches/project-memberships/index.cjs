'use strict';
const before = 'u.setThreadAssignmentsEnabled(K().localProjectTaskMembership)';
const after = 'u.setThreadAssignmentsEnabled(!0)';
module.exports = {
  id: 'project-memberships', title: 'Persist desktop project memberships for Remote Control',
  targetPath: '.vite/build/main-BGDKyzfM.js',
  sourceSha256: 'a44bacb4f1627c74d9d087695074d5abfe3d8a896aa38debca368bbe0cb37a8b',
  defaultMode: 'disabled',
  apply: (source, replace) => replace(source, before, after), before, after, sourceType: 'commonjs',
};

module.exports.revisions = [{
  targetPath: '.vite/build/main-Dn18kdv3.js',
  sourceSha256: '447e4900075d8cb41f5c55f1728c20147ea23ab761bb4377348eea8c8f3d4a48',
  before: 'u.setThreadAssignmentsEnabled(q().localProjectTaskMembership)',
  after: 'u.setThreadAssignmentsEnabled(!0)',
  apply: (source, replace) => replace(source, 'u.setThreadAssignmentsEnabled(q().localProjectTaskMembership)', 'u.setThreadAssignmentsEnabled(!0)'),
}];

module.exports.revisions.push({
  targetPath: '.vite/build/main-C_jM0dPl.js',
  sourceSha256: 'd940b7ba89557a640cf23967c60555fa2a2344d6899807478c69ffc304314302',
  before: 'u.setThreadAssignmentsEnabled(K().localProjectTaskMembership)', after: 'u.setThreadAssignmentsEnabled(!0)',
  apply: (source, replace) => replace(source, 'u.setThreadAssignmentsEnabled(K().localProjectTaskMembership)', 'u.setThreadAssignmentsEnabled(!0)'),
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/main-B5_S2vFm.js',
  sourceSha256: 'e58e0124daa49b216ae8f6a656cc967e82b5b17204206c2c2b7dd38db003d9d6',
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/main-gtVueRkt.js',
  sourceSha256: 'a4b72dcd241e8ee360aa960442cc585aa822685a42efd056c760937d9f8b623e',
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/main-p91kJShj.js',
  sourceSha256: 'aafd6a750458cb39b6202f9be00231482122d32ac14017b79d544c4ab741e889',
  before: 'd.setThreadAssignmentsEnabled(K().localProjectTaskMembership)', after: 'd.setThreadAssignmentsEnabled(!0)',
  apply: (source, replace) => replace(source, 'd.setThreadAssignmentsEnabled(K().localProjectTaskMembership)', 'd.setThreadAssignmentsEnabled(!0)'),
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/main-BklS_2Y2.js',
  sourceSha256: '5cf1544463be9497b85b69051aa5ad32320f9ebdca063ec2ab41abb75b6cadf7',
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/main-Bgi5Xaw-.js',
  sourceSha256: 'e8923725ad6357380ac7bb25818f78eb4d97e522ebbde2ddf6ff5a2a93032e54',
});

module.exports.revisions.push({
  targetPath: '.vite/build/main-C4DYk222.js',
  sourceSha256: 'c8a2af504b21314fa6a64ad1b4ec83dbad80033ede902caf9978fd9c74a2c175',
  before: 'f.setThreadAssignmentsEnabled(q().localProjectTaskMembership)',
  after: 'f.setThreadAssignmentsEnabled(!0)',
  apply: (source, replace) => replace(source, 'f.setThreadAssignmentsEnabled(q().localProjectTaskMembership)', 'f.setThreadAssignmentsEnabled(!0)'),
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/main-CT5a1yCd.js',
  sourceSha256: 'cdac659a830908ec5202a887e5a37b302074bfc9e9ab0f52fed3e8abbdb9e713',
});

module.exports.revisions.push({
  targetPath: '.vite/build/main-BPBEjAxi.js',
  sourceSha256: '2327d031e32c8d80c0dbf9bd81144466a90f8e49d3bc64e6604c23fbab900d7f',
  before: 'd.setThreadAssignmentsEnabled(va().localProjectTaskMembership)',
  after: 'd.setThreadAssignmentsEnabled(!0)',
  apply: (source, replace) => replace(source, 'd.setThreadAssignmentsEnabled(va().localProjectTaskMembership)', 'd.setThreadAssignmentsEnabled(!0)'),
});

module.exports.revisions.push({
  targetPath: ".vite/build/main-CP9z2iYn.js",
  sourceSha256: '9a4d60010bcceb6310ef6a357cae924db06df1babe3c4dd91310da2b5f39cf1f',
  before: 'd.setThreadAssignmentsEnabled(fa().localProjectTaskMembership)',
  after: 'd.setThreadAssignmentsEnabled(!0)',
  apply: (source, replace) => replace(source, 'd.setThreadAssignmentsEnabled(fa().localProjectTaskMembership)', 'd.setThreadAssignmentsEnabled(!0)'),
});

module.exports.revisions.push({
  targetPath: '.vite/build/early-bootstrap-491-e75c34fa1b2c0832.js',
  sourceSha256: 'db3fd1590ec3d3c621a85c2cf925785ea6d99df8bc4eaec8bc4b1e974758a8ab',
  before: 'E.setThreadAssignmentsEnabled(tl().localProjectTaskMembership)',
  after: 'E.setThreadAssignmentsEnabled(!0)',
  apply: (source, replace) => replace(source, 'E.setThreadAssignmentsEnabled(tl().localProjectTaskMembership)', 'E.setThreadAssignmentsEnabled(!0)'),
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/early-bootstrap-499-8b3807f1185eeae8.js',
  sourceSha256: '91ed814e18c0d55a585dfa359829746df6e8eb2f7488bfe9bfd71378ef24cdf1',
});

module.exports.revisions.push({
  targetPath: '.vite/build/early-bootstrap-632-62c641245a52ef0e.js',
  sourceSha256: 'c16675e64dae86bdb09f7720f038a8c2f2beacf0e85bbadd369f407d38662aa4',
  before: 'M.setThreadAssignmentsEnabled(tl().localProjectTaskMembership)',
  after: 'M.setThreadAssignmentsEnabled(!0)',
  apply(source, replace) { return replace(source, this.before, this.after); },
});

module.exports.revisions.push({
  targetPath: '.vite/build/early-bootstrap-199-e3316cddb4ea6a6b.js',
  sourceSha256: '3202cb775ee05404d2b08f6dbb6fa3e524321da435564d8b2a7c6359ccdc6b0a',
  before: 'T.setThreadAssignmentsEnabled(tr().localProjectTaskMembership)',
  after: 'T.setThreadAssignmentsEnabled(!0)',
  apply(source, replace) { return replace(source, this.before, this.after); },
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: ".vite/build/early-bootstrap-480-5def667ddfcd786d.js",
  sourceSha256: "be8eba3b9283d6a9784fa069a019b83a89fd02277cc13e4f7d32d57faf0ada65",
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: ".vite/build/early-bootstrap-620-1eb87a1b3aa240b6.js",
  sourceSha256: "5d08d7246c17ad6c295420a592ed2109bd70a318c63efe4890dcb7c32975ec0c",
});
