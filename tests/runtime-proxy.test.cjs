"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const PYTHON = process.env.CODEX_PATCHES_PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const PROXY = path.join(__dirname, "../patches/wsl-project-paths/proxy.py");

function python(source) {
  return execFileSync(PYTHON, ["-c", `import importlib.util,json\nspec=importlib.util.spec_from_file_location('proxy',${JSON.stringify(PROXY)})\np=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)\n${source}`], { encoding: "utf8" });
}

test("project roots translate discovered drive mounts and matching WSL UNC paths only", () => {
  const values = ["D:\\Users\\Example\\work", "\\\\wsl.localhost\\FixtureUbuntu\\home\\example\\work",
    "\\\\wsl$\\OtherUbuntu\\home\\example", "/home/example/work", "relative/path"];
  const result = JSON.parse(python(`print(json.dumps([p.normalize_project_path(x,'FixtureUbuntu',{'d':'/drives/d'}) for x in json.loads(${JSON.stringify(JSON.stringify(values))})]))`));
  assert.deepEqual(result, ["/drives/d/Users/Example/work", "/home/example/work",
    "\\\\wsl$\\OtherUbuntu\\home\\example", "/home/example/work", "relative/path"]);
});

test("JSONL adapter preserves unrelated and malformed traffic, newline style and unsafe integer IDs", () => {
  const input = '{"id":9007199254740993,"method":"project/update","params":{"roots":[{"path":"D:\\\\work"}],"name":"unchanged"}}\r\n';
  const report = JSON.parse(python(`line=${JSON.stringify(input)}.encode();out,method,count=p.rewrite_request_line(line,'FixtureUbuntu',{'d':'/drives/d'});print(json.dumps({'out':out.decode(),'method':method,'count':count}))`));
  assert.equal(report.count, 1);
  assert.match(report.out, /9007199254740993/);
  assert.ok(report.out.endsWith("\r\n"));
  assert.equal(JSON.parse(report.out).params.roots[0].path, "/drives/d/work");
  for (const line of ["not JSON\n", '{"id":1,"method":"thread/start","params":{"cwd":"D:\\\\work"}}\n', "[]\n"]) {
    assert.equal(python(`out,_,_=p.rewrite_request_line(${JSON.stringify(line)}.encode(),'FixtureUbuntu',{'d':'/drives/d'});print(out.decode(),end='')`), line);
  }
});

test("only a stdio app-server session is supervised", () => {
  const input = [["--version"], ["app-server", "--help"], ["app-server", "generate-ts"],
    ["app-server", "--listen", "ws://127.0.0.1:1234"], ["app-server"], ["app-server", "--listen=stdio://"]];
  assert.deepEqual(JSON.parse(python(`print(json.dumps([p.should_proxy_app_server(x) for x in json.loads(${JSON.stringify(JSON.stringify(input))})]))`)),
    [false, false, false, false, true, true]);
});
