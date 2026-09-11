import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import {openKnowledge, hashText} from '../knowledge.mjs';

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'enzime-mesh-'));
  const service = await openKnowledge(root, options);
  t.after(() => { service.close(); return rm(root, {recursive: true, force: true}); });
  return {root, service};
}
function source(id, text, overrides = {}) {
  return {id, assetId: `asset-${id}`, edition: 'edition-1', key: id, title: id,
    kind: 'document', locator: {key: id}, contentHash: hashText(text), links: [], ...overrides};
}

test('retrieval combines source bodies across ZIM and PDF with navigable citations and honest vector status', async t => {
  const {service} = await fixture(t);
  const contents = {
    water: 'Water storage uses clean containers. Compare the field manual for treatment procedures.',
    manual: 'The manual describes water storage inspection and treatment precautions.',
    unrelated: 'Piano voicing depends on hammer shape and felt density.',
  };
  service.putSource(source('water', contents.water, {kind: 'zim', title: 'Water storage', links: [{sourceId: 'manual'}], locator: {key: 'A/Water_storage'}}));
  service.putSource(source('manual', contents.manual, {kind: 'pdf', title: 'Field manual', locator: {page: 7}}));
  service.putSource(source('unrelated', contents.unrelated));
  const result = await service.search('water storage', {resolveBody: async s => contents[s.id]});
  assert.deepEqual(new Set(result.results.map(r => r.id)), new Set(['water', 'manual']));
  assert.equal(result.status.mode, 'lexical+graph');
  assert.match(result.status.embeddings, /inactive/);
  const manual = result.results.find(r => r.id === 'manual');
  assert.equal(manual.citation.locator.page, 7);
  assert.equal(manual.citation.contentHash, hashText(contents.manual));
  assert.equal(manual.scores.vector, 0);
  assert.ok(manual.scores.graph > 0);
  assert.equal(service.graph().edges[0].kind, 'explicit');
  assert.equal(result.status.partial, false);
});

test('edition overlays and tombstones change the active view without losing historical annotations or reusing stale vectors', async t => {
  const {service} = await fixture(t);
  const original = 'Original water guidance.';
  const corrected = 'Corrected water guidance with amended sources.';
  service.registerLayer({id: 'base', corpusId: 'medical', precedence: 0});
  service.putSource(source('old', original, {key: 'water', corpusId: 'medical', layerId: 'base'}));
  service.setEmbedding('old', [1, 0], {model: 'embedding-A'});
  service.saveNote({sourceId: 'old', text: 'I annotated this exact edition.', anchor: {quote: 'Original water'}});
  service.registerLayer({id: 'correction', corpusId: 'medical', precedence: 10});
  service.putSource(source('new', corrected, {key: 'water', corpusId: 'medical', layerId: 'correction', edition: 'edition-2'}));
  assert.deepEqual(service.listSources().map(s => s.id), ['new']);
  assert.equal(service.listSources({active: false}).length, 2);
  assert.equal(service.listNotes()[0].sourceActive, false);
  assert.equal(service.listNotes()[0].citation.sourceId, 'old');
  const result = await service.search('water', {queryVector: [1, 0], embeddingModel: 'embedding-A', resolveBody: async () => corrected});
  assert.deepEqual(result.results.map(r => r.id), ['new']);
  assert.equal(result.results[0].scores.vector, 0);
  assert.match(result.status.embeddings, /No compatible source embeddings/);
  assert.equal(service.stats().vectorCache.activeCount, 0);
  service.registerLayer({id: 'deleted', corpusId: 'medical', precedence: 20});
  service.tombstone({layerId: 'deleted', key: 'water'});
  assert.equal(service.listSources().length, 0);
  service.setLayerEnabled('deleted', false);
  assert.deepEqual(service.listSources().map(s => s.id), ['new']);
  service.setLayerEnabled('correction', false);
  assert.deepEqual(service.listSources().map(s => s.id), ['old']);
  assert.equal(service.listNotes()[0].sourceActive, true);
});

