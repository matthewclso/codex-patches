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
