'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function parseArchive(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length >= 16, 'Invalid ASAR buffer');
  assert.equal(bytes.readUInt32LE(0), 4, 'Unsupported ASAR pickle');
  const headerSize = bytes.readUInt32LE(4), jsonSize = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(8), headerSize - 4, 'Malformed ASAR header pickle');
  assert(headerSize >= 8 && jsonSize > 0 && jsonSize <= headerSize - 8, 'Malformed ASAR JSON size');
  assert(8 + headerSize <= bytes.length, 'Truncated ASAR');
  const json = bytes.subarray(16, 16 + jsonSize);
  const tree = JSON.parse(json.toString('utf8'));
  assert(tree.files && typeof tree.files === 'object', 'Missing ASAR files');
  return { tree, payload: bytes.subarray(8 + headerSize), headerHash: sha256(json) };
}
function listEntries(tree, prefix = '') {
  return Object.entries(tree.files).flatMap(([name, entry]) => entry.files
    ? listEntries(entry, prefix + name + '/') : [{ path: prefix + name, entry }]);
}
function lookup(tree, name) {
  assert(typeof name === 'string' && !name.startsWith('/') && !name.split('/').some(p => !p || p === '..' || p === '.'), 'Invalid ASAR entry path');
  let entry = tree;
  for (const part of name.split('/')) {
    assert(entry.files && Object.hasOwn(entry.files, part), 'Missing ASAR entry: ' + name);
    entry = entry.files[part];
  }
  return entry;
}
function readEntry(archive, name) {
  const entry = lookup(archive.tree, name);
  assert(!entry.files && !entry.link && !entry.unpacked, 'Entry must be a packed regular file: ' + name);
  const offset = Number(entry.offset);
  assert(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(entry.size) && entry.size >= 0 && offset + entry.size <= archive.payload.length, 'Invalid ASAR entry bounds: ' + name);
  return archive.payload.subarray(offset, offset + entry.size);
}
function serializeArchive(tree, payload) {
  const json = Buffer.from(JSON.stringify(tree)), padding = (4 - json.length % 4) % 4;
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(8 + json.length + padding, 4);
  prefix.writeUInt32LE(4 + json.length + padding, 8);
  prefix.writeUInt32LE(json.length, 12);
  return Buffer.concat([prefix, json, Buffer.alloc(padding), payload]);
}
function verifyEntryIntegrity(data, entry, name) {
  const integrity = entry.integrity;
  assert(integrity?.algorithm === 'SHA256' && Number.isSafeInteger(integrity.blockSize) && integrity.blockSize > 0, 'Unsupported entry integrity: ' + name);
  assert.equal(integrity.hash, sha256(data), 'Source integrity mismatch: ' + name);
  const blocks = [];
  for (let i = 0; i < data.length; i += integrity.blockSize) blocks.push(sha256(data.subarray(i, i + integrity.blockSize)));
  assert.deepEqual(integrity.blocks, blocks, 'Source block integrity mismatch: ' + name);
}
function replaceEntries(bytes, replacements) {
  const before = parseArchive(bytes), tree = structuredClone(before.tree), parts = [before.payload];
  let cursor = before.payload.length;
  for (const [name, data] of replacements) {
    assert(Buffer.isBuffer(data), 'Replacement must be a Buffer');
    const entry = lookup(tree, name), original = readEntry(before, name);
    verifyEntryIntegrity(original, entry, name);
    entry.offset = String(cursor);
    entry.size = data.length;
    entry.integrity.hash = sha256(data);
    entry.integrity.blocks = [];
    for (let i = 0; i < data.length; i += entry.integrity.blockSize) entry.integrity.blocks.push(sha256(data.subarray(i, i + entry.integrity.blockSize)));
    parts.push(data); cursor += data.length;
  }
  const result = serializeArchive(tree, Buffer.concat(parts)), after = parseArchive(result);
  assert(before.payload.equals(after.payload.subarray(0, before.payload.length)), 'Original archive payload was changed');
  const first = listEntries(before.tree), second = listEntries(after.tree);
  assert.deepEqual(first.map(e => e.path), second.map(e => e.path), 'Archive entry set changed');
  for (let i = 0; i < first.length; i++) {
    const { path, entry } = first[i];
    if (!replacements.has(path)) {
      assert.deepEqual(second[i].entry, entry, 'Unrelated archive metadata changed: ' + path);
      if (!entry.unpacked && !entry.link) assert(readEntry(before, path).equals(readEntry(after, path)), 'Unrelated archive content changed: ' + path);
    } else verifyEntryIntegrity(readEntry(after, path), second[i].entry, path);
  }
  return result;
}
function headerHash(bytes) { return parseArchive(bytes).headerHash; }

