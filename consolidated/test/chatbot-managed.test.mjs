import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createManagedRuntime } from '../chatbot/managed-runtime.mjs';

async function temp(t) { const root = await mkdtemp(path.join(os.tmpdir(), 'enzime-runtime-protocol-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }

test('managed runtime: paths, file formats, and bounded launch configuration fail closed', async t => {
  const root = await temp(t); const model = path.join(root, 'not-a-model'); await writeFile(model, 'not GGUF');
  const runtime = createManagedRuntime({ binary: process.execPath, storeRoot: root });
  await assert.rejects(runtime.start({ modelPath: model }), { code: 'INVALID_MODEL' });
  await assert.rejects(runtime.start({ modelPath: process.execPath }), { code: 'MODEL_OUTSIDE_STORE' });
  const link = path.join(root, 'outside'); await symlink(process.execPath, link);
  await assert.rejects(runtime.start({ modelPath: link }), { code: 'MODEL_OUTSIDE_STORE' });
  assert.throws(() => createManagedRuntime({ binary: 'llama-server', storeRoot: root }), { code: 'INVALID_INPUT' });
  assert.throws(() => createManagedRuntime({ binary: process.execPath, storeRoot: root, contextSize: 999999999 }), { code: 'INVALID_INPUT' });
  assert.equal(runtime.status().state, 'stopped');
});

test('managed lifecycle protocol fixture: read shared path in place, start and stop owned process', { skip: process.platform === 'win32' }, async t => {
  const root = await temp(t); const binary = path.join(root, 'fixture-server'); const model = path.join(root, 'fixture.gguf');
  // Header-only test artifact and HTTP process fixture: neither constitutes a model or real inference.
  const header = Buffer.alloc(8); header.write('GGUF'); header.writeUInt32LE(3, 4); await writeFile(model, header);
  await writeFile(binary, '#!' + process.execPath + '\n' + `
const http = require('node:http');
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
http.createServer((req,res) => {
if(req.url !== '/health' && req.headers.authorization !== 'Bearer '+process.env.LLAMA_API_KEY)return res.writeHead(401).end();
res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify(req.url === '/health' ? {status:'ok'} : {data:[{id:'managed-protocol-fixture'}]}));
}).listen(port,'127.0.0.1');
`, { mode: 0o700 });
  const runtime = createManagedRuntime({ binary, storeRoot: root, port: await freePort(), startupTimeoutMs: 5000, probeIntervalMs: 20 });
  t.after(() => runtime.stop());
  const ready = await runtime.start({ modelPath: model });
  assert.equal(ready.state, 'ready'); assert.equal(ready.modelPath, model); assert(ready.pid > 0);
  assert.equal(ready.kvCache.turboQuantVerified, false);
  assert.equal(ready.authentication.verified, true);
  const connection = runtime.connectionOptions(); assert.match(connection.apiKey, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(ready).includes(connection.apiKey), false);
  assert.equal((await fetch(connection.endpoint + '/models')).status, 401);
  assert.equal((await fetch(connection.endpoint + '/models', {headers:{Authorization:'Bearer '+connection.apiKey}})).status, 200);
  assert.equal((await runtime.start({ modelPath: model })).pid, ready.pid);
  assert.equal((await runtime.stop()).state, 'stopped');
  assert.throws(() => runtime.connectionOptions(), {code:'RUNTIME_NOT_READY'});
  assert.throws(() => process.kill(ready.pid, 0), { code: 'ESRCH' });
});

test('managed runtime refuses an engine that ignores the configured API key', { skip: process.platform === 'win32' }, async t => {
  const root = await temp(t); const binary = path.join(root, 'unauthenticated-fixture'); const model = path.join(root, 'fixture.gguf');
  const header = Buffer.alloc(8); header.write('GGUF'); header.writeUInt32LE(3, 4); await writeFile(model, header);
  await writeFile(binary, '#!' + process.execPath + '\n' + `
const http = require('node:http'); const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
http.createServer((req,res) => res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify(req.url === '/health' ? {status:'ok'} : {data:[{id:'insecure-protocol-fixture'}]}))).listen(port,'127.0.0.1');
`, {mode:0o700});
  const runtime = createManagedRuntime({binary,storeRoot:root,port:await freePort(),startupTimeoutMs:5000,probeIntervalMs:20});
  t.after(() => runtime.stop());
  await assert.rejects(runtime.start({modelPath:model}), {code:'RUNTIME_AUTH_UNVERIFIED'});
  assert.equal(runtime.status().state, 'failed'); assert.equal(runtime.status().pid, null);
});
