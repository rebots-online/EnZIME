import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {transform} from 'esbuild';
import * as support from '../thinkspace-support.mjs';

const source = await readFile(new URL('../ThinkSpace.tsx', import.meta.url), 'utf8');
const {code} = await transform(source + '\nexport {ReaderView, ConnFields, embedUnified, chatStream};', {loader: 'tsx', jsx: 'automatic', format: 'cjs'});
const opts = {ontoKeys: ['entity', 'process', 'abstract', 'place', 'artifact', 'field'], relationKeys: ['is_a', 'part_of', 'causes', 'related', 'uses']};
const file = (text, name = 'graph.json') => ({name, size: Buffer.byteLength(text), text: async () => text});
const graphFile = value => file(JSON.stringify(value));
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? textOf(node.props?.children) : String(node);
function walk(node, predicate, out = []) {
  if (Array.isArray(node)) { for (const item of node) walk(item, predicate, out); }
  else if (node && typeof node === 'object') { if (predicate(node)) out.push(node); walk(node.props?.children, predicate, out); }
  return out;
}

// A hook/event harness runs the actual component handlers without a browser or new dependencies.
function harness({orientation} = {}) {
  const slots = [], listeners = new Map(), frames = new Map();
  let cursor = 0, effects = [], nextFrame = 0, tree, activeComponent;
  const react = {
    useState(initial) {const i = cursor++; if (!slots[i]) slots[i] = {kind: 'state', value: typeof initial === 'function' ? initial() : initial}; return [slots[i].value, value => {slots[i].value = typeof value === 'function' ? value(slots[i].value) : value;}];},
    useRef(initial) {const i = cursor++; if (!slots[i]) slots[i] = {kind: 'ref', value: {current: initial}}; return slots[i].value;},
    useCallback(fn) {cursor++; return fn;},
    useEffect(fn, deps) {const i = cursor++, prev = slots[i]; if (!prev || deps.some((v, j) => !Object.is(v, prev.deps[j]))) {effects.push(() => {prev?.cleanup?.(); slots[i].cleanup = fn();}); slots[i] = {kind: 'effect', deps};}},
  };
  const parameter = () => ({value: 0, ramps: [], cancelScheduledValues() {}, setValueAtTime(v) {this.value = v;}, linearRampToValueAtTime(v) {this.ramps.push(v); this.value = v;}});
  class AudioContext {
    currentTime = 0; destination = {};
    createGain() {return {gain: parameter(), connect() {}};}
    createBiquadFilter() {return {frequency: parameter(), connect() {}};}
    createOscillator() {return {frequency: parameter(), detune: parameter(), connect() {}, start() {}};}
    resume() {return Promise.resolve();}
  }
  const window = {
    AudioContext,
    addEventListener(name, fn) {if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn);},
    removeEventListener(name, fn) {listeners.get(name)?.delete(fn);},
  };
  const module = {exports: {}};
  const context = vm.createContext({module, exports: module.exports, performance, console, TextDecoder, TextEncoder, URL, setTimeout, clearTimeout,
    window, DeviceOrientationEvent: orientation, navigator: {get geolocation() {throw new Error('Location must never be requested.');}},
    requestAnimationFrame(fn) {frames.set(++nextFrame, fn); return nextFrame;}, cancelAnimationFrame(id) {frames.delete(id);},
    require(name) {if (name === 'react') return react; if (name === 'react/jsx-runtime') return {jsx: (type, props) => ({type, props}), jsxs: (type, props) => ({type, props}), Fragment: 'fragment'}; if (name === './thinkspace-support.mjs') return support; throw new Error('Unexpected dependency: ' + name);},
  });
  vm.runInContext(code, context);
  const api = {
    exports: module.exports, listeners, window,
    render(component = module.exports.default, props) {if (activeComponent !== component) {slots.length = 0; effects = []; activeComponent = component;} cursor = 0; tree = component(props); return tree;},
    flush() {const pending = effects; effects = []; for (const effect of pending) effect();},
    find(predicate) {return walk(tree, predicate)[0];},
    all(predicate) {return walk(tree, predicate);},
    button(label) {const result = api.find(n => n.type === 'button' && textOf(n) === label); assert.ok(result, 'Missing button ' + label); return result;},
    state(predicate) {return slots.find(s => s?.kind === 'state' && predicate(s.value));},
    refs() {return slots.filter(s => s?.kind === 'ref').map(s => s.value);},
    emit(name, event = {}) {for (const fn of [...listeners.get(name) || []]) fn(event);},
    frame() {const [id, fn] = frames.entries().next().value; frames.delete(id); fn();},
    data() {api.button('⊞ data').props.onClick(); api.render();},
    connection(kind, values) {
      const editor = api.find(n => n.type?.name === 'ConnFields' && n.props.kind === kind); assert.ok(editor);
      editor.props.setConn(c => ({...c, ...Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'Trust').map(([key, val]) => [kind + key, val]))})); api.render();
      if ('Trust' in values) {api.find(n => n.type?.name === 'ConnFields' && n.props.kind === kind).props.setConn(c => ({...c, [kind + 'Trust']: values.Trust})); api.render();}
    },
    async load(value) {const picker = api.find(n => n.type === 'input' && n.props.accept); assert.ok(picker); await picker.props.onChange({target: {files: [graphFile(value)]}}); api.render();},
    async ingest(files) {const picker = api.find(n => n.type === 'input' && n.props.webkitdirectory === ''); assert.ok(picker); await picker.props.onChange({target: {files}}); api.render();},
  };
  api.render();
  return api;
}

