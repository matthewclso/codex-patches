"use strict";
const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");
const { WebSocket, WebSocketServer } = require("ws");
const { IncomingRewriter, MAX_WIRE, MAX_MESSAGE } = require("./rewrite.cjs");
const { normalizeAccountRouting, LIMIT } = require("./account-routing.cjs");

const HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "host"]);
function headers(input, websocket = false) {
  const blocked = new Set([...HOP, ...(input.connection ?? "").toLowerCase().split(",").map(v => v.trim())]);
  return Object.fromEntries(Object.entries(input).filter(([key]) => !blocked.has(key.toLowerCase()) &&
    !(websocket && key.toLowerCase().startsWith("sec-websocket-"))));
}
async function createRelay({ upstreamBase = "https://chatgpt.com/backend-api/", testLoopback = false,
    capability = crypto.randomBytes(32).toString("hex"), port = 0,
    proxyEnv = process.env } = {}) {
  const base = new URL(upstreamBase);
  const localTest = testLoopback && base.protocol === "http:" && base.hostname === "127.0.0.1";
  if (!localTest && !(base.protocol === "https:" && base.hostname === "chatgpt.com" && !base.port))
    throw new Error("Unsupported upstream; TLS verification is mandatory");
  if (base.username || base.password || base.search || base.hash || !base.pathname.endsWith("/"))
    throw new Error("Invalid upstream base");
  if (!/^[a-f0-9]{64}$/.test(capability)) throw new Error("Invalid relay capability");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("TLS validation must remain enabled");
  // Inherit authorized network routing, including ALL_PROXY's HTTP(S) fallback.
  const routing = { ...proxyEnv };
  const fallback = routing.all_proxy || routing.ALL_PROXY;
  if (fallback) {
    if (!["http:", "https:"].includes(new URL(fallback).protocol))
      throw new Error("Unsupported managed proxy; refusing a direct fallback");
    if (!routing.http_proxy && !routing.HTTP_PROXY) routing.HTTP_PROXY = fallback;
    if (!routing.https_proxy && !routing.HTTPS_PROXY) routing.HTTPS_PROXY = fallback;
  }
  const httpAgent = new http.Agent({ proxyEnv: routing, keepAlive: true });
  const httpsAgent = new https.Agent({ proxyEnv: routing, keepAlive: true, rejectUnauthorized: true });
  const prefix = `/${capability}/backend-api/`;
  const pairs = new Set();
  const requests = new Set();
  const counters = { rewrites: 0, websocketConnections: 0, rejected: 0, routingNormalizations: 0 };
  function destination(req) {
    const allowedHost = `127.0.0.1:${server.address().port}`;
    if (req.headers.host !== allowedHost || req.headers.origin || !req.url?.startsWith(prefix)) return null;
    const relative = req.url.slice(prefix.length);
    const pathname = relative.split("?")[0];
    try {
      for (const part of pathname.split("/")) {
        const decoded = decodeURIComponent(part);
        if (decoded === "." || decoded === ".." || /[\\/\x00-\x1f]/.test(decoded)) return null;
      }
    } catch { return null; }
    const result = new URL(base.href);
    result.pathname = base.pathname + pathname;
    result.search = relative.includes("?") ? relative.slice(relative.indexOf("?")) : "";
    return result;
  }
  const server = http.createServer((req, res) => {
    const target = destination(req);
    if (!target) { counters.rejected++; res.writeHead(403).end(); req.resume(); return; }
    const accountCheck = req.method === "GET" && target.pathname === base.pathname + "wham/accounts/check";
    const outgoingHeaders = headers(req.headers);
    if (accountCheck) outgoingHeaders["accept-encoding"] = "identity";
    const outgoing = (target.protocol === "https:" ? https : http).request(target,
      { method: req.method, headers: outgoingHeaders, timeout: 600000,
        agent: target.protocol === "https:" ? httpsAgent : httpAgent }, upstream => {
        if (accountCheck && upstream.statusCode === 200) {
          const chunks = [];
          let size = 0;
          upstream.on("data", data => {
            size += data.length;
            if (size > LIMIT) upstream.destroy(); else chunks.push(data);
          });
          upstream.on("error", () => { if (!res.headersSent) res.writeHead(502).end(); else res.destroy(); });
          upstream.on("end", () => {
            try {
              const original = Buffer.concat(chunks);
              const body = normalizeAccountRouting(original, upstream.headers["content-encoding"],
                localTest ? "https://chatgpt.com" : base.origin);
              const resultHeaders = headers(upstream.headers);
              if (body) {
                for (const name of ["content-encoding", "content-length", "etag", "content-md5", "digest"])
                  delete resultHeaders[name];
                resultHeaders["content-length"] = String(body.length);
                counters.routingNormalizations++;
              }
              res.writeHead(upstream.statusCode, resultHeaders).end(body ?? original);
            } catch { res.writeHead(502).end(); }
          });
          return;
        }
        res.writeHead(upstream.statusCode, headers(upstream.headers));
        upstream.on("error", () => res.destroy());
        upstream.pipe(res);
      });
    requests.add(outgoing);
    outgoing.once("close", () => requests.delete(outgoing));
    outgoing.on("timeout", () => outgoing.destroy());
    outgoing.on("error", () => { if (!res.headersSent) res.writeHead(502).end(); else res.destroy(); });
    req.on("aborted", () => outgoing.destroy());
    req.on("error", () => outgoing.destroy());
    res.on("close", () => { if (!res.writableEnded) outgoing.destroy(); });
    req.pipe(outgoing);
  });
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false,
    autoPong: false, maxPayload: MAX_MESSAGE,
    handleProtocols: (_protocols, req) => req.relaySelectedProtocol || false });
  server.on("upgrade", (req, socket, head) => {
    const target = destination(req);
    if (!target) {
      counters.rejected++; socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return;
    }
    const remoteControl = target.pathname === base.pathname + "wham/remote/control/server";
    target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
    const protocols = (req.headers["sec-websocket-protocol"] ?? "").split(",").map(s => s.trim()).filter(Boolean);
    let upstream;
    try {
      upstream = new WebSocket(target, protocols, { headers: headers(req.headers, true),
        agent: target.protocol === "wss:" ? httpsAgent : httpAgent,
        rejectUnauthorized: true,
        perMessageDeflate: false, autoPong: false, maxPayload: remoteControl ? MAX_WIRE : MAX_MESSAGE, handshakeTimeout: 10000 });
    } catch { socket.destroy(); return; }
    pairs.add(upstream);
    upstream.once("close", () => pairs.delete(upstream));
    socket.once("close", () => { if (upstream.readyState !== WebSocket.CLOSED) upstream.terminate(); });
    let handshakeRejected = false;
    upstream.on("unexpected-response", (_request, response) => {
      // Native 401 refresh, 404 handling and Retry-After depend on this HTTP response.
      handshakeRejected = true;
      const lines = Object.entries(headers(response.headers)).flatMap(([key, value]) =>
        (Array.isArray(value) ? value : [value]).map(v => `${key}: ${v}\r\n`));
      socket.write(`HTTP/1.1 ${response.statusCode} ${http.STATUS_CODES[response.statusCode] ?? "Error"}\r\n` +
        lines.join("") + "Connection: close\r\n\r\n");
      response.on("error", () => { socket.destroy(); upstream.terminate(); });
      response.once("end", () => upstream.terminate());
      response.pipe(socket);
    });
    upstream.on("error", () => { if (!handshakeRejected) socket.destroy(); });
    upstream.once("open", () => {
      if (socket.destroyed) { upstream.terminate(); return; }
      // An upstream can send its first frame immediately after the handshake.
      upstream.pause();
      req.relaySelectedProtocol = upstream.protocol;
      try { wss.handleUpgrade(req, socket, head, client => {
        pairs.add(client);
        counters.websocketConnections++;
        const rewrite = new IncomingRewriter();
        const fail = () => { client.terminate(); upstream.terminate(); };
        const timer = setInterval(() => { try { rewrite.expire(); } catch { fail(); } }, 1000);
        timer.unref();
        function closePeer(peer, code, reason) {
          if (peer.readyState === WebSocket.OPEN)
            peer.close(code === 1005 || code === 1006 ? 1011 : code, reason);
          else if (peer.readyState !== WebSocket.CLOSED && peer.readyState !== WebSocket.CLOSING) peer.terminate();
        }
        client.once("close", (code, reason) => { clearInterval(timer); pairs.delete(client); closePeer(upstream, code, reason); });
        upstream.once("close", (code, reason) => { clearInterval(timer); closePeer(client, code, reason); });
        client.on("error", fail);
        upstream.on("error", fail);
        function send(source, sink, frames) {
          source.pause();
          let pending = frames.length;
          if (!pending) { source.resume(); return; }
          for (const frame of frames) {
            if (sink.readyState !== WebSocket.OPEN || sink.bufferedAmount > 16 * 1024 * 1024) { fail(); return; }
            sink.send(frame.data, { binary: frame.binary }, error => {
              if (error) { fail(); return; }
              if (--pending === 0) source.resume();
            });
          }
        }
        upstream.on("message", (data, binary) => {
          try {
            if (!remoteControl) { send(upstream, client, [{data, binary}]); return; }
            const before = rewrite.rewritten;
            const frames = rewrite.push(data, binary);
            counters.rewrites += rewrite.rewritten - before;
            send(upstream, client, frames);
          } catch { fail(); }
        });
        client.on("message", (data, binary) => send(client, upstream, [{ data, binary }]));
        for (const [from, to] of [[client, upstream], [upstream, client]]) {
          from.on("ping", data => { if (to.readyState === WebSocket.OPEN) to.ping(data); });
          from.on("pong", data => { if (to.readyState === WebSocket.OPEN) to.pong(data); });
        }
        upstream.resume();
      }); } catch { upstream.terminate(); socket.destroy(); }
    });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return { baseUrl: `http://127.0.0.1:${server.address().port}${prefix}`, counters,
    async close() {
      for (const connection of pairs) connection.terminate();
      for (const request of requests) request.destroy();
      httpAgent.destroy();
      httpsAgent.destroy();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      wss.close();
    } };
}
module.exports = { createRelay, headers };
