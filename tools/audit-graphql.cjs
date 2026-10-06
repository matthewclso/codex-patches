#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { parseArchive, readEntry } = require("../lib/asar.cjs");

function between(source, start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  if (from < 0 || to <= from) throw new Error(`GraphQL source boundary changed: ${start}`);
  return source.slice(from, to);
}

async function auditGraphql(asarPath, { wslDistro, windowsNode } = {}) {
  const source = readEntry(parseArchive(fs.readFileSync(asarPath)), ".vite/build/worker.js").toString();
  const workerHash = crypto.createHash('sha256').update(source).digest('hex');
  const source7945 = workerHash === '46b153e94466da15a8245dba0aecea0cc775b0b1688fe3b4cc9dd74d7805d7ad';
  const latestSource = source7945 || workerHash === '290125797165e28c2b11e2b49031c605d55857007ea61c1352260d36a1fc195e';
  const currentSource = latestSource || workerHash === '23cb6abfcfe706cb571b80140a65b04b9a6a0a66b741439afde3d9e6cddf92d3';
  const quotes = between(source, "function sQ(", source7945 ? "var pbe=" : currentSource ? "var dbe=" : "var ube=");
  const execute = between(source, source7945 ? "async function cje(" : latestSource ? "async function oje(" : currentSource ? "async function aje(" : "async function ije(", source7945 ? "function lje(" : latestSource ? "function sje(" : currentSource ? "function oje(" : "function aje(");
  const wrap = between(source, "function _xe(", source7945 ? "function Sxe(" : currentSource ? "function bxe(" : "function yxe(");
  const wslArgs = between(source, source7945 ? "function _U(" : "function yU(", source7945 ? "function vU(" : "function bU(");
  const shell = source.match(source7945 ? /dU=`([^`]+)`/ : /pU=`([^`]+)`/)?.[1];
  if (!shell?.startsWith("/")) throw new Error("WSL shell boundary changed");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-graphql-audit-"));
  const bin = path.join(directory, "bin");
  fs.mkdirSync(bin);
  const hook = path.join(directory, "fixture-env.sh");
  fs.writeFileSync(path.join(bin, "gh"), "#!/usr/bin/env python3\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\n", { mode: 0o700 });
  // Resolve the disposable fake gh in both login shells. The old variable
  // guard is deliberately absent, even if this audit runs from a patched app.
  fs.writeFileSync(hook, `export PATH=${JSON.stringify(bin)}:$PATH\nunset searchQuery first after owner repo number search threadId body\n`);
  const context = { [source7945 ? "sje" : latestSource ? "aje" : currentSource ? "ije" : "rje"]: { GIT_TERMINAL_PROMPT: "0", GH_PROMPT_DISABLED: "1" },
    tF: () => true, QP: () => null, oU: value => value, fP: async value => value,
    $P: () => true, XP: () => null, iU: value => value, uP: async value => value,
    [source7945 ? "Sxe" : currentSource ? "bxe" : "yxe"]: () => false, pU: shell, dU: shell, process: { cwd: () => directory, env: {} } };
  vm.createContext(context);
  vm.runInContext(quotes + execute + wrap + wslArgs + (source7945 ? ";globalThis.auditExec=cje;globalThis.auditWrap=xxe;" : latestSource ? ";globalThis.auditExec=oje;globalThis.auditWrap=yxe;" : currentSource ? ";globalThis.auditExec=aje;globalThis.auditWrap=yxe;" : ";globalThis.auditExec=ije;globalThis.auditWrap=vxe;") + (source7945 ? "globalThis.auditWsl=_U;" : "globalThis.auditWsl=yU;"), context);
  const query = "query($searchQuery:String!,$first:Int,$after:String){ search(query:$searchQuery,first:$first,after:$after,type:ISSUE){issueCount} }";
  const args = ["api", "graphql", "-f", `query=${query}`, "-f", "searchQuery=fixture's query"];
  let captured;
  try {
    await context.auditExec(args, { appServerClient: { id: "local", hostConfig: {}, spawn: async options => {
      captured = options;
      return { stdout: "", stderr: "", code: 0, signal: null };
    } }, cwd: directory });
    const command = context.auditWrap(captured.args, captured.env);
    const env = { ...process.env, BASH_ENV: hook };
    const prior = (env.WSLENV ?? "").split(":").filter(value => value && !/^BASH_ENV(?:\/|$)/.test(value));
    env.WSLENV = [...prior, "BASH_ENV/u"].join(":");
    let output;
    if (wslDistro) {
      if (!windowsNode) throw new Error("The WSL executable boundary requires a Windows Node executable");
      // Windows Node builds Windows argv exactly as the desktop does. Spawning
      // wsl.exe directly from Linux Node uses a different interop quoting path.
      const program = path.join(directory, "windows-spawn.cjs");
      const argv = context.auditWsl({ distro: wslDistro, cwd: directory, command });
      fs.writeFileSync(program, `const {spawnSync}=require('node:child_process');const r=spawnSync('wsl.exe',${JSON.stringify(argv)},{encoding:'utf8',timeout:15000,env:{...process.env,BASH_ENV:${JSON.stringify(hook)},WSLENV:'BASH_ENV/u'}});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exitCode=r.status??1;`);
      const windowsProgram = execFileSync("wslpath", ["-w", program], { encoding: "utf8" }).trim();
      output = execFileSync(windowsNode, [windowsProgram], { encoding: "utf8", env, timeout: 20000 });
    } else output = execFileSync(shell, ["-lc", command], { encoding: "utf8", env, timeout: 15000 });
    const observed = JSON.parse(output);
    if (JSON.stringify(observed) !== JSON.stringify(args)) throw new Error("Stock GraphQL command altered its arguments");
    return { sourceFile: ".vite/build/worker.js", workerSha256: crypto.createHash("sha256").update(source).digest("hex"),
      stockQueryVariablesPreserved: true, doubleShell: true, wslExecutableExercised: Boolean(wslDistro), externalRequests: 0 };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

module.exports = { auditGraphql };
if (require.main === module) auditGraphql(process.argv[2], { wslDistro: process.argv[3], windowsNode: process.argv[4] })
  .then(report => console.log(JSON.stringify(report, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