test('unknown and prototype-named relations normalize on every accepted graph shape', async () => {
  const graph = {nodes: [{id: 'a'}, {id: 'b', type: '__proto__'}], links: [{source: 'a', target: 'b', type: 'mentions'}, {source: 'b', target: 'a', rel: '__proto__'}]};
  for (const input of [graph, {graph}, {data: graph}]) {
    const result = await support.readGraphFile(graphFile(input), opts);
    assert.deepEqual(result.edges.map(e => e.rel), ['related', 'related']);
    assert.equal(result.nodes[1].onto, 'field');
  }
});

test('oversized JSON is rejected before reading or parsing', async () => {
  let reads = 0;
  await assert.rejects(support.readGraphFile({size: support.GRAPH_LIMITS.bytes + 1, text() {reads++; throw new Error('must not read');}}, opts), /byte limit/);
  assert.equal(reads, 0);
  await assert.rejects(support.boundedFileText({size: 1, text: async () => '\u20ac'}, 2), /byte limit/);
});

test('input node and edge counts are rejected before processing their malformed entries', async () => {
  await assert.rejects(support.readGraphFile(graphFile({nodes: Array(10001).fill(null)}), opts), /exceeds 10000 nodes/);
  await assert.rejects(support.readGraphFile(graphFile({nodes: [{}], edges: Array(40001).fill(null)}), opts), /40000 edges/);
});

test('empty graphs, malformed shapes and ambiguous node IDs are rejected', async () => {
  for (const input of [[], {nodes: []}, null, {}, {nodes: [null]}, {nodes: [{id: 'a'}, {id: 'a'}]}, {nodes: [{id: '__proto__'}]}, {nodes: [{id: ''}]}]) await assert.rejects(support.readGraphFile(graphFile(input), opts));
  await assert.rejects(support.readGraphFile(file('{'), opts), /Invalid JSON/);
});

test('visible node and edge bounds remain enforced when callers request a larger cap', async () => {
  const nodes = Array.from({length: 900}, (_, i) => ({id: 'n' + i}));
  const edges = Array.from({length: 10000}, (_, i) => ({from: 'n' + (i % 900), to: 'n' + ((i + 1) % 900), weight: 2}));
  const result = await support.readGraphFile(graphFile({nodes, edges}), {...opts, maxNodes: 100000});
  assert.equal(result.nodes.length, 800);
  assert.ok(result.edges.length <= 3200);
  assert.ok(result.edges.every(e => e.conf === 1));
});

test('imported node IDs reject every Object.prototype property name before graph replacement', async () => {
  const h = harness(); h.data();
  for (const id of Object.getOwnPropertyNames(Object.prototype)) {
    await assert.rejects(support.readGraphFile(graphFile({nodes: [{id}]}), opts), /Object\.prototype property name/, id);
    await h.load({nodes: [{id}]});
    assert.match(h.state(s => s && typeof s === 'object' && 'maxNodes' in s).value.err, /Object\.prototype property name/);
    assert.ok(h.refs().some(r => r.current?.nodes?.[0]?.id === 'entropy'), id);
  }
  const valid = await support.readGraphFile(graphFile({nodes: [{id: 'toString-guide'}]}), opts);
  assert.equal(valid.nodes[0].id, 'toString-guide');
});

