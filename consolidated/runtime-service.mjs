import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { createManagedRuntime } from './chatbot/managed-runtime.mjs';
import { createChatbot, ChatbotError } from './chatbot/index.mjs';

const HASH = /^[a-f0-9]{64}$/;
const fail = (code, message) => new ChatbotError(code, message);
function integer(value, fallback, min, max, name) {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < min || result > max) throw fail('INVALID_INPUT', `${name} must be an integer between ${min} and ${max}.`);
  return result;
}

/**
 * Local broker integration for the shared Chatbot Module.
 * The browser supplies a catalog asset ID only. Executable/port come from the
 * operator; model paths come exclusively from the store's approved artifacts.
 * A mounted model uses its resolved parent as the subprocess's permitted root,
 * but only its exact catalog-resolved file is ever passed to that subprocess.
 */
export function createRuntimeService({ store, onEndpoint = () => {},
  binary = process.env.ENZIME_LLAMA_SERVER_BIN || '',
  port = Number(process.env.ENZIME_LLAMA_SERVER_PORT || 8097),
  contextSize = Number(process.env.ENZIME_LLAMA_CONTEXT_SIZE || 4096),
  gpuLayers = Number(process.env.ENZIME_LLAMA_GPU_LAYERS || 0),
  threads = Number(process.env.ENZIME_LLAMA_THREADS || 4),
  startupTimeoutMs = 180_000, verifyOnStart = true,
} = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.file !== 'function' || !store.root) throw fail('INVALID_INPUT', 'A shared model catalog is required.');
  if (typeof onEndpoint !== 'function' || typeof verifyOnStart !== 'boolean') throw fail('INVALID_INPUT', 'Runtime callbacks and integrity policy must be explicit operator configuration.');
  const configured = typeof binary === 'string' && binary.length > 0;
  integer(port, 8097, 1024, 65535, 'port'); integer(contextSize, 4096, 256, 131072, 'contextSize');
  integer(gpuLayers, 0, 0, 999, 'gpuLayers'); integer(threads, 4, 1, 256, 'threads');
  integer(startupTimeoutMs, 180_000, 100, 1_800_000, 'startupTimeoutMs');
  let runtime = null; let queue = Promise.resolve(); let revision = 0; let startup = null; let closed = false;
  let current = { state: configured ? 'stopped' : 'unconfigured', endpoint: `http://127.0.0.1:${port}/v1`,
    assetId: null, modelId: null, modelName: null, contextSize, gpuLayers, threads, lastError: null };
  const serialize = operation => { const result = queue.then(operation, operation); queue = result.catch(() => {}); return result; };
  const status = () => {
    const live = runtime?.status();
    const state = live && !['validating', 'stopping'].includes(current.state) ? live.state : current.state;
    return { configured, status: { ...current, state,
      ...(live ? { pid: live.pid, kvCache: live.kvCache, authentication: live.authentication, lastError: current.lastError || live.lastError } : {}),
      ...(!configured ? { detail: 'Set ENZIME_LLAMA_SERVER_BIN to an installed llama-server executable to load a shared GGUF model here.' } : {}) } };
  };

  async function resetEndpoint() { await onEndpoint(null, null); }
  async function stopInternal() {
    if (runtime) {
      current.state = 'stopping';
      try { await runtime.stop(); }
      catch (error) { current.state = 'failed'; current.lastError = error.message; await resetEndpoint(); throw error; }
      runtime = null;
    }
    await resetEndpoint();
    current = { ...current, state: configured ? 'stopped' : 'unconfigured', assetId: null, modelId: null, modelName: null, lastError: null };
    return status();
  }

  async function startInternal(value, { signal, ticket }) {
    if (closed) throw fail('RUNTIME_CLOSED', 'The model runtime service is closed.');
    if (!configured) throw fail('RUNTIME_NOT_CONFIGURED', 'Set ENZIME_LLAMA_SERVER_BIN to an installed llama-server executable first.');
    if (ticket !== revision || signal?.aborted) throw fail('CANCELLED', 'Model loading cancelled.');
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['assetId', 'contextSize', 'gpuLayers', 'model'].includes(key))) throw fail('INVALID_INPUT', 'Choose an asset ID and optional context size, GPU layers, or advertised model ID.');
    if (!HASH.test(value.assetId || '')) throw fail('INVALID_INPUT', 'Choose a model asset from the shared library.');
    const asset = store.get(value.assetId);
    if (!asset) throw fail('MODEL_NOT_FOUND', 'The selected model is not in the shared library.');
    if (asset.kind !== 'model') throw fail('NOT_MODEL', 'The selected library asset is not a model.');
    const selectedContext = integer(value.contextSize, contextSize, 256, 131072, 'contextSize');
    const selectedGPU = integer(value.gpuLayers, gpuLayers, 0, 999, 'gpuLayers');
    if (value.model !== undefined && (typeof value.model !== 'string' || !value.model || value.model.length > 512)) throw fail('INVALID_INPUT', 'A model ID must be a nonempty advertised ID.');
    const previous = { ...current };
    startup = new AbortController();
    const combined = signal ? AbortSignal.any([signal, startup.signal]) : startup.signal;
    let stoppedPrevious = false;
    try {
      current = { ...current, state: 'validating', lastError: null };
      // file() checks mounted source presence and size/mtime before returning its approved path.
      const modelPath = await realpath(store.file(asset.id));
      if (verifyOnStart) {
        if (typeof store.verify !== 'function') throw fail('MODEL_INTEGRITY', 'The shared store cannot verify this model artifact.');
        const integrity = await store.verify(asset.id);
        if (!integrity.ok) throw fail('MODEL_INTEGRITY', 'The model no longer matches its recorded content hash. Verify and import it as a new edition.');
      }
      combined.throwIfAborted();
      if (ticket !== revision) throw fail('CANCELLED', 'Model loading was superseded.');
      // Recheck the store after hashing, then confine this launch to that exact source.
      if (await realpath(store.file(asset.id)) !== modelPath) throw fail('MODEL_INTEGRITY', 'The model location changed while being validated.');
      if (runtime && runtime.status().state === 'ready' && previous.assetId === asset.id && previous.contextSize === selectedContext && previous.gpuLayers === selectedGPU) {
        if (value.model && value.model !== previous.modelId) throw fail('MODEL_UNAVAILABLE', 'The requested model ID is not loaded by this runtime.');
        current = { ...previous, lastError: null }; return status();
      }
      const approvedRoot = asset.storage === 'mounted' ? path.dirname(modelPath) : store.root;
      // Construct before stopping the previous process so invalid operator configuration cannot tear it down.
      const replacement = createManagedRuntime({ binary, storeRoot: approvedRoot, port,
        contextSize: selectedContext, gpuLayers: selectedGPU, threads, startupTimeoutMs });
      if (runtime) await runtime.stop();
      stoppedPrevious = true; runtime = replacement;
      await resetEndpoint();
      current = { ...current, state: 'starting', assetId: asset.id, modelId: null, modelName: asset.name,
        contextSize: selectedContext, gpuLayers: selectedGPU, lastError: null };
      await runtime.start({ modelPath, signal: combined });
      const connection = runtime.connectionOptions();
      const models = await createChatbot(connection).listModels({ signal: combined });
      const modelId = value.model || models.find(model => model.recommended)?.id || models[0]?.id;
      if (!modelId || !models.some(model => model.id === modelId)) throw fail('MODEL_UNAVAILABLE', 'The requested model ID is not advertised by the loaded engine.');
      combined.throwIfAborted();
      if (ticket !== revision) throw fail('CANCELLED', 'Model loading was superseded.');
      current = { ...current, state: 'ready', modelId };
      await onEndpoint(runtime.endpoint, { assetId: asset.id, modelId, apiKey: connection.apiKey });
      return status();
    } catch (error) {
      const converted = combined.aborted ? fail('CANCELLED', 'Model loading cancelled.') : error;
      if (stoppedPrevious) {
        await runtime?.stop().catch(() => {}); runtime = null;
        current = { ...current, state: 'failed', modelId: null, lastError: converted.message };
        await resetEndpoint();
      } else current = { ...previous, lastError: converted.message };
      throw converted;
    } finally { startup = null; }
  }

  const start = (value, { signal } = {}) => {
    const ticket = ++revision; startup?.abort();
    return serialize(() => startInternal(value, { signal, ticket }));
  };
  const stop = () => { revision += 1; startup?.abort(); return serialize(stopInternal); };
  const close = () => { closed = true; return stop(); };
  async function handle({ req, res, url, input, json }) {
    const pathname = url.pathname;
    if (!['/api/runtime', '/api/runtime/start', '/api/runtime/stop'].includes(pathname)) return false;
    if (pathname === '/api/runtime' && req.method === 'GET') { json(200, status()); return true; }
    if (req.method !== 'POST' || pathname === '/api/runtime') { json(405, { error: 'Method not allowed' }); return true; }
    try {
      if (pathname === '/api/runtime/stop') { json(200, await stop()); return true; }
      const value = await input(65536); const abort = new AbortController();
      const disconnected = () => { if (!res.writableEnded) abort.abort(); };
      res.once('close', disconnected);
      try { const result = await start(value, { signal: abort.signal }); if (!res.destroyed) json(200, result); }
      finally { res.removeListener('close', disconnected); }
    } catch (error) {
      const code = error.code || 'RUNTIME_ERROR';
      const httpStatus = code === 'MODEL_NOT_FOUND' ? 404 : code === 'RUNTIME_NOT_CONFIGURED' ? 503 : code === 'CANCELLED' ? 409 : 400;
      if (!res.destroyed) json(httpStatus, { error: error.message, code, ...status() });
    }
    return true;
  }
  return { handle, status, start, stop, close };
}
