/** A bounded, source-driven spatial knowledge mesh. Angles are radians. */
export const DEFAULT_CAMERA = Object.freeze({ x: 0, y: 0, z: 650, yaw: 0, pitch: 0, roll: 0 });
export const MAX_NODES = 300;
export const MAX_EDGES = 600;
const TAU = Math.PI * 2;
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const angle = value => ((value + Math.PI) % TAU + TAU) % TAU - Math.PI;

export function normalizeCamera(value = {}) {
  const camera = {};
  for (const key of ['x', 'y', 'z']) camera[key] = Math.max(-1e6, Math.min(1e6, finite(value?.[key], DEFAULT_CAMERA[key])));
  for (const key of ['yaw', 'pitch', 'roll']) camera[key] = angle(finite(value?.[key], 0));
  return camera;
}

function rotateX({ x, y, z }, a) {
  return { x, y: y * Math.cos(a) - z * Math.sin(a), z: y * Math.sin(a) + z * Math.cos(a) };
}
function rotateY({ x, y, z }, a) {
  return { x: x * Math.cos(a) + z * Math.sin(a), y, z: -x * Math.sin(a) + z * Math.cos(a) };
}
function rotateZ({ x, y, z }, a) {
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a), z };
}

/** Camera basis is R_yaw * R_pitch * R_roll; forward is local -Z. */
export function cameraVectorToWorld(vector, camera) {
  return rotateY(rotateX(rotateZ(vector, camera.roll), camera.pitch), camera.yaw);
}

export function worldToCamera(point, camera) {
  return rotateZ(rotateX(rotateY({ x: point.x - camera.x, y: point.y - camera.y, z: point.z - camera.z }, -camera.yaw), -camera.pitch), -camera.roll);
}

export function translateCamera(camera, localDelta) {
  const delta = cameraVectorToWorld(localDelta, camera);
  return normalizeCamera({ ...camera, x: camera.x + delta.x, y: camera.y + delta.y, z: camera.z + delta.z });
}

/** Returns null behind the camera/near plane; depth is positive in front. */
export function projectPoint(point, camera, width, height, fov = Math.PI / 3) {
  if (!(width > 0 && height > 0 && fov > 0 && fov < Math.PI)) return null;
  const view = worldToCamera(point, camera);
  const depth = -view.z;
  if (!(depth >= 8) || !Number.isFinite(depth)) return null;
  const scale = Math.min(width, height) / (2 * Math.tan(fov / 2)) / depth;
  const x = width / 2 + view.x * scale;
  const y = height / 2 - view.y * scale;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, depth, scale };
}

export function boundGraph(graph = {}) {
  const nodes = [];
  const ids = new Set();
  for (const item of Array.isArray(graph.nodes) ? graph.nodes : []) {
    if (!item || item.id == null) continue;
    const id = String(item.id);
    if (!id || ids.has(id)) continue;
    ids.add(id);
    nodes.push({ id, title: String(item.title || id), kind: String(item.kind || 'source') });
    if (nodes.length === MAX_NODES) break;
  }
  const edges = [];
  const seen = new Set();
  for (const item of Array.isArray(graph.edges) ? graph.edges : []) {
    if (!item || item.from == null || item.to == null) continue;
    const from = String(item.from), to = String(item.to);
    if (!ids.has(from) || !ids.has(to)) continue;
    const type = String(item.type || 'link');
    const key = JSON.stringify([from, to, type]);
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to, type, ...(Number.isFinite(item.weight) ? { weight: item.weight } : {}) });
    if (edges.length === MAX_EDGES) break;
  }
  return { nodes, edges };
}

