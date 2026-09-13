# Shared Chatbot Module

`index.mjs` connects to an actual OpenAI-compatible inference engine. No output is synthesized when an engine or model is unavailable. Local models are referenced from shared `mba.robin` storage; importing a model does not imply that an engine has loaded it.

```js
import { createChatbot } from './chatbot/index.mjs';
const assistant = createChatbot({ endpoint: 'http://127.0.0.1:8080/v1' });
console.log(await assistant.probe());
for await (const event of assistant.chat({
  messages: [{ role: 'user', content: 'What do my sources say?' }],
  evidence: [{ id: 'immutable-section-id', title: 'Local manual',
    text: 'Retrieved excerpt', sourceRef: { artifactId: 'sha256...', articleKey: 'A/example' } }],
  signal: abortController.signal,
})) console.log(event);
```

`probe()` discovers advertised IDs through `/models`; this does not claim that every advertised model is already loaded. The default selection prefers an advertised LFM 2.5 ID, then the first advertised ID. The other preference labels are options, not invented IDs or claims that a backend supports a format. Passing `model` selects exactly that advertised model.

`chat()` yields `start`, `delta`, optional backend `reasoning`, and `done` events. Consumer cancellation or an abort signal cancels the response stream. Deadlines, history, evidence, response size, and individual streaming events are bounded. A malformed, truncated, timed-out, or failed response throws `ChatbotError` with a stable `code`; the caller must distinguish a partial answer from a completed one.

Evidence is serialized as untrusted user-level data under a separate system contract. `[S1]` citations map back to immutable source references. `done.citedSourceIds` and `unsupportedCitationIds` report citation syntax and mapping, not whether the model's claim is entailed by the source. Prompt separation helps but is not a proof against model prompt injection.

`embed({input, model, signal})` calls the real `/embeddings` endpoint and verifies count, ordering, numeric values and dimensions. There is no generated substitute vector. Capability state becomes `verified` only after the corresponding operation succeeds. Model discovery alone does not verify generation or embeddings.

Loopback is required by default, redirects are rejected, and `localhost` must resolve exclusively to loopback. Set `allowRemote: true` only in explicit operator configuration for a trusted homestead endpoint. Evidence then travels to that configured server. Never derive this permission or the destination from a source document or model response.

TurboQuant compresses KV cache separately from weight quantization. This generic protocol cannot attest to TurboQuant. A caller can supply `capabilities: {kvCache: {compression: 'turboquant', detail: 'operator deployment evidence'}}`; it remains `operator-configured`, with `verified: false`. The adapter does not silently send unrecognized compression flags.

## Managed model loading

`managed-runtime.mjs` starts an explicitly installed `llama-server` executable with a real GGUF v2/v3 model located inside the configured shared store. It reads the original model in place, binds only to loopback, uses fixed bounded flags, and never invokes a shell or downloads executable/model bytes.

```js
import { createManagedRuntime } from './chatbot/managed-runtime.mjs';
const runtime = createManagedRuntime({
  binary: '/opt/llama.cpp/llama-server', storeRoot: '/data/mba.robin',
  port: 8080, contextSize: 4096, gpuLayers: 0, threads: 4,
});
await runtime.start({ modelPath: '/data/mba.robin/objects/actual-gguf-artifact-id' });
// createChatbot({endpoint: runtime.endpoint}) now uses that local process.
await runtime.stop();
```

Model compatibility is determined by the actual llama-server build. Importing Bonsai, ternary weights, or a Gemma-family artifact does not make an incompatible build support it. Managed loading uses backend-default KV cache and makes no TurboQuant claim. Shutdown must call `runtime.stop()`; application process-exit handling belongs to the host server.

Protocol tests use a local HTTP fixture and do not establish real inference quality or model compatibility. Actual inference acceptance requires a real runtime and model.

Protocol references: [llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server), [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), [LM Studio compatibility](https://lmstudio.ai/docs/developer/openai-compat).
