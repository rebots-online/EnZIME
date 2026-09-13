# EnZIME local knowledge engine

EnZIME now has a working local application for mounting knowledge sources,
reading and annotating them, connecting their knowledge, and asking a real local
model to apply retrieved passages. Preparedness is the first target use case.
This independently runnable **local beta** sits alongside the existing Tauri
projects. It does not close every mature-product or commercial-release gate.

1. **Read:** real ZIM archives, PDF pages, EPUB chapters, HTML, text and media.
2. **Understand:** a source-bound Knowledge Mesh, lexical retrieval, a configurable
   real embedding service in this beta, and a spatial navigator with six camera axes.
3. **Apply:** the shared Chatbot Module, managed GGUF loading or an existing
   local inference endpoint, streamed answers and mapped source citations.
4. **Keep:** independent notes, private drafts, immutable final revisions and
   correction layers, shared model references and personal backups.
5. **Fit:** DynDon plans complete prepared download units and generates valid
   budgeted ZIM editions without truncating archive bytes.

The **Knowledge Mesh means semantic relationships between sources**. Sharing is
a separate import/export concern. Pysanky remains an optional preserved
playground; reading and reasoning do not depend on its Easter egg functionality.

## Run from source

Use Node **24+**. From this directory:

```sh
npm ci
npm run build
npm test
npm start
```

Open **http://127.0.0.1:4173**. `npm ci` obtains dependencies once; the built
interface and installed sources are served locally. Set `MBA_ROBIN_HOME` to use
an existing shared data directory. Otherwise EnZIME uses an operating-system
data directory named `mba.robin`. A single process owns each catalog.

## Portable launch

For an extracted Linux portable package:

```sh
./launch.sh
```

To keep data beside the package on removable storage:

```sh
MBA_ROBIN_PORTABLE=1 ./launch.sh
```

The package builder can include Node and the pinned CPU `llama-server` runtime.
It does not include model weights. The included runtime targets Linux x86-64
with glibc; native Windows installers and Android packages remain separate gates.
See [running and packaging instructions](docs/RUNNING.md) for system dependencies,
the Windows Node launcher, data locations, and packaging commands.

## Local intelligence is a launch requirement

Every prepper launch configuration must deliver fast, role-tuned local practical synthesis of Wikipedia and other installed sources. A compact LFM2.5 profile, Bonsai27B low-bit choices, uncensored/abliterated derivatives and TurboQuant integration are specified in AI-01..10. Local retrieval, citations, context/tool capacity and the complete offline readiness pack must pass measured speed and quality gates before sales. Hardware selects a qualified local profile; cloud and homestead services are optional enhancements. The local beta's recorded inference evidence is bounded; it does not yet qualify this complete launch contract.

## Local models

**LFM 2.5 is the leading default.** Explicit model choices remain available for
other models supported by the actual engine and device. Bonsai 27B 1-bit/ternary
and Gemma-family preference labels do not certify backend compatibility.

The Linux launcher discovers a bundled engine automatically. With a separately
installed engine, set its executable path before launch:

```sh
ENZIME_LLAMA_SERVER_BIN=/opt/llama.cpp/llama-server ./launch.sh
```

Import or mount a supported GGUF as a model, select it in assistant settings, and
start the managed engine. Large models can remain linked to their original
shared-storage location. Alternatively, connect a running OpenAI-compatible
local server through Settings or `ENZIME_LLM_ENDPOINT`.

A real **LFM2.5-1.2B-Instruct Q4_K_M** run with official **llama.cpp b10809** has
passed actual application HTTP retrieval → shared chatbot streaming → cited
answer → restart with preserved notes/chat. Managed inference requires an
ephemeral bearer key; unauthenticated engine requests were rejected. Exact
pins, hashes and the measured environment are in the
[implementation and validation report](docs/LOCAL_ENGINE_RELEASE.md).
That short CPU test does not establish TurboQuant, GPU, Android or large-context
performance. TurboQuant remains unverified until a supporting engine is
integrated and measured; it is separate from model-weight quantization.

## Source identity and storage

Source bodies remain in their mounted ZIM/PDF/EPUB or immutable managed object.
The durable mesh holds source identities, article/page locators, hashes,
relationships and user notes. Parsed text and embedding caches are bounded and
evictable; clearing them preserves originals, notes and revision identities.
The reader does not progressively accumulate a permanent copy of Wikipedia.

ZIM title discovery is bounded and reports partial coverage. Opening a PDF or
EPUB page makes that page available to retrieval; the application does not claim
to have indexed every unopened page. Embedding retrieval is active only when a
configured embedding engine returns compatible real vectors.

## DynDon scope

The shared planner applies to complete prepared ZIM download units and to
generated ZIM editions. It accounts for dependencies, selected domains/depth,
essentials, reserves, staged output, and persisted resumable transfers.
**Arbitrary smaller Wikipedia editions require prepared manifests/content units
or a Creator service that produces them.** A storage slider cannot make any
remote monolithic ZIM valid by cutting bytes. The common policy remains intended
for every ZIM corpus, including Catholic collections; cross-application and
catalogue requirements remain tracked.

## Product and release records

- [Local implementation and evidence](docs/LOCAL_ENGINE_RELEASE.md)
- [Complete-to-market checklist](docs/RELEASE_CHECKLIST.md)
- [Mature product specification](docs/PRD.md)
- [Running and packaging](docs/RUNNING.md)
- [ZIM compatibility and fixture provenance](native/README.md)
- [Shared Chatbot Module contract](chatbot/README.md)
- [Original donor review](docs/DONOR_AUDIT.md)

Older donor/integration documents describe earlier project states. The local
implementation report supersedes their statements that ZIM and inference are
unconnected, without reducing the broader PRD requirements.

## Commercial boundary

Checkout routing and a signed-entitlement verification primitive exist. Live
BIDLR authentication, entitlement reconciliation, provider webhooks, production
purchase/restore/refund evidence, and approved pricing remain open. Without valid
configuration the application does not claim to take a payment or activate a
paid entitlement.
