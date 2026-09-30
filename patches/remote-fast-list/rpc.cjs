"use strict";
const { spawn } = require("node:child_process");
const readline = require("node:readline");

class AppServerRpc {
  constructor(binary, home, sqliteHome, overrides = [], { isolatedRemoteControl = false, processEnv = {} } = {}) {
    this.nextId = 1;
    this.pending = new Map();
    const env = { ...process.env, CODEX_HOME: home, CODEX_SQLITE_HOME: sqliteHome,
      CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED: "1", NO_COLOR: "1" };
    delete env.CODEX_CLI_PATH;
    delete env.CODEX_PROJECT_PATH_PROXY_REAL_CLI;
    delete env.CODEX_PATCHES_REAL_CLI;
    delete env.CODEX_PATCHES_RUNTIME_CONFIG;
    if (isolatedRemoteControl) delete env.CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED;
    Object.assign(env, processEnv);
    this.child = spawn(binary, ["app-server", "--disable", "plugins", ...overrides],
      { env, stdio: ["pipe", "pipe", "pipe"] });
    // Never print stderr: an upstream diagnostic can contain URLs or credentials.
    this.child.stderr.resume();
    this.exit = new Promise(resolve => this.child.once("close", resolve));
    this.child.on("error", () => this.rejectAll(new Error("App-server failed to start")));
    this.child.on("close", () => this.rejectAll(new Error("App-server closed")));
    readline.createInterface({ input: this.child.stdout }).on("line", line => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(Object.assign(new Error("JSON-RPC request failed"),
        { rpcError: msg.error }));
      else pending.resolve(msg.result);
    });
  }
  rejectAll(error) {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear();
  }
  request(method, params, timeoutMs = 15000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  async initialize(clientName = "codex-project-sync") {
    const result = await this.request("initialize", {
      clientInfo: { name: clientName, version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    this.child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
    return result;
  }
  async close() {
    this.child.stdin.end();
    let timer;
    const result = await Promise.race([this.exit, new Promise(resolve => {
      timer = setTimeout(() => resolve("timeout"), 10000);
    })]);
    clearTimeout(timer);
    if (result === "timeout") {
      // This child belongs solely to this probe, never the running desktop.
      this.child.kill("SIGTERM");
      const killer = setTimeout(() => this.child.kill("SIGKILL"), 5000);
      await this.exit;
      clearTimeout(killer);
      throw new Error("Isolated app-server did not shut down gracefully");
    }
    if (result !== 0) throw new Error(`Isolated app-server exit ${result}`);
  }
}
module.exports = { AppServerRpc };
