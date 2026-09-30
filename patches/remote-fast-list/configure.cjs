#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeConfig } = require("./config.cjs");
const { prepare, readConfig, pairing, migrate, publicReport, rollback } = require("./runtime.cjs");

async function main(args) {
  const options = Object.fromEntries(args.map(arg => {
    if (!arg.startsWith("--")) throw new Error("Expected named options");
    const split = arg.indexOf("=");
    return split < 0 ? [arg.slice(2), true] : [arg.slice(2, split), arg.slice(split + 1)];
  }));
  if (options.rollback) return rollback(options.rollback);
  const runtime = readRuntimeConfig(options.config);
  const root = path.join(runtime.stateRoot, "relay");
  const exists = fs.existsSync(path.join(root, "runtime.json"));
  if (!exists && !options.apply) return { prepared: false, applied: false,
    needsPreparation: true, message: "Apply creates a stable private relay route and adds mappings for existing pairings." };
  const config = options.apply ? await prepare(root) : readConfig(root);
  const database = path.join(runtime.sqliteHome, "state_5.sqlite");
  if (!fs.existsSync(database)) return { prepared: true, applied: false, sourceEntries: 0, databaseAbsent: true };
  return options.apply ? migrate(database, config, root) : publicReport(pairing(database, config, "plan"));
}

module.exports = { main };
if (require.main === module) main(process.argv.slice(2)).then(report => console.log(JSON.stringify(report, null, 2)))
  .catch(error => { console.error(`Relay configuration: ${error.message}`); process.exitCode = 1; });