test('embedding responses must be nonempty, finite, bounded and dimensionally consistent', () => {
  for (const vector of [[], [NaN], [Infinity], ['1'], Array(8193).fill(1)]) assert.throws(() => support.validateEmbedding(vector), /invalid/);
  assert.throws(() => support.validateEmbedding([1, 2], 3), /inconsistent/);
  assert.deepEqual(support.validateEmbedding([1, 2], 2), [1, 2]);
});

test('model endpoints preserve local services while rejecting dangerous or credential-bearing URLs', () => {
  assert.equal(support.modelEndpoint('192.168.0.41:11434').base, 'http://192.168.0.41:11434');
  assert.equal(support.modelEndpoint('https://models.example/v1/').base, 'https://models.example');
  assert.equal(support.modelEndpoint('http://[::1]:11434').loopback, true);
  for (const host of ['10.evil.example', '192.168.evil.example', '172.16.evil.example', '127.0.0.1.evil.example']) assert.throws(() => support.modelEndpoint('http://' + host), /require HTTPS/);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'https://user:secret@example.com', 'https://example.com/?key=secret', 'https://example.com/#secret', 'https://example.com/admin', 'http://example.com', 'http://127.0.0.1:22', 'https://example.com\\@evil.test']) assert.throws(() => support.modelEndpoint(url), undefined, url);
});

test('model requests cannot transmit before exact endpoint approval', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {requests++; return new Response('{}');});
  await assert.rejects(support.modelRequest('https://models.example', '/v1/models', {}, ''), /Approve this exact/);
  await assert.rejects(support.modelRequest('https://other.example', '/v1/models', {}, 'https://models.example'), /Approve this exact/);
  await assert.rejects(support.modelRequest('http://192.168.0.41:11434', '/v1/models', {}, 'http://192.168.0.41:11434', 'secret'), /Use HTTPS/);
  assert.equal(requests, 0);
});

test('approved model requests omit ambient credentials/referrers and reject redirects', async t => {
  let captured;
  t.mock.method(globalThis, 'fetch', async (...args) => {captured = args; return new Response('{}');});
  await support.modelRequest('localhost:11434', '/api/tags', {credentials: 'include', redirect: 'follow'}, 'http://localhost:11434');
  assert.equal(captured[0], 'http://localhost:11434/api/tags');
  assert.equal(captured[1].credentials, 'omit');
  assert.equal(captured[1].redirect, 'error');
  assert.equal(captured[1].referrerPolicy, 'no-referrer');
  await assert.rejects(support.modelRequest('localhost:11434', '/admin', {}, 'http://localhost:11434'), /Unsupported/);
});

test('changing a connection host, key or API mode revokes endpoint approval', () => {
  for (const field of ['Host', 'Key', 'OAI']) {
    const h = harness();
    let conn = {chatHost: 'https://models.example', chatTrust: 'https://models.example', chatKey: 'secret', chatOAI: true};
    h.render(h.exports.ConnFields, {kind: 'chat', conn, setConn: update => {conn = update(conn);}, models: []});
    const input = h.find(n => n.type === 'input' && (field === 'Host' ? n.props.value === conn.chatHost : field === 'Key' ? n.props.type === 'password' : n.props.type === 'checkbox' && n.props.checked === true));
    input.props.onChange({target: {value: 'changed', checked: false}});
    assert.equal(conn.chatTrust, '');
  }
});

test('failed embedding ingestion restores the chooser, preserves the graph and permits retry', async t => {
  const h = harness(); h.data();
  h.connection('embed', {Host: 'http://localhost:11434', Trust: 'http://localhost:11434'});
  t.mock.method(globalThis, 'fetch', async () => {throw new Error('Model offline');});
  await h.ingest([file('# Document\nUseful text', 'book.md')]);
  const ingest = h.state(s => s && typeof s === 'object' && 'thresh' in s).value;
  assert.equal(ingest.busy, false); assert.equal(ingest.open, true); assert.match(ingest.err, /Model offline.*choose the folder again/);
  assert.ok(h.refs().some(r => r.current?.nodes?.[0]?.id === 'entropy'));
  h.connection('embed', {Host: '', Trust: ''});
  await h.ingest([file('# Document\nUseful text', 'book.md')]);
  assert.equal(h.state(s => s && typeof s === 'object' && 'thresh' in s).value.busy, false);
  assert.ok(h.refs().some(r => r.current?.nodes?.[0]?.id === 'n0'));
});

