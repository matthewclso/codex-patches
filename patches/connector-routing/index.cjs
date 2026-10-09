"use strict";
const crypto = require("node:crypto");
const { QUIET } = require("../remote-fast-list/rewrite.cjs");

const BACKEND = "https://chatgpt.com/backend-api";
const THREAD_METHODS = new Set(["thread/start", "thread/resume", "thread/fork"]);
const DISCOVERY_METHODS = new Set(["app/installed", "app/read", "mcpServerStatus/list", "mcpServer/resource/read"]);
function routeThread(message) {
  if (!THREAD_METHODS.has(message?.method) || !Object.hasOwn(message, "id")) return false;
  if (message.params != null && (typeof message.params !== "object" || Array.isArray(message.params))) return false;
  if (message.params?.config != null && (typeof message.params.config !== "object" || Array.isArray(message.params.config))) return false;
  if (Object.hasOwn(message.params?.config ?? {}, "chatgpt_base_url")) return false;
  message.params = { ...message.params, config: { ...message.params?.config, chatgpt_base_url: BACKEND } };
  return true;
}
function threadlessDiscovery(message) {
  return DISCOVERY_METHODS.has(message?.method) && Object.hasOwn(message, "id") &&
    (message.params == null || (typeof message.params === "object" && !Array.isArray(message.params))) &&
    message.params?.threadId == null;
}

