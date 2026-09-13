export const GRAPH_LIMITS = Object.freeze({bytes: 8 * 1024 * 1024, nodes: 10000, edges: 40000, visibleNodes: 800, visibleEdges: 3200, documents: 128, documentBytes: 512 * 1024, vectorDimensions: 8192, repulsionSamples: 48});

export async function boundedFileText(file, limit = GRAPH_LIMITS.bytes) {
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > limit) throw new Error(`File exceeds the ${limit} byte limit. Choose a smaller export.`);
  const text = await file.text();
  if (text.length > limit || new TextEncoder().encode(text).length > limit) throw new Error(`File exceeds the ${limit} byte limit. Choose a smaller export.`);
  return text;
}

export function validateEmbedding(vec, dimensions) {
  if (!Array.isArray(vec) || !vec.length || vec.length > GRAPH_LIMITS.vectorDimensions || (dimensions && vec.length !== dimensions) || !vec.every(x => Number.isFinite(x) && Math.abs(x) <= 1e6)) {
    throw new Error('The embedding model returned an invalid or inconsistent vector. Select a working embedding model and retry.');
  }
  return vec;
}

export async function readGraphFile(file, {maxNodes = 300, minConf = 0, ontoKeys, relationKeys}) {
  const text = await boundedFileText(file);
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('Invalid JSON. Export a graph containing nodes and edges.'); }
  const g = Array.isArray(value) ? {nodes: value} : value?.nodes ? value : value?.graph || value?.data;
  if (!g || !Array.isArray(g.nodes)) throw new Error('Expected a nodes array in the graph.');
  const inputEdges = g.edges ?? g.links ?? [];
  if (!Array.isArray(inputEdges)) throw new Error('Expected an edges or links array.');
  // Reject before normalization, vector work, degree calculation or sorting.
  if (!g.nodes.length) throw new Error('The graph has no nodes. Choose a nonempty graph.');
  if (g.nodes.length > GRAPH_LIMITS.nodes || inputEdges.length > GRAPH_LIMITS.edges) throw new Error(`Graph exceeds ${GRAPH_LIMITS.nodes} nodes or ${GRAPH_LIMITS.edges} edges. Export a smaller graph.`);
  const ids = new Set();
  let vectorDimensions;
  const asText = (v, fallback, limit) => typeof v === 'string' && v ? v.slice(0, limit) : fallback;
  let nodes = g.nodes.map((n, i) => {
    if (!n || typeof n !== 'object' || Array.isArray(n)) throw new Error(`Node ${i + 1} must be an object.`);
    const id = n.id == null ? 'n' + i : String(n.id);
    if (!id.trim() || id.length > 256 || ids.has(id) || Object.hasOwn(Object.prototype, id) || id === 'prototype') throw new Error(`Node ${i + 1} needs a unique, nonempty ID (up to 256 characters) that is not an Object.prototype property name.`);
    ids.add(id);
    const onto = n.onto || n.type || n.category;
    const position = n.pos || n.position;
    const p = Array.isArray(position) && position.length === 3 && position.every(x => Number.isFinite(x) && Math.abs(x) <= 1e6) ? [...position] : [0, 1, 2].map(() => (Math.random() - 0.5) * 340);
    const vec = n.vec ?? n.embedding;
    const embedding = vec == null ? null : validateEmbedding(vec, vectorDimensions);
    if (embedding) vectorDimensions ??= embedding.length;
    return {id, title: asText(n.title || n.name || n.label, 'node ' + i, 512), onto: ontoKeys.includes(onto) ? onto : 'field', raw: asText(n.raw || n.text || n.body || n.snippet, '', 32000), html: asText(n.html || n.content_html, '', 128000), media: Array.isArray(n.media) ? n.media.slice(0, 32) : [], vec: embedding, p};
  });
  let edges = inputEdges.flatMap(e => {
    if (!e || typeof e !== 'object') return [];
    const from = String(e.from ?? e.source), to = String(e.to ?? e.target);
    if (!ids.has(from) || !ids.has(to)) return [];
    const confidence = Number(e.conf ?? e.weight ?? 0.7);
    const conf = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.7;
    const rel = e.rel || e.type;
    return conf >= minConf ? [{from, to, rel: relationKeys.includes(rel) ? rel : 'related', conf}] : [];
  });
  const cap = Math.max(1, Math.min(GRAPH_LIMITS.visibleNodes, Math.floor(Number(maxNodes)) || 300));
  if (nodes.length > cap) {
    const degree = new Map();
    for (const e of edges) for (const id of [e.from, e.to]) degree.set(id, (degree.get(id) || 0) + e.conf);
    nodes.sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0));
    nodes = nodes.slice(0, cap);
  }
  const keep = new Set(nodes.map(n => n.id));
  edges = edges.filter(e => keep.has(e.from) && keep.has(e.to)).sort((a, b) => b.conf - a.conf).slice(0, Math.min(GRAPH_LIMITS.visibleEdges, nodes.length * 4));
  return {nodes, edges, total: g.nodes.length};
}

