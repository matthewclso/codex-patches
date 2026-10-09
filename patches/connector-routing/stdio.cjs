"use strict";
const { parse, MAX_MESSAGE } = require("../remote-fast-list/rewrite.cjs");

function writer(source, destination) {
  let blocked = false, closed = false;
  const drain = () => { blocked = false; if (!closed) source.resume(); };
  const write = raw => {
    if (closed || destination.destroyed || destination.writableEnded) return;
    if (!destination.write(raw) && !blocked) {
      blocked = true;
      source.pause();
      destination.once("drain", drain);
    }
  };
  write.close = () => { closed = true; destination.off("drain", drain); };
  return write;
}

function jsonLines(source, forward, transform) {
  let pieces = [], size = 0, bypass = false;
  function accept(piece, complete) {
    size += piece.length;
    if (bypass || size > MAX_MESSAGE) {
      for (const saved of pieces) forward(saved);
      pieces = [];
      forward(piece);
      bypass = !complete;
      if (complete) size = 0;
      return;
    }
    pieces.push(piece);
    if (!complete) return;
    const raw = Buffer.concat(pieces, size);
    pieces = []; size = 0;
    let message;
    try { message = parse(raw.toString()); } catch { forward(raw); return; }
    if (!transform(message, raw)) forward(raw);
  }
  const data = chunk => {
    let start = 0, end;
    while ((end = chunk.indexOf(10, start)) >= 0) {
      accept(chunk.subarray(start, end + 1), true);
      start = end + 1;
    }
    if (start < chunk.length) accept(chunk.subarray(start), false);
  };
  const end = () => { if (pieces.length) accept(Buffer.alloc(0), true); };
  source.on("data", data);
  source.once("end", end);
  return () => { source.off("data", data); source.off("end", end); };
}
module.exports = { jsonLines, writer };
