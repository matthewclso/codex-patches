'use strict';
// Keep the sidebar/native window and outer shell on the configured surface.
// Elevated controls and the editor retain their independent contrast colors.
const before = '"--app-color-background-surface-under":e.surfaceUnder,';
const after = '"--app-color-background-surface-under":e.theme.surface,"--app-color-background-shell":e.theme.surface,';
// Windows' ordinary application-menu layout has no full-height shell background.
// Native material and Electron's tertiary-surface rules otherwise paint it gray.
// Append an unlayered, scoped rule to the native theme stylesheet on every write.
const shellCss = ':root[data-codex-window-type="electron"][data-codex-os="win32"] :is([data-app-shell-frame],[data-app-shell-page-surface="true"],.app-shell-left-panel:not([data-app-shell-left-panel-appearance="content-surface"])){background-color:var(--app-color-background-shell)}';
const stylesheetBefore = 'return l(e,s),s}';
const stylesheetAfter = 'return l(e,s),e.head.querySelector(`style[data-codex-app-themes]`).textContent+=' + JSON.stringify(shellCss) + ',s}';
module.exports = {
  id: 'theme-background',
  title: 'Apply the configured background to the top bar and sidebar',
  sourceType: 'module',
  targetPath: 'webview/assets/app-theme-c850e3c1c24c.js',
  sourceSha256: 'cbc719a3fbbc0952efc34502dbbea844bd5deca9461ca89687374555c504c46f',
  before, after, shellCss, stylesheetBefore, stylesheetAfter,
  apply(source, replace) {
    source = replace(source, before, after);
    return replace(source, stylesheetBefore, stylesheetAfter);
  },
};

module.exports.revisions = [{
  targetPath: "webview/assets/app-theme-74be6a9cf7df.js",
  sourceSha256: '107d26679f5a0faf789d7695aef84299fdad63dae4d6edbd69f20de2ed79f545',
  stylesheetBefore: 'return d(e,s),s}',
  stylesheetAfter: stylesheetAfter.replace('return l(e,s)', 'return d(e,s)'),
  apply(source, replace) {
    source = replace(source, before, after);
    return replace(source, this.stylesheetBefore, this.stylesheetAfter);
  },
}];

module.exports.revisions.push({
  targetPath: 'webview/assets/app-theme-98273c284c4e.js',
  sourceSha256: '36152979155da22a2d1dae487baf5ba7599474ddb1e0ddac62757cceeea4aa88',
  stylesheetBefore: 'return l(e,c),c}',
  stylesheetAfter: stylesheetAfter.replace('return l(e,s)', 'return l(e,c)').replace(',s}', ',c}'),
  apply(source, replace) {
    source = replace(source, before, after);
    return replace(source, this.stylesheetBefore, this.stylesheetAfter);
  },
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: 'webview/assets/app-theme-e32c698b2a48.js',
  sourceSha256: 'ce999cd54682d518f3194a36641566173729ad6462a33b00e4b08df2b39099af',
});

module.exports.revisions.push({
  targetPath: 'webview/assets/async/496175.cf5ad221c1.js',
  sourceSha256: '79cd497b3586afdb4edd6a50e9cab6e0c255ea60ee0e04808c1b5dd7cc649376',
  before: '"--app-color-background-surface-under":G.surfaceUnder,',
  after: '"--app-color-background-surface-under":G.theme.surface,"--app-color-background-shell":G.theme.surface,',
  stylesheetBefore: 'l.textContent!==C&&(l.textContent=C),c}',
  stylesheetAfter: 'l.textContent!==C&&(l.textContent=C),l.textContent+='+JSON.stringify(shellCss)+',c}',
  apply(source, replace) {
    source = replace(source, this.before, this.after);
    return replace(source, this.stylesheetBefore, this.stylesheetAfter);
  },
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: 'webview/assets/async/890434.9dbaee449e.js',
  sourceSha256: 'f2e695e1cc13f1d453fac89de447fd14821a1a1d906fbd6d086af314512a660b',
});
