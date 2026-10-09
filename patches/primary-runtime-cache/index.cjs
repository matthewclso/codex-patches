"use strict";
const path = require("node:path");
function cacheEnvironment(runtime, inherited) {
  if (!runtime.primaryRuntimeCacheHome) return inherited;
  if (!path.isAbsolute(runtime.primaryRuntimeCacheHome)) throw new Error("Primary runtime cache must be absolute");
  if (inherited.XDG_CACHE_HOME && path.resolve(inherited.XDG_CACHE_HOME) !== path.resolve(runtime.primaryRuntimeCacheHome))
    throw new Error("Explicit XDG_CACHE_HOME conflicts with the desktop primary runtime cache; disable primary-runtime-cache in the patch selection or align XDG_CACHE_HOME with the desktop cache before installing");
  return { ...inherited, XDG_CACHE_HOME: runtime.primaryRuntimeCacheHome };
}
module.exports = { id: "primary-runtime-cache", title: "Shared desktop and WSL primary runtime cache", cacheEnvironment };