/** Force layout expresses supplied links. Coordinates are not embeddings. */
export function layoutGraph(graph) {
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const positions = new Map();
  nodes.forEach((node, i) => {
    const y = nodes.length > 1 ? 1 - 2 * i / (nodes.length - 1) : 0;
    const radius = Math.sqrt(1 - y * y);
    positions.set(node.id, nodes.length === 1 ? { x: 0, y: 0, z: 0 } : {
      x: Math.cos(i * 2.399963229728653) * radius * 180,
      y: y * 180,
      z: Math.sin(i * 2.399963229728653) * radius * 180,
    });
  });
  if (nodes.length < 2) return positions;
  for (let iteration = 0; iteration < 44; iteration++) {
    const deltas = new Map(nodes.map(node => [node.id, { x: 0, y: 0, z: 0 }]));
    for (let a = 0; a < nodes.length; a++) {
      const pa = positions.get(nodes[a].id), da = deltas.get(nodes[a].id);
      for (let b = a + 1; b < nodes.length; b++) {
        const pb = positions.get(nodes[b].id), db = deltas.get(nodes[b].id);
        const dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z;
        const distanceSquared = Math.max(64, dx * dx + dy * dy + dz * dz);
        const force = 500 / (distanceSquared * Math.sqrt(distanceSquared));
        da.x += dx * force; da.y += dy * force; da.z += dz * force;
        db.x -= dx * force; db.y -= dy * force; db.z -= dz * force;
      }
    }
    for (const edge of graph.edges) {
      if (edge.from === edge.to) continue;
      const a = positions.get(edge.from), b = positions.get(edge.to);
      if (!a || !b) continue;
      const da = deltas.get(edge.from), db = deltas.get(edge.to);
      const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) || 1;
      const strength = (distance - 80) / distance * 0.018;
      for (const axis of ['x', 'y', 'z']) {
        const force = (b[axis] - a[axis]) * strength;
        da[axis] += force; db[axis] -= force;
      }
    }
    for (const node of nodes) {
      const p = positions.get(node.id), d = deltas.get(node.id);
      for (const axis of ['x', 'y', 'z']) p[axis] += Math.max(-8, Math.min(8, d[axis] - p[axis] * 0.001));
    }
  }
  const center = { x: 0, y: 0, z: 0 };
  for (const p of positions.values()) for (const axis of ['x', 'y', 'z']) center[axis] += p[axis] / nodes.length;
  for (const p of positions.values()) for (const axis of ['x', 'y', 'z']) p[axis] -= center[axis];
  return positions;
}

const PALETTE = { source: '#00e8ef', note: '#ffbd62', semantic: '#c28dff', text: '#e1e9f1', muted: '#98a8b8' };
const nodeColor = node => /note|annotation|lore/i.test(node.kind) ? PALETTE.note : /concept|semantic/i.test(node.kind) ? PALETTE.semantic : PALETTE.source;
const edgeColor = edge => /similar|semantic|vector|concept/i.test(edge.type) ? PALETTE.semantic : /note|annotat|lore/i.test(edge.type) ? PALETTE.note : PALETTE.source;

