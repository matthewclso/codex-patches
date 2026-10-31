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
  const source1027 = workerHash === '1c0b48134ba6564b7da680600b8d068b29d0d700cf21fc119012ce296dff2e51';
  const source1023 = workerHash === '5730c672547f933e5dd942220001815975fdd3a44b73769c6d39194822cf443a';
  const source1021 = source1023 || workerHash === 'fbc7dbcb1402ac10c7594d009ee0ef7303261d8ab67c49b9646accdd791f15f1';
  const source1016 = workerHash === '6d233b3cdc282a638a4253d8a4f7866f181284f3b3e745f2ff1b995c7c061ef3';
  const source1013 = workerHash === 'a23348d825dfa28e9b7b90cea45363ba09cb5192eab4ecc0febe12c808e3d930';
  const source1007 = workerHash === '0874df6a424d1d6a1adb85931964c2e0cec128790a835c35e96b529624896fc2' || workerHash === 'df97ab945ce9850480ccdd0317b2d194febcc580c81ab25adfcfa6d265a00ae1';
  const source1002 = workerHash === 'e22f56b0fcd68492cd5d0cc445b1103dfab0f54c456b2fe838a4aeef6b02f64e';
  const source7945 = source1002 || workerHash === '46b153e94466da15a8245dba0aecea0cc775b0b1688fe3b4cc9dd74d7805d7ad';
  const latestSource = source7945 || workerHash === '290125797165e28c2b11e2b49031c605d55857007ea61c1352260d36a1fc195e';
  const currentSource = latestSource || workerHash === '23cb6abfcfe706cb571b80140a65b04b9a6a0a66b741439afde3d9e6cddf92d3';
  const quotes = source1027 ? between(source, "function hf(", "var hg=") : between(source, source1023 ? "function xY(" : source1021 ? "function sY(" : source1016 ? "function tZ(" : source1013 ? "function YZ(" : source1007 ? "function ZZ(" : source1002 ? "function $Z(" : "function sQ(", source1023 ? "var CY=" : source1021 ? "var lY=" : source1016 ? "var zCe=" : source1013 ? "var Hbe=" : source1007 ? "var Abe=" : source1002 ? "var Cbe=" : source7945 ? "var pbe=" : currentSource ? "var dbe=" : "var ube=");
  const execute = source1027 ? between(source, "async function vK(", "async function vZ(") : between(source, source1023 ? "async function $Ce(" : source1021 ? "async function nwe(" : source1016 ? "async function TPe(" : source1013 ? "async function Oje(" : source1007 ? "async function xje(" : source1002 ? "async function Eje(" : source7945 ? "async function cje(" : latestSource ? "async function oje(" : currentSource ? "async function aje(" : "async function ije(", source1023 ? "function ewe(" : source1021 ? "function rwe(" : source1016 ? "function EPe(" : source1013 ? "function kje(" : source1007 ? "function Sje(" : source1002 ? "function Dje(" : source7945 ? "function lje(" : latestSource ? "function sje(" : currentSource ? "function oje(" : "function aje(");
  const wrap = source1027 ? 'function __webpackWrap(e,n){var d,p,h,f;return '+between(source,'command:(d=e,p=n,h=hm(d),','}).distro,"--cd"').slice('command:'.length)+'}' : between(source, source1023 ? "function ZY(" : source1021 ? "function IY(" : source1016 ? "function rwe(" : source1013 ? "function oxe(" : source1007 ? "function Ixe(" : source1002 ? "function Dxe(" : "function _xe(", source1021 ? "K({autoResolutionMs:" : source1016 ? "G({autoResolutionMs:" : source1013 ? "K({autoResolutionMs:" : source1007 ? "G({autoResolutionMs:" : source1002 ? "function Mxe(" : source7945 ? "function Sxe(" : currentSource ? "function bxe(" : "function yxe(");
  const wslArgs = source1027 ? 'function __webpackWsl({distro,cwd}){var u,d,p,h,f;let m=distro,r=cwd,e=__fixtureArgs,n=__fixtureEnv;return '+between(source,'let g=["-d",(u={distro:m',',_={env:c4(process.env)').slice('let g='.length)+'}' : between(source, source1023 ? "function _U(" : source1021 ? "function rU(" : source1016 ? "function jU(" : source1013 ? "function NU(" : source1007 ? "function jU(" : source1002 ? "function mU(" : source7945 ? "function _U(" : "function yU(", source1023 ? "function vU(" : source1021 ? "function iU(" : source1016 ? "function MU(" : source1013 ? "function PU(" : source1007 ? "function MU(" : source1002 ? "function hU(" : source7945 ? "function vU(" : "function bU(");
  const shell = source1027 ? "/usr/bin/bash" : source.match(source1023 ? /lU=`([^`]+)`/ : source1021 ? /YH=`([^`]+)`/ : source1016 ? /CU=`([^`]+)`/ : source1013 ? /TU=`([^`]+)`/ : source1007 ? /CU=`([^`]+)`/ : source1002 ? /cU=`([^`]+)`/ : source7945 ? /dU=`([^`]+)`/ : /pU=`([^`]+)`/)?.[1];
  if (!shell?.startsWith("/")) throw new Error("WSL shell boundary changed");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-graphql-audit-"));
  const bin = path.join(directory, "bin");
  fs.mkdirSync(bin);
  const hook = path.join(directory, "fixture-env.sh");
  fs.writeFileSync(path.join(bin, "gh"), "#!/usr/bin/env python3\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\n", { mode: 0o700 });
  // Resolve the disposable fake gh in both login shells. The old variable
  // guard is deliberately absent, even if this audit runs from a patched app.
  fs.writeFileSync(hook, `export PATH=${JSON.stringify(bin)}:$PATH\nunset searchQuery first after owner repo number search threadId body\n`);
  const context = { [source1027 ? "vH" : source1023 ? "QCe" : source1021 ? "twe" : source1016 ? "wPe" : source1013 ? "Dje" : source1007 ? "bje" : source1002 ? "Tje" : source7945 ? "sje" : latestSource ? "aje" : currentSource ? "ije" : "rje"]: { GIT_TERMINAL_PROMPT: "0", GH_PROMPT_DISABLED: "1" },
    tF: () => true, QP: () => null, oU: value => value, fP: async value => value,
    lF: () => true, aF: () => null, tU: value => value, EP: async value => value,
    $P: () => true, XP: () => null, iU: value => value, uP: async value => value,
    [source1002 ? "Mxe" : source7945 ? "Sxe" : currentSource ? "bxe" : "yxe"]: () => false, pU: shell, dU: shell, cU: shell, process: { cwd: () => directory, env: {} } };
  if (source1007) Object.assign(context, { uP: () => true, sP: () => null, hU: value => value, UP: async value => value, vV: () => false, xV: value => value, CU: shell });
  if (source1013) Object.assign(context,{oP:()=>true,rP:()=>null,_U:value=>value,zP:async value=>value,bV:()=>false,CV:value=>value,TU:shell});
  if (source1016) Object.assign(context,{QN:()=>true,YN:()=>null,hU:value=>value,jP:async value=>value,vV:()=>false,xV:value=>value,CU:shell});
  if (source1021) Object.assign(context,{vM:()=>true,mM:()=>null,VH:value=>value,zN:async value=>value,WB:()=>false,qB:value=>value,YH:shell});
  if (source1023) Object.assign(context,{kM:()=>true,TM:()=>null,tU:value=>value,XN:async value=>value,nV:()=>false,lU:shell});
  if (source1027) Object.assign(context,{r0:()=>true,rQ:()=>null,c4:value=>value,nU:async value=>value,lj:value=>value,lL:()=>false});
  vm.createContext(context);
  vm.runInContext(quotes + execute + wrap + wslArgs + (source1027 ? ";globalThis.auditExec=vK;globalThis.auditWrap=__webpackWrap;" : source1023 ? ";globalThis.auditExec=$Ce;globalThis.auditWrap=QY;" : source1021 ? ";globalThis.auditExec=nwe;globalThis.auditWrap=RY;" : source1016 ? ";globalThis.auditExec=TPe;globalThis.auditWrap=awe;" : source1013 ? ";globalThis.auditExec=Oje;globalThis.auditWrap=cxe;" : source1007 ? ";globalThis.auditExec=xje;globalThis.auditWrap=Rxe;" : source1002 ? ";globalThis.auditExec=Eje;globalThis.auditWrap=jxe;" : source7945 ? ";globalThis.auditExec=cje;globalThis.auditWrap=xxe;" : latestSource ? ";globalThis.auditExec=oje;globalThis.auditWrap=yxe;" : currentSource ? ";globalThis.auditExec=aje;globalThis.auditWrap=yxe;" : ";globalThis.auditExec=ije;globalThis.auditWrap=vxe;") + (source1027 ? "globalThis.auditWsl=__webpackWsl;" : source1023 ? "globalThis.auditWsl=_U;" : source1021 ? "globalThis.auditWsl=rU;" : source1016 ? "globalThis.auditWsl=jU;" : source1013 ? "globalThis.auditWsl=NU;" : source1007 ? "globalThis.auditWsl=jU;" : source1002 ? "globalThis.auditWsl=mU;" : source7945 ? "globalThis.auditWsl=_U;" : "globalThis.auditWsl=yU;"), context);
  const query = "query($searchQuery:String!,$first:Int,$after:String){ search(query:$searchQuery,first:$first,after:$after,type:ISSUE){issueCount} }";
  const args = ["api", "graphql", "-f", `query=${query}`, "-f", "searchQuery=fixture's query"];
  let captured;
  try {
    await context.auditExec(args, { appServerClient: { id: "local", hostConfig: {}, spawn: async options => {
      captured = options;
      return { stdout: "", stderr: "", code: 0, signal: null };
    } }, cwd: directory });
    context.__fixtureArgs=captured.args;context.__fixtureEnv=captured.env;
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
