"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { stateDb } = require("../patches/remote-fast-list/sqlite-state.cjs");
const { AppServerRpc } = require("../patches/remote-fast-list/rpc.cjs");

function authority(state, hostKey) {
  return { projects: state["local-projects"] ?? {}, assignments: state["thread-project-assignments"] ?? {},
    mapping: state["app-server-project-id-by-legacy-project-id-by-host"]?.[hostKey] ?? {} };
}
function signature(input) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
function makePlan(input, snapshot) {
  const projects = new Map(snapshot.projects.map(p => [p.id, p.name]));
  const threads = new Map(snapshot.threads.map(t => [t.id, t]));
  const result = { actions: [], alreadyCorrect: [], missingThreads: [], conflicts: [], missingProjects: [] };
  for (const [threadId, assignment] of Object.entries(input.assignments)) {
    if (assignment?.projectKind !== "local") continue;
    const desktop = input.projects[assignment.projectId];
    const projectId = input.mapping[assignment.projectId];
    if (!desktop || !projectId || projects.get(projectId) !== desktop.name) {
      result.missingProjects.push({ threadId, desktopProjectId: assignment.projectId });
      continue;
    }
    const thread = threads.get(threadId);
    if (!thread) { result.missingThreads.push(threadId); continue; }
    if (thread.project_id === projectId) { result.alreadyCorrect.push(threadId); continue; }
    if (thread.project_id !== null) { result.conflicts.push(threadId); continue; }
    result.actions.push({ threadId, projectId, projectName: desktop.name });
  }
  return result;
}
async function verifyApi(binary, home, sqliteHome, actions) {
  const rpc = new AppServerRpc(binary, home, sqliteHome);
  const verified = new Set();
  const expected = new Map(actions.map(a => [a.threadId, a.projectId]));
  try {
    await rpc.initialize();
    const grouped = new Map(actions.map(a => [a.projectId, a.projectName]));
    for (const [projectId, name] of grouped) {
      const project = await rpc.request("project/read", { projectId });
      if (project.project.name !== name) throw new Error("Project API name mismatch");
      for (const archived of [false, true]) {
        let cursor = null;
        do {
          const page = await rpc.request("thread/list", { projectId, archived, cursor, limit: 50, useStateDbOnly: true });
          for (const thread of page.data) {
            if (thread.projectId !== projectId) throw new Error("Project-filtered API returned wrong membership");
            if (expected.get(thread.id) === projectId) verified.add(thread.id);
          }
          cursor = page.nextCursor;
        } while (cursor);
      }
    }
    // Listing may exclude some source kinds; validate those explicitly, without turns or resume.
    for (const [threadId, projectId] of expected) {
      if (verified.has(threadId)) continue;
      const result = await rpc.request("thread/read", { threadId, includeTurns: false });
      if (result.thread.projectId !== projectId) throw new Error("Thread API membership mismatch");
      verified.add(threadId);
    }
  } finally { await rpc.close(); }
  return { verifiedThreadCount: verified.size, via: "stock app-server project/read and thread/list/read" };
}
async function main() {
  const options = Object.fromEntries(process.argv.slice(2).filter(v => v.startsWith("--"))
    .map(v => { const p = v.indexOf("="); return p < 0 ? [v.slice(2), true] : [v.slice(2,p), v.slice(p+1)]; }));
  if (options.rollback) {
    const record = JSON.parse(fs.readFileSync(path.join(options.rollback, "plan.json"), "utf8"));
    const result = stateDb(record.database, "rollback", { actions: record.plan.actions });
    console.log(JSON.stringify({ rolledBack: true, changedCount: result.changedThreadIds.length }, null, 2));
    return;
  }
  const home = options.home;
  const sqliteHome = options.sqlite;
  const binary = options.binary;
  for(const [name,value] of Object.entries({home,sqlite:sqliteHome,binary}))
    if(typeof value!=="string" || !path.isAbsolute(value))throw new Error(`--${name}=absolute-path is required`);
  const statePath = path.join(home, ".codex-global-state.json");
  const database = path.join(sqliteHome, "state_5.sqlite");
  const hostKey = options.host ?? `local:${home}`;
  const readAuthority = () => authority(JSON.parse(fs.readFileSync(statePath, "utf8")), hostKey);
  const input = readAuthority();
  const fingerprint = signature(input);
  const plan = makePlan(input, stateDb(database, "snapshot"));
  const summary = { repairCandidates: plan.actions.length, alreadyCorrect: plan.alreadyCorrect.length,
    missingThreads: plan.missingThreads.length, conflicts: plan.conflicts.length,
    missingProjects: plan.missingProjects.length, applied: false };
  if (!options.apply || !plan.actions.length) { console.log(JSON.stringify(summary, null, 2)); return; }
  const backupRoot = options.backup;
  if(typeof backupRoot!=="string" || !path.isAbsolute(backupRoot))throw new Error("--backup=absolute-directory is required for apply");
  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  const backup = fs.mkdtempSync(path.join(backupRoot, "project-sync-"));
  fs.chmodSync(backup, 0o700);
  const write = (name, value) => fs.writeFileSync(path.join(backup, name), JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  const snapshot = await stateDb(database, "backup", { destination: path.join(backup, "state_5.sqlite") });
  fs.copyFileSync(statePath, path.join(backup, "desktop-state.json"));
  fs.chmodSync(path.join(backup, "desktop-state.json"), 0o600);
  write("plan.json", { database, authoritySignature: fingerprint, plan });
  if (signature(readAuthority()) !== fingerprint) throw new Error("Desktop project assignments changed; repair not applied");
  const applied = stateDb(database, "apply", { actions: plan.actions });
  summary.applied = true;
  summary.changedCount = applied.changedThreadIds.length;
  summary.backup = backup;
  summary.backupQuickCheck = snapshot.quickCheck;
  write("result.json", summary);
  try {
    const after = stateDb(database, "snapshot");
    const byId = new Map(after.threads.map(t => [t.id, t.project_id]));
    if (plan.actions.some(a => byId.get(a.threadId) !== a.projectId)) throw new Error("Database verification failed");
    summary.api = await verifyApi(binary, home, sqliteHome, plan.actions);
    summary.authorityUnchanged = signature(readAuthority()) === fingerprint;
    if (!summary.authorityUnchanged) throw new Error("Desktop project authority changed during repair; review pending items");
  } catch (error) {
    summary.verificationError = error.message;
    process.exitCode = 1;
  }
  write("result.json", summary);
  console.log(JSON.stringify(summary, null, 2));
}
module.exports = { makePlan, stateDb, verifyApi, authority };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
