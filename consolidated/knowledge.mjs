/**
 * Local knowledge mesh. Source bytes remain in their immutable ZIM/PDF/document.
 * This database owns references, explicit relationships and user notes; extracted
 * text and supplied model embeddings are separate, bounded, disposable caches.
 * contentHash is SHA-256 of the exact extracted text, when it is known.
 */
import {DatabaseSync} from 'node:sqlite';
import {mkdir} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import path from 'node:path';

export const hashText = text => createHash('sha256').update(text, 'utf8').digest('hex');
const parse = value => value ? JSON.parse(value) : null;
const words = text => String(text).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [];
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const identity = source => JSON.stringify([source.corpusId, source.key]);

function string(value, name, max = 1024) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}
function budget(value, fallback) {
  value ??= fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Cache budgets must be nonnegative integer bytes');
  return value;
}
function lexical(tokens, text) {
  if (!tokens.length) return 0;
  const counts = new Map();
  for (const token of words(text)) counts.set(token, (counts.get(token) || 0) + 1);
  let matched = 0, score = 0;
  for (const token of tokens) {
    const count = counts.get(token) || 0;
    if (count) { matched++; score += 1 + Math.log1p(count); }
  }
  return score * (matched / tokens.length);
}
function vectorValues(value) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) throw new Error('Embedding must be a numeric array');
  const values = Array.from(value);
  if (!values.length || values.length > 32768 || values.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new Error('Embedding must contain 1–32768 finite numbers');
  }
  const magnitude = Math.hypot(...values);
  if (!magnitude || !Number.isFinite(magnitude)) throw new Error('Embedding must have a finite nonzero norm');
  return values.map(v => v / magnitude);
}
function encodeVector(values) {
  const blob = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => blob.writeFloatLE(v, i * 4));
  return blob;
}
function cosine(query, row) {
  if (query.length !== row.dimensions) return null;
  const blob = Buffer.from(row.vector);
  let dot = 0;
  for (let i = 0; i < query.length; i++) dot += query[i] * blob.readFloatLE(i * 4);
  return Math.max(-1, Math.min(1, dot));
}
function excerpt(text, tokens, max = 4000) {
  if (text.length <= max) return text;
  const lower = text.toLowerCase();
  const positions = tokens.map(t => lower.indexOf(t)).filter(i => i >= 0);
  const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 180);
  return `${start ? '…' : ''}${text.slice(start, start + max)}${start + max < text.length ? '…' : ''}`;
}

