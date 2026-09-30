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
