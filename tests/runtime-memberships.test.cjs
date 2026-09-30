"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { makePlan, stateDb } = require("../tools/repair-project-memberships.cjs");

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
