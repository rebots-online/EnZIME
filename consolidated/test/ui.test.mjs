import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
import { build } from 'esbuild';
import { createApp } from '../server.mjs';
import { generateUncompressedZim } from '../dyndon-zim.mjs';

// These are DOM/API integration tests, not browser, canvas, PDF or screenshot
// verification. The real application is bundled in memory and runs in an
// isolated JSDOM realm against a real local EnZIME HTTP service. Only model
// advertisement is a protocol fixture; no LLM generation is represented here.
test('application DOM integrates reader, citations, notes, creator, downloads and model settings with the local API', { timeout: 40_000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'enzime-ui-'));
  const modelCalls = [];
  const app = await createApp({ root, runtimeOptions: { binary: '' }, chatbotOptions: {
    fetchImpl: async (url, options = {}) => {
      modelCalls.push({ url, method: options.method || 'GET' });
      if (url.endsWith('/models')) return Response.json({ data: [
        { id: 'protocol-Bonsai-27B-1bit', owned_by: 'test-fixture' },
        { id: 'protocol-LFM2.5', owned_by: 'test-fixture' },
      ] });
      throw Error(`Unexpected model-fixture route: ${url}`);
    },
  } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../public/app.mjs', import.meta.url))],
    bundle: true, write: false, format: 'esm', target: 'es2022', external: ['/vendor/*'],
  });
  const code = bundle.outputFiles[0].text;
  const nativeFetch = globalThis.fetch;
  const problems = [], network = [], inFlight = new Set();
  let dom;
  const unhandled = error => problems.push(`Unhandled promise: ${error?.stack || error}`);
  process.on('unhandledRejection', unhandled);
  t.after(async () => {
    await Promise.allSettled([...inFlight]);
    dom?.window.close();
    await app.close();
    await rm(root, { recursive: true, force: true });
    process.off('unhandledRejection', unhandled);
  });

  async function json(route, body) {
    const response = await nativeFetch(base + route, body === undefined ? {} : {
      method: 'POST', headers: { 'X-MBA-Client': 'enzime', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const value = await response.json();
    assert.ok(response.ok, `${route}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  async function upload(bytes, kind, name) {
    const response = await nativeFetch(`${base}/api/assets?kind=${kind}&name=${encodeURIComponent(name)}`, {
      method: 'POST', headers: { 'X-MBA-Client': 'enzime' }, body: bytes,
    });
    const value = await response.json();
    assert.equal(response.status, 201, JSON.stringify(value));
    return value;
  }
  const byId = id => dom.window.document.getElementById(id);
  function assertHealthy() {
    assert.deepEqual(problems, [], 'Unexpected DOM, HTTP or promise error');
    assert.equal(byId('status').classList.contains('error'), false, byId('status').textContent);
  }
  async function waitFor(predicate, description, timeout = 6_000) {
    const deadline = Date.now() + timeout;
    do {
      assertHealthy();
      if (await predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 15));
    } while (Date.now() < deadline);
    assert.fail(`Timed out waiting for ${description}; status: ${byId('status').textContent}`);
  }
  async function settle() {
    for (let i = 0; i < 3; i++) { await Promise.allSettled([...inFlight]); await new Promise(resolve => setTimeout(resolve, 10)); }
    assertHealthy();
  }
  async function boot() {
    await Promise.allSettled([...inFlight]);
    dom?.window.close();
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', error => problems.push(`JSDOM: ${error.message}`));
    virtualConsole.on('error', (...args) => problems.push(`Console: ${args.join(' ')}`));
    dom = new JSDOM(html, { url: base + '/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
    dom.window.addEventListener('error', event => problems.push(`Window: ${event.message}`));
    dom.window.addEventListener('unhandledrejection', event => problems.push(`Window promise: ${event.reason}`));
    dom.window.fetch = (input, options = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, base);
      assert.equal(url.origin, base, 'The UI should only contact its local broker');
      const operation = (async () => {
        const response = await nativeFetch(url, options);
        network.push({ pathname: url.pathname, method: options.method || 'GET', status: response.status });
        if (!response.ok) problems.push(`HTTP ${response.status} ${url.pathname}: ${await response.clone().text()}`);
        return response;
      })();
      inFlight.add(operation);
      operation.then(() => inFlight.delete(operation), () => inFlight.delete(operation));
      return operation;
    };
    // The entry has no exports. Wrapping its freshly bundled module body keeps
    // top-level await and lexical state inside this DOM's own JavaScript realm.
    await dom.window.eval(`(async () => {\n${code}\n})()`);
    assertHealthy();
  }
  function submit(id) {
    const event = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    const uncancelled = byId(id).dispatchEvent(event);
    assert.equal(uncancelled, false, `${id} must cancel native form submission synchronously`);
  }
  function openCard(name) {
    const card = [...dom.window.document.querySelectorAll('.work-card')].find(card => card.querySelector('h3')?.textContent === name);
    assert.ok(card, `Library card exists: ${name}`);
    card.querySelector('button').click();
  }
  const parsedArticle = () => new dom.window.DOMParser().parseFromString(byId('reading').querySelector('iframe').srcdoc, 'text/html');

  await t.test('boot and fresh DOM reload display library objects seeded through the actual import API', async () => {
    await boot();
    assert.equal(byId('library-count').textContent, '0 works');
    assert.equal(byId('library-empty').hidden, false);
    assert.equal(dom.window.document.documentElement.dataset.theme, 'dark');
    assert.equal(byId('ai-state').textContent, 'Not connected');
    assert.equal(modelCalls.length, 0, 'Boot does not require a model or external service');
  });

  const articleMarkup = '<h1>Water storage</h1><p>Water storage inspection records belong beside the field notebook.</p>' +
    '<a href="02-soil">Soil records</a><a href="/C/02-soil">Root source link</a><a href="https://example.invalid/reference">External reference</a>' +
    '<img src="image.svg" onerror="window.compromised=true"><img src="https://example.invalid/tracker.png">' +
    '<script>window.compromised=true</script><form action="https://example.invalid"><input value="secret"></form>';
  const zim = await upload(generateUncompressedZim([
    { key: 'C/01-water', title: 'Water storage', html: articleMarkup },
    { key: 'C/02-soil', title: 'Soil records', html: '<h1>Soil records</h1><p>Soil observations link back to the water storage notebook.</p><a href="01-water">Water storage</a>' },
    { key: 'C/image.svg', title: 'Diagram', mime: 'image/svg+xml', text: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5"/></svg>' },
  ], { title: 'DOM field archive', date: '2026-09-11' }), 'zim', 'DOM field archive.zim');
  const notebook = await upload('Water inspection notebook: preserve the inspection date and source edition.', 'final', 'Inspection notebook.txt');

  await t.test('opening a real ZIM wires entries, immutable source identity and sanitized archive HTML', async () => {
    await boot();
    assert.equal(byId('library-count').textContent, '2 works');
    assert.equal(byId('library-empty').hidden, true);
    openCard('DOM field archive.zim');
    await waitFor(() => byId('status').textContent === 'Opened DOM field archive.zim', 'ZIM open completion');
    assert.equal(byId('view-reader').classList.contains('active'), true);
    assert.equal(byId('work-title').textContent, 'Water storage');
    const frame = byId('reading').querySelector('iframe');
    assert.ok(frame, 'Archive content is isolated in an iframe');
    assert.equal(frame.getAttribute('sandbox'), 'allow-same-origin');
    const article = parsedArticle();
    assert.match(article.body.textContent, /Water storage inspection records/);
    assert.equal(article.querySelectorAll('script,form,input,[onerror]').length, 0);
    assert.equal(article.querySelector('a').getAttribute('href'), `/api/resources/${zim.id}/C/02-soil`);
    const rootLink = [...article.querySelectorAll('a')].find(a => a.textContent === 'Root source link');
    assert.equal(rootLink.getAttribute('href'), `/api/resources/${zim.id}/C/02-soil`);
    assert.equal(article.querySelector('img').getAttribute('src'), `/api/resources/${zim.id}/C/image.svg`);
    assert.equal(article.querySelectorAll('img')[1].hasAttribute('src'), false);
    assert.equal(article.querySelector('[data-external]').getAttribute('href'), '#external');
    assert.match(article.querySelector('meta[http-equiv="Content-Security-Policy"]').content, /script-src 'none'/);
    assert.match(byId('source-status').textContent, new RegExp(zim.id.slice(0, 10)));
    assert.ok([...byId('entry-list').querySelectorAll('button')].some(button => button.textContent === 'Soil records'));
    const soil = [...byId('entry-list').querySelectorAll('button')].find(button => button.textContent === 'Soil records');
    soil.click();
    await waitFor(() => byId('work-title').textContent === 'Soil records', 'contents navigation');
    await settle();
    assert.match(parsedArticle().body.textContent, /Soil observations/);
  });

  await t.test('global search presents source editions and its citation action reopens the referenced work', async () => {
    byId('search').value = 'water storage';
    submit('search-form');
    await waitFor(() => byId('search-status').textContent.includes('passages ·'), 'cross-source search results');
    const results = [...byId('search-results').querySelectorAll('.search-hit')];
    assert.ok(results.length >= 2);
    const hit = results.find(result => result.querySelector('h3').textContent === 'Water storage');
    assert.ok(hit, 'Real ZIM passage is represented in the search UI');
    assert.match(hit.querySelector('.eyebrow').textContent, new RegExp(zim.id.slice(0, 10)));
    assert.match(hit.querySelector('p').textContent, /Water storage inspection/);
    hit.querySelector('button').click();
    await waitFor(() => byId('view-reader').classList.contains('active') && byId('work-title').textContent === 'Water storage', 'source citation navigation');
    await settle();
    assert.match(parsedArticle().body.textContent, /Water storage inspection/);
  });

  await t.test('a submitted annotation preserves its source locator and survives a fresh app DOM', async () => {
    byId('note-text').value = 'Check the water record against my actual stored containers.';
    submit('note-form');
    await waitFor(() => byId('status').textContent === 'Note saved independently of the original.', 'annotation save');
    const notes = await json(`/api/annotations?assetId=${zim.id}`);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].locator.key, 'C/01-water');
    assert.equal(typeof notes[0].locator.sourceId, 'string');
    assert.match(byId('notes-list').textContent, /actual stored containers/);
    assert.equal(byId('note-text').value, '');
    await boot();
    openCard('DOM field archive.zim');
    await waitFor(() => byId('status').textContent === 'Opened DOM field archive.zim', 'source reopen after reload');
    assert.match(byId('notes-list').textContent, /actual stored containers/);
    assert.equal(byId('work-title').textContent, 'Water storage', 'Saved reading key survives reload');
  });

  await t.test('creator saves a draft, finalizes its text and generates a reopenable nonempty ZIM', async () => {
    dom.window.document.querySelector('[data-view="create"]').click();
    await settle();
    byId('new-draft').click();
    byId('draft-title').value = 'Preparedness field notebook';
    byId('draft-body').value = 'Water storage observations: record dates, sources, and local conditions.';
    submit('draft-form');
    await waitFor(() => byId('draft-status').textContent === 'Draft saved', 'private draft save');
    await settle();
    assert.ok([...byId('draft-list').querySelectorAll('button')].some(button => button.textContent === 'Preparedness field notebook'));
    const drafts = await json('/api/drafts');
    assert.equal(drafts.find(draft => draft.title === 'Preparedness field notebook').body, byId('draft-body').value);
    byId('finalize-draft').click();
    await waitFor(() => byId('draft-status').textContent === 'Finalized', 'final revision');
    await settle();
    const final = (await json('/api/assets')).find(asset => asset.kind === 'final' && asset.id !== notebook.id);
    assert.ok(final, 'Finalized text appears as a library work');
    assert.equal((await json(`/api/assets/${final.id}/read`)).text, byId('draft-body').value);
    const priorZims = new Set((await json('/api/assets')).filter(asset => asset.kind === 'zim').map(asset => asset.id));
    byId('export-zim').click();
    await waitFor(() => byId('status').textContent.startsWith('ZIM generation complete.'), 'creator ZIM generation');
    const generated = (await json('/api/assets')).find(asset => asset.kind === 'zim' && !priorZims.has(asset.id));
    assert.ok(generated, 'The created ZIM is adopted by the library');
    const expectedText = byId('draft-body').value;
    openCard(generated.name);
    await waitFor(() => byId('status').textContent === `Opened ${generated.name}`, 'opening generated ZIM');
    assert.equal(byId('work-title').textContent, 'Preparedness field notebook');
    const generatedFrame = byId('reading').querySelector('iframe');
    const displayedText = generatedFrame ? parsedArticle().body.textContent : byId('reading').textContent;
    assert.match(displayedText, /Water storage observations/);
    assert.equal((await json(`/api/assets/${generated.id}/read`)).text, expectedText);
  });

  await t.test('model discovery maps broker advertisements, defaults to LFM2.5 and persists size-up selection', async () => {
    dom.window.document.querySelector('[data-view="settings"]').click();
    await settle();
    byId('endpoint').value = 'http://127.0.0.1:8080/v1';
    submit('model-form');
    await waitFor(() => byId('status').textContent === 'Local model connection checked.', 'model discovery');
    assert.deepEqual([...byId('model-select').options].map(option => option.value), ['protocol-Bonsai-27B-1bit', 'protocol-LFM2.5']);
    assert.equal(byId('model-select').value, 'protocol-LFM2.5');
    assert.equal(byId('chat-model-label').textContent, 'protocol-LFM2.5');
    assert.equal(byId('ai-state').textContent, 'Connected');
    assert.match(byId('kv-status').textContent, /not verified|unverified|unsupported|unknown|not-advertised/);
    byId('model-select').value = 'protocol-Bonsai-27B-1bit';
    byId('model-select').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await waitFor(() => byId('chat-model-label').textContent === 'protocol-Bonsai-27B-1bit', 'larger model choice');
    assert.equal((await json('/api/config')).settings.model, 'protocol-Bonsai-27B-1bit');
    await boot();
    assert.equal(byId('model-select').value, 'protocol-Bonsai-27B-1bit');
    assert.ok(modelCalls.length >= 2);
    assert.ok(modelCalls.every(call => call.url.endsWith('/models')), 'No actual LLM inference was claimed or attempted');
  });

  await t.test('download controls show real byte progress, pause retained bytes, resume ranges and adopt the completed archive', async st => {
    const bytes = generateUncompressedZim([{ key: 'C/Field', title: 'Downloaded field reference',
      html: '<h1>Downloaded field reference</h1><p>This offline reference arrived through the resumable transfer.</p>' +
        '<!--' + 'fixture padding '.repeat(6000) + '-->',
    }], { title: 'Slow field edition', date: '2026-09-11' });
    const initialBytes = 16_384, resumedBytes = 8_192;
    const rangeRequests = [];
    let finishResume;
    // Each response deliberately stops after a known chunk. This lets the UI's
    // regular polling expose real progress before Pause, and again after Resume.
    const upstream = createServer((request, response) => {
      const range = request.headers.range || null;
      rangeRequests.push(range);
      const offset = range ? Number(range.match(/^bytes=(\d+)-$/)?.[1]) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset >= bytes.length) { response.writeHead(416); response.end(); return; }
      response.writeHead(offset ? 206 : 200, { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length - offset,
        ETag: '"slow-field-edition"', ...(offset ? { 'Content-Range': `bytes ${offset}-${bytes.length - 1}/${bytes.length}` } : {}),
      });
      if (!offset) response.write(bytes.subarray(0, initialBytes));
      else {
        response.write(bytes.subarray(offset, offset + resumedBytes));
        finishResume = () => response.end(bytes.subarray(offset + resumedBytes));
      }
    });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    st.after(async () => {
      upstream.closeAllConnections();
      await new Promise(resolve => upstream.close(resolve));
    });
    const digest = createHash('sha256').update(bytes).digest('hex');
    dom.window.document.querySelector('[data-view="downloads"]').click();
    await settle();
    byId('download-title').value = 'Slow field edition';
    byId('download-url').value = `http://127.0.0.1:${upstream.address().port}/field.zim`;
    byId('download-size').value = String(bytes.length);
    byId('download-hash').value = digest;
    byId('plan-download').click();
    await waitFor(() => byId('status').textContent === 'Coverage preview is ready.', 'download coverage preview');
    assert.equal(byId('install-plan').disabled, false);
    const beforePolling = network.filter(call => call.pathname === '/api/downloads').length;
    const jobCard = () => [...byId('download-jobs').querySelectorAll('.note-card')]
      .find(card => card.querySelector('strong')?.textContent.startsWith('local-selection ·'));
    byId('install-plan').click();
    await waitFor(() => jobCard()?.querySelector('button')?.textContent === 'Pause' && jobCard().querySelector('progress')?.value === initialBytes,
      'polled partial download bytes');
    assert.equal(jobCard().querySelector('progress').max, bytes.length);
    assert.match(jobCard().querySelector('p').textContent, /16\.0 KiB/);
    assert.ok(network.filter(call => call.pathname === '/api/downloads').length > beforePolling);
    assert.equal((await json('/api/assets')).some(asset => asset.id === digest), false, 'A partial archive is not presented as installed');
    jobCard().querySelector('button').click();
    await waitFor(() => jobCard()?.querySelector('strong')?.textContent.endsWith(' · paused') && jobCard().querySelector('button')?.textContent === 'Resume',
      'paused transfer with Resume action');
    assert.equal(jobCard().querySelector('progress').value, initialBytes, 'Pause preserves downloaded bytes');
    assert.match(byId('status').textContent, /Transfer paused; received bytes are retained/);
    jobCard().querySelector('button').click();
    await waitFor(() => jobCard()?.querySelector('button')?.textContent === 'Pause' && jobCard().querySelector('progress')?.value === initialBytes + resumedBytes,
      'polled resumed byte progress');
    assert.deepEqual(rangeRequests, [null, `bytes=${initialBytes}-`]);
    assert.equal(typeof finishResume, 'function');
    finishResume();
    await waitFor(() => jobCard()?.querySelector('strong')?.textContent.endsWith(' · complete') && jobCard().querySelector('progress')?.value === bytes.length,
      'automatically polled completion and adoption');
    await settle();
    assert.equal(jobCard().querySelector('button'), null, 'Completed transfers no longer offer Pause or Resume');
    const installed = (await json('/api/assets')).find(asset => asset.id === digest);
    assert.equal(installed.kind, 'zim');
    assert.equal(installed.storage, 'mounted');
    assert.ok([...byId('library-grid').querySelectorAll('h3')].some(title => title.textContent === 'Slow field edition'),
      'Completion refreshes the actual library without manually reloading it');
    assert.ok(network.some(call => call.pathname === '/api/dyndon/pause' && call.method === 'POST'));
    assert.ok(network.some(call => call.pathname === '/api/dyndon/resume' && call.method === 'POST'));
    openCard('Slow field edition');
    await waitFor(() => byId('status').textContent === 'Opened Slow field edition', 'opening the adopted download');
    assert.match(parsedArticle().body.textContent, /arrived through the resumable transfer/);
  });

  await settle();
  assert.ok(network.some(call => call.pathname === '/api/search' && call.method === 'POST'));
  assert.ok(network.some(call => call.pathname === '/api/dyndon/generate' && call.method === 'POST'));
  assertHealthy();
});
