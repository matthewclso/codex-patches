"use strict";
const { DatabaseSync } = require("node:sqlite");
const crypto = require("node:crypto");
const SOURCE = "wss://chatgpt.com/backend-api/wham/remote/control/server";
const COLUMNS = ["websocket_url", "account_id", "app_server_client_name", "server_id",
  "environment_id", "server_name", "updated_at", "remote_control_enabled"];

function target(config) {
  if (!/^[a-f0-9]{64}$/.test(config.capability) || !Number.isInteger(config.port) ||
      config.port < 1024 || config.port > 65535) throw new Error("Invalid relay target");
  return `ws://127.0.0.1:${config.port}/${config.capability}/backend-api/wham/remote/control/server`;
}

function pairing(database, config, operation, extra = {}) {
  if (!["plan", "apply", "rollback"].includes(operation)) throw new Error("Unknown pairing operation");
  const db = new DatabaseSync(database, { readOnly: operation === "plan" });
  const destination = target(config), client = extra.clientName ?? "Codex Desktop";
  try {
    db.exec("PRAGMA busy_timeout=5000");
    const columns = db.prepare("PRAGMA table_info(remote_control_enrollments)").all().map(r => r.name).sort();
    if (JSON.stringify(columns) !== JSON.stringify([...COLUMNS].sort()))
      throw new Error("Unvalidated enrollment schema");
    if (operation !== "plan") db.exec("BEGIN IMMEDIATE");
    try {
      if (operation === "rollback") {
        let removed = 0;
        for (const row of extra.insertedEntries ?? []) {
          if (row.websocket_url !== destination) throw new Error("Rollback belongs to another relay");
          const current = db.prepare("SELECT * FROM remote_control_enrollments WHERE websocket_url=? AND account_id=? AND app_server_client_name=?")
            .get(destination, row.account_id, row.app_server_client_name);
          if (!current) continue;
          if (COLUMNS.some(key => current[key] !== row[key]))
            throw new Error("Enrollment changed since migration; rollback refused");
          removed += db.prepare("DELETE FROM remote_control_enrollments WHERE websocket_url=? AND account_id=? AND app_server_client_name=?")
            .run(destination, row.account_id, row.app_server_client_name).changes;
        }
        db.exec("COMMIT");
        return { removedMappings: removed, rolledBack: true, originalEntriesPreserved: true };
      }
      const rows = db.prepare("SELECT * FROM remote_control_enrollments WHERE websocket_url=? AND app_server_client_name=?")
        .all(SOURCE, client);
      let existing = 0;
      const insertedEntries = [];
      for (const row of rows) {
        const mapped = db.prepare("SELECT * FROM remote_control_enrollments WHERE websocket_url=? AND account_id=? AND app_server_client_name=?")
          .get(destination, row.account_id, client);
        if (mapped) {
          if (["server_id", "environment_id", "server_name"].some(key => mapped[key] !== row[key]))
            throw new Error("Enrollment identity conflict; no rows changed");
          existing++;
          continue;
        }
        const newRow = { ...row, websocket_url: destination };
        insertedEntries.push(newRow);
        if (operation === "apply") db.prepare(`INSERT INTO remote_control_enrollments(${COLUMNS.join(",")}) VALUES(${COLUMNS.map(() => "?").join(",")})`)
          .run(...COLUMNS.map(key => newRow[key]));
      }
      if (operation === "apply") db.exec("COMMIT");
      return { sourceEntries: rows.length, alreadyMapped: existing, newMappings: insertedEntries.length,
        sourceSignature: crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
        applied: operation === "apply", insertedEntries };
    } catch (error) { if (operation !== "plan") db.exec("ROLLBACK"); throw error; }
  } finally { db.close(); }
}

module.exports = { SOURCE, target, pairing };
