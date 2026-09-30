"use strict";
const fs = require("node:fs");
const { DatabaseSync, backup } = require("node:sqlite");

function stateDb(database, operation, extra = {}) {
  const writable = ["apply", "rollback"].includes(operation);
  const db = new DatabaseSync(database, { readOnly: !writable });
  db.exec("PRAGMA busy_timeout=5000");
  if (operation === "backup") {
    if (fs.existsSync(extra.destination)) { db.close(); throw new Error("Refusing to replace a backup"); }
    return backup(db, extra.destination).then(() => {
      fs.chmodSync(extra.destination, 0o600);
      const saved = new DatabaseSync(extra.destination, { readOnly: true });
      try {
        if (saved.prepare("PRAGMA quick_check").get().quick_check !== "ok")
          throw new Error("Backup integrity check failed");
        return { destination: extra.destination, quickCheck: "ok" };
      } finally { saved.close(); }
    }).finally(() => db.close());
  }
  try {
    if (operation === "snapshot") return {
      projects: db.prepare("SELECT id,name FROM projects").all(),
      threads: db.prepare("SELECT id,project_id,rollout_path,cwd,archived FROM threads").all(),
    };
    if (!writable) throw new Error("Unknown SQLite operation");
    db.exec("BEGIN IMMEDIATE");
    try {
      const changed = [];
      for (const action of extra.actions) {
        const project = db.prepare("SELECT name FROM projects WHERE id=?").get(action.projectId);
        if (!project || project.name !== action.projectName) throw new Error("Project identity changed");
        const row = db.prepare("SELECT project_id FROM threads WHERE id=?").get(action.threadId);
        if (!row) throw new Error("Thread disappeared");
        const previous = operation === "apply" ? null : action.projectId;
        const desired = operation === "apply" ? action.projectId : null;
        if (row.project_id === desired) continue;
        if (row.project_id !== previous) throw new Error("Concurrent project membership change");
        if (db.prepare("UPDATE threads SET project_id=? WHERE id=? AND project_id IS ?")
            .run(desired, action.threadId, previous).changes !== 1)
          throw new Error("Conditional membership update failed");
        changed.push(action.threadId);
      }
      db.exec("COMMIT");
      return { changedThreadIds: changed, operation };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  } finally { db.close(); }
}

module.exports = { stateDb };
