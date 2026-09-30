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
