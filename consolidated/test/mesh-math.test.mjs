import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CAMERA, MAX_NODES, MAX_EDGES, normalizeCamera, cameraVectorToWorld,
  worldToCamera, translateCamera, projectPoint, boundGraph, layoutGraph,
} from '../public/mesh.mjs';

const near = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not close to ${expected}`);

test('camera transforms invert a mixed yaw/pitch/roll basis without losing degrees of freedom', () => {
  const camera = { x: 18, y: -41, z: 170, yaw: 0.71, pitch: -0.42, roll: 1.2 };
  const local = { x: 31, y: 48, z: -212 };
  const worldVector = cameraVectorToWorld(local, camera);
  const roundTrip = worldToCamera({ x: camera.x + worldVector.x, y: camera.y + worldVector.y, z: camera.z + worldVector.z }, camera);
  for (const axis of ['x', 'y', 'z']) near(roundTrip[axis], local[axis]);
  near(Math.hypot(...Object.values(worldVector)), Math.hypot(...Object.values(local)));
});

test('translation follows the oriented camera rather than fixed world axes', () => {
  const camera = { ...DEFAULT_CAMERA, yaw: Math.PI / 2 };
  const moved = translateCamera(camera, { x: 0, y: 0, z: -30 });
  near(moved.x, -30); near(moved.y, 0); near(moved.z, 650);
  const rolled = translateCamera({ ...DEFAULT_CAMERA, roll: Math.PI / 2 }, { x: 20, y: 0, z: 0 });
  near(rolled.x, 0); near(rolled.y, 20); near(rolled.z, 650);
  assert.deepEqual(camera, { ...DEFAULT_CAMERA, yaw: Math.PI / 2 });
});

test('perspective centers the origin, preserves screen orientation, and rejects points behind the camera', () => {
  const center = projectPoint({ x: 0, y: 0, z: 0 }, DEFAULT_CAMERA, 800, 600);
  near(center.x, 400); near(center.y, 300); near(center.depth, 650);
  const upperRight = projectPoint({ x: 30, y: 30, z: 0 }, DEFAULT_CAMERA, 800, 600);
  assert.ok(upperRight.x > center.x && upperRight.y < center.y);
  const nearer = projectPoint({ x: 30, y: 0, z: 300 }, DEFAULT_CAMERA, 800, 600);
  assert.ok(nearer.x - center.x > upperRight.x - center.x);
  assert.equal(projectPoint({ x: 0, y: 0, z: 651 }, DEFAULT_CAMERA, 800, 600), null);
  assert.equal(projectPoint({ x: 0, y: 0, z: 645 }, DEFAULT_CAMERA, 800, 600), null);
  assert.equal(projectPoint({ x: 0, y: 0, z: 0 }, DEFAULT_CAMERA, 0, 600), null);
});

test('pitch and roll change projection independently', () => {
  const origin = { x: 0, y: 0, z: 0 };
  const pitch = projectPoint(origin, { ...DEFAULT_CAMERA, pitch: 0.1 }, 800, 600);
  assert.ok(pitch.y > 300, 'looking up makes the origin appear below center');
  const rolled = projectPoint({ x: 40, y: 0, z: 0 }, { ...DEFAULT_CAMERA, roll: Math.PI / 2 }, 800, 600);
  near(rolled.x, 400); assert.ok(rolled.y > 300);
});

test('persisted camera sanitizes invalid values while preserving full rotations', () => {
  const normalized = normalizeCamera({ x: Infinity, y: -Infinity, z: NaN, yaw: Math.PI * 8 + 0.7, pitch: Math.PI, roll: -Math.PI * 3 });
  assert.equal(normalized.x, 0); assert.equal(normalized.y, 0); assert.equal(normalized.z, 650);
  near(normalized.yaw, 0.7); near(Math.abs(normalized.pitch), Math.PI); near(Math.abs(normalized.roll), Math.PI);
  assert.deepEqual(normalizeCamera(null), DEFAULT_CAMERA);
});

test('graph bounds keep real identities and directed typed edges with no dangling or fabricated connections', () => {
  const nodes = Array.from({ length: MAX_NODES + 15 }, (_, i) => ({ id: `n${i}`, title: `Source ${i}`, kind: 'source' }));
  const edges = Array.from({ length: MAX_EDGES + 20 }, (_, i) => ({ from: `n${i % MAX_NODES}`, to: `n${(i + 1) % MAX_NODES}`, type: `real-type-${i}`, weight: i / 1000 }));
  const result = boundGraph({ nodes: [nodes[0], nodes[0], null, ...nodes], edges: [{ from: 'n0', to: 'missing', type: 'link' }, ...edges, edges[0]] });
  assert.equal(result.nodes.length, MAX_NODES); assert.equal(result.edges.length, MAX_EDGES);
  assert.equal(new Set(result.nodes.map(node => node.id)).size, MAX_NODES);
  assert.ok(result.edges.every(edge => result.nodes.some(node => node.id === edge.from) && result.nodes.some(node => node.id === edge.to)));
  assert.deepEqual(result.edges[0], edges[0]);
  assert.deepEqual(boundGraph({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [] }).edges, []);
});

test('force layout is finite, deterministic across node ordering, and contains only supplied nodes', () => {
  const graph = boundGraph({ nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], edges: [{ from: 'a', to: 'b', type: 'link' }] });
  const first = layoutGraph(graph), reversed = layoutGraph({ ...graph, nodes: [...graph.nodes].reverse() });
  assert.deepEqual(first, reversed);
  assert.deepEqual([...first.keys()], ['a', 'b', 'c']);
  for (const position of first.values()) assert.ok(Object.values(position).every(Number.isFinite));
  for (const axis of ['x', 'y', 'z']) near([...first.values()].reduce((sum, point) => sum + point[axis], 0), 0);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const withoutEdges = layoutGraph({ ...graph, edges: [] });
  assert.ok(distance(first.get('a'), first.get('b')) < distance(withoutEdges.get('a'), withoutEdges.get('b')));
  assert.equal(layoutGraph({ nodes: [], edges: [] }).size, 0);
  assert.deepEqual(layoutGraph({ nodes: [{ id: 'only' }], edges: [] }).get('only'), { x: 0, y: 0, z: 0 });
});
