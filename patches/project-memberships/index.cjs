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
