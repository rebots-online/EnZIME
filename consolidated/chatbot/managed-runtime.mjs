import { spawn } from 'node:child_process';
import { access, open, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createChatbot, ChatbotError } from './index.mjs';

function bounded(value, fallback, min, max, name) {
  const n = value ?? fallback;
  if (!Number.isInteger(n) || n < min || n > max) throw new ChatbotError('INVALID_INPUT', `${name} must be between ${min} and ${max}.`);
  return n;
}
async function checkPort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer(); server.once('error', () => reject(new ChatbotError('PORT_IN_USE', 'The managed inference port is already in use.')));
    server.listen({ port, host: '127.0.0.1', exclusive: true }, () => server.close(resolve));
  });
}

/** Explicit operator configuration only. Shared model bytes are read in place. No shell or downloads. */
export function createManagedRuntime({ binary, storeRoot, port = 8080, contextSize = 4096, gpuLayers = 0,
  threads = 4, startupTimeoutMs = 180_000, probeIntervalMs = 250 } = {}) {
  if (typeof binary !== 'string' || !path.isAbsolute(binary)) throw new ChatbotError('INVALID_INPUT', 'Configure the absolute path to an installed llama-server executable.');
  if (typeof storeRoot !== 'string' || !path.isAbsolute(storeRoot)) throw new ChatbotError('INVALID_INPUT', 'Configure the absolute mba.robin storage root.');
  bounded(port, 8080, 1024, 65535, 'port'); bounded(contextSize, 4096, 256, 131072, 'contextSize');
  bounded(gpuLayers, 0, 0, 999, 'gpuLayers'); bounded(threads, 4, 1, 256, 'threads');
  bounded(startupTimeoutMs, 180_000, 100, 1_800_000, 'startupTimeoutMs'); bounded(probeIntervalMs, 250, 10, 5000, 'probeIntervalMs');
  const endpoint = `http://127.0.0.1:${port}/v1`;
  let child = null; let startup = null; let closing = null; let generation = 0; let requested = 0; let queue = Promise.resolve(); let apiKey = null;
  let state = { state: 'stopped', endpoint, modelPath: null, pid: null, lastError: null, logTail: '',
    contextSize, gpuLayers, threads, authentication: { mode: 'ephemeral-bearer', verified: false },
    kvCache: { compression: null, status: 'backend-default', turboQuantVerified: false } };
  const status = () => structuredClone(state);
  const serialize = operation => { const result = queue.then(operation, operation); queue = result.catch(() => {}); return result; };

  async function stopChild() {
    if (closing) return closing;
    const process = child;
    if (!process) { apiKey = null; state.state = 'stopped'; state.pid = null; return status(); }
    closing = (async () => {
      state.state = 'stopping';
      if (process.exitCode === null && process.signalCode === null) {
        await new Promise(resolve => {
          const done = () => { clearTimeout(timer); process.removeListener('exit', done); resolve(); };
          const timer = setTimeout(() => { process.kill('SIGKILL'); }, 3000); timer.unref?.();
          process.once('exit', done); process.kill('SIGTERM');
        });
      }
      if (child === process) child = null;
      apiKey = null; state.state = 'stopped'; state.pid = null;
      return status();
    })();
    try { return await closing; } finally { closing = null; }
  }

  async function startInternal({ modelPath, signal } = {}) {
    signal?.throwIfAborted();
    if (typeof modelPath !== 'string' || !path.isAbsolute(modelPath)) throw new ChatbotError('INVALID_INPUT', 'Select an absolute shared-storage GGUF model path.');
    const [root, file, executable] = await Promise.all([realpath(storeRoot), realpath(modelPath), realpath(binary)]);
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw new ChatbotError('MODEL_OUTSIDE_STORE', 'The model must reside inside the configured shared mba.robin storage root.');
    const [fileStat, binaryStat] = await Promise.all([stat(file), stat(executable)]);
    if (!fileStat.isFile() || !binaryStat.isFile()) throw new ChatbotError('INVALID_INPUT', 'The model and inference executable must be regular files.');
    await access(executable, constants.X_OK);
    const handle = await open(file, 'r');
    try {
      const bytes = Buffer.alloc(8); const result = await handle.read(bytes, 0, bytes.length, 0);
      if (result.bytesRead !== 8 || bytes.toString('ascii', 0, 4) !== 'GGUF' || ![2, 3].includes(bytes.readUInt32LE(4))) throw new ChatbotError('INVALID_MODEL', 'The selected artifact is not a supported GGUF v2/v3 file.');
    } finally { await handle.close(); }
    if (child && state.state === 'ready' && state.modelPath === file) return status();
    await stopChild(); await checkPort(port);
    const token = ++generation;
    startup = new AbortController(); const startupSignal = signal ? AbortSignal.any([signal, startup.signal]) : startup.signal;
    const args = ['-m', file, '--host', '127.0.0.1', '--port', String(port), '-c', String(contextSize), '-ngl', String(gpuLayers), '-t', String(threads)];
    apiKey = randomBytes(32).toString('hex');
    state = { ...state, state: 'starting', modelPath: file, pid: null, lastError: null, logTail: '',
      authentication: { mode: 'ephemeral-bearer', verified: false } };
    let launchError = null;
    // Do not inherit unrelated llama launch options (including optional agent tools).
    // The key is passed only through the supported LLAMA_API_KEY environment field,
    // never the command line, public status, catalog, or browser.
    const env = Object.fromEntries(Object.entries(globalThis.process.env).filter(([key]) => !key.startsWith('LLAMA_')));
    Object.assign(env, { LLAMA_API_KEY: apiKey, LLAMA_ARG_CORS_ORIGINS: 'http://127.0.0.1', LLAMA_ARG_CORS_CREDENTIALS: 'false' });
    const process = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env });
    child = process; state.pid = process.pid ?? null;
    const capture = data => { if (generation === token) state.logTail = (state.logTail + data.toString('utf8')).replaceAll(apiKey || '\u0000', '[redacted]').slice(-8192); };
    process.stdout.on('data', capture); process.stderr.on('data', capture);
    process.once('error', error => { launchError = error; });
    process.once('exit', (code, exitSignal) => {
      if (generation === token && child === process && state.state !== 'stopping') {
        child = null; state.state = 'failed'; state.pid = null;
        state.lastError = `Inference process exited (${code ?? exitSignal ?? 'unknown'}).`;
      }
    });
    const deadline = Date.now() + startupTimeoutMs;
    const bot = createChatbot({ endpoint, apiKey, probeTimeoutMs: Math.min(2000, startupTimeoutMs) });
    try {
      while (Date.now() < deadline) {
        startupSignal.throwIfAborted();
        if (launchError) throw new ChatbotError('RUNTIME_LAUNCH_FAILED', 'The configured llama-server executable could not be started.', { cause: launchError });
        if (process.exitCode !== null || process.signalCode !== null || child !== process) throw new ChatbotError('RUNTIME_EXITED', state.lastError || 'The inference process exited before loading the model.');
        let healthy = false;
        try {
          const response = await fetch(`http://127.0.0.1:${port}/health`, {
            redirect: 'error', headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.any([startupSignal, AbortSignal.timeout(Math.min(2000, Math.max(1, deadline - Date.now())))]) });
          if (response.ok) healthy = (await response.json()).status === 'ok';
          else await response.body?.cancel().catch(() => {});
        } catch { startupSignal.throwIfAborted(); }
        if (healthy) {
          const unauthenticated = await fetch(`${endpoint}/models`, {
            redirect: 'error', signal: AbortSignal.any([startupSignal, AbortSignal.timeout(Math.min(2000, Math.max(1, deadline - Date.now())))]) });
          await unauthenticated.body?.cancel().catch(() => {});
          if (![401, 403].includes(unauthenticated.status)) throw new ChatbotError('RUNTIME_AUTH_UNVERIFIED', 'The installed engine did not enforce the managed API key. Update llama-server before loading a model.');
          const health = await bot.probe({ signal: startupSignal });
          if (health.available && health.models.length) { state.state = 'ready'; state.authentication.verified = true; return status(); }
        }
        await delay(Math.min(probeIntervalMs, Math.max(1, deadline - Date.now())), undefined, { signal: startupSignal });
      }
      throw new ChatbotError('RUNTIME_START_TIMEOUT', 'The model did not become ready within the configured startup timeout.');
    } catch (error) {
      const converted = startupSignal.aborted ? new ChatbotError('CANCELLED', 'Model loading cancelled.', { cause: error }) : error;
      await stopChild(); state.state = 'failed'; state.lastError = converted.message; throw converted;
    } finally { startup = null; }
  }
  return { endpoint, status,
    connectionOptions: () => {
      if (!apiKey || state.state !== 'ready') throw new ChatbotError('RUNTIME_NOT_READY', 'The managed model is not ready.');
      return { endpoint, apiKey };
    },
    start: options => {
      const ticket = ++requested; startup?.abort();
      return serialize(() => {
        if (ticket !== requested) throw new ChatbotError('CANCELLED', 'Model loading was superseded.');
        return startInternal(options);
      });
    },
    stop: () => { requested += 1; startup?.abort(); return serialize(stopChild); } };
}
