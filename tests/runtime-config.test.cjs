"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { prepare, readConfig, migrate, pairing, SOURCE, target, rollback } = require("../patches/remote-fast-list/runtime.cjs");
const { readRuntimeConfig, validateBinary } = require("../patches/remote-fast-list/config.cjs");
const { main: configure } = require("../patches/remote-fast-list/configure.cjs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-patches-runtime-"));
  fs.chmodSync(root, 0o700);
  const config = { schemaVersion: 1, realCli: process.execPath,
    cliSha256: crypto.createHash("sha256").update(fs.readFileSync(process.execPath)).digest("hex"),
    cliVersion: "codex-cli fixture", codexHome: path.join(root, "home"), sqliteHome: path.join(root, "sqlite"),
    stateRoot: path.join(root, "state"), node: process.execPath, distro: "Fixture Ubuntu", relayEnabled: true, rewriteProjectPaths: true };
  const file = path.join(root, "runtime.json");
  fs.writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
  fs.mkdirSync(config.sqliteHome, { mode: 0o700 });
  return { root, config, file };
}

function enrollmentDb(file) {
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE remote_control_enrollments(websocket_url TEXT,account_id TEXT,app_server_client_name TEXT,server_id TEXT,environment_id TEXT,server_name TEXT,updated_at INTEGER,remote_control_enabled INTEGER,PRIMARY KEY(websocket_url,account_id,app_server_client_name))");
  return db;
}

test("runtime binds an explicit stock binary and rejects incompatible, public or aliased config", () => {
  const { root, config, file } = fixture();
  try {
    assert.deepEqual(readRuntimeConfig(file), config);
    validateBinary(config.realCli, config.cliSha256);
    assert.throws(() => validateBinary(config.realCli, "0".repeat(64)));
    fs.writeFileSync(file, JSON.stringify({ ...config, relayEnabled: "true" }));
    assert.throws(() => readRuntimeConfig(file));
    fs.writeFileSync(file, JSON.stringify(config));
    if (process.platform !== "win32") {
      fs.chmodSync(file, 0o644);
      assert.throws(() => readRuntimeConfig(file));
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("default configure plan has no filesystem or enrollment side effects", async () => {
  const { root, file, config } = fixture();
  try {
    const before = fs.readdirSync(root);
    const report = await configure([`--config=${file}`]);
    assert.equal(report.needsPreparation, true);
    assert.deepEqual(fs.readdirSync(root), before);
    assert.equal(fs.existsSync(config.stateRoot), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("stable relay route is independent of CLI updates, migrations are additive and rollback is conditional", async () => {
  const { root, config } = fixture();
  const relayRoot = path.join(config.stateRoot, "relay");
  const file = path.join(config.sqliteHome, "state_5.sqlite");
  let db;
  try {
    const relay = await prepare(relayRoot);
    assert.deepEqual(await prepare(relayRoot), relay);
    assert.deepEqual(readConfig(relayRoot), relay);
    assert.equal(Object.hasOwn(relay, "cliSha256"), false);
    db = enrollmentDb(file);
    const original = [SOURCE, "fixture-account", "Codex Desktop", "fixture-server", "fixture-env", "fixture-name", 123, 1];
    db.prepare("INSERT INTO remote_control_enrollments VALUES(?,?,?,?,?,?,?,?)").run(...original);
    assert.equal(pairing(file, relay, "plan").newMappings, 1);
    const migrated = await migrate(file, relay, relayRoot);
    assert.equal(migrated.backupQuickCheck, "ok");
    assert.equal(Object.hasOwn(migrated, "insertedEntries"), false, "public report must omit account identifiers");
    assert.deepEqual(Object.values(db.prepare("SELECT * FROM remote_control_enrollments WHERE websocket_url=?").get(SOURCE)), original);
    assert.equal(pairing(file, relay, "apply").newMappings, 0);
    db.prepare("UPDATE remote_control_enrollments SET remote_control_enabled=0 WHERE websocket_url=?").run(target(relay));
    assert.equal(pairing(file, relay, "apply").newMappings, 0);
    assert.equal(db.prepare("SELECT remote_control_enabled FROM remote_control_enrollments WHERE websocket_url=?").get(target(relay)).remote_control_enabled, 0);
    assert.throws(() => rollback(migrated.backup), /changed since migration/);
    db.prepare("UPDATE remote_control_enrollments SET remote_control_enabled=1 WHERE websocket_url=?").run(target(relay));
    assert.equal(rollback(migrated.backup).removedMappings, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM remote_control_enrollments").get().n, 1);
  } finally { db?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("an enrollment identity conflict rolls back every preceding candidate insertion", async () => {
  const { root, config } = fixture();
  let db;
  try {
    const relay = await prepare(path.join(config.stateRoot, "relay"));
    const file = path.join(config.sqliteHome, "state_5.sqlite");
    db = enrollmentDb(file);
    const insert = db.prepare("INSERT INTO remote_control_enrollments VALUES(?,?,?,?,?,?,?,?)");
    insert.run(SOURCE, "a", "Codex Desktop", "server-a", "env", "name", 1, 1);
    insert.run(SOURCE, "b", "Codex Desktop", "server-b", "env", "name", 1, 1);
    insert.run(target(relay), "b", "Codex Desktop", "different", "env", "name", 1, 1);
    assert.throws(() => pairing(file, relay, "apply"), /identity conflict/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM remote_control_enrollments WHERE websocket_url=?").get(target(relay)).n, 1);
  } finally { db?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