test('HTTP failures and empty or nonfinite embedding responses recover ingestion without replacing the graph', async t => {
  for (const response of [new Response('{}', {status: 500}), new Response('{"embedding":[]}'), new Response('{"embedding":[1e309]}'), new Response('{"embedding":[null]}'), new Response('{}')]) {
    const h = harness(); h.data(); h.connection('embed', {Host: 'localhost:11434', Trust: 'http://localhost:11434'});
    t.mock.method(globalThis, 'fetch', async () => response);
    await h.ingest([file('text', 'book.md')]);
    assert.equal(h.state(s => s && typeof s === 'object' && 'thresh' in s).value.busy, false);
    assert.ok(h.find(n => n.props?.role === 'alert'));
    assert.ok(h.refs().some(r => r.current?.nodes?.[0]?.id === 'entropy'));
  }
});

test('folder limits reject excess documents before reading or transmitting content', async () => {
  const h = harness(); h.data(); let reads = 0;
  await h.ingest(Array.from({length: 129}, () => ({name: 'book.md', size: 1, text() {reads++; throw new Error('must not read');}})));
  assert.equal(reads, 0);
  assert.match(h.state(s => s && typeof s === 'object' && 'thresh' in s).value.err, /at most 128/);
});

test('both graph replacement paths reset stale journey, dive, drag and projectile state', async () => {
  for (const method of ['json', 'folder']) {
    const h = harness();
    h.state(s => Array.isArray(s) && s[0] === 'entropy').value = ['entropy', 'heat'];
    const arrays = h.refs().filter(r => Array.isArray(r.current));
    for (const ref of arrays) ref.current = [{mode: 'homing', target: 'entropy'}];
    const svg = h.find(n => n.type === 'svg' && n.props.onDoubleClick);
    svg.props.ref.current = {getBoundingClientRect: () => ({left: 0, top: 0, width: 760, height: 520})};
    svg.props.onDoubleClick({clientX: 624, clientY: 260}); h.render();
    h.data();
    if (method === 'json') await h.load({nodes: [{id: 'book'}]}); else await h.ingest([file('book', 'book.md')]);
    h.flush(); h.render(); h.button('411').props.onClick(); assert.doesNotThrow(() => h.render());
    const trail = h.state(s => Array.isArray(s) && s.length > 0).value;
    assert.deepEqual(Array.from(trail), [method === 'json' ? 'book' : 'n0']);
    assert.ok(arrays.every(r => r.current.length === 0));
    assert.equal(h.state(s => s === 'entropy'), undefined);
  }
});

test('empty graph rejection keeps spatial controls usable', async () => {
  const h = harness(); h.data(); await h.load([]);
  assert.match(h.state(s => s && typeof s === 'object' && 'maxNodes' in s).value.err, /no nodes/);
  const root = h.render(); root.props.onFocus(); h.render(); h.flush();
  const event = {key: 'e', target: {tagName: 'DIV'}, preventDefault() {}};
  assert.doesNotThrow(() => {h.emit('keydown', event); h.emit('keyup', event);});
  assert.ok(h.refs().some(r => Array.isArray(r.current) && r.current[0]?.mode === 'homing'));
});

test('mute then unmute restores the existing audio gain', () => {
  const h = harness(); h.flush(); h.emit('pointerdown');
  const audio = h.refs().find(r => r.current?.pad).current;
  h.button('\u266a on').props.onClick(); h.render(); assert.equal(audio.pad.gain.ramps.at(-1), 0);
  h.button('\u266a off').props.onClick(); h.render(); assert.equal(audio.pad.gain.ramps.at(-1), 0.5);
  assert.equal(h.refs().find(r => r.current?.pad).current.ctx, audio.ctx);
});