export function mountMesh(container, { onSelect, onCameraChange, camera: initialCamera } = {}) {
  if (!container?.ownerDocument) throw new TypeError('mountMesh requires a DOM container');
  const document = container.ownerDocument;
  const window = document.defaultView;
  const controller = new window.AbortController();
  const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal: controller.signal });
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const root = el('section', 'enzime-mesh');
  root.setAttribute('aria-label', 'Spatial knowledge mesh');
  const style = el('style');
  style.textContent = `
    .enzime-mesh{color:#e1e9f1;background:#060b14;border:1px solid #273443;border-radius:14px;overflow:hidden;font:14px/1.5 system-ui,sans-serif;isolation:isolate;min-width:0}
    .enzime-mesh *{box-sizing:border-box}.enzime-mesh button{font:inherit;cursor:pointer;color:#e1e9f1;background:#101c2a;border:1px solid #35475d;border-radius:6px;padding:7px 10px;min-height:36px}
    .enzime-mesh button:hover{border-color:#00e8ef;background:#152838}.enzime-mesh button:focus-visible,.enzime-mesh canvas:focus-visible{outline:2px solid #00e8ef;outline-offset:-2px}
    .enzime-mesh-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #273443}.enzime-mesh-title{font-weight:650}.enzime-mesh-count{font-size:12px;color:#98a8b8}
    .enzime-mesh-stage{position:relative;min-height:310px;height:clamp(310px,48vh,560px)}.enzime-mesh canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}.enzime-mesh canvas:active{cursor:grabbing}
    .enzime-mesh-empty{position:absolute;inset:0;display:grid;place-items:center;padding:28px;text-align:center;pointer-events:none;color:#98a8b8}.enzime-mesh-empty[hidden]{display:none}
    .enzime-mesh-toolbar{display:flex;flex-wrap:wrap;gap:10px;padding:10px 12px;border-top:1px solid #273443}.enzime-mesh-group{display:flex;align-items:center;flex-wrap:wrap;gap:4px}.enzime-mesh-group>span{font-size:12px;color:#98a8b8;margin-right:3px}
    .enzime-mesh-help,.enzime-mesh-legend{font-size:12px;color:#98a8b8;padding:4px 14px 10px;margin:0}.enzime-mesh-legend{display:flex;gap:16px;flex-wrap:wrap}.enzime-mesh-legend span::before{content:'●';margin-right:6px;color:var(--mesh-color)}
    .enzime-mesh details{padding:10px 14px;border-top:1px solid #273443}.enzime-mesh summary{cursor:pointer}.enzime-mesh-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:6px;padding:10px 0;margin:0;list-style:none;max-height:240px;overflow:auto}
    .enzime-mesh-list button{display:block;width:100%;text-align:left;overflow-wrap:anywhere}.enzime-mesh-list button[aria-pressed=true]{border-color:#00e8ef;background:#123342}.enzime-mesh-list small{display:block;color:#98a8b8}
    .enzime-mesh-caption{padding:0 14px 10px;color:#98a8b8;font-size:12px}.enzime-mesh-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(max-width:520px){.enzime-mesh-header{align-items:flex-start}.enzime-mesh button{min-height:42px}.enzime-mesh-group{gap:5px}.enzime-mesh-toolbar{gap:12px}.enzime-mesh-stage{height:340px}}
  `;
  root.append(style);
  const header = el('div', 'enzime-mesh-header');
  const heading = el('div');
  heading.append(el('div', 'enzime-mesh-title', 'Knowledge mesh'));
  const count = el('div', 'enzime-mesh-count', 'No sources yet');
  heading.append(count);
  const resetButton = el('button', '', 'Recenter'); resetButton.type = 'button';
  resetButton.setAttribute('aria-label', 'Reset camera position and rotation');
  header.append(heading, resetButton);
  const stage = el('div', 'enzime-mesh-stage');
  const canvas = el('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive knowledge graph. W S move forward and back, A D left and right, R F up and down. Arrow keys turn. Q E roll. Home resets. The source list below provides equivalent navigation.');
  const empty = el('div', 'enzime-mesh-empty', 'Open or add a source to explore its knowledge connections.');
  stage.append(canvas, empty);
  const toolbar = el('div', 'enzime-mesh-toolbar');
  toolbar.setAttribute('role', 'group'); toolbar.setAttribute('aria-label', 'Camera controls');
  const help = el('p', 'enzime-mesh-help', 'Drag to look · Shift-drag to pan · Scroll to move forward/back. Focus the graph: W/S, A/D, R/F move; arrows turn; Q/E roll; Shift moves faster; Home recenters.');
  const legend = el('div', 'enzime-mesh-legend');
  for (const [label, color] of [['Sources & links', PALETTE.source], ['Notes & annotations', PALETTE.note], ['Concepts & semantic links', PALETTE.semantic]]) {
    const item = el('span', '', label); item.style.setProperty('--mesh-color', color); legend.append(item);
  }
  const details = el('details');
  const summary = el('summary', '', 'Sources and connections (accessible list)');
  const list = el('ul', 'enzime-mesh-list');
  details.append(summary, list);
  const caption = el('div', 'enzime-mesh-caption', 'Distances reflect the graph layout; they are not similarity scores.');
  const live = el('div', 'enzime-mesh-sr'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  root.append(header, stage, toolbar, help, legend, details, caption, live);
  container.append(root);
  let camera = normalizeCamera(initialCamera);
  let graph = { nodes: [], edges: [] }, positions = new Map(), selected = null, hovered = null;
  let width = 1, height = 1, frame = 0, destroyed = false, pendingCamera = false, projected = [];
  let pointer = null;
  const listButtons = new Map();
  let context = null;
  try { context = canvas.getContext('2d'); } catch { /* The accessible list remains usable. */ }
  if (!context) empty.textContent = 'The graph canvas is unavailable. Use the sources and connections list below.';

  function schedule(notify = false) {
    if (destroyed) return;
    pendingCamera ||= notify;
    if (!frame) frame = window.requestAnimationFrame(() => {
      frame = 0;
      draw();
      if (pendingCamera) { pendingCamera = false; onCameraChange?.({ ...camera }); }
    });
  }
  function draw() {
    if (!context) return;
    const ctx = context;
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.65);
    gradient.addColorStop(0, '#10202d'); gradient.addColorStop(1, '#060b14');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    const byId = new Map();
    projected = [];
    for (const node of graph.nodes) {
      const point = projectPoint(positions.get(node.id), camera, width, height);
      if (!point) continue;
      const drawNode = { ...point, node, radius: Math.max(5, Math.min(15, point.scale * 10)) };
      byId.set(node.id, drawNode); projected.push(drawNode);
    }
    for (const edge of graph.edges) {
      const a = byId.get(edge.from), b = byId.get(edge.to);
      if (!a || !b || a === b) continue;
      const focused = [selected, hovered].some(id => id != null && (edge.from === id || edge.to === id));
      ctx.strokeStyle = edgeColor(edge); ctx.globalAlpha = focused ? 0.9 : 0.3; ctx.lineWidth = focused ? 1.8 : 1;
      ctx.setLineDash(/similar|semantic|vector/i.test(edge.type) ? [4, 4] : []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (distance > 35) {
        const dx = (b.x - a.x) / distance, dy = (b.y - a.y) / distance;
        const tipX = b.x - dx * (b.radius + 3), tipY = b.y - dy * (b.radius + 3);
        ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(tipX - dx * 5 - dy * 3, tipY - dy * 5 + dx * 3); ctx.lineTo(tipX, tipY); ctx.lineTo(tipX - dx * 5 + dy * 3, tipY - dy * 5 - dx * 3); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    projected.sort((a, b) => b.depth - a.depth);
    for (const point of projected) {
      if (point.x < -80 || point.x > width + 80 || point.y < -80 || point.y > height + 80) continue;
      const focus = point.node.id === selected || point.node.id === hovered;
      const color = nodeColor(point.node);
      ctx.shadowColor = color; ctx.shadowBlur = focus ? 18 : 5;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(point.x, point.y, point.radius, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      if (focus) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(point.x, point.y, point.radius + 4, 0, TAU); ctx.stroke(); }
      if (graph.nodes.length <= 45 || focus) {
        const label = point.node.title.length > 38 ? `${point.node.title.slice(0, 35)}…` : point.node.title;
        ctx.font = `${focus ? '600' : '400'} 12px system-ui,sans-serif`;
        ctx.textBaseline = 'middle';
        const labelWidth = ctx.measureText(label).width;
        const labelX = Math.max(5, Math.min(width - labelWidth - 5, point.x + point.radius + 8));
        const labelY = Math.max(10, Math.min(height - 10, point.y));
        ctx.fillStyle = 'rgba(6,11,20,0.82)'; ctx.fillRect(labelX - 3, labelY - 9, labelWidth + 6, 18);
        ctx.fillStyle = focus ? '#fff' : PALETTE.text; ctx.fillText(label, labelX, labelY);
      }
    }
    if (graph.nodes.length && !projected.some(p => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)) {
      ctx.font = '14px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = PALETTE.muted;
      ctx.fillText('Sources are outside the view. Recenter to return.', width / 2, height / 2); ctx.textAlign = 'left';
    }
  }
  function resize() {
    if (destroyed) return;
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); schedule();
  }
  function move(x, y, z) { camera = translateCamera(camera, { x, y, z }); schedule(true); }
  function turn(axis, delta) { camera = normalizeCamera({ ...camera, [axis]: camera[axis] + delta }); schedule(true); }
  function reset() { camera = { ...DEFAULT_CAMERA }; live.textContent = 'Camera recentered.'; schedule(true); }
  const groups = [
    ['Move', [['←', 'Move left', () => move(-30, 0, 0)], ['→', 'Move right', () => move(30, 0, 0)], ['↑', 'Move up', () => move(0, 30, 0)], ['↓', 'Move down', () => move(0, -30, 0)], ['In', 'Move forward', () => move(0, 0, -40)], ['Out', 'Move backward', () => move(0, 0, 40)]]],
    ['Turn', [['↶', 'Yaw left', () => turn('yaw', 0.12)], ['↷', 'Yaw right', () => turn('yaw', -0.12)], ['Up', 'Pitch up', () => turn('pitch', 0.12)], ['Down', 'Pitch down', () => turn('pitch', -0.12)]]],
    ['Roll', [['↺', 'Roll counterclockwise', () => turn('roll', 0.12)], ['↻', 'Roll clockwise', () => turn('roll', -0.12)]]],
  ];
  for (const [name, actions] of groups) {
    const group = el('div', 'enzime-mesh-group'); group.setAttribute('role', 'group'); group.setAttribute('aria-label', `${name} camera`); group.append(el('span', '', name));
    for (const [label, title, action] of actions) {
      const button = el('button', '', label); button.type = 'button'; button.title = title; button.setAttribute('aria-label', title); listen(button, 'click', action); group.append(button);
    }
    toolbar.append(group);
  }
  listen(resetButton, 'click', reset);
  listen(canvas, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 70 : 24, radians = event.shiftKey ? 0.12 : 0.045;
    const actions = {
      w: () => move(0, 0, -step), s: () => move(0, 0, step), a: () => move(-step, 0, 0), d: () => move(step, 0, 0), r: () => move(0, step, 0), f: () => move(0, -step, 0),
      arrowleft: () => turn('yaw', radians), arrowright: () => turn('yaw', -radians), arrowup: () => turn('pitch', radians), arrowdown: () => turn('pitch', -radians),
      q: () => turn('roll', radians), e: () => turn('roll', -radians), home: reset,
    };
    const action = actions[event.key.toLowerCase()];
    if (action) { event.preventDefault(); event.stopPropagation(); action(); }
  });
  function hit(event) {
    const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    for (let i = projected.length - 1; i >= 0; i--) if (Math.hypot(projected[i].x - x, projected[i].y - y) <= projected[i].radius + 6) return projected[i].node.id;
    return null;
  }
  function select(id, notify = false) {
    selected = graph.nodes.some(node => node.id === id) ? id : null;
    for (const [key, button] of listButtons) button.setAttribute('aria-pressed', String(key === selected));
    if (selected && notify) { live.textContent = `Selected ${graph.nodes.find(node => node.id === selected).title}.`; onSelect?.(selected); }
    schedule();
  }
  listen(canvas, 'pointerdown', event => {
    if (event.button !== 0 || pointer) return;
    canvas.focus({ preventScroll: true });
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
    canvas.setPointerCapture?.(event.pointerId);
  });
  listen(canvas, 'pointermove', event => {
    if (!pointer) { const next = hit(event); if (next !== hovered) { hovered = next; canvas.title = graph.nodes.find(node => node.id === next)?.title || ''; schedule(); } return; }
    if (event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer.x = event.clientX; pointer.y = event.clientY; pointer.distance += Math.hypot(dx, dy);
    if (pointer.distance < 4) return;
    if (event.shiftKey) move(-dx * 1.1, dy * 1.1, 0);
    else { camera = normalizeCamera({ ...camera, yaw: camera.yaw - dx * 0.004, pitch: camera.pitch - dy * 0.004 }); schedule(true); }
  });
  listen(canvas, 'pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const click = pointer.distance < 4; pointer = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (click) { const id = hit(event); if (id != null) select(id, true); }
  });
  for (const type of ['pointercancel', 'lostpointercapture']) listen(canvas, type, () => { pointer = null; });
  listen(canvas, 'pointerleave', () => { if (!pointer) { hovered = null; schedule(); } });
  listen(canvas, 'wheel', event => {
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    move(0, 0, Math.max(-100, Math.min(100, event.deltaY * unit * 0.5)));
  }, { passive: false });
  const observer = window.ResizeObserver ? new window.ResizeObserver(resize) : null;
  observer?.observe(stage); listen(window, 'resize', resize); resize();

  function setGraph(next = {}) {
    if (destroyed) return;
    graph = boundGraph(next); positions = layoutGraph(graph); projected = []; hovered = null;
    count.textContent = `${graph.nodes.length} sources · ${graph.edges.length} connections${(next.nodes?.length > MAX_NODES || next.edges?.length > MAX_EDGES) ? ' · bounded view' : ''}`;
    empty.hidden = Boolean(context && graph.nodes.length);
    canvas.setAttribute('aria-label', `Knowledge mesh with ${graph.nodes.length} sources and ${graph.edges.length} connections. W S, A D, R F move. Arrows turn. Q E roll. Home resets. Use the source list below for equivalent navigation.`);
    list.replaceChildren(); listButtons.clear();
    const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
    for (const node of graph.nodes) {
      const item = el('li');
      const button = el('button'); button.type = 'button'; button.dataset.nodeId = node.id; button.append(el('span', '', node.title));
      const connected = graph.edges.filter(edge => edge.from === node.id || edge.to === node.id);
      button.append(el('small', '', `${node.kind} · ${connected.length} connection${connected.length === 1 ? '' : 's'}`));
      const description = connected.slice(0, 8).map(edge => `${edge.from === node.id ? 'to' : 'from'} ${nodeMap.get(edge.from === node.id ? edge.to : edge.from).title}: ${edge.type}`).join('; ');
      if (description) button.setAttribute('aria-label', `${node.title}. ${description}${connected.length > 8 ? `; and ${connected.length - 8} more` : ''}`);
      button.addEventListener('click', () => select(node.id, true));
      listButtons.set(node.id, button); item.append(button); list.append(item);
    }
    if (!graph.nodes.length) list.append(el('li', '', 'No source nodes are available yet.'));
    select(selected);
  }
  return {
    setGraph,
    setSelected: id => { if (!destroyed) select(id == null ? null : String(id)); },
    reset,
    getCamera: () => ({ ...camera }),
    destroy() {
      if (destroyed) return;
      destroyed = true; controller.abort(); observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      root.remove(); positions.clear(); listButtons.clear(); projected = []; graph = { nodes: [], edges: [] };
    },
  };
}
