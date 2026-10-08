'use strict';
// Restrict the existing in-app gate to its WSL rejection branch. Other browser
// requirements, feature gates and window-type restrictions remain authoritative.
const before = 'function xBr({areRequirementsPending:e,isBrowserAgentGateEnabled:t,isBrowserAndComputerUseAllowed:n,isBrowserEnabled:r,isBrowserUseEnabled:i,isLoading:a,runCodexInWsl:o,windowType:s}){return s===`chrome-extension`?`window-type-disabled`:e?`loading`:n?a?`loading`:r?t?i?o?`wsl-disabled`:`available`:`config-requirement-disabled`:`statsig-disabled`:`browser-pane-disabled`:`config-requirement-disabled`}';
const after = before.replace('o?`wsl-disabled`:`available`', '`available`');
module.exports = {
  id: 'browser-wsl', title: 'In-app browser availability with a WSL backend',
  targetPath: 'webview/assets/app-shared-6472dfc83b38.js',
  sourceSha256: 'f17abe823ba920bf3e34dc41a88d0327d27dc3ae6ac80209c87984f0d525523d',
  apply: (source, replace) => replace(source, before, after), before, after, sourceType: 'module',
};

const currentBefore = before.replace("function xBr(", "function KBr(");
const currentAfter = currentBefore.replace('o?`wsl-disabled`:`available`', '`available`');

module.exports.revisions = [{
  targetPath: 'webview/assets/app-shared-ac32c0d1413b.js',
  sourceSha256: '08289e5e6a31013f044a61a0e856b68ee234b764a8b5a1f5e06bbeeb7a02f476',
  before: currentBefore, after: currentAfter,
  apply: (source, replace) => replace(source, currentBefore, currentAfter),
}];

const latestBefore = before.replace('function xBr(', 'function GBr(');
const latestAfter = latestBefore.replace('o?`wsl-disabled`:`available`', '`available`');
module.exports.revisions.push({
  targetPath: 'webview/assets/app-shared-2d992d47c83d.js',
  sourceSha256: '5e3a36d643393af861d2009584f64289f2247928e793f1985fe12cfec803a40b', before: latestBefore, after: latestAfter,
  apply: (source, replace) => replace(source, latestBefore, latestAfter),
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: 'webview/assets/app-shared-e20a5fe9db04.js',
  sourceSha256: 'ddb65d8470cdb5b3a44e9f53777b805b263c37441b07367fccd144df6c9ce92b',
  before: currentBefore, after: currentAfter,
  apply: (source, replace) => replace(source, currentBefore, currentAfter),
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: 'webview/assets/app-shared-e32c0e36d554.js',
  sourceSha256: 'b9468897f9c8a96395322ae4b2a2446914f50670403466c0c8889a40eb23f3cf',
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: 'webview/assets/app-shared-40678a67f0e3.js',
  sourceSha256: '35b467c3a05695ec354eb1d0bb4572ad7e9d1480decc1cf0fae3d16b50aa5bd8',
  before: before.replace('function xBr(', 'function cGr('),
  after: after.replace('function xBr(', 'function cGr('),
  apply: (source, replace) => replace(source, before.replace('function xBr(', 'function cGr('), after.replace('function xBr(', 'function cGr(')),
});
