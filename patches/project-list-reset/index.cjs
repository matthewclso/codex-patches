'use strict';

module.exports = {
  id: 'project-list-reset',
  title: 'Reset the project chat list on collapse',
  targetPath: 'webview/assets/async/499225.6d2e47bea2.js',
  sourceSha256: '80f7a6b651f9f56ac97463123d72963c2a78570f6f0162c75d0d6d9d0a03f074',
  sourceType: 'module',
  apply(source, replace) {
    // Jk reads the folder's current collapsed state. wE clears the same
    // project-scoped expansion flag that the native pagination control sets.
    return replace(source,
      'j=()=>{(0,eW.x5)(ep,ek)},G[37]=ek',
      'j=()=>{ep.get(eW.Jk,ek)||(0,eW.wE)(ep,`project:${ek}`,!1),(0,eW.x5)(ep,ek)},G[37]=ek');
  },
};