// Managed authentication remains in the stock CLI. This adapter supplies a
// native per-thread routing override; it never reads or forwards credentials.
class ConnectorRouting {
  constructor({ sendNative, sendClient, timeoutMs = 10000 }) {
    this.sendNative = sendNative;
    this.sendClient = sendClient;
    this.timeoutMs = timeoutMs;
    this.prefix = `connector-routing-${crypto.randomUUID()}-`;
    this.contextId = null;
    this.pending = null;
    this.queue = [];
    this.closed = false;
    this.sequence = 0;
    this.expired = new Set();
    this.hidden = new Set();
    this.remoteWaiting = 0;
    this.settling = new Map();
    this.cleanups = new Set();
    this.unavailableContext = crypto.randomUUID();
    this.desktopRequests = new Map();
    this.remoteRequests = new Map();
  }
  context() {
    if (this.closed) return Promise.reject(new Error("Connector routing closed"));
    if (this.contextId) return Promise.resolve(this.contextId);
    if (this.pending) return this.ready;
    if (this.expired.size >= 128 || this.hidden.size >= 128) return Promise.reject(new Error("Too many outstanding connector contexts"));
    this.ready = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    // Desktop callers use the bounded queue below rather than awaiting this promise.
    this.ready.catch(() => {});
    this.pending = this.prefix + "start-" + ++this.sequence;
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    this.settling.set(this.pending, { promise, resolve });
    this.timer = setTimeout(() => this.fail(), this.timeoutMs);
    this.timer.unref();
    this.sendNative({ id: this.pending, method: "thread/start", params: {
      ephemeral: true, config: { chatgpt_base_url: BACKEND },
    } });
    return this.ready;
  }
  request(message) {
    if (this.closed) return false;
    if (message?.method === "thread/unsubscribe" && message.params?.threadId === this.contextId) this.contextId = null;
    if (routeThread(message)) { this.sendNative(message); return true; }
    if (!threadlessDiscovery(message)) return false;
    if (this.contextId) {
      this.remember(this.desktopRequests, message.id, this.contextId);
      this.sendNative({ ...message, params: { ...message.params, threadId: this.contextId } });
      return true;
    }
    if (this.queue.length + this.remoteWaiting >= 128 || this.expired.size >= 128 || this.hidden.size >= 128 || this.closed) {
      this.sendClient({ id: message.id, error: { code: -32603, message: "Connector routing startup queue is full" } });
      return true;
    }
    this.queue.push(message);
    this.context().catch(() => {});
    return true;
  }
  response(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) return false;
    if (this.pending && message?.id === this.pending && !message.method) {
      clearTimeout(this.timer);
      const requestId = this.pending;
      this.pending = null;
      const id = message.result?.thread?.id;
      if (message.error || typeof id !== "string" || !id) { this.settle(requestId); this.fail(); return true; }
      this.contextId = id;
      this.hidden.add(id);
      this.settle(requestId);
      const queued = this.queue.splice(0);
      for (const request of queued)
        { this.remember(this.desktopRequests, request.id, id); this.sendNative({ ...request, params: { ...request.params, threadId: id } }); }
      this.resolve(id);
      return true;
    }
    // Native thread/start returns its response before thread/started. Hide only
    // this non-persistent discovery context; ordinary chat events pass through.
    this.observeReply(message, this.desktopRequests, message.id);
    if (["thread/closed", "thread/archived"].includes(message.method) && message.params?.threadId === this.contextId)
      this.contextId = null;
    if (this.hiddenNotification(message)) return true;
    if (this.expired.has(message?.id) && !message.method) {
      this.expired.delete(message.id);
      const id = message.result?.thread?.id;
      if (typeof id === "string") {
        this.hidden.add(id);
        this.unsubscribe(id);
      }
      this.settle(message.id);
      return true;
    }
    if (this.cleanups.has(message.id) && !message.method) { this.cleanups.delete(message.id); return true; }
    return false;
  }
  async remoteRequest(message, envelope) {
    if (routeThread(message)) return true;
    if (!threadlessDiscovery(message)) return false;
    if (this.queue.length + this.remoteWaiting >= 128) {
      message.params = { ...message.params, threadId: this.unavailableContext };
      return true;
    }
    this.remoteWaiting++;
    try {
      let id;
      try { id = await this.context(); }
      catch { id = this.unavailableContext; }
      // Let the native endpoint return a request-scoped "thread not found"
      // error on startup failure. Never synthesize a remote protocol reply or
      // terminate an otherwise healthy listing/reconnect session.
      message.params = { ...message.params, threadId: id };
      if (id !== this.unavailableContext) this.remember(this.remoteRequests, [envelope?.client_id, message.id], id);
      return true;
    } finally { this.remoteWaiting--; }
  }
  remember(requests, id, context) {
    if (requests.size >= 1024) requests.delete(requests.keys().next().value);
    requests.set(JSON.stringify(id), context);
  }
  observeReply(message, requests, id) {
    if (message?.method || !Object.hasOwn(message ?? {}, "id")) return;
    const key = JSON.stringify(id), context = requests.get(key);
    requests.delete(key);
    if (context === this.contextId && /thread.*(?:not found|not loaded|does not exist)/i.test(message.error?.message ?? ""))
      this.contextId = null;
  }
  settle(id) {
    this.settling.get(id)?.resolve();
    this.settling.delete(id);
  }
  unsubscribe(threadId) {
    const id = this.prefix + "unsubscribe-" + ++this.sequence;
    this.cleanups.add(id);
    this.sendNative({ id, method: "thread/unsubscribe", params: { threadId } });
  }
  hiddenNotification(message) {
    return message && typeof message === "object" && !Object.hasOwn(message, "id") &&
      (this.hidden.has(message.params?.threadId) || this.hidden.has(message.params?.thread?.id));
  }
  async remoteResponse(message, envelope) {
    // A native broadcast can reach the WebSocket before its stdio start reply.
    // Learn the context ID first, including late replies after startup timeout.
    this.observeReply(message, this.remoteRequests, [envelope?.client_id, message?.id]);
    if (message?.method === "thread/started" && !Object.hasOwn(message, "id") &&
        message.params?.thread?.ephemeral === true && this.settling.size) {
      let timer;
      try {
        await Promise.race([Promise.all([...this.settling.values()].map(item => item.promise)),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Connector context identity timeout")), this.timeoutMs); timer.unref(); })]);
      } finally { clearTimeout(timer); }
    }
    return this.hiddenNotification(message) ? QUIET : false;
  }
  fail() {
    clearTimeout(this.timer);
    if (this.pending) this.expired.add(this.pending);
    this.pending = null;
    this.reject?.(new Error("Native connector routing context could not start"));
    for (const message of this.queue.splice(0))
      this.sendClient({ id: message.id, error: { code: -32603, message: "Native connector routing context could not start" } });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.fail();
    for (const id of this.settling.keys()) this.settle(id);
    if (this.contextId) this.unsubscribe(this.contextId);
    this.contextId = null;
  }
}
module.exports = { id: "connector-routing", title: "Native authentication for connectors alongside the remote relay", BACKEND, routeThread, ConnectorRouting };