test('look-coast damping changes travel and the actual drag handler supplies angular velocity', () => {
  const nodes = [{p: [0, 0, 0]}];
  const camera = damping => {const c = {pos: [0, 0, -560], yaw: 0, pitch: 0, vYaw: 0.1, vPitch: 0.01}; for (let i = 0; i < 10; i++) support.coastLook(c, nodes, damping); return c;};
  assert.ok(camera(0.95).yaw > camera(0.7).yaw);
  const h = harness(); h.flush();
  const svg = h.find(n => n.type === 'svg' && n.props.onMouseDown);
  svg.props.ref.current = {getBoundingClientRect: () => ({left: 0, top: 0, width: 760, height: 520})};
  svg.props.onMouseDown({clientX: 5, clientY: 5}); svg.props.onMouseMove({clientX: 25, clientY: 15}); svg.props.onMouseUp();
  const cam = h.refs().find(r => r.current && typeof r.current === 'object' && 'vYaw' in r.current).current;
  assert.ok(cam.vYaw > 0); const yaw = cam.yaw; h.frame(); assert.ok(cam.yaw > yaw);
});

test('repulsion work stays linear in visible nodes at the 800-node limit', () => {
  let reads = 0;
  const nodes = Array.from({length: 800}, (_, i) => ({get p() {reads++; return [i * 2, i % 3, i % 7];}}));
  for (let i = 0; i < nodes.length; i++) assert.ok(support.repulsionForce(nodes, i, 9000).every(Number.isFinite));
  assert.ok(reads <= 800 * (support.GRAPH_LIMITS.repulsionSamples + 1));
});

test('Sky denial and unavailable orientation remain off without any location access', async () => {
  for (const orientation of [undefined, {requestPermission: async () => 'denied'}, {requestPermission: async () => {throw new Error('blocked');}}]) {
    const h = harness({orientation}); h.flush(); await h.button('\u2736 sky').props.onClick(); h.render(); h.flush();
    assert.equal(h.state(s => s && typeof s === 'object' && 'on' in s).value.on, false);
    assert.equal(h.listeners.get('deviceorientation')?.size || 0, 0);
    assert.match(textOf(h.find(n => n.props?.role === 'status')), /Sky off/);
  }
});

test('Sky toggles install exactly one orientation listener and clean it up', async () => {
  const h = harness({orientation: {requestPermission: async () => 'granted'}}); h.flush();
  for (let i = 0; i < 2; i++) {
    await h.button('\u2736 sky').props.onClick(); h.render(); h.flush(); assert.equal(h.listeners.get('deviceorientation').size, 1);
    h.button('\u2736 sky').props.onClick(); h.render(); h.flush(); assert.equal(h.listeners.get('deviceorientation').size, 0);
  }
});

test('imported HTML is confined to a scriptless opaque iframe with resource restrictions', () => {
  const h = harness();
  const html = '<style>body{display:none}</style><svg onload=alert(1)></svg><script>parent.hacked=true</script>';
  h.render(h.exports.ReaderView, {nodes: [{id: 'a', title: 'Hostile HTML', onto: 'field', html}], edges: [], sel: 'a'});
  const frame = h.find(n => n.type === 'iframe');
  assert.equal(frame.props.sandbox, ''); assert.equal(frame.props.referrerPolicy, 'no-referrer');
  assert.match(frame.props.srcDoc, /script-src 'none'/); assert.match(frame.props.srcDoc, /default-src 'none'/);
  assert.equal(h.find(n => n.props?.dangerouslySetInnerHTML), undefined);
});

test('Markdown attribute payloads are escaped and unsafe links cannot open windows', () => {
  const h = harness();
  h.render(h.exports.ReaderView, {nodes: [{id: 'a', title: 'Markdown', onto: 'field', raw: '![x" onerror="alert](x) [bad](javascript:alert)'}], edges: [], sel: 'a'});
  const body = h.find(n => n.props?.dangerouslySetInnerHTML);
  assert.match(body.props.dangerouslySetInnerHTML.__html, /&quot;/);
  assert.doesNotThrow(() => body.props.onClick({target: {closest: () => ({getAttribute: () => 'javascript:alert(1)'})}, preventDefault() {}}));
});