export function modelEndpoint(host) {
  const input = String(host || '').trim();
  if (!input) return {base: '', local: true, loopback: false};
  if (/[\s\\\u0000-\u001f\u007f]/.test(input)) throw new Error('Use a plain HTTP(S) model service URL without whitespace or backslashes.');
  const explicit = /^https?:\/\//i.test(input);
  if (!explicit && /^[a-z][a-z\d+.-]*:/i.test(input) && !/^[\w.-]+:\d+(?:\/|$)/.test(input)) throw new Error('Only HTTP(S) model services are supported.');
  let url;
  try { url = new URL(explicit ? input : 'http://' + input); } catch { throw new Error('Enter a valid model service host and port.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['/', '/v1', '/v1/'].includes(url.pathname)) throw new Error('Use the service base URL without credentials, query, fragment or an API path (optional /v1 is accepted).');
  const h = url.hostname.toLowerCase();
  const loopback = h === 'localhost' || h === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(h);
  const local = loopback || /^10\.\d+\.\d+\.\d+$/.test(h) || /^192\.168\.\d+\.\d+$/.test(h) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h) || /^\[f[cd][a-f\d]{2}:/.test(h) || h.endsWith('.local') || /^[a-z\d-]+$/.test(h);
  if (url.protocol === 'http:' && !local) throw new Error('Remote model services require HTTPS. HTTP is available for explicitly trusted local services.');
  if (['0', '21', '22', '23', '25', '53', '110', '143', '389', '445', '5432', '6379'].includes(url.port)) throw new Error('Choose an HTTP model-service port.');
  return {base: url.origin, local, loopback};
}

export function requireModelTrust(host, approvedBase, key = '') {
  const endpoint = modelEndpoint(host);
  if (!endpoint.base) throw new Error('Set a model host in Data connections first.');
  if (endpoint.base !== approvedBase) throw new Error('Approve this exact model endpoint in Data connections before sending requests, private text or a key.');
  if (key && endpoint.base.startsWith('http:') && !endpoint.loopback) throw new Error('Use HTTPS before sending an API key to another device.');
  return endpoint;
}

export async function modelRequest(host, path, options, approvedBase, key = '') {
  const {base} = requireModelTrust(host, approvedBase, key);
  if (!['/v1/models', '/api/tags', '/v1/embeddings', '/api/embeddings', '/v1/chat/completions', '/api/chat'].includes(path)) throw new Error('Unsupported model API route.');
  const response = await fetch(base + path, {...options, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error('Model service returned HTTP ' + response.status + '. Check the host, model and key.');
  return response;
}

function knowledgeText(node) {
  if (!node.html) return String(node.raw || '');
  // Text extraction only: never insert imported markup into an application DOM.
  // Ignore invisible executable/style content and preserve block boundaries.
  const entities = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};
  return String(node.html)
    .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
    .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    .replace(/<\/?[a-z][a-z\d:-]*\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi, '\n')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] || match;
      const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : ' ';
    })
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
}

