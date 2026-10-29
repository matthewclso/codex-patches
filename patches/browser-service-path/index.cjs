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

module.exports.revisions.push({
  targetPath: '.vite/build/main-C_jM0dPl.js',
  sourceSha256: 'd940b7ba89557a640cf23967c60555fa2a2344d6899807478c69ffc304314302',
  before: '{browser:b}', after: '{browser:_&&h.platform===`win32`?o.lt(b,null):b}',
  apply: (source, replace) => replace(source, '{browser:b}', '{browser:_&&h.platform===`win32`?o.lt(b,null):b}'),
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
});

module.exports.revisions.push({
  targetPath: '.vite/build/main-BklS_2Y2.js',
  sourceSha256: '5cf1544463be9497b85b69051aa5ad32320f9ebdca063ec2ab41abb75b6cadf7',
  before: '{browser:b}', after: '{browser:_&&h.platform===`win32`?c.ut(b,null):b}',
  apply: (source, replace) => replace(source, '{browser:b}', '{browser:_&&h.platform===`win32`?c.ut(b,null):b}'),
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/main-Bgi5Xaw-.js',
  sourceSha256: 'e8923725ad6357380ac7bb25818f78eb4d97e522ebbde2ddf6ff5a2a93032e54',
});

module.exports.revisions.push({
  targetPath: '.vite/build/main-C4DYk222.js',
  sourceSha256: 'c8a2af504b21314fa6a64ad1b4ec83dbad80033ede902caf9978fd9c74a2c175',
  before: '{browser:b}', after: '{browser:_&&h.platform===`win32`?l.pt(b,null):b}',
  apply: (source, replace) => replace(source, '{browser:b}', '{browser:_&&h.platform===`win32`?l.pt(b,null):b}'),
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: '.vite/build/main-CT5a1yCd.js',
  sourceSha256: 'cdac659a830908ec5202a887e5a37b302074bfc9e9ab0f52fed3e8abbdb9e713',
});

module.exports.revisions.push({
  targetPath: '.vite/build/main-BPBEjAxi.js',
  sourceSha256: '2327d031e32c8d80c0dbf9bd81144466a90f8e49d3bc64e6604c23fbab900d7f',
  before: '{browser:b}', after: '{browser:_&&h.platform===`win32`?l.At(b,null):b}',
  apply: (source, replace) => replace(source, '{browser:b}', '{browser:_&&h.platform===`win32`?l.At(b,null):b}'),
});

module.exports.revisions.push({
  targetPath: ".vite/build/main-CP9z2iYn.js",
  sourceSha256: '9a4d60010bcceb6310ef6a357cae924db06df1babe3c4dd91310da2b5f39cf1f',
  before: '{browser:b}', after: '{browser:_&&h.platform===`win32`?l.jt(b,null):b}',
  apply: (source, replace) => replace(source, '{browser:b}', '{browser:_&&h.platform===`win32`?l.jt(b,null):b}'),
});