test('only exact, unambiguous response citations become source chips', () => {
  const sources = [{id: 'a', title: 'Alpha'}, {id: 'b', title: 'Beta'}, {id: 'c', title: 'Duplicate'}, {id: 'd', title: 'Duplicate'}];
  assert.deepEqual(support.citedSources('Answer [Beta] [Unknown] [Beta] [Duplicate]', sources).map(n => n.id), ['b']);
  assert.deepEqual(support.citedSources('An uncited answer.', sources), []);
});

test('the streaming chat handler displays only the sources cited by the actual answer', async t => {
  const h = harness(); h.data(); h.connection('chat', {Host: 'localhost:11434', Trust: 'http://localhost:11434'});
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({message: {content: 'See [Heat Death].'}}) + '\n'));
  h.button('\u2726 chat').props.onClick(); h.render();
  let panel = h.find(n => n.type?.name === 'ChatPanel'); panel.props.setChat(c => ({...c, q: 'heat entropy'})); h.render();
  panel = h.find(n => n.type?.name === 'ChatPanel'); await panel.props.onSend(); h.render();
  const chat = h.state(s => s && typeof s === 'object' && 'msgs' in s).value;
  assert.equal(chat.busy, false); assert.deepEqual(Array.from(chat.msgs.at(-1).sources, n => n.id), ['heat']);
});

for (const oai of [false, true]) test(`${oai ? 'SSE' : 'NDJSON'} chat preserves a final record without a newline and split UTF-8`, async t => {
  const h = harness(), tokens = [];
  const token = 'caf\u00e9 \u4e16\u754c [Heat Death]';
  const record = oai ? 'data: ' + JSON.stringify({choices: [{delta: {content: token}}]}) : JSON.stringify({message: {content: token}});
  const bytes = new TextEncoder().encode(record);
  const body = new ReadableStream({start(controller) {for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close();}});
  t.mock.method(globalThis, 'fetch', async () => new Response(body));
  const answer = await h.exports.chatStream({host: 'localhost:11434', trust: 'http://localhost:11434', model: 'test', oai, messages: [], onToken: value => tokens.push(value)});
  assert.equal(answer, token); assert.deepEqual(tokens, [token]); assert.equal(body.locked, false);
});

test('SSE DONE cancels the open stream and ignores tokens buffered after the terminator', async t => {
  const h = harness(), tokens = []; let cancelled = false;
  const record = token => 'data: ' + JSON.stringify({choices: [{delta: {content: token}}]}) + '\n';
  const bytes = new TextEncoder().encode(record('before') + 'data: [DONE]\n' + record('after'));
  const body = new ReadableStream({start(controller) {controller.enqueue(bytes);}, cancel() {cancelled = true;}});
  t.mock.method(globalThis, 'fetch', async () => new Response(body));
  const answer = await h.exports.chatStream({host: 'localhost:11434', trust: 'http://localhost:11434', model: 'test', oai: true, messages: [], onToken: token => tokens.push(token)});
  assert.equal(answer, 'before'); assert.deepEqual(tokens, ['before']); assert.equal(cancelled, true); assert.equal(body.locked, false);
});

test('query-specific passages include matching source text beyond the opening prefix', () => {
  const node = {id: 'manual', title: 'Manual', raw: 'Ignition adjustment: set the timing first.\n' + 'General background. '.repeat(800) + '\nDrainage maintenance: clear the impeller before restarting.'};
  const ignition = support.relevantPassage(node, 'ignition timing');
  const drainage = support.relevantPassage(node, 'drainage impeller');
  assert.match(ignition.raw, /set the timing first/);
  assert.match(drainage.raw, /clear the impeller before restarting/);
  assert.ok(drainage.raw.length <= 1200); assert.notEqual(ignition.raw, drainage.raw);
});

test('HTML-only sources participate in retrieval alongside nodes with embeddings', () => {
  const nodes = [{id: 'unrelated', title: 'Other', raw: 'Unrelated background'}, {id: 'html', title: 'Manual', html: '<script>invisiblekeyword</script><style>anotherinvisiblekeyword</style><p>Pressure&nbsp;valve&#32;inspection prevents leaks.</p>'}];
  const ranked = support.rankKnowledge(nodes, 'pressure valve inspection', 6, new Map([['unrelated', 0.9]]));
  assert.equal(ranked[0].id, 'html'); assert.match(ranked[0].raw, /Pressure valve inspection/);
  assert.doesNotMatch(ranked[0].raw, /invisiblekeyword|<script>|<p>/);
  assert.deepEqual(support.rankKnowledge([nodes[1]], 'invisiblekeyword'), []);
});

