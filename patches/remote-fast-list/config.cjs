"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function privatePath(file, directory = false, create = false) {
  if (create) fs.mkdirSync(file, { recursive: true, mode: 0o700 });
  const st = fs.lstatSync(file);
  if (st.isSymbolicLink() || (directory ? !st.isDirectory() : !st.isFile()))
    throw new Error("Runtime state must be an ordinary owned file or directory");
  if (process.platform !== "win32" && (st.uid !== process.getuid() || (st.mode & 0o077)))
    throw new Error("Runtime state must be private to its owner");
}

function readRuntimeConfig(file = process.env.CODEX_PATCHES_RUNTIME_CONFIG) {
  if (!file || !path.isAbsolute(file)) throw new Error("An absolute runtime configuration is required");
  privatePath(path.dirname(file), true);
  privatePath(file);
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  if (config.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(config.cliSha256) ||
      !/^codex-cli \S+$/.test(config.cliVersion) || !config.distro ||
      typeof config.relayEnabled !== "boolean" || typeof config.rewriteProjectPaths !== "boolean")
    throw new Error("Unsupported runtime configuration");
  for (const field of ["realCli", "codexHome", "sqliteHome", "stateRoot", "node"])
    if (typeof config[field] !== "string" || !path.isAbsolute(config[field]))
      throw new Error(`Runtime ${field} must be an absolute path`);
  const override = process.env.CODEX_PATCHES_REAL_CLI;
  if (override && fs.realpathSync(override) !== fs.realpathSync(config.realCli))
    throw new Error("The stock CLI override disagrees with the runtime configuration");
  return config;
}

function validateBinary(binary, expectedHash) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error("A validated CLI hash is required");
  const hash = crypto.createHash("sha256").update(fs.readFileSync(binary)).digest("hex");
  if (hash !== expectedHash) throw new Error("Stock CLI hash differs from the supported build");
}

module.exports = { readRuntimeConfig, privatePath, validateBinary };
