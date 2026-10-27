'use strict';
// Keep the sidebar/native window and outer shell on the configured surface.
// Elevated controls and the editor retain their independent contrast colors.
const before = '"--app-color-background-surface-under":e.surfaceUnder,';
const after = '"--app-color-background-surface-under":e.theme.surface,"--app-color-background-shell":e.theme.surface,';
module.exports = {
  id: 'theme-background',
  title: 'Apply the configured background to the top bar and sidebar',
  sourceType: 'module',
  targetPath: 'webview/assets/app-theme-c850e3c1c24c.js',
  sourceSha256: 'cbc719a3fbbc0952efc34502dbbea844bd5deca9461ca89687374555c504c46f',
  before, after,
  apply(source, replace) { return replace(source, before, after); },
};
