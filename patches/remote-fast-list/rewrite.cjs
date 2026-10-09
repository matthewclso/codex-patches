"use strict";
const MAX_MESSAGE = 100 * 1024 * 1024;
const MAX_WIRE = 150 * 1024;
const QUIET = Symbol("internal-context-heartbeat");
function quietFrame(envelope) {
  const { type, message, segment_id, segment_count, message_size_bytes, message_chunk_base64, ...header } = envelope;
  // Keep the native per-stream sequence and acknowledgement boundary. Dropping
  // a broadcast would leave a delivery gap and an unacknowledged native frame.
  return { data: Buffer.from(JSON.stringify({ ...header, type: "pong", status: "active" })), binary: false };
}
function expandedChunks(payload, templates, envelopeType) {
  // Routing can add a few bytes to a frame already at the wire limit. Use the
  // native segmented format, retaining the stream/sequence and existing cursors.
  // Extra segments use the last cursor, so reconnect resumes at the same point.
  if (templates.some(e => typeof e.client_id !== "string" || typeof e.stream_id !== "string" || !Object.hasOwn(e, "seq_id"))) return null;
  const headers = templates.map(({ message, ...header }) => header);
  const capacity = Math.min(...headers.map(header => {
    const overhead = Buffer.byteLength(JSON.stringify({ ...header, type: envelopeType + "_chunk", segment_id: 1023,
      segment_count: 1024, message_size_bytes: payload.length, message_chunk_base64: "" }));
    return Math.floor((MAX_WIRE - overhead - 16) / 4) * 3;
  }));
  if (capacity < 1) return null;
  const count = Math.max(templates.length, Math.ceil(payload.length / capacity));
  if (count > 1024) return null;
  return Array.from({ length: count }, (_, index) => ({ binary: false,
    data: Buffer.from(JSON.stringify({ ...headers[Math.min(index, headers.length - 1)], type: envelopeType + "_chunk",
      segment_id: index, segment_count: count, message_size_bytes: payload.length,
      message_chunk_base64: payload.subarray(Math.floor(payload.length * index / count), Math.floor(payload.length * (index + 1) / count)).toString("base64") })) }));
}

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
  constructor({ ttlMs = 30000, maxBuffered = 128 * 1024 * 1024, additionalRewrite = () => false,
      envelopeType = "client_message" } = {}) {
    this.assemblies = new Map();
    this.buffered = 0;
    this.ttlMs = ttlMs;
    this.maxBuffered = maxBuffered;
    this.rewritten = 0;
    this.additionalRewrite = additionalRewrite;
    this.envelopeType = envelopeType;
    this.expirySuspended = false;
  }
  expire(now = Date.now()) {
    if (this.expirySuspended) return;
    if ([...this.assemblies.values()].some(a => now - a.started > this.ttlMs))
      throw new Error("Incomplete remote message expired");
  }
  suspendExpiry(now = Date.now()) { this.expirySuspended = true; this.suspendedAt = now; }
  resumeExpiry(now = Date.now()) {
    if (!this.expirySuspended) return;
    const elapsed = now - this.suspendedAt;
    for (const assembly of this.assemblies.values()) assembly.started += elapsed;
    this.expirySuspended = false;
  }
  push(data, binary = false) {
    const frames = this.frames(data, binary);
    let step = frames.next();
    while (!step.done) {
      const changed = this.additionalRewrite(step.value.message, step.value.envelope);
      if (changed?.then) throw new Error("Async rewrite requires pushAsync");
      step = frames.next(changed);
    }
    return step.value;
  }
  async pushAsync(data, binary = false) {
    const frames = this.frames(data, binary);
    let step = frames.next();
    while (!step.done) step = frames.next(await this.additionalRewrite(step.value.message, step.value.envelope));
    return step.value;
  }
  *frames(data, binary = false) {
    this.expire();
    const original = { data, binary };
    if (binary) return [original];
    let envelope;
    try { envelope = parse(data.toString()); } catch { return [original]; }
    if (envelope?.type === this.envelopeType) {
      const listed = this.envelopeType === "client_message" && rewriteRequest(envelope.message);
      const changed = yield { message: envelope.message, envelope };
      if (changed === QUIET) return [quietFrame(envelope)];
      if (!changed && !listed) return [original];
      const encoded = Buffer.from(JSON.stringify(envelope));
      if (encoded.length > MAX_WIRE) {
        const frames = expandedChunks(Buffer.from(JSON.stringify(envelope.message)), [envelope], this.envelopeType);
        if (!frames) return [original];
        this.rewritten++;
        return frames;
      }
      this.rewritten++;
      return [{ data: encoded, binary: false }];
    }
    if (envelope?.type !== this.envelopeType + "_chunk") return [original];
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
    const listed = this.envelopeType === "client_message" && rewriteRequest(message);
    const changed = yield { message, envelope: a.frames.at(-1).envelope };
    if (changed === QUIET) return [quietFrame(a.frames.at(-1).envelope)];
    if (!changed && !listed) return a.frames.map(f => f.original);
    const payload = Buffer.from(JSON.stringify(message));
    if (payload.length > MAX_MESSAGE) return a.frames.map(frame => frame.original);
    // Keep the original segment count and each segment's delivery cursor/metadata.
    const encodedFrames = a.frames.map((frame, index) => {
      const start = Math.floor(payload.length * index / a.frames.length);
      const end = Math.floor(payload.length * (index + 1) / a.frames.length);
      const result = Buffer.from(JSON.stringify({ ...frame.envelope, message_size_bytes: payload.length,
        message_chunk_base64: payload.subarray(start, end).toString("base64") }));
      return { data: result, binary: false };
    });
    if (encodedFrames.some(frame => frame.data.length > MAX_WIRE)) {
      const expanded = expandedChunks(payload, a.frames.map(frame => frame.envelope), this.envelopeType);
      if (!expanded) return a.frames.map(frame => frame.original);
      this.rewritten++;
      return expanded;
    }
    this.rewritten++;
    return encodedFrames;
  }
}
module.exports = { IncomingRewriter, parse, rewriteRequest, MAX_MESSAGE, MAX_WIRE, QUIET };
