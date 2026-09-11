// Copyright 2026 Robin L. M. Cheung
// SPDX-License-Identifier: AGPL-3.0
// Node adapter for the AnZimmerman reader contract. This is a format-corrected
// implementation, not a binding to the unfinished Rust RealZim implementation.
// Provenance and compatibility limits: native/README.md.
import {open} from 'node:fs/promises';
import {basename} from 'node:path';
import {createHash, timingSafeEqual} from 'node:crypto';
import {zstdDecompress, inflate, constants as zlibConstants} from 'node:zlib';
import {promisify} from 'node:util';
import {spawn} from 'node:child_process';

const zstd = promisify(zstdDecompress), unzip = promisify(inflate);
const MiB = 1024 * 1024;
export const ZIM_LIMITS = Object.freeze({
  clusterBytes: 128 * MiB, articleBytes: 32 * MiB,
  cacheBytes: 64 * MiB, directoryCacheBytes: 2 * MiB,
  directoryEntryBytes: 64 * 1024, mimeBytes: MiB,
  scanEntries: 20_000, pageSize: 200, redirectHops: 32,
});

export class ZimError extends Error {
  constructor(code, message) { super(message); this.name = 'ZimError'; this.code = code; }
}
const fail = (message, code = 'ZIM_INVALID') => { throw new ZimError(code, message); };
function integer(n, name, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(n) || n < 0 || n > max) fail(`Invalid ${name}.`);
  return n;
}
function u64(bytes, offset, name = '64-bit offset') {
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${name} exceeds safe file addressing.`);
  return Number(value);
}
class ByteLRU {
  constructor(limit) { this.limit = limit; this.bytes = 0; this.items = new Map(); }
  get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    this.items.delete(key); this.items.set(key, item); return item.value;
  }
  put(key, value, cost) {
    const old = this.items.get(key);
    if (old) { this.bytes -= old.cost; this.items.delete(key); }
    if (cost > this.limit) return value;
    while (this.bytes + cost > this.limit) {
      const key = this.items.keys().next().value, old = this.items.get(key);
      this.bytes -= old.cost; this.items.delete(key);
    }
    this.items.set(key, {value, cost}); this.bytes += cost; return value;
  }
  clear() { this.items.clear(); this.bytes = 0; }
}

// Locate a single standard Zstandard frame, excluding directory/index bytes
// which may follow the final cluster. Frame layout: RFC 8878 sections 3.1.1–3.
function zstdFrameEnd(data) {
  const need = (offset, bytes) => { if (offset + bytes > data.length) fail('Truncated Zstandard frame.'); };
  need(0, 5);
  if (data.readUInt32LE(0) !== 0xfd2fb528) fail('Invalid Zstandard frame magic.');
  const descriptor = data[4], single = (descriptor >> 5) & 1;
  if (descriptor & 0x08) fail('Reserved Zstandard frame flag.');
  const dictionary = [0, 1, 2, 4][descriptor & 3];
  const sizeFlag = descriptor >> 6;
  const contentSize = sizeFlag === 0 ? single : [0, 2, 4, 8][sizeFlag];
  let at = 5 + (single ? 0 : 1) + dictionary + contentSize;
  need(0, at);
  for (;;) {
    need(at, 3);
    const header = data.readUIntLE(at, 3); at += 3;
    const last = header & 1, type = (header >> 1) & 3, size = header >>> 3;
    if (type === 3 || size > 128 * 1024) fail('Invalid Zstandard block.');
    at += type === 1 ? 1 : size; need(0, at);
    if (last) break;
  }
  if (descriptor & 4) at += 4;
  need(0, at); return at;
}

// The decoder runs without a shell, reads only the supplied cluster, and has
// bounded output, decoder memory and runtime. Modern ZIM files do not need it.
function legacyDecode(bytes, algorithm) {
  const command = algorithm === 4 ? 'xz' : 'bzip2';
  const args = algorithm === 4
    ? ['--decompress', '--stdout', '--single-stream', '--memlimit-decompress=128MiB']
    : ['--decompress', '--stdout'];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true});
    const parts = []; let size = 0, errorText = '', settled = false;
    const finish = (error, result) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) { child.kill(); reject(error); } else resolve(result);
    };
    const timer = setTimeout(() => finish(new ZimError('ZIM_LIMIT', 'Legacy cluster decompression timed out.')), 30_000);
    child.on('error', error => finish(new ZimError('ZIM_DECODER_UNAVAILABLE', `Legacy ZIM requires ${command} on PATH: ${error.message}`)));
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') finish(error); });
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > ZIM_LIMITS.clusterBytes) return finish(new ZimError('ZIM_LIMIT', 'Decompressed cluster exceeds the memory limit.'));
      parts.push(chunk);
    });
    child.stderr.on('data', chunk => { if (errorText.length < 2048) errorText += chunk.toString().slice(0, 2048); });
    child.on('close', code => code === 0
      ? finish(null, Buffer.concat(parts, size))
      : finish(new ZimError('ZIM_INVALID', `${command} could not decode this ZIM cluster: ${errorText.trim()}`)));
    child.stdin.end(bytes);
  });
}

/** Open a mounted, immutable ZIM with random file reads and evictable caches. */
export async function openZim(path) {
  const file = await open(path, 'r');
  const entries = new ByteLRU(ZIM_LIMITS.directoryCacheBytes);
  const pointers = new ByteLRU(MiB);
  const clusters = new ByteLRU(ZIM_LIMITS.cacheBytes);
  let closed = false, pending = Promise.resolve(), metadata, header, size;
  const serial = fn => {
    const result = pending.then(() => { if (closed) fail('This ZIM is closed.', 'ZIM_CLOSED'); return fn(); });
    pending = result.catch(() => {}); return result;
  };
  const checkRange = (position, length) => {
    integer(position, 'file position'); integer(length, 'read size');
    if (position > size || length > size - position) fail('ZIM pointer or read is outside the archive.');
  };
  async function readAt(position, length) {
    checkRange(position, length);
    const result = Buffer.allocUnsafe(length); let done = 0;
    while (done < length) {
      const {bytesRead} = await file.read(result, done, length - done, position + done);
      if (!bytesRead) fail('ZIM was truncated while reading.');
      done += bytesRead;
    }
    return result;
  }
  async function pointer(base, index, count) {
    integer(index, 'pointer index', count - 1);
    const page = Math.floor(index / 512), key = `${base}:${page}`;
    let bytes = pointers.get(key);
    if (!bytes) {
      bytes = await readAt(base + page * 4096, Math.min(512, count - page * 512) * 8);
      pointers.put(key, bytes, bytes.length);
    }
    const result = u64(bytes, (index % 512) * 8);
    if (result < 80 || result >= header.checksumPos) fail('ZIM pointer is outside the content area.');
    return result;
  }
  async function dirent(index) {
    const cached = entries.get(index); if (cached) return cached;
    const start = await pointer(header.urlPtr, index, header.entryCount);
    const maximum = Math.min(ZIM_LIMITS.directoryEntryBytes, header.checksumPos - start);
    for (let wanted = Math.min(256, maximum); wanted <= maximum; wanted = Math.min(wanted * 2, maximum)) {
      const data = await readAt(start, wanted);
      if (data.length < 8) fail('Truncated directory entry.');
      const mimeIndex = data.readUInt16LE(0), parameterLength = data[2], namespace = String.fromCharCode(data[3]);
      if (data[3] < 32 || data[3] > 126) fail('Invalid ZIM namespace.');
      const isRedirect = mimeIndex === 0xffff, special = mimeIndex === 0xfffe || mimeIndex === 0xfffd;
      const fixed = isRedirect ? 12 : special ? 8 : 16;
      const keyEnd = data.indexOf(0, fixed);
      const titleEnd = keyEnd < 0 ? -1 : data.indexOf(0, keyEnd + 1);
      if (titleEnd >= 0 && titleEnd + 1 + parameterLength <= data.length) {
        const url = data.toString('utf8', fixed, keyEnd), title = data.toString('utf8', keyEnd + 1, titleEnd) || url;
        if (!url || url.includes('\ufffd') || /[\x00-\x1f]/.test(url)) fail('Invalid ZIM article path.');
        const mime = isRedirect ? null : special ? null : header.mimes[mimeIndex];
        if (!isRedirect && !special && !mime) fail('Unknown MIME index in ZIM directory entry.');
        const result = {index, key: `${namespace}/${url}`, title, mime, isRedirect, namespace, url, special,
          redirectIndex: isRedirect ? data.readUInt32LE(8) : null,
          cluster: isRedirect || special ? null : data.readUInt32LE(8),
          blob: isRedirect || special ? null : data.readUInt32LE(12)};
        if (isRedirect && result.redirectIndex >= header.entryCount) fail('Redirect target is outside the directory.');
        if (!special && !isRedirect && result.cluster >= header.clusterCount) fail('Article cluster index is outside the cluster table.');
        return entries.put(index, result, (titleEnd + parameterLength + 1) * 2 + 256);
      }
      if (wanted === maximum) break;
    }
    fail('Unterminated or oversized ZIM directory entry.');
  }
  async function find(key) {
    if (typeof key !== 'string' || key.length > ZIM_LIMITS.directoryEntryBytes || !/^.[/].+$/s.test(key) || /[\x00-\x1f]/.test(key)) fail('Expected a canonical ZIM key such as C/Article.', 'ZIM_BAD_KEY');
    const target = Buffer.from(key); let lo = 0, hi = header.entryCount;
    while (lo < hi) {
      const middle = lo + Math.floor((hi - lo) / 2), entry = await dirent(middle);
      const order = Buffer.compare(target, Buffer.from(entry.key));
      if (!order) return entry;
      if (order < 0) hi = middle; else lo = middle + 1;
    }
    fail(`Article not found: ${key}`, 'ZIM_NOT_FOUND');
  }
  async function resolve(entry) {
    const seen = new Set();
    while (entry.isRedirect) {
      if (seen.has(entry.index) || seen.size >= ZIM_LIMITS.redirectHops) fail('ZIM redirect cycle or excessive redirect chain.');
      seen.add(entry.index); entry = await dirent(entry.redirectIndex);
    }
    if (entry.special) fail('This ZIM entry is deleted or has no stored content.', 'ZIM_NOT_FOUND');
    return entry;
  }
  async function blob(entry) {
    const start = await pointer(header.clusterPtr, entry.cluster, header.clusterCount);
    const info = (await readAt(start, 1))[0], compression = info & 15, width = (info & 16) ? 8 : 4;
    if (info & 0xe0 || compression > 5) fail('Unsupported ZIM cluster flags.');
    const offsetFrom = (data, at) => width === 8 ? u64(data, at, 'blob offset') : data.readUInt32LE(at);
    let payload = clusters.get(entry.cluster), available = header.checksumPos - start - 1;
    if (entry.cluster + 1 < header.clusterCount) {
      const next = await pointer(header.clusterPtr, entry.cluster + 1, header.clusterCount);
      if (next <= start) fail('ZIM cluster pointers are not increasing.');
      available = next - start - 1;
    }
    if (compression > 1 && !payload) {
      // Do not accidentally load a final trailing URL table with a cluster.
      for (const boundary of [header.urlPtr, header.titlePtr, header.clusterPtr, header.mimePtr]) {
        if (boundary > start) available = Math.min(available, boundary - start - 1);
      }
      if (available > ZIM_LIMITS.clusterBytes) fail('Compressed cluster exceeds the memory limit.', 'ZIM_LIMIT');
      const compressed = await readAt(start + 1, available);
      try {
        if (compression === 5) payload = await zstd(compressed.subarray(0, zstdFrameEnd(compressed)), {
          maxOutputLength: ZIM_LIMITS.clusterBytes,
          params: {[zlibConstants.ZSTD_d_windowLogMax]: 27},
        });
        else if (compression === 2) payload = await unzip(compressed, {maxOutputLength: ZIM_LIMITS.clusterBytes});
        else payload = await legacyDecode(compressed, compression);
      } catch (error) {
        if (error instanceof ZimError) throw error;
        fail(`ZIM decompression failed: ${error.message}`, error.code === 'ERR_BUFFER_TOO_LARGE' ? 'ZIM_LIMIT' : 'ZIM_INVALID');
      }
      clusters.put(entry.cluster, payload, payload.length);
    }
    // Uncompressed clusters are never loaded wholesale, including large media
    // clusters: only the offset table entries and requested blob are read.
    const firstBytes = payload ? payload.subarray(0, width) : await readAt(start + 1, width);
    if (firstBytes.length < width) fail('Truncated ZIM blob offset table.');
    const first = offsetFrom(firstBytes, 0), extent = payload ? payload.length : available;
    if (first < width || first % width !== 0 || first > extent) fail('Invalid first blob offset.');
    const count = first / width - 1;
    if (entry.blob >= count) fail('Blob index is outside the cluster offset table.');
    const at = entry.blob * width;
    const offsets = payload ? payload.subarray(at, at + width * 2) : await readAt(start + 1 + at, width * 2);
    if (offsets.length < width * 2) fail('Truncated ZIM blob offsets.');
    const from = offsetFrom(offsets, 0), to = offsetFrom(offsets, width);
    if (from < first || from > to || to > extent) fail('Unordered or out-of-bounds ZIM blob offsets.');
    if (to - from > ZIM_LIMITS.articleBytes) fail('Article exceeds the per-read memory limit.', 'ZIM_LIMIT');
    // Copy so callers cannot retain a huge decompression buffer via a tiny slice.
    return payload ? Buffer.from(payload.subarray(from, to)) : readAt(start + 1 + from, to - from);
  }
  async function read(key) {
    const entry = await resolve(await find(key));
    return {key: entry.key, requestedKey: key, title: entry.title, mime: entry.mime, bytes: await blob(entry)};
  }
  try {
    const stat = await file.stat();
    if (!stat.isFile()) fail('ZIM input is not a regular file.');
    size = integer(stat.size, 'file size');
    if (size < 96) fail('ZIM is smaller than its header and checksum.');
    const bytes = await readAt(0, 80);
    if (bytes.readUInt32LE(0) !== 0x044d495a) fail('Invalid OpenZIM magic number.');
    const major = bytes.readUInt16LE(4), minor = bytes.readUInt16LE(6);
    if (![5, 6].includes(major)) fail(`Unsupported ZIM major version ${major}.`, 'ZIM_UNSUPPORTED');
    header = {major, minor, uuid: bytes.subarray(8, 24).toString('hex'), entryCount: bytes.readUInt32LE(24), clusterCount: bytes.readUInt32LE(28),
      urlPtr: u64(bytes, 32), titlePtr: bytes.readBigUInt64LE(40) === 0xffffffffffffffffn ? null : u64(bytes, 40),
      clusterPtr: u64(bytes, 48), mimePtr: u64(bytes, 56), mainIndex: bytes.readUInt32LE(64), checksumPos: u64(bytes, 72), mimes: []};
    if (header.checksumPos !== size - 16) fail('Invalid ZIM checksum position or unsupported multipart archive.');
    for (const [ptr, length] of [[header.urlPtr, header.entryCount * 8], [header.clusterPtr, header.clusterCount * 8]]) {
      if (ptr < 80 || ptr + length > header.checksumPos) fail('ZIM pointer table is outside the content area.');
    }
    if (header.mimePtr < 80 || header.mimePtr >= header.checksumPos) fail('Invalid ZIM MIME table position.');
    let mimeBuffer = Buffer.alloc(0), terminated = false;
    for (let at = header.mimePtr; at < header.checksumPos && mimeBuffer.length < ZIM_LIMITS.mimeBytes;) {
      const part = await readAt(at, Math.min(4096, header.checksumPos - at, ZIM_LIMITS.mimeBytes - mimeBuffer.length));
      at += part.length; mimeBuffer = Buffer.concat([mimeBuffer, part]);
      const end = mimeBuffer.indexOf(Buffer.from([0, 0]));
      if (end >= 0) {
        header.mimes = mimeBuffer.subarray(0, end).toString('ascii').split('\0'); terminated = true; break;
      }
    }
    if (!terminated || !header.mimes.length || header.mimes.length > 65533 || header.mimes.some(m => !/^[\x21-\x7e]+\/[\x20-\x7e]+$/.test(m))) fail('Invalid or unterminated ZIM MIME table.');
    // Cheap first/last pointer validation catches corrupt tables without
    // building an archive-sized index or silently accepting malformed fixtures.
    if (header.entryCount) { await dirent(0); await dirent(header.entryCount - 1); }
    if (header.clusterCount) { await pointer(header.clusterPtr, 0, header.clusterCount); await pointer(header.clusterPtr, header.clusterCount - 1, header.clusterCount); }
    metadata = {uuid: header.uuid, version: `${major}.${minor}`, entryCount: header.entryCount,
      articleCount: null, clusterCount: header.clusterCount, fileSize: size, title: basename(path), description: '', language: '',
      mainPage: null, checksumStatus: 'not-checked', limits: ZIM_LIMITS,
      features: {randomAccess: true, titleSearch: true, xapianFulltext: false, multipart: false}};
    if (header.mainIndex !== 0xffffffff) {
      if (header.mainIndex >= header.entryCount) fail('ZIM main page index is outside the directory.');
      metadata.mainPage = (await resolve(await dirent(header.mainIndex))).key;
    }
    for (const [key, field] of [['Title', 'title'], ['Description', 'description'], ['Language', 'language'], ['Creator', 'creator'], ['Date', 'date'], ['Publisher', 'publisher']]) {
      try {
        const result = await read(`M/${key}`);
        if (result.bytes.length > MiB) fail('ZIM metadata value is too large.', 'ZIM_LIMIT');
        metadata[field] = result.bytes.toString('utf8').trim();
      } catch (error) { if (error.code !== 'ZIM_NOT_FOUND') throw error; }
    }
    return {
      metadata: () => structuredClone(metadata),
      read: key => serial(() => read(key)),
      list: ({offset = 0, limit = 50, query = '', includeAssets = false} = {}) => serial(async () => {
        integer(offset, 'listing offset', header.entryCount); integer(limit, 'listing limit', ZIM_LIMITS.pageSize);
        if (typeof query !== 'string' || query.length > 1024) fail('Invalid title query.');
        const needle = query.trim().toLocaleLowerCase(), result = [], end = Math.min(header.entryCount, offset + ZIM_LIMITS.scanEntries);
        let cursor = offset;
        while (cursor < end && result.length < limit) {
          const entry = await dirent(cursor++);
          if (entry.special || (!includeAssets && !['A', 'C'].includes(entry.namespace))) continue;
          if (!includeAssets && !entry.isRedirect && !/^(?:text\/(?:html|plain)|application\/xhtml\+xml)(?:;|$)/i.test(entry.mime)) continue;
          if (needle && !`${entry.title}\n${entry.key}`.toLocaleLowerCase().includes(needle)) continue;
          result.push({key: entry.key, title: entry.title, mime: entry.mime, index: entry.index, isRedirect: entry.isRedirect});
        }
        result.nextOffset = cursor; result.complete = cursor === header.entryCount; return result;
      }),
      verify: () => serial(async () => {
        const hash = createHash('md5');
        for (let at = 0; at < header.checksumPos; at += MiB) hash.update(await readAt(at, Math.min(MiB, header.checksumPos - at)));
        const valid = timingSafeEqual(hash.digest(), await readAt(header.checksumPos, 16));
        metadata.checksumStatus = valid ? 'verified' : 'failed';
        if (!valid) fail('ZIM MD5 checksum does not match.', 'ZIM_CHECKSUM');
        return {valid, algorithm: 'md5', bytes: header.checksumPos};
      }),
      cacheStats: () => ({clusterBytes: clusters.bytes, directoryBytes: entries.bytes, pointerBytes: pointers.bytes}),
      close: async () => {
        await pending; if (closed) return; closed = true;
        clusters.clear(); entries.clear(); pointers.clear(); await file.close();
      },
    };
  } catch (error) { await file.close(); throw error; }
}
