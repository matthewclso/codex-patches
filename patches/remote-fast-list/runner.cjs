#!/usr/bin/env node
"use strict";
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createRelay } = require("./relay.cjs");
const { readConfig } = require("./runtime.cjs");
const { readRuntimeConfig, validateBinary } = require("./config.cjs");

async function run(runtime, args) {
  validateBinary(runtime.realCli, runtime.cliSha256);
  if (!runtime.relayEnabled) throw new Error("Relay is disabled in this runtime");
  if (args.some(arg => /^chatgpt_base_url\s*=/.test(arg))) throw new Error("Existing backend override");
  const config = readConfig(path.join(runtime.stateRoot, "relay"));
  let relay, child, stopping = false, orphanGuard, killTimer;
  const signals = new Map();
  try {
    relay = await createRelay(config);
    const env = { ...process.env, CODEX_HOME: runtime.codexHome, CODEX_SQLITE_HOME: runtime.sqliteHome };
    delete env.CODEX_REMOTE_CONTROL_RELAY_ENABLED;
    // The capability-bearing local hop must never be sent to a network proxy.
    env.NO_PROXY = [env.no_proxy || env.NO_PROXY || "", "127.0.0.1", "localhost"].filter(Boolean).join(",");
    env.no_proxy = env.NO_PROXY;
    child = spawn(runtime.realCli, [...args, "-c", `chatgpt_base_url=${JSON.stringify(relay.baseUrl)}`],
      { env, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.on("error", () => {});
    const stop = signal => {
      if (stopping) return;
      stopping = true;
      clearTimeout(killTimer);
      child.kill(signal);
      killTimer = setTimeout(() => child.kill("SIGKILL"), 10000);
      killTimer.unref();
    };
    const onStdinError = () => child.stdin.destroy();
    const onOutputError = () => stop("SIGTERM");
    const onEof = () => { killTimer = setTimeout(() => stop("SIGTERM"), 10000); killTimer.unref(); };
    process.stdin.on("error", onStdinError);
    process.stdout.on("error", onOutputError);
    process.stdin.once("end", onEof);
    process.stdin.pipe(child.stdin);
    child.stdout.pipe(process.stdout, { end: false });
    child.stderr.pipe(process.stderr, { end: false });
    if (process.platform !== "win32") {
      orphanGuard = setInterval(() => { if (process.ppid === 1) stop("SIGTERM"); }, 1000);
      orphanGuard.unref();
    }
    for (const name of ["SIGTERM", "SIGINT", ...(process.platform !== "win32" ? ["SIGHUP"] : [])]) {
      const handler = () => stop(name);
      signals.set(name, handler);
      process.on(name, handler);
    }
    try {
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve(code ?? ({ SIGTERM: 143, SIGINT: 130, SIGHUP: 129 }[signal] ?? 1)));
      });
      return code;
    } finally {
      process.stdin.unpipe(child.stdin);
      process.stdin.pause();
      process.stdin.removeListener("error", onStdinError);
      process.stdout.removeListener("error", onOutputError);
      process.stdin.removeListener("end", onEof);
    }
  } finally {
    clearInterval(orphanGuard);
    clearTimeout(killTimer);
    for (const [name, handler] of signals) process.removeListener(name, handler);
    if (relay) await relay.close();
  }
}

module.exports = { run };
if (require.main === module) {
  let runtime;
  try { runtime = readRuntimeConfig(process.argv[2]); }
  catch (error) { console.error(`Relay runtime: ${error.message}`); process.exitCode = 1; }
  if (runtime) run(runtime, process.argv.slice(3)).then(code => { process.exitCode = code; }).catch(() => {
    console.error("Codex relay could not start. Check the validated runtime and local port; pairing was not reset.");
    process.stdin.pause(); process.exitCode = 1;
  });
}