export async function openKnowledge(root, options = {}) {
  await mkdir(root, {recursive: true});
  let projectionBytes = budget(options.projectionBytes, 8 * 1024 ** 2);
  let vectorBytes = budget(options.vectorBytes, 4 * 1024 ** 2);
  const db = new DatabaseSync(path.join(root, 'knowledge.sqlite'));
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS mesh_layers (
      id TEXT PRIMARY KEY, corpus_id TEXT NOT NULL, precedence REAL NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1, sequence INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mesh_sources (
      id TEXT PRIMARY KEY, corpus_id TEXT NOT NULL, layer_id TEXT NOT NULL REFERENCES mesh_layers(id),
      article_key TEXT NOT NULL, metadata TEXT NOT NULL,
      tombstone INTEGER NOT NULL DEFAULT 0, UNIQUE(layer_id, article_key)
    );
    CREATE INDEX IF NOT EXISTS mesh_source_identity ON mesh_sources(corpus_id, article_key);
    CREATE TABLE IF NOT EXISTS mesh_edges (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES mesh_sources(id),
      target_id TEXT NOT NULL REFERENCES mesh_sources(id), relation TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('explicit','asserted')), created TEXT NOT NULL,
      UNIQUE(source_id, target_id, relation, kind)
    );
    CREATE TABLE IF NOT EXISTS mesh_notes (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES mesh_sources(id),
      text TEXT NOT NULL, anchor TEXT, created TEXT NOT NULL, updated TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mesh_projections (
      source_id TEXT PRIMARY KEY REFERENCES mesh_sources(id), content_hash TEXT NOT NULL,
      text TEXT NOT NULL, bytes INTEGER NOT NULL, touched INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mesh_embeddings (
      source_id TEXT NOT NULL REFERENCES mesh_sources(id), model TEXT NOT NULL,
      content_hash TEXT NOT NULL, dimensions INTEGER NOT NULL, vector BLOB NOT NULL,
      bytes INTEGER NOT NULL, touched INTEGER NOT NULL, PRIMARY KEY(source_id, model)
    );
  `);
  let clock = Math.max(Date.now(), db.prepare(`SELECT MAX(touched) AS n FROM (
    SELECT touched FROM mesh_projections UNION ALL SELECT touched FROM mesh_embeddings
  )`).get().n || 0);
  let sourceResolver = options.resolveBody || null;
  const tick = () => ++clock;
  const count = table => db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(bytes), 0) AS bytes FROM ${table}`).get();
  function prune(table, limit) {
    let total = count(table).bytes;
    if (total <= limit) return;
    const rows = db.prepare(`SELECT rowid, bytes FROM ${table} ORDER BY touched ASC, rowid ASC`).all();
    const remove = db.prepare(`DELETE FROM ${table} WHERE rowid=?`);
    for (const row of rows) {
      remove.run(row.rowid); total -= row.bytes;
      if (total <= limit) break;
    }
  }
  function reclaimCacheSpace() {
    // DELETE alone keeps SQLite free pages allocated on disk. Reclaim them when
    // the user explicitly clears/shrinks a cache under storage pressure.
    db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);');
  }
  prune('mesh_projections', projectionBytes);
  prune('mesh_embeddings', vectorBytes);

  function layer(id) {
    const row = db.prepare('SELECT * FROM mesh_layers WHERE id=?').get(id);
    return row ? {id: row.id, corpusId: row.corpus_id, precedence: row.precedence, enabled: !!row.enabled, sequence: row.sequence} : null;
  }
  function getSource(id) {
    return parse(db.prepare('SELECT metadata FROM mesh_sources WHERE id=?').get(id)?.metadata);
  }
  function listSources({active = true, includeTombstones = false, assetId, corpusId, limit} = {}) {
    const rows = db.prepare(`SELECT s.metadata, s.tombstone, l.enabled FROM mesh_sources s
      JOIN mesh_layers l ON l.id=s.layer_id ORDER BY l.precedence DESC, l.sequence DESC, s.id ASC`).all();
    const seen = new Set(), result = [];
    for (const row of rows) {
      const source = parse(row.metadata);
      if (active) {
        if (!row.enabled) continue;
        const key = identity(source);
        if (seen.has(key)) continue;
        seen.add(key);
      }
      if (row.tombstone && !includeTombstones) continue;
      if (assetId && source.assetId !== assetId) continue;
      if (corpusId && source.corpusId !== corpusId) continue;
      result.push(source);
      if (limit && result.length >= limit) break;
    }
    return result;
  }
  function registerLayer(value) {
    const id = string(value.id, 'layer id');
    const corpusId = string(value.corpusId, 'corpus id');
    const precedence = value.precedence ?? 0;
    if (!Number.isFinite(precedence)) throw new Error('Invalid layer precedence');
    const old = layer(id);
    if (old) {
      if (old.corpusId !== corpusId || old.precedence !== precedence) {
        throw new Error('Layer identity and precedence are immutable; create a new layer');
      }
      return old;
    }
    const sequence = (db.prepare('SELECT MAX(sequence) AS n FROM mesh_layers').get().n || 0) + 1;
    db.prepare('INSERT INTO mesh_layers VALUES(?,?,?,?,?)').run(id, corpusId, precedence, value.enabled === false ? 0 : 1, sequence);
    return layer(id);
  }
  function putSource(value) {
    const assetId = string(value.assetId, 'asset id');
    const edition = string(value.edition, 'edition');
    const corpusId = string(value.corpusId || assetId, 'corpus id');
    const layerId = string(value.layerId || JSON.stringify([corpusId, edition]), 'layer id');
    const key = string(value.key, 'article key', 4096);
    const id = value.id || hashText(JSON.stringify([layerId, assetId, edition, key]));
    string(id, 'source id');
    const knownHash = value.contentHash ?? null;
    if (knownHash !== null && !sha256(knownHash)) throw new Error('contentHash must be the SHA-256 of exact extracted text');
    const locator = value.locator ?? {key};
    if (typeof locator !== 'object' || Array.isArray(locator) || !locator || JSON.stringify(locator).length > 16384) {
      throw new Error('Invalid source locator');
    }
    const links = value.links ?? [];
    if (!Array.isArray(links) || links.length > 5000) throw new Error('Invalid source links');
    const normalizedLinks = links.map(link => {
      if (typeof link === 'string') return {key: string(link, 'link key', 4096), relation: 'links_to'};
      if (!link || typeof link !== 'object') throw new Error('Invalid source link');
      const out = {relation: string(link.relation || 'links_to', 'link relation', 100)};
      if (link.sourceId) out.sourceId = string(link.sourceId, 'link source id');
      else {
        out.key = string(link.key, 'link key', 4096);
        if (link.corpusId) out.corpusId = string(link.corpusId, 'link corpus id');
      }
      return out;
    });
    const source = {id, assetId, edition, key, title: string(value.title || key, 'title'),
      kind: string(value.kind || 'document', 'source kind', 64), locator,
      contentHash: knownHash?.toLowerCase() || null, links: normalizedLinks, corpusId, layerId,
      tombstone: !!value.tombstone};
    const old = getSource(id);
    if (old) {
      if (JSON.stringify(old) !== JSON.stringify(source)) throw new Error('Source references are immutable; create a new edition or overlay');
      return old;
    }
    const existingLayer = layer(layerId);
    if (existingLayer && existingLayer.corpusId !== corpusId) throw new Error('Source corpus does not match its layer');
    if (!existingLayer) registerLayer({id: layerId, corpusId, precedence: value.precedence ?? 0});
    db.prepare('INSERT INTO mesh_sources VALUES(?,?,?,?,?,?)').run(id, corpusId, layerId, key, JSON.stringify(source), source.tombstone ? 1 : 0);
    return source;
  }
  function citation(source, contentHash = source.contentHash) {
    const {id, assetId, edition, key, title, kind, locator, layerId, corpusId} = source;
    return {sourceId: id, assetId, edition, key, title, kind, locator, contentHash, layerId, corpusId};
  }
  async function project(id, resolveBody = sourceResolver) {
    const source = getSource(id);
    if (!source || source.tombstone) throw new Error('Unknown or deleted source');
    const cached = db.prepare('SELECT * FROM mesh_projections WHERE source_id=?').get(id);
    if (cached && (!source.contentHash || cached.content_hash === source.contentHash)) {
      db.prepare('UPDATE mesh_projections SET touched=? WHERE source_id=?').run(tick(), id);
      return {source, text: cached.text, contentHash: cached.content_hash, cached: true};
    }
    if (cached) db.prepare('DELETE FROM mesh_projections WHERE source_id=?').run(id);
    if (typeof resolveBody !== 'function') throw new Error('Source body resolver is unavailable');
    const resolved = await resolveBody(source);
    const text = typeof resolved === 'string' ? resolved : resolved?.text;
    if (typeof text !== 'string') throw new Error('Source body resolver must return text');
    const contentHash = hashText(text);
    if (source.contentHash && contentHash !== source.contentHash) {
      db.prepare('DELETE FROM mesh_embeddings WHERE source_id=?').run(id);
      throw new Error(`Source content changed for ${source.title}; register a new edition`);
    }
    db.prepare('DELETE FROM mesh_embeddings WHERE source_id=? AND content_hash<>?').run(id, contentHash);
    const bytes = Buffer.byteLength(text, 'utf8');
    // Oversized bodies are read transiently, never inserted then "evicted".
    if (bytes <= projectionBytes && projectionBytes > 0) {
      db.prepare('INSERT OR REPLACE INTO mesh_projections VALUES(?,?,?,?,?)').run(id, contentHash, text, bytes, tick());
      prune('mesh_projections', projectionBytes);
    }
    return {source, text, contentHash, cached: false};
  }
  function setEmbedding(id, vector, {model, contentHash} = {}) {
    const source = getSource(id);
    if (!source || source.tombstone) throw new Error('Unknown or deleted source');
    string(model, 'embedding model');
    const projected = db.prepare('SELECT content_hash FROM mesh_projections WHERE source_id=?').get(id);
    const expected = source.contentHash || projected?.content_hash;
    contentHash ||= expected;
    if (!expected || !sha256(contentHash) || contentHash.toLowerCase() !== expected) {
      throw new Error('Embedding must match the verified source text fingerprint; project unknown-hash sources first');
    }
    const values = vectorValues(vector), blob = encodeVector(values);
    if (blob.length > vectorBytes || vectorBytes === 0) return {stored: false, reason: 'Embedding exceeds disposable vector cache budget'};
    db.prepare('INSERT OR REPLACE INTO mesh_embeddings VALUES(?,?,?,?,?,?,?)')
      .run(id, model, expected, values.length, blob, blob.length, tick());
    prune('mesh_embeddings', vectorBytes);
    return {stored: true, sourceId: id, model, dimensions: values.length, contentHash: expected};
  }
  function addEdge(sourceId, targetId, {relation = 'related_to', kind = 'asserted'} = {}) {
    if (!getSource(sourceId) || !getSource(targetId)) throw new Error('Both edge endpoints must be registered sources');
    if (!['explicit', 'asserted'].includes(kind)) throw new Error('Similarity is a retrieval score, not an asserted graph fact');
    string(relation, 'edge relation', 100);
    const id = hashText(JSON.stringify([sourceId, targetId, relation, kind]));
    db.prepare('INSERT OR IGNORE INTO mesh_edges VALUES(?,?,?,?,?,?)')
      .run(id, sourceId, targetId, relation, kind, new Date().toISOString());
    return {id, sourceId, targetId, relation, kind};
  }
  function graph({limit = 300} = {}) {
    limit = Math.max(1, Math.min(10000, Number(limit) || 300));
    const all = listSources(), nodes = all.slice(0, limit);
    const nodeIds = new Set(nodes.map(n => n.id));
    const byIdentity = new Map(all.map(n => [identity(n), n]));
    const edges = [];
    for (const node of nodes) for (const link of node.links) {
      const targetId = link.sourceId || byIdentity.get(JSON.stringify([link.corpusId || node.corpusId, link.key]))?.id;
      if (targetId && nodeIds.has(targetId)) edges.push({sourceId: node.id, targetId, relation: link.relation, kind: 'explicit'});
    }
    for (const row of db.prepare('SELECT * FROM mesh_edges').all()) {
      if (nodeIds.has(row.source_id) && nodeIds.has(row.target_id)) {
        edges.push({id: row.id, sourceId: row.source_id, targetId: row.target_id, relation: row.relation, kind: row.kind});
      }
    }
    return {nodes, edges, totalNodes: all.length, truncated: all.length > nodes.length};
  }
  function graphScores(seedIds, all, depth = 1) {
    const byId = new Map(all.map(s => [s.id, s]));
    const byIdentity = new Map(all.map(s => [identity(s), s]));
    const adjacent = new Map(all.map(s => [s.id, new Set()]));
    const link = (a, b) => { if (byId.has(a) && byId.has(b)) { adjacent.get(a).add(b); adjacent.get(b).add(a); } };
    for (const source of all) for (const edge of source.links) {
      const target = edge.sourceId || byIdentity.get(JSON.stringify([edge.corpusId || source.corpusId, edge.key]))?.id;
      if (target) link(source.id, target);
    }
    for (const edge of db.prepare('SELECT source_id, target_id FROM mesh_edges').all()) link(edge.source_id, edge.target_id);
    const scores = new Map(), seen = new Set();
    let frontier = seedIds.filter(id => byId.has(id));
    for (let step = 0; step <= Math.min(3, Math.max(0, depth)); step++) {
      const next = [];
      for (const id of frontier) {
        if (seen.has(id)) continue;
        seen.add(id); scores.set(id, 1 / (step + 1));
        next.push(...adjacent.get(id));
      }
      frontier = next;
    }
    return scores;
  }
  async function search(query, config = {}) {
    string(query, 'query', 8000);
    const tokens = [...new Set(words(query))];
    const limit = Math.max(1, Math.min(30, Number(config.limit) || 8));
    const maxCandidates = Math.max(limit, Math.min(1000, Number(config.maxCandidates) || 120));
    const all = listSources();
    const base = all.map(source => ({source, metadata: 3 * lexical(tokens, source.title) + lexical(tokens, source.key)}));
    const byId = new Map(base.map(row => [row.source.id, row]));
    const seeds = config.seedIds || [...base].sort((a, b) => b.metadata - a.metadata).filter(r => r.metadata > 0).slice(0, 3).map(r => r.source.id);
    const graphRank = graphScores(seeds, all, config.graphDepth ?? 1);
    const queryVector = config.queryVector ? vectorValues(config.queryVector) : null;
    if (queryVector && !config.embeddingModel) throw new Error('Query vectors must identify their embeddingModel');
    let compatibleVectors = 0, incompatibleVectors = 0;
    const vectorRank = new Map();
    if (queryVector) {
      for (const row of db.prepare('SELECT * FROM mesh_embeddings WHERE model=?').all(config.embeddingModel)) {
        const source = byId.get(row.source_id)?.source;
        if (!source || (source.contentHash && source.contentHash !== row.content_hash)) continue;
        const score = cosine(queryVector, row);
        if (score === null) { incompatibleVectors++; continue; }
        compatibleVectors++;
        vectorRank.set(row.source_id, {score: Math.max(0, score), hash: row.content_hash});
      }
    }
    // Previously encountered bodies participate in lexical candidate selection,
    // while the permanent map remains body-free.
    for (const row of db.prepare('SELECT source_id, text FROM mesh_projections').all()) {
      const found = byId.get(row.source_id);
      if (found) found.cachedLexical = lexical(tokens, row.text);
    }
    for (const row of base) row.priority = row.metadata + (row.cachedLexical || 0) + 3 * (graphRank.get(row.source.id) || 0) + 5 * (vectorRank.get(row.source.id)?.score || 0);
    const candidates = base.sort((a, b) => b.priority - a.priority || a.source.id.localeCompare(b.source.id)).slice(0, maxCandidates);
    const errors = [], evidence = [];
    const verifiedVectors = new Set();
    const resolver = config.resolveBody || sourceResolver;
    const queue = [...candidates];
    await Promise.all(Array.from({length: Math.min(4, queue.length)}, async () => {
      while (queue.length) {
        const row = queue.shift();
        let projection;
        try { projection = await project(row.source.id, resolver); }
        catch (error) { errors.push({sourceId: row.source.id, error: error.message}); continue; }
        const textRank = row.metadata + lexical(tokens, projection.text);
        const vr = vectorRank.get(row.source.id);
        const semantic = vr?.hash === projection.contentHash ? vr.score : 0;
        if (vr?.hash === projection.contentHash) verifiedVectors.add(row.source.id);
        const relation = graphRank.get(row.source.id) || 0;
        const score = textRank + 5 * semantic + 3 * relation;
        if (score <= 0) continue;
        evidence.push({id: row.source.id, title: row.source.title, kind: row.source.kind,
          text: excerpt(projection.text, tokens, 5000), excerpt: excerpt(projection.text, tokens, 350),
          citation: citation(row.source, projection.contentHash), score,
          scores: {lexical: textRank, vector: semantic, graph: relation}});
      }
    }));
    const results = evidence.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
    const status = {
      mode: queryVector && verifiedVectors.size ? 'lexical+graph+vector' : 'lexical+graph',
      embeddings: !queryVector ? 'No query embedding supplied; vector retrieval is inactive.'
        : !verifiedVectors.size ? 'No compatible source embeddings available for the resolved evidence; using lexical and explicit graph retrieval.'
        : `${verifiedVectors.size} compatible source embeddings from ${config.embeddingModel} verified against resolved evidence.`,
      embeddingModel: queryVector ? config.embeddingModel : null,
      compatibleVectors: verifiedVectors.size, candidateVectors: compatibleVectors,
      incompatibleVectors, activeSources: all.length, candidates: candidates.length,
      partial: candidates.length < all.length || errors.length > 0,
      scope: 'Mounted source metadata and bounded disposable text/vector projections.',
      errors,
    };
    return {query, results, status};
  }
  function saveNote(value) {
    const sourceId = string(value.sourceId, 'note source id');
    if (!getSource(sourceId)) throw new Error('Unknown note source');
    const id = value.id || randomUUID();
    string(id, 'note id');
    if (typeof value.text !== 'string' || value.text.length > 100000) throw new Error('Invalid note text');
    const anchor = value.anchor ?? null;
    if (JSON.stringify(anchor).length > 16384) throw new Error('Note anchor is too large');
    const old = db.prepare('SELECT * FROM mesh_notes WHERE id=?').get(id);
    if (old && old.source_id !== sourceId) throw new Error('A note cannot silently move to a different source edition');
    const now = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO mesh_notes VALUES(?,?,?,?,?,?)')
      .run(id, sourceId, value.text, JSON.stringify(anchor), old?.created || now, now);
    return listNotes({sourceId}).find(n => n.id === id);
  }
  function listNotes({sourceId} = {}) {
    const active = new Set(listSources().map(s => s.id));
    const rows = sourceId ? db.prepare('SELECT * FROM mesh_notes WHERE source_id=? ORDER BY updated DESC').all(sourceId)
      : db.prepare('SELECT * FROM mesh_notes ORDER BY updated DESC').all();
    return rows.map(row => ({id: row.id, sourceId: row.source_id, text: row.text, anchor: parse(row.anchor),
      created: row.created, updated: row.updated, sourceActive: active.has(row.source_id), citation: citation(getSource(row.source_id))}));
  }
  function stats() {
    const active = listSources();
    const activeIds = new Set(active.map(s => s.id));
    const embeddings = db.prepare('SELECT source_id, model, dimensions FROM mesh_embeddings').all();
    return {
      sources: db.prepare('SELECT COUNT(*) AS n FROM mesh_sources WHERE tombstone=0').get().n,
      activeSources: active.length,
      layers: db.prepare('SELECT COUNT(*) AS n FROM mesh_layers').get().n,
      notes: db.prepare('SELECT COUNT(*) AS n FROM mesh_notes').get().n,
      assertedEdges: db.prepare('SELECT COUNT(*) AS n FROM mesh_edges').get().n,
      projectionCache: {...count('mesh_projections'), budgetBytes: projectionBytes, disposable: true},
      vectorCache: {...count('mesh_embeddings'), budgetBytes: vectorBytes, disposable: true,
        activeCount: embeddings.filter(e => activeIds.has(e.source_id)).length,
        models: [...new Set(embeddings.map(e => e.model))]},
      durableContent: 'Source references, explicit links/assertions and user notes; no permanent source-body copy.',
    };
  }
  return {
    root, putSource, getSource, listSources, registerLayer, getLayer: layer,
    listLayers: () => db.prepare('SELECT id FROM mesh_layers ORDER BY precedence DESC, sequence DESC').all().map(r => layer(r.id)),
    setLayerEnabled(id, enabled) {
      if (!layer(id)) throw new Error('Unknown layer');
      db.prepare('UPDATE mesh_layers SET enabled=? WHERE id=?').run(enabled ? 1 : 0, id);
      return layer(id);
    },
    tombstone(value) {
      const target = layer(value.layerId);
      if (!target) throw new Error('Register the tombstone layer first');
      return putSource({...value, corpusId: target.corpusId, assetId: value.assetId || target.id,
        edition: value.edition || target.id, kind: 'tombstone', title: value.title || value.key,
        contentHash: null, links: [], tombstone: true});
    },
    setResolver(resolveBody) {
      if (typeof resolveBody !== 'function') throw new Error('Resolver must be a function');
      sourceResolver = resolveBody;
    },
    project, setEmbedding, addEdge, graph, search, saveNote, listNotes,
    deleteNote(id) { return db.prepare('DELETE FROM mesh_notes WHERE id=?').run(id).changes > 0; },
    stats,
    setCacheBudgets(value) {
      const nextProjection = budget(value.projectionBytes, projectionBytes);
      const nextVector = budget(value.vectorBytes, vectorBytes);
      const shrinking = nextProjection < projectionBytes || nextVector < vectorBytes;
      projectionBytes = nextProjection; vectorBytes = nextVector;
      prune('mesh_projections', projectionBytes); prune('mesh_embeddings', vectorBytes);
      if (shrinking) reclaimCacheSpace();
      return stats();
    },
    clearCaches() {
      db.exec('DELETE FROM mesh_projections; DELETE FROM mesh_embeddings;');
      reclaimCacheSpace();
      return stats();
    },
    close() { db.close(); },
  };
}
