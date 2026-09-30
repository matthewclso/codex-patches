"use strict";
const MAX_MESSAGE = 100 * 1024 * 1024;
const MAX_WIRE = 150 * 1024;

// JSON-RPC IDs and delivery sequence numbers can exceed Number's safe range.
function parse(text) {
  return JSON.parse(text, (_key, value, context) =>
    typeof value === "number" && !Number.isSafeInteger(value) && /^-?\d+$/.test(context.source)
      ? JSON.rawJSON(context.source) : value);
}
function rewriteRequest(message) {
  if (!message || typeof message !== "object" || Array.isArray(message) ||
      message.method !== "thread/list" || !Object.hasOwn(message, "id")) return false;
  if (message.params != null && (typeof message.params !== "object" || Array.isArray(message.params))) return false;
  if (message.params?.useStateDbOnly === true) return false;
  message.params = { ...(message.params ?? {}), useStateDbOnly: true };
  return true;
}

class IncomingRewriter {
  constructor({ ttlMs = 30000, maxBuffered = 128 * 1024 * 1024 } = {}) {
    this.assemblies = new Map();
    this.buffered = 0;
    this.ttlMs = ttlMs;
    this.maxBuffered = maxBuffered;
    this.rewritten = 0;
  }
  expire(now = Date.now()) {
    if ([...this.assemblies.values()].some(a => now - a.started > this.ttlMs))
      throw new Error("Incomplete remote message expired");
  }
  push(data, binary = false) {
    this.expire();
    const original = { data, binary };
    if (binary) return [original];
    let envelope;
    try { envelope = parse(data.toString()); } catch { return [original]; }
    if (envelope?.type === "client_message") {
      if (!rewriteRequest(envelope.message)) return [original];
      const encoded = Buffer.from(JSON.stringify(envelope));
      if (encoded.length > MAX_WIRE) throw new Error("Rewritten frame exceeds wire limit");
      this.rewritten++;
      return [{ data: encoded, binary: false }];
    }
    if (envelope?.type !== "client_message_chunk") return [original];
    const e = envelope;
    if (typeof e.client_id !== "string" || !Number.isInteger(e.segment_id) ||
        !Number.isInteger(e.segment_count) || e.segment_count < 1 || e.segment_count > 1024 ||
        e.segment_id < 0 || e.segment_id >= e.segment_count ||
        !Number.isInteger(e.message_size_bytes) || e.message_size_bytes < 1 || e.message_size_bytes > MAX_MESSAGE ||
        typeof e.message_chunk_base64 !== "string" ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(e.message_chunk_base64) ||
        Buffer.byteLength(data) > MAX_WIRE) throw new Error("Invalid remote chunk");
    const identity = JSON.stringify([e.stream_id, e.seq_id, e.segment_count, e.message_size_bytes]);
    let a = this.assemblies.get(e.client_id);
    if (!a) {
      if (e.segment_id !== 0 || this.assemblies.size >= 128) throw new Error("Invalid remote chunk order");
      a = { identity, frames: [], pieces: [], bytes: 0, retained: 0, started: Date.now() };
      this.assemblies.set(e.client_id, a);
    }
    if (a.identity !== identity || e.segment_id !== a.frames.length) throw new Error("Invalid remote chunk sequence");
    const piece = Buffer.from(e.message_chunk_base64, "base64");
    a.bytes += piece.length;
    // Count BOTH original wire frames and decoded pieces retained until completion.
    const retained = Buffer.byteLength(data) + piece.length;
    a.retained += retained;
    this.buffered += retained;
    if (a.bytes > e.message_size_bytes || this.buffered > this.maxBuffered) throw new Error("Remote chunk buffer exceeded");
    a.frames.push({ original, envelope: e });
    a.pieces.push(piece);
    if (a.frames.length < e.segment_count) return [];
    this.assemblies.delete(e.client_id);
    this.buffered -= a.retained;
    if (a.bytes !== e.message_size_bytes) throw new Error("Remote message size mismatch");
    let message;
    try { message = parse(Buffer.concat(a.pieces).toString()); } catch { return a.frames.map(f => f.original); }
    if (!rewriteRequest(message)) return a.frames.map(f => f.original);
    const payload = Buffer.from(JSON.stringify(message));
    if (payload.length > MAX_MESSAGE) throw new Error("Rewritten message exceeds limit");
    this.rewritten++;
    // Keep the original segment count and each segment's delivery cursor/metadata.
    return a.frames.map((frame, index) => {
      const start = Math.floor(payload.length * index / a.frames.length);
      const end = Math.floor(payload.length * (index + 1) / a.frames.length);
      const result = Buffer.from(JSON.stringify({ ...frame.envelope, message_size_bytes: payload.length,
        message_chunk_base64: payload.subarray(start, end).toString("base64") }));
      if (result.length > MAX_WIRE) throw new Error("Rewritten chunk exceeds wire limit");
      return { data: result, binary: false };
    });
  }
}
module.exports = { IncomingRewriter, parse, rewriteRequest, MAX_MESSAGE, MAX_WIRE };
