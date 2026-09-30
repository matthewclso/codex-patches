"use strict";
const zlib = require("node:zlib");
const { parse } = require("./rewrite.cjs");
const LIMIT = 1024 * 1024;

function normalizeAccountRouting(bytes, encoding, upstreamOrigin) {
  let decoded = bytes;
  const options = { maxOutputLength: LIMIT };
  switch ((encoding ?? "identity").toLowerCase()) {
    case "identity": break;
    case "gzip": decoded = zlib.gunzipSync(bytes, options); break;
    case "deflate": decoded = zlib.inflateSync(bytes, options); break;
    case "br": decoded = zlib.brotliDecompressSync(bytes, options); break;
    case "zstd": decoded = zlib.zstdDecompressSync(bytes, options); break;
    default: throw new Error("Unknown account response encoding");
  }
  if (decoded.length > LIMIT) throw new Error("Account response exceeds limit");
  const value = parse(decoded.toString());
  let changed = false;
  for (const account of Array.isArray(value?.accounts) ? value.accounts : []) {
    // Preserve the original default origin, not the artificial loopback bootstrap.
    // Never supply missing/null fields or change the backend's residency decision.
    if (account?.workspace_backend_origin === "NO_CONSTRAINT") {
      account.workspace_backend_origin = upstreamOrigin;
      changed = true;
    }
  }
  return changed ? Buffer.from(JSON.stringify(value)) : null;
}
module.exports = { normalizeAccountRouting, LIMIT };
