"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRelay } = require("./relay.cjs");
const { privatePath } = require("./config.cjs");
const { stateDb } = require("./sqlite-state.cjs");
const { SOURCE, target, pairing } = require("./pairing.cjs");

function readConfig(root) {
  privatePath(root, true);
  const file = path.join(root, "runtime.json");
  privatePath(file);
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  if (config.version !== 1) throw new Error("Unsupported relay configuration");
  target(config);
  return config;
}

async function prepare(root) {
  privatePath(root, true, true);
  if (fs.existsSync(path.join(root, "runtime.json"))) return readConfig(root);
  // Reserving a local port does not contact the upstream or create an enrollment.
  const relay = await createRelay();
  try {
    const url = new URL(relay.baseUrl);
    const config = { version: 1, port: Number(url.port), capability: url.pathname.split("/")[1] };
    fs.writeFileSync(path.join(root, "runtime.json"), JSON.stringify(config) + "\n", { mode: 0o600, flag: "wx" });
    return config;
  } finally { await relay.close(); }
}

async function migrate(database, config, root) {
  const plan = pairing(database, config, "plan");
  if (!plan.newMappings) return { ...publicReport(plan), applied: false };
  const backups = path.join(root, "backups");
  privatePath(backups, true, true);
  const destination = fs.mkdtempSync(path.join(backups, "routing-"));
  fs.chmodSync(destination, 0o700);
  const saved = await stateDb(database, "backup", { destination: path.join(destination, "state.sqlite") });
  const applied = pairing(database, config, "apply");
  const record = { database, config, insertedEntries: applied.insertedEntries };
  fs.writeFileSync(path.join(destination, "rollback.json"), JSON.stringify(record) + "\n", { mode: 0o600 });
  const report = { ...publicReport(applied), backup: destination,
    backupQuickCheck: saved.quickCheck, originalEntriesPreserved: true };
  fs.writeFileSync(path.join(destination, "result.json"), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  return report;
}

function publicReport(report) {
  const { insertedEntries, ...publicFields } = report;
  return publicFields;
}

function rollback(directory) {
  privatePath(directory, true);
  const file = path.join(directory, "rollback.json");
  privatePath(file);
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  return pairing(record.database, record.config, "rollback", record);
}

module.exports = { SOURCE, prepare, readConfig, pairing, migrate, target, publicReport, rollback };