async function askInHarness(h, query) {
  h.button('\u2726 chat').props.onClick(); h.render();
  h.find(n => n.type?.name === 'ChatPanel').props.setChat(c => ({...c, q: query})); h.render();
  await h.find(n => n.type?.name === 'ChatPanel').props.onSend(); h.render();
  const chat = h.state(s => s && typeof s === 'object' && 'msgs' in s).value;
  assert.equal(chat.busy, false);
  return chat;
}

test('Markdown ingestion retains late passages and sends the relevant passage to chat', async t => {
  const h = harness(); h.data(); h.connection('chat', {Host: 'localhost:11434', Trust: 'http://localhost:11434'});
  const late = 'Emergency water pump priming: open the bleed valve before restarting.';
  await h.ingest([file('Background information. '.repeat(800) + '\n' + late, 'Pump manual.md')]);
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, init) => {sent = JSON.parse(init.body); return new Response(JSON.stringify({message: {content: 'Open the bleed valve [Pump manual].'}}) + '\n');});
  await askInHarness(h, 'emergency water pump priming');
  assert.ok(sent.messages[0].content.includes(late));
  assert.ok(h.refs().some(r => r.current?.nodes?.[0]?.raw?.endsWith(late)));
});

test('HTML-only imported nodes send matching later text to chat instead of an empty context', async t => {
  const h = harness(); h.data(); h.connection('chat', {Host: 'localhost:11434', Trust: 'http://localhost:11434'});
  const late = 'Hydraulic pump inspection: replace the cracked pressure hose.';
  await h.load({nodes: [{id: 'manual', title: 'Workshop manual', html: '<p>' + 'General introduction. '.repeat(200) + '</p><section><p>' + late + '</p></section>'}]});
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, init) => {sent = JSON.parse(init.body); return new Response(JSON.stringify({message: {content: 'Replace the hose [Workshop manual].'}}) + '\n');});
  const chat = await askInHarness(h, 'hydraulic pump pressure hose');
  assert.ok(sent.messages[0].content.includes(late));
  assert.doesNotMatch(sent.messages[0].content, /<section>|<p>/);
  assert.deepEqual(Array.from(chat.msgs.at(-1).sources, s => s.id), ['manual']);
});

test('graph imports use the first non-null vector dimension and reject mixed lengths before replacement', async () => {
  const nodes = [{id: 'plain'}, {id: 'two', vec: [1, 2]}, {id: 'three', embedding: [1, 2, 3]}];
  await assert.rejects(support.readGraphFile(graphFile({nodes}), opts), /inconsistent vector/);
  const result = await support.readGraphFile(graphFile({nodes: nodes.slice(0, 2).concat({id: 'alsoTwo', embedding: [3, 4]})}), opts);
  assert.equal(result.nodes[0].vec, null); assert.equal(result.nodes[2].vec.length, 2);
  const h = harness(); h.data(); await h.load({nodes});
  assert.match(h.state(s => s && typeof s === 'object' && 'maxNodes' in s).value.err, /inconsistent vector/);
  assert.ok(h.refs().some(r => r.current?.nodes?.[0]?.id === 'entropy'));
});

test('stale model completion cannot overwrite a newer endpoint list or clear its busy flag', async t => {
  const h = harness(); h.data(); h.connection('embed', {Host: 'localhost:11434', Trust: 'http://localhost:11434'});
  const pending = new Map();
  t.mock.method(globalThis, 'fetch', url => new Promise(resolve => pending.set(url, resolve)));
  const editor = () => h.find(n => n.type?.name === 'ConnFields' && n.props.kind === 'embed');
  const old = editor().props.onList(); h.render(); assert.equal(editor().props.busy, true);
  h.connection('embed', {Host: 'localhost:11435', Trust: 'http://localhost:11435'});
  assert.equal(editor().props.busy, false); assert.equal(editor().props.models.length, 0);
  const current = editor().props.onList(); h.render();
  pending.get('http://localhost:11434/api/tags')(new Response('{"models":[{"name":"old-model"}]}'));
  await old; h.render(); assert.equal(editor().props.busy, true); assert.equal(editor().props.models.length, 0);
  pending.get('http://localhost:11435/api/tags')(new Response('{"models":[{"name":"new-model"}]}'));
  await current; h.render(); assert.equal(editor().props.busy, false); assert.deepEqual(Array.from(editor().props.models), ['new-model']);
});