// Resolve the PE resource directory and its RVAs. No build-specific byte offset.
function executableResources(bytes) {
  function bounds(offset, size) { assert(Number.isSafeInteger(offset) && offset >= 0 && offset + size <= bytes.length, 'Malformed executable bounds'); return offset; }
  assert(Buffer.isBuffer(bytes) && bytes.length >= 64 && bytes.toString('ascii', 0, 2) === 'MZ', 'Invalid PE executable');
  const pe = bounds(bytes.readUInt32LE(0x3c), 24);
  assert.equal(bytes.toString('ascii', pe, pe + 4), 'PE\0\0', 'Missing PE header');
  const sectionsCount = bytes.readUInt16LE(pe + 6), optionalSize = bytes.readUInt16LE(pe + 20), optional = bounds(pe + 24, optionalSize);
  const magic = bytes.readUInt16LE(optional), directoryStart = magic === 0x20b ? 112 : magic === 0x10b ? 96 : 0;
  assert(directoryStart && optionalSize >= directoryStart + 24, 'Unsupported PE optional header');
  const resourceRva = bytes.readUInt32LE(optional + directoryStart + 16), resourceSize = bytes.readUInt32LE(optional + directoryStart + 20);
  assert(resourceRva && resourceSize, 'Missing PE resources');
  const sectionStart = optional + optionalSize;
  const sections = [];
  for (let i = 0; i < sectionsCount; i++) {
    const at = bounds(sectionStart + 40 * i, 40);
    sections.push({ size: bytes.readUInt32LE(at + 16), rva: bytes.readUInt32LE(at + 12), offset: bytes.readUInt32LE(at + 20) });
  }
  function rvaOffset(rva, size) {
    const matching = sections.filter(s => rva >= s.rva && rva + size <= s.rva + s.size);
    assert.equal(matching.length, 1, 'Resource RVA outside a unique section');
    return bounds(matching[0].offset + rva - matching[0].rva, size);
  }
  const root = rvaOffset(resourceRva, resourceSize), resources = [], visited = new Set();
  function resourceOffset(relative, size) { assert(relative >= 0 && relative + size <= resourceSize, 'Resource directory out of bounds'); return bounds(root + relative, size); }
  function walk(relative, names, depth) {
    assert(depth < 8 && !visited.has(relative), 'Cyclic PE resource directory'); visited.add(relative);
    const at = resourceOffset(relative, 16), count = bytes.readUInt16LE(at + 12) + bytes.readUInt16LE(at + 14);
    resourceOffset(relative + 16, count * 8);
    for (let i = 0; i < count; i++) {
      const entry = at + 16 + i * 8, nameId = bytes.readUInt32LE(entry), target = bytes.readUInt32LE(entry + 4);
      let name = nameId;
      if (nameId & 0x80000000) {
        const rel = nameId & 0x7fffffff, pos = resourceOffset(rel, 2), length = bytes.readUInt16LE(pos);
        name = bytes.toString('utf16le', resourceOffset(rel + 2, length * 2), pos + 2 + length * 2);
      }
      const nextNames = [...names, name];
      if (target & 0x80000000) walk(target & 0x7fffffff, nextNames, depth + 1);
      else {
        const record = resourceOffset(target, 16), size = bytes.readUInt32LE(record + 4);
        resources.push({ names: nextNames, offset: rvaOffset(bytes.readUInt32LE(record), size), size });
      }
    }
  }
  walk(0, [], 0);
  return resources;
}
function updateExecutableIntegrity(original, beforeHash, afterHash) {
  assert(/^[a-f0-9]{64}$/.test(beforeHash) && /^[a-f0-9]{64}$/.test(afterHash), 'Invalid header hashes');
  if (beforeHash === afterHash) return Buffer.from(original);
  const resources = executableResources(original).filter(r => r.names.some(n => typeof n === 'string' && n.toLowerCase() === 'electronasar') && r.names.some(n => typeof n === 'string' && n.toLowerCase() === 'integrity'));
  assert.equal(resources.length, 1, 'Expected one Integrity/ElectronAsar resource');
  const resource = resources[0], raw = original.subarray(resource.offset, resource.offset + resource.size);
  const records = JSON.parse(raw.toString('utf8').replace(/\0+$/, ''));
  assert(Array.isArray(records), 'Unexpected ElectronAsar resource');
  const matches = records.filter(r => r.file?.replaceAll('/', '\\').toLowerCase() === 'resources\\app.asar' && r.alg === 'SHA256' && r.value === beforeHash);
  assert.equal(matches.length, 1, 'Original ASAR integrity hash does not match executable');
  const needle = Buffer.from(beforeHash), relative = raw.indexOf(needle);
  assert(relative >= 0 && raw.indexOf(needle, relative + needle.length) === -1, 'Ambiguous ASAR hash in resource');
  const offset = resource.offset + relative, result = Buffer.from(original);
  result.write(afterHash, offset, 64, 'ascii');
  assert(result.subarray(0, offset).equals(original.subarray(0, offset)) && result.subarray(offset + 64).equals(original.subarray(offset + 64)), 'Unrelated executable bytes changed');
  return result;
}
module.exports = { sha256, parseArchive, listEntries, lookup, readEntry, serializeArchive, verifyEntryIntegrity, replaceEntries, headerHash, executableResources, updateExecutableIntegrity };