test('bounded disposable caches evict least-recently-used entries and retain metadata and user notes', async t => {
  const {service, root} = await fixture(t, {projectionBytes: 12, vectorBytes: 16});
  const texts = {a: '123456', b: 'abcdef', c: 'UVWXYZ', huge: 'A'.repeat(10000)};
  for (const [id, text] of Object.entries(texts)) service.putSource(source(id, text));
  service.setResolver(async s => texts[s.id]);
  await service.project('a'); await service.project('b');
  await service.project('a'); // Touch a; b must be the oldest.
  await service.project('c');
  const inspect = new DatabaseSync(path.join(root, 'knowledge.sqlite'));
  try {
    assert.deepEqual(inspect.prepare('SELECT source_id FROM mesh_projections ORDER BY source_id').all().map(r => r.source_id), ['a', 'c']);
    await service.project('huge');
    assert.equal(inspect.prepare("SELECT COUNT(*) AS n FROM mesh_projections WHERE source_id='huge'").get().n, 0);
    for (const id of ['a', 'b', 'c']) service.setEmbedding(id, [1, 0], {model: 'same'});
    assert.equal(service.stats().vectorCache.count, 2);
    assert.equal(service.stats().vectorCache.bytes, 16);
    assert.ok(service.stats().projectionCache.bytes <= 12);
    service.saveNote({sourceId: 'a', text: 'Durable user content.'});
    service.addEdge('a', 'c', {kind: 'asserted', relation: 'clarifies'});
    const state = service.clearCaches();
    assert.equal(state.projectionCache.bytes, 0);
    assert.equal(state.vectorCache.bytes, 0);
    assert.equal(state.sources, 4);
    assert.equal(state.notes, 1);
    assert.equal(state.assertedEdges, 1);
    const persistedMetadata = inspect.prepare('SELECT metadata FROM mesh_sources').all().map(r => r.metadata).join('\n');
    assert.ok(!persistedMetadata.includes(texts.huge));
    assert.equal(service.listNotes()[0].text, 'Durable user content.');
  } finally { inspect.close(); }
});

test('vectors require a real supplied embedding, matching model and source fingerprint, and do not become graph assertions', async t => {
  const {service} = await fixture(t);
  const texts = {a: 'A passage about renewing soil.', b: 'A passage about keyboard touch.'};
  for (const [id, text] of Object.entries(texts)) service.putSource(source(id, text));
  service.setEmbedding('a', [0.9, 0.1], {model: 'actual-model'});
  service.setEmbedding('b', [0, 1], {model: 'actual-model'});
  assert.throws(() => service.setEmbedding('a', [1, 0], {model: 'actual-model', contentHash: hashText('different edition')}), /fingerprint/);
  assert.throws(() => service.setEmbedding('a', [0, 0], {model: 'actual-model'}), /nonzero/);
  assert.throws(() => service.addEdge('a', 'b', {kind: 'similarity'}), /not an asserted graph fact/);
  const result = await service.search('horticulture', {resolveBody: async s => texts[s.id], queryVector: [1, 0], embeddingModel: 'actual-model'});
  assert.equal(result.results[0].id, 'a');
  assert.ok(result.results[0].scores.vector > 0.9);
  assert.equal(result.status.mode, 'lexical+graph+vector');
  assert.equal(service.graph().edges.length, 0);
  const wrongModel = await service.search('horticulture', {queryVector: [1, 0], embeddingModel: 'different-model'});
  assert.equal(wrongModel.results.length, 0);
  assert.equal(wrongModel.status.mode, 'lexical+graph');
});

test('changed extracted bytes cannot inherit source citations or old embeddings', async t => {
  const {service} = await fixture(t);
  service.putSource(source('signed', 'Known source text.'));
  service.setEmbedding('signed', [1, 0], {model: 'embed'});
  const result = await service.search('source', {resolveBody: async () => 'Source silently changed.'});
  assert.equal(result.results.length, 0);
  assert.match(result.status.errors[0].error, /register a new edition/);
  assert.equal(result.status.partial, true);
  assert.equal(service.stats().vectorCache.count, 0);
  assert.throws(() => service.putSource(source('signed', 'Changed text.')), /immutable/);
});

test('unknown text hashes bind to verified projections and changed projections retire cached vectors', async t => {
  const {service} = await fixture(t, {projectionBytes: 100, vectorBytes: 100});
  service.putSource(source('lazy-zim', '', {contentHash: null, kind: 'zim'}));
  assert.throws(() => service.setEmbedding('lazy-zim', [1, 0], {model: 'embed', contentHash: hashText('first')}), /project unknown-hash sources first/);
  await service.project('lazy-zim', async () => 'first');
  service.setEmbedding('lazy-zim', [1, 0], {model: 'embed'});
  service.setCacheBudgets({projectionBytes: 0});
  await service.project('lazy-zim', async () => 'second');
  assert.equal(service.stats().vectorCache.count, 0);
  assert.equal(service.getSource('lazy-zim').contentHash, null);
});

test('overlay precedence and durable notes survive restart while cache budgets can shrink', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'enzime-mesh-restart-'));
  let service = await openKnowledge(root);
  t.after(() => { service.close(); return rm(root, {recursive: true, force: true}); });
  service.putSource(source('a', 'source body', {corpusId: 'corpus'}));
  service.saveNote({sourceId: 'a', text: 'My persistent note'});
  await service.project('a', async () => 'source body');
  service.close();
  service = await openKnowledge(root, {projectionBytes: 0, vectorBytes: 0});
  assert.equal(service.listSources().length, 1);
  assert.equal(service.listNotes()[0].text, 'My persistent note');
  assert.equal(service.stats().projectionCache.bytes, 0);
  const sourceReference = service.listSources()[0];
  assert.equal(Object.hasOwn(sourceReference, 'text'), false);
  assert.equal(Object.hasOwn(sourceReference, 'body'), false);
});
