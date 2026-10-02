'use strict';
const before = '{browser:y}';
const after = '{browser:g&&m.platform===`win32`?o.st(y,null):y}';
module.exports = {
  id: 'browser-service-path', title: 'Native browser trusted-service path for Windows workers in WSL tasks',
  targetPath: '.vite/build/main-BGDKyzfM.js',
  sourceSha256: 'a44bacb4f1627c74d9d087695074d5abfe3d8a896aa38debca368bbe0cb37a8b',
  apply: (source, replace) => replace(source, before, after), before, after, sourceType: 'commonjs',
};

module.exports.revisions = [{
  targetPath: '.vite/build/main-Dn18kdv3.js',
  sourceSha256: '447e4900075d8cb41f5c55f1728c20147ea23ab761bb4377348eea8c8f3d4a48',
  before: '{browser:b}',
  after: '{browser:_&&h.platform===`win32`?o.st(b,null):b}',
  apply: (source, replace) => replace(source, '{browser:b}', '{browser:_&&h.platform===`win32`?o.st(b,null):b}'),
}];
