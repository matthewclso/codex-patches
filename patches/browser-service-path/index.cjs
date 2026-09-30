'use strict';
const before = '{browser:y}';
const after = '{browser:g&&m.platform===`win32`?o.st(y,null):y}';
module.exports = {
  id: 'browser-service-path', title: 'Native browser trusted-service path for Windows workers in WSL tasks',
  targetPath: '.vite/build/main-BGDKyzfM.js',
  sourceSha256: 'a44bacb4f1627c74d9d087695074d5abfe3d8a896aa38debca368bbe0cb37a8b',
  dependencies: ['browser-wsl'],
  apply: (source, replace) => replace(source, before, after), before, after, sourceType: 'commonjs',
};
