import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openZim, ZIM_LIMITS} from '../zim.mjs';
import {generateUncompressedZim} from '../dyndon-zim.mjs';

const fixture = name => fileURLToPath(new URL(`../native/fixtures/${name}`, import.meta.url));
const v6 = fixture('openzim-v6-small.zim');
async function temporary(t, bytes) {
  const directory = await mkdtemp(join(tmpdir(), 'enzime-zim-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const file = join(directory, 'archive.zim'); await writeFile(file, bytes); return file;
}
async function mounted(t, path) { const reader = await openZim(path); t.after(() => reader.close()); return reader; }

for (const [name, version, main] of [
  ['openzim-v5-small.zim', '5.0', 'A/main.html'],
  ['openzim-v6-small.zim', '6.1', 'C/main.html'],
  ['openzim-v6.3-small.zim', '6.3', 'C/main.html'],
]) test(`official OpenZIM ${version}: mount, HTML, binary asset, directory and checksum`, async t => {
  const path = fixture(name), original = await readFile(path), reader = await mounted(t, path);
  assert.equal(reader.metadata().version, version);
  assert.equal(reader.metadata().mainPage, main);
  assert.equal(reader.metadata().checksumStatus, 'not-checked');
  assert.equal(reader.metadata().articleCount, null, 'directory entry count is not a claimed article count');
  const list = await reader.list();
  assert.deepEqual(list.map(x => x.key), [main]);
  assert.equal(list.complete, true);
  const article = await reader.read(main);
  assert.equal(article.mime, 'text/html');
  assert.match(article.bytes.toString(), /<title>Test ZIM file<\/title>/);
  assert.equal(article.bytes.length, 207);
  const assetKey = version === '5.0' ? 'I/favicon.png' : 'C/favicon.png';
  const asset = await reader.read(assetKey);
  assert.equal(asset.mime, 'image/png');
  assert.deepEqual(asset.bytes.subarray(0, 8), Buffer.from([137,80,78,71,13,10,26,10]));
  const checked = await reader.verify();
  assert.equal(checked.valid, true);
  assert.equal(reader.metadata().checksumStatus, 'verified');
  assert.deepEqual(await readFile(path), original, 'mount/read/verify preserve source bytes');
});

test('main-page redirects return the actual target key and preserve requested identity', async t => {
  const reader = await mounted(t, v6), result = await reader.read('W/mainPage');
  assert.equal(result.requestedKey, 'W/mainPage'); assert.equal(result.key, 'C/main.html');
  assert.equal(result.mime, 'text/html');
  assert.deepEqual(result.bytes, (await reader.read('C/main.html')).bytes);
});

test('directory cursor pagination and case-insensitive title queries keep binary assets separate', async t => {
  const reader = await mounted(t, v6);
  const page = await reader.list({limit: 1, query: 'TEST ZIM'});
  assert.equal(page.length, 1); assert.equal(page[0].key, 'C/main.html');
  assert.equal(page.nextOffset, 2); assert.equal(page.complete, false);
  const rest = await reader.list({offset: page.nextOffset, query: 'TEST ZIM'});
  assert.equal(rest.length, 0); assert.equal(rest.complete, true);
  const assets = await reader.list({includeAssets: true});
  assert.equal(assets.length, reader.metadata().entryCount);
  await assert.rejects(reader.list({offset: -1}), /offset/);
  await assert.rejects(reader.list({limit: 201}), /limit/);
  await assert.rejects(reader.list({query: {}}), /query/);
});

test('absent and malformed keys fail explicitly, operations survive rejection and close is idempotent', async t => {
  const reader = await mounted(t, v6);
  await assert.rejects(reader.read('C/no-such-article'), {code: 'ZIM_NOT_FOUND'});
  await assert.rejects(reader.read('main.html'), {code: 'ZIM_BAD_KEY'});
  await assert.rejects(reader.read('C/main.html\0'), {code: 'ZIM_BAD_KEY'});
  assert.equal((await reader.read('C/main.html')).bytes.length, 207);
  await reader.close(); await reader.close();
  await assert.rejects(reader.read('C/main.html'), {code: 'ZIM_CLOSED'});
});

test('cache use stays under byte budgets and returned bytes cannot mutate cached source content', async t => {
  const reader = await mounted(t, v6);
  const all = await Promise.all(Array.from({length: 12}, () => reader.read('C/main.html')));
  const expected = Buffer.from(all[0].bytes); all[0].bytes.fill(0);
  assert.deepEqual((await reader.read('C/main.html')).bytes, expected);
  const stats = reader.cacheStats();
  assert(stats.clusterBytes <= ZIM_LIMITS.cacheBytes);
  assert(stats.directoryBytes <= ZIM_LIMITS.directoryCacheBytes);
  assert(stats.pointerBytes <= 1024 * 1024);
});

test('original wiki-mini.zim is a malformed legacy development fixture, not evidence of real compatibility', async () => {
  const path = fileURLToPath(new URL('../native/fixtures/legacy-invalid-wiki-mini.zim', import.meta.url));
  assert.equal((await readFile(path)).length, 605);
  await assert.rejects(openZim(path), /magic number/);
});

for (const [name, mutate, message] of [
  ['unsafe header pointer', b => b.writeBigUInt64LE(2n ** 63n, 32), /safe file addressing/],
  ['out of file pointer table', b => b.writeBigUInt64LE(BigInt(b.length), 48), /pointer table/],
  ['impossible entry count', b => b.writeUInt32LE(0xffffffff, 24), /pointer table/],
  ['wrong checksum position', b => b.writeBigUInt64LE(0n, 72), /checksum position/],
  ['invalid MIME table', b => b.writeBigUInt64LE(0n, 56), /MIME table position/],
  ['directory offset at EOF', b => {const p=Number(b.readBigUInt64LE(32));b.writeBigUInt64LE(BigInt(b.length),p);}, /content area/],
  ['redirect cycle', b => {const p=Number(b.readBigUInt64LE(32)), index=b.readUInt32LE(64), at=Number(b.readBigUInt64LE(p+index*8));b.writeUInt32LE(index,at+8);}, /redirect cycle/],
]) test(`hostile archive rejects ${name}`, async t => {
  const data = await readFile(v6); mutate(data); const path = await temporary(t, data);
  await assert.rejects(openZim(path), message);
});

test('truncated header and changed checksum fail without false success', async t => {
  await assert.rejects(openZim(await temporary(t, Buffer.alloc(79))), /smaller than/);
  const data = await readFile(v6); data[8] ^= 1;
  const reader = await mounted(t, await temporary(t, data));
  await assert.rejects(reader.verify(), {code: 'ZIM_CHECKSUM'});
  assert.equal(reader.metadata().checksumStatus, 'failed');
});

test('blob offset bounds are checked before returning binary data', async t => {
  const data = await readFile(v6), urlTable = Number(data.readBigUInt64LE(32));
  const firstEntry = Number(data.readBigUInt64LE(urlTable));
  const clusterIndex = data.readUInt32LE(firstEntry + 8), blobIndex = data.readUInt32LE(firstEntry + 12);
  const clusterTable = Number(data.readBigUInt64LE(48)), cluster = Number(data.readBigUInt64LE(clusterTable + clusterIndex * 8));
  assert.equal(data[cluster], 1, 'asset fixture uses a real uncompressed cluster');
  data.writeUInt32LE(0xffffffff, cluster + 1 + (blobIndex + 1) * 4);
  const reader = await mounted(t, await temporary(t, data));
  await assert.rejects(reader.read('C/favicon.png'), /blob offsets/);
});

test('DynDon generated edition roundtrips UTF-8 paths and binary assets through the same mounted reader', async t => {
  const image = Buffer.from([0, 255, 17, 84, 0, 32]);
  const data = generateUncompressedZim([
    {key: 'C/électricité', title: 'Électricité', html: '<h1>Électricité</h1><p>Câblage sûr.</p>'},
    {key: 'C/manual/Water', title: 'Water', text: 'Source-bound field notes'},
    {key: 'C/assets/image.bin', title: 'Image bytes', mime: 'application/octet-stream', bytes: image},
  ], {title: 'Preparedness sources', language: 'fra'});
  const reader = await mounted(t, await temporary(t, data));
  assert.equal(reader.metadata().title, 'Preparedness sources');
  assert.equal(reader.metadata().language, 'fra');
  const pages = await reader.list();
  assert.deepEqual(pages.map(x => x.key).sort(), ['C/manual/Water', 'C/électricité'].sort());
  assert.match((await reader.read('C/électricité')).bytes.toString(), /Câblage sûr/);
  assert.deepEqual((await reader.read('C/assets/image.bin')).bytes, image);
  assert.equal((await reader.verify()).valid, true);
});