test('key, API mode and trust edits invalidate pending model lists and their completion errors', async t => {
  for (const changed of [{Key: 'new-key'}, {OAI: true}, {Trust: ''}]) {
    const h = harness(); h.data(); h.connection('embed', {Host: 'localhost:11434', Trust: 'http://localhost:11434'});
    let reject;
    t.mock.method(globalThis, 'fetch', () => new Promise((resolve, failure) => {reject = failure;}));
    const editor = () => h.find(n => n.type?.name === 'ConnFields' && n.props.kind === 'embed');
    const pending = editor().props.onList(); h.render(); h.connection('embed', changed);
    assert.equal(editor().props.busy, false); assert.equal(editor().props.models.length, 0);
    reject(new Error('stale failure')); await pending; h.render();
    assert.equal(editor().props.error, ''); assert.equal(editor().props.models.length, 0);
  }
});

test('reader and spatial annotations retain their source node, stay scoped, and clear on graph replacement', async () => {
  const h = harness(); h.button('\u25a4 reader').props.onClick(); h.render();
  const child = harness();
  const reader = () => h.find(n => n.type?.name === 'ReaderView');
  const bounds = () => ({left: 0, top: 0, width: 500, height: 100});
  const selection = text => ({toString: () => text, getRangeAt: () => ({getBoundingClientRect: bounds}), removeAllRanges() {}});
  function annotate(text) {
    child.window.getSelection = () => selection(text);
    child.render(child.exports.ReaderView, reader().props);
    child.find(n => n.props?.dangerouslySetInnerHTML).props.onMouseUp({currentTarget: {getBoundingClientRect: bounds}});
    child.render(child.exports.ReaderView, reader().props);
    child.find(n => n.type === 'button' && n.props.title === 'annotate').props.onClick();
    h.render();
  }
  annotate('ENTROPY_MARK');
  const marks = h.state(s => Array.isArray(s) && s[0]?.nodeId);
  assert.equal(marks.value[0].nodeId, 'entropy');
  reader().props.onSel('heat'); h.render();
  assert.doesNotMatch(textOf(child.render(child.exports.ReaderView, reader().props)), /1 annotation/);
  annotate('HEAT_MARK');
  assert.equal(marks.value[1].nodeId, 'heat');
  assert.match(textOf(child.render(child.exports.ReaderView, reader().props)), /1 annotation for this document/);
  h.button('\u2726 space').props.onClick(); h.render();
  function dive(id) {
    const svg = h.find(n => n.type === 'svg' && n.props.onDoubleClick);
    svg.props.ref.current = {getBoundingClientRect: () => ({left: 0, top: 0, width: 760, height: 520})};
    const node = h.refs().find(r => r.current?.nodes?.[0]?.p).current.nodes.find(n => n.id === id);
    svg.props.onDoubleClick({clientX: 380 + node.p[0] * 620 / (node.p[2] + 560), clientY: 260 + node.p[1] * 620 / (node.p[2] + 560)});
    return h.render();
  }
  let view = textOf(dive('entropy')); assert.match(view, /ENTROPY_MARK/); assert.doesNotMatch(view, /HEAT_MARK/);
  h.window.getSelection = () => selection('SPATIAL_MARK');
  h.find(n => n.type === 'div' && n.props.onMouseUp).props.onMouseUp({currentTarget: {getBoundingClientRect: bounds}, clientX: 10, clientY: 10}); h.render();
  h.find(n => n.type === 'div' && n.props.style?.padding === '9px 14px' && textOf(n).includes('annotate')).props.onClick(); h.render();
  assert.equal(marks.value.at(-1).nodeId, 'entropy');
  h.button('\u2715 surface').props.onClick(); h.render();
  view = textOf(dive('heat')); assert.match(view, /HEAT_MARK/); assert.doesNotMatch(view, /ENTROPY_MARK|SPATIAL_MARK/);
  h.data(); await h.load({nodes: [{id: 'replacement'}]}); assert.equal(marks.value.length, 0);
});
