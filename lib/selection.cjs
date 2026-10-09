'use strict';
const app = require('./app-patches.cjs');
const ids = [...app.listPatches().map(p => p.id), 'wsl-project-paths', 'remote-fast-list', 'connector-routing', 'primary-runtime-cache'];
function resolveSelection(config, build) {
  if (config.schemaVersion !== 1 || !config.patches || typeof config.patches !== 'object') throw new Error('Unsupported selection configuration');
  for (const id of Object.keys(config.patches)) if (!ids.includes(id)) throw new Error('Unknown patch: ' + id);
  const states = {}, selected = [];
  for (const id of ids) {
    const mode = config.patches[id] ?? app.listPatches().find(p => p.id === id)?.defaultMode ?? 'auto';
    if (!['auto', 'enabled', 'disabled'].includes(mode)) throw new Error('Invalid mode for ' + id);
    const needed = build.patches[id]?.status === 'needed' || build.runtimePatches?.[id]?.status === 'needed';
    if (mode === 'enabled' && !needed) throw new Error('Patch has no reviewed implementation for this build: ' + id);
    states[id] = mode;
    if (mode !== 'disabled' && needed) selected.push(id);
  }
  for (const p of app.listPatches()) if (selected.includes(p.id)) for (const dep of p.dependencies) {
    if (!selected.includes(dep)) throw new Error(p.id + ' requires ' + dep + '; enable both or disable the dependent patch');
  }
  return { states, selected, appPatches: selected.filter(id => app.listPatches().some(p => p.id === id)) };
}
module.exports = { ids, resolveSelection };