export function relevantPassage(node, query, limit = 1200) {
  const text = knowledgeText(node);
  const stop = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'what', 'which', 'about', 'tell', 'how', 'does', 'are']);
  const terms = [...new Set(String(query).slice(0, 4096).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])].filter(term => term.length > 2 && !stop.has(term)).slice(0, 24);
  const title = String(node.title || '').toLowerCase();
  const titleHits = terms.filter(term => title.includes(term)).length;
  // Overlapping windows allow matches anywhere in the bounded source, including
  // a term spanning a window boundary. Preserve the selected source verbatim.
  let bestStart = 0, bestHits = -1;
  const stride = Math.max(1, Math.floor(limit / 2));
  for (let start = 0; start < text.length; start += stride) {
    const window = text.slice(start, start + limit).toLowerCase();
    const hits = terms.filter(term => window.includes(term)).length;
    if (hits > bestHits) {bestHits = hits; bestStart = start;}
  }
  return {raw: text.slice(bestStart, bestStart + limit), score: terms.length ? (Math.max(0, bestHits) + titleHits * 0.35) / terms.length : 0};
}

export function rankKnowledge(nodes, query, k = 6, vectorScores = new Map()) {
  return nodes.map(node => {
    const passage = relevantPassage(node, query);
    const semantic = vectorScores.get(node.id);
    return {id: node.id, title: node.title, onto: node.onto, raw: passage.raw, score: passage.score + (Number.isFinite(semantic) ? Math.max(0, semantic) : 0), matched: passage.score > 0 || Number.isFinite(semantic)};
  }).filter(node => node.matched).sort((a, b) => b.score - a.score).slice(0, k);
}

export function citedSources(answer, candidates) {
  const byTitle = new Map();
  for (const node of candidates) byTitle.set(node.title, byTitle.has(node.title) ? null : node);
  const found = new Map();
  for (const match of String(answer).matchAll(/\[([^\]\n]+)\]/g)) {
    const node = byTitle.get(match[1]);
    if (node) found.set(node.id, node);
  }
  return [...found.values()];
}

export function isolatedGraphHtml(html) {
  // No script or same-origin sandbox permission is granted by the host iframe.
  // This policy also prevents automatic resource loads, nested frames and forms.
  return '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\'; img-src data:; frame-src \'none\'; form-action \'none\'; base-uri \'none\'"><meta name="referrer" content="no-referrer"><style>body{color:#c9d2f5;background:#05060f;font:14px/1.75 Georgia,serif;overflow-wrap:anywhere;margin:8px}img{max-width:100%}a{color:#7ee8fa}</style></head><body>' + html + '</body></html>';
}

export function repulsionForce(nodes, i, charge) {
  let x = 0, y = 0, z = 0;
  const stride = Math.max(1, Math.ceil((nodes.length - 1) / GRAPH_LIMITS.repulsionSamples));
  const p = nodes[i].p;
  for (let offset = 1; offset < nodes.length; offset += stride) {
    const q = nodes[(i + offset) % nodes.length].p;
    const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2];
    const r2 = Math.max(1, dx * dx + dy * dy + dz * dz);
    const weight = Math.min(stride, nodes.length - offset);
    const f = charge * weight / (r2 * Math.sqrt(r2));
    x += dx * f; y += dy * f; z += dz * f;
  }
  return [x, y, z];
}

export function applyLook(camera, nodes, yaw, pitch) {
  if (!nodes.length) return;
  const center = [0, 0, 0];
  for (const node of nodes) for (let axis = 0; axis < 3; axis++) center[axis] += node.p[axis] / nodes.length;
  const hinge = center.map((v, i) => camera.pos[i] + (v - camera.pos[i]) * 0.55);
  const x = camera.pos[0] - hinge[0], z = camera.pos[2] - hinge[2];
  camera.pos = [hinge[0] + x * Math.cos(yaw) - z * Math.sin(yaw), camera.pos[1], hinge[2] + x * Math.sin(yaw) + z * Math.cos(yaw)];
  camera.yaw += yaw;
  camera.pitch = Math.max(-1.1, Math.min(1.1, camera.pitch + pitch));
}

export function coastLook(camera, nodes, damping) {
  camera.vYaw = Math.abs(camera.vYaw) > 0.00001 ? camera.vYaw * damping : 0;
  camera.vPitch = Math.abs(camera.vPitch) > 0.00001 ? camera.vPitch * damping : 0;
  if (camera.vYaw || camera.vPitch) applyLook(camera, nodes, camera.vYaw, camera.vPitch);
}
