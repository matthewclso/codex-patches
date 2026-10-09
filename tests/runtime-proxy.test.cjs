"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const PYTHON = process.env.CODEX_PATCHES_PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const PROXY = path.join(__dirname, "../patches/wsl-project-paths/proxy.py");

function python(source) {
  return execFileSync(PYTHON, ["-c", `import importlib.util,json,sys\nsys.dont_write_bytecode=True\nspec=importlib.util.spec_from_file_location('proxy',${JSON.stringify(PROXY)})\np=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)\n${source}`], { encoding: "utf8" });
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
    assert.equal(python(`out,_,_=p.rewrite_request_line(${JSON.stringify(line)}.encode(),'FixtureUbuntu',{'d':'/drives/d'});sys.stdout.buffer.write(out)`), line);
  }
});

test("only a stdio app-server session is supervised", () => {
  const input = [["--version"], ["app-server", "--help"], ["app-server", "generate-ts"],
    ["app-server", "--listen", "ws://127.0.0.1:1234"], ["app-server"], ["app-server", "--listen=stdio://"]];
  assert.deepEqual(JSON.parse(python(`print(json.dumps([p.should_proxy_app_server(x) for x in json.loads(${JSON.stringify(JSON.stringify(input))})]))`)),
    [false, false, false, false, true, true]);
});

test("stock passthrough and both-disabled app-server use the canonical Linux home even with a Windows desktop environment", {
  skip: process.platform === "win32",
}, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-patches-env-fixture-"));
  fs.chmodSync(directory, 0o700);
  const binary = path.join(directory, "stock-cli-fixture");
  const log = path.join(directory, "calls.jsonl");
  const program = "#!/usr/bin/env python3\nimport json,os,sys\nrecord={'args':sys.argv[1:],'home':os.environ.get('CODEX_HOME'),'sqlite':os.environ.get('CODEX_SQLITE_HOME'),'cache':os.environ.get('XDG_CACHE_HOME')}\nwith open(os.environ['CODEX_PATCHES_FIXTURE_LOG'],'a') as f:f.write(json.dumps(record)+'\\n')\nprint('codex-cli fixture' if sys.argv[1:]==['--version'] else json.dumps(record))\n";
  fs.writeFileSync(binary, program, { mode: 0o700 });
  const config = { schemaVersion: 1, realCli: binary,
    cliSha256: crypto.createHash("sha256").update(program).digest("hex"), cliVersion: "codex-cli fixture",
    codexHome: path.join(directory, "canonical-home"), sqliteHome: path.join(directory, "canonical-sqlite"),
    stateRoot: path.join(directory, "state"), node: process.execPath, distro: "FixtureUbuntu",
    relayEnabled: false, rewriteProjectPaths: false, primaryRuntimeCacheHome: path.join(directory, "desktop-cache") };
  const runtime = path.join(directory, "runtime.json");
  fs.writeFileSync(runtime, JSON.stringify(config), { mode: 0o600 });
  const env = { ...process.env, CODEX_HOME: "Q:\\Desktop\\.codex", CODEX_SQLITE_HOME: "Q:\\Desktop\\sqlite",
    CODEX_PATCHES_RUNTIME_CONFIG: runtime, CODEX_PATCHES_FIXTURE_LOG: log };
  delete env.CODEX_PATCHES_REAL_CLI;
  delete env.XDG_CACHE_HOME;
  try {
    const invoke = args => execFileSync(PYTHON, [PROXY, ...args], { encoding: "utf8", env });
    assert.equal(invoke(["--version"]).trim(), config.cliVersion);
    assert.deepEqual(JSON.parse(invoke(["app-server", "--listen", "ws://127.0.0.1:12345"])).args,
      ["app-server", "--listen", "ws://127.0.0.1:12345"]);
    assert.deepEqual(JSON.parse(invoke(["app-server"])).args, ["app-server"]);
    const calls = fs.readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(calls.map(call => call.args), [["--version"],
      ["app-server", "--listen", "ws://127.0.0.1:12345"], ["--version"], ["app-server"]]);
    for (const call of calls) {
      assert.equal(call.home, config.codexHome, "Every stock invocation, including its version probe, needs the backend home");
      assert.equal(call.sqlite, config.sqliteHome);
      assert.equal(call.cache, config.primaryRuntimeCacheHome);
    }
    assert.equal(fs.existsSync(config.stateRoot), false, "Disabling optional modules creates no relay runtime");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
