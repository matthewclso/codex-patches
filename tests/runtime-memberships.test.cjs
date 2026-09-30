"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { makePlan, stateDb } = require("../tools/repair-project-memberships.cjs");
const { AppServerRpc } = require("../patches/remote-fast-list/rpc.cjs");

test("authoritative assignments distinguish two projects sharing one working directory", () => {
  const result = makePlan({ projects: { a: {name:"Research"}, b: {name:"AI"} }, mapping: {a:"p1", b:"p2"},
    assignments: { t1: {projectKind:"local",projectId:"a"}, t2: {projectKind:"local",projectId:"b"},
      missing: {projectKind:"local",projectId:"a"}, conflict: {projectKind:"local",projectId:"a"} } },
  { projects: [{id:"p1",name:"Research"},{id:"p2",name:"AI"}], threads: [
    {id:"t1",cwd:"/same",project_id:null},{id:"t2",cwd:"/same",project_id:null},
    {id:"conflict",cwd:"/same",project_id:"p2"}] });
  assert.deepEqual(result, { actions: [
    {threadId:"t1",projectId:"p1",projectName:"Research"},
    {threadId:"t2",projectId:"p2",projectName:"AI"}], alreadyCorrect: [],
    missingThreads: ["missing"], conflicts: ["conflict"], missingProjects: [] });
});
test("stale mappings do not rename projects or guess missing identities", () => {
  assert.equal(makePlan({ projects:{a:{name:"New name"}},mapping:{a:"p1"},
    assignments:{t1:{projectKind:"local",projectId:"a"}} },
  {projects:[{id:"p1",name:"Old name"}],threads:[{id:"t1",project_id:null}]}).actions.length,0);
});
test("SQLite repair is atomic, conditional, reversible and leaves other fields unchanged", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-project-sync-test-"));
  const db = path.join(dir,"state.sqlite");
  try {
    const fixture=new DatabaseSync(db);
    fixture.exec("CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT); CREATE TABLE threads(id TEXT PRIMARY KEY,project_id TEXT,cwd TEXT,rollout_path TEXT,archived INTEGER); INSERT INTO projects VALUES('p1','Research'),('p2','AI'); INSERT INTO threads VALUES('t1',NULL,'/same','unchanged',0),('t2','p2','/same','unchanged',0);");
    fixture.close();
    const before = stateDb(db,"snapshot");
    const good={threadId:"t1",projectId:"p1",projectName:"Research"};
    const conflict={threadId:"t2",projectId:"p1",projectName:"Research"};
    assert.throws(()=>stateDb(db,"apply",{actions:[good,conflict]}));
    assert.deepEqual(stateDb(db,"snapshot"),before);
    assert.deepEqual(stateDb(db,"apply",{actions:[good]}).changedThreadIds,["t1"]);
    assert.equal(stateDb(db,"apply",{actions:[good]}).changedThreadIds.length,0);
    stateDb(db,"rollback",{actions:[good]});
    assert.deepEqual(stateDb(db,"snapshot"),before);
    assert.equal((await stateDb(db,"backup",{destination:path.join(dir,"backup.sqlite")})).quickCheck,"ok");
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test("stock project APIs persist initial, moved and cleared memberships independently of cwd", {
  skip: !process.env.CODEX_RELAY_TEST_BINARY || process.platform === "win32", timeout: 30000,
}, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-project-membership-api-"));
  const home = path.join(dir, "home"), sqlite = path.join(dir, "sqlite");
  fs.mkdirSync(home, { mode: 0o700 }); fs.mkdirSync(sqlite, { mode: 0o700 });
  fs.writeFileSync(path.join(home, "config.toml"),
    'cli_auth_credentials_store = "file"\n[analytics]\nenabled = false\n[feedback]\nenabled = false\n');
  let rpc = new AppServerRpc(process.env.CODEX_RELAY_TEST_BINARY, home, sqlite);
  try {
    await rpc.initialize();
    assert.equal((await rpc.request("account/read", {})).account, null);
    const projects = [];
    for (const name of ["Research", "AI"]) projects.push((await rpc.request("project/create", {
      name, roots: [{ path: dir }], idempotencyKey: require("node:crypto").randomUUID(),
    })).project);
    const started = await rpc.request("thread/start", {
      cwd: dir, projectId: projects[0].id, ephemeral: false, approvalPolicy: "never", sandbox: "read-only",
    });
    const threadId = started.thread.id;
    assert.equal(started.thread.projectId, projects[0].id);
    // Persist a synthetic history item through the stock API without starting
    // a model turn. All files and state belong to this disposable test home.
    await rpc.request("thread/inject_items", { threadId, items: [{
      type: "message", role: "user", content: [{ type: "input_text", text: "Isolated membership fixture." }],
    }] });
    const read = async () => (await rpc.request("thread/read", { threadId, includeTurns: false })).thread;
    assert.equal((await read()).projectId, projects[0].id);
    for (const projectId of [projects[1].id, "", projects[0].id]) {
      await rpc.request("thread/metadata/update", { threadId, projectId });
      const thread = await read();
      assert.equal(thread.projectId, projectId || null);
      assert.equal(thread.cwd, dir, "Membership changes must not rename the shared working directory");
      const persisted = new DatabaseSync(path.join(sqlite, "state_5.sqlite"), { readOnly: true });
      try { assert.equal(persisted.prepare("SELECT project_id FROM threads WHERE id=?").get(threadId).project_id,
        projectId || null, "The backend must persist each update, including a clear"); }
      finally { persisted.close(); }
    }
    await rpc.close(); rpc = null;
    rpc = new AppServerRpc(process.env.CODEX_RELAY_TEST_BINARY, home, sqlite);
    await rpc.initialize();
    assert.equal((await read()).projectId, projects[0].id, "Membership must survive a backend restart");
  } finally {
    try { if (rpc) await rpc.close(); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
