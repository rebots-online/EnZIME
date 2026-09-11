# EnZIME local engine implementation report

**Status: local beta implementation, 11 September 2026.** This report supersedes
the original skeleton's statements that ZIM reading and inference were
unconnected. It does not reduce the mature [PRD](PRD.md), certify native platform
releases, or declare the whole project commercially complete.

## Product scope

Preparedness is the first use case: retain usable sources and adapt their
knowledge to the question at hand without requiring a cloud model. **LFM 2.5 is
the leading default**, with explicit choices for actually compatible models.
The Knowledge Mesh is the semantic structure used by navigation and retrieval.
Sharing and network transport are separate concerns.

| Area | Local implementation | Boundary |
| --- | --- | --- |
| Library | Immutable SHA-256 objects, linked files/models, editions, reading state, quotas, single writer | Local profile; cross-app grants/SAF/OPFS remain open |
| Sources | ZIM articles/resources, PDF extraction/viewing, EPUB chapters, sanitized HTML, text, media | Unopened/partial coverage disclosed; OCR and broad conformance open |
| Knowledge Mesh | Locators/hashes, explicit/asserted edges, overlays, tombstones, note snapshots | Source bodies do not accumulate permanently in the graph |
| Retrieval | Lexical/graph ranking, actual optional embedding endpoint, immutable citations | Bounded discovery; real embedding quality and corpus performance open |
| Spatial view | Source graph, translation plus yaw/pitch/roll, saved camera, source navigation | 300-node/600-edge display; actual browser/device QA open |
| Assistant | Shared streaming module, model selection, evidence/citations, cancellation/errors, history | Citation mapping does not prove entailment; no fabricated offline answer fallback |
| Managed models | Catalog-selected GGUF, hash verification, linked weights, ephemeral bearer authentication, readiness/stop/failure recovery | Actual backend/device compatibility required; no TurboQuant claim |
| Authoring | Private drafts, immutable final revisions, corrections, generated ZIM editions | Rich editor/clipper and complete merge workflows open |
| DynDon | Complete-unit plans, dependencies, essentials, domain/depth controls, reservations, pause/resume, ZIM generation | Arbitrary remote Wikipedia subsets need prepared manifests/Creator output |
| Backups | Objects/catalog, optional payloads, historical mesh/notes, explicit missing sources | Personal backup contains private drafts/chats; public sharing is distinct |
| Billing | Purchase routing and signed-claim primitive | Live BIDLR payments, reconciliation and commercial acceptance open |

The original `ThinkSpace.tsx`/Pysanky playground remains a separate historical
handoff. The local mesh uses real source records. Optional Easter egg behavior
does not define or gate reading, storage policy or RAG.

## Source identity and bounded storage

ZIM/PDF/EPUB bodies stay in the original mounted archive or an immutable managed
object. Nodes carry edition, canonical key/page locator and extracted-evidence
fingerprint. Corrections become new layers; active retrieval resolves precedence
and deletion without rewriting the original. Notes/final work survive eviction.

Default text projections are bounded to **8 MiB** and vectors to **4 MiB**.
The archive adapter separately retains up to **64 MiB** of decompressed clusters,
**2 MiB** of directory entries and **1 MiB** of pointer pages per mounted archive.
It rejects compressed/decompressed clusters over **128 MiB** and requested blobs
over **32 MiB**. Uncompressed clusters use positional blob reads. These limits
are not a total process-memory or battery guarantee.

ZIM title/path listing scans at most 20,000 entries per call, with a continuation
cursor; it is not Xapian full-text search. Opened PDF/EPUB pages are retrievable,
without claiming every unopened page was read. Newly resolved text is checked
against source fingerprints. Vector similarity does not create asserted facts.

## Actual local inference

The final application acceptance completed **2026-09-11 at 02:57:58 UTC**.
It exercised the real HTTP application: linked GGUF mounting, managed loading,
uploaded valid ZIM reading, retrieval, `/api/chat` streaming, citation opening,
note/chat persistence across restart, integrity checks and clean shutdown.
No protocol fixture supplied the generated answer. The retained
[sanitized acceptance record](validation/app-local-inference-evidence.json)
contains exact requests/statuses, source text, response, hashes and results;
only absolute model paths have been replaced with a placeholder.

| Item | Exact pin or setting |
| --- | --- |
| Engine | Official `ggml-org/llama.cpp` **b10809**, `0.4.0-dev`, Linux x86-64 CPU |
| Engine source commit | `5266f24da75dc449bd56cbed7addb9c8e4a6a73e` |
| Engine archive | `llama-b10809-bin-ubuntu-x64.tar.gz` |
| Engine archive SHA-256 | `5e34434ddc6d03cd1584f403201aff0d4bd1a5793a72ff7e286532dfd1e4b941` |
| Server executable SHA-256 | `07723ae07835bdf11cf0d00d68eb4df8308df0603f689c64c9f841a626cad01d` |
| Model repository | `LiquidAI/LFM2.5-1.2B-Instruct-GGUF` |
| Model revision | `6767265158422fb8a19c62ceb45f16f05363615b` |
| Model filename | `LFM2.5-1.2B-Instruct-Q4_K_M.gguf` |
| Model bytes | `730895168` |
| Model SHA-256 | `b1b3de114215d9507409a662a501a631095a479a419584e8a2ded6304b19b4f5` |
| Host | Linux x64 container, Node `v24.19.0`, reported AMD EPYC 9V74 CPU |
| Managed engine configuration | 4 CPU threads, 0 GPU layers, 4096 context |
| Final application generation defaults | 2048 maximum output tokens, temperature 0.3 |
| Final HTTP source ZIM SHA-256 | `e7f80ea9636477610e19de60dd05c1904b5e3b2cb3d6ff0d93f2664b35280cfd` |
| Final HTTP source-text SHA-256 | `a45c9cc4816099c7c6d7097f5732063a3807403d434c421428e9879ccf9bae92` |

Downloaded hashes matched their published release/LFS hashes. Primary sources:
[llama.cpp b10809](https://github.com/ggml-org/llama.cpp/releases/tag/b10809),
[pinned LiquidAI model](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/tree/6767265158422fb8a19c62ceb45f16f05363615b).

Final application model loading took **3.083 s**. Generation through `/api/chat`
took **5.234 s**, with first output text after **4.490 s**. Exact answer:

> The source states that the fictional test light draws 6 watts and running it for 3 hours requires 18 watt-hours. This information is cited directly from the excerpt. [S1]

The completion had `finishReason: "stop"`, cited `S1`, and no unsupported citation
IDs. Its citation opened the original source before and after application
restart. Notes, the immutable note snapshot and chat remained available. Source
and model hashes were unchanged; duplicated managed model bytes were zero.
Shutdown stopped the child and restart correctly reported the runtime stopped.

Direct unauthenticated model-discovery and chat requests to the managed engine
both returned **HTTP 401**. Its ephemeral bearer key was absent from public
status. The broker supplies the internal credential to the shared module; an
advertised model alone does not establish authenticated readiness.

Earlier real component checks recorded **2.320 s** managed readiness,
**3.259 s** generation and **2.563 s** first token for the direct module path,
then **2.648 s** startup/**3.699 s** generation through the catalog runtime
service. The latter also exercised unavailable-model failure recovery. These
different paths and prompts must not be treated as repeated benchmark samples.

These short functional measurements describe one container with artifacts
downloaded before inference. They are not a hardware comparison, network-isolation
audit, quality benchmark, memory benchmark or phone-performance promise. The KV
cache used backend defaults: **TurboQuant was not enabled or verified**. Other
models, GPU backends, long contexts and Android inference need separate evidence.

## Real ZIM compatibility

The adapter mounts unchanged official OpenZIM archives, returns actual HTML/PNG
bytes, resolves canonical redirect targets and verifies checksums. Three small
fixtures are tracked under `native/fixtures`:

| Version | Compression exercised | Official source fixture |
| --- | --- | --- |
| 5.0 | XZ/LZMA and raw | `data/withns/small.zim` |
| 6.1 | Zstandard and raw | `data/nons/small.zim` |
| 6.3 | Zstandard; no legacy title listing | `data/noTitleListingV0/small.zim` |

Source: official
[openzim/zim-testing-suite](https://github.com/openzim/zim-testing-suite/tree/2edf72096208e60c82b6ebbe313baa552cc6af52),
commit `2edf72096208e60c82b6ebbe313baa552cc6af52`; hashes and format references are
in [native/README.md](../native/README.md). Additional successful HTML reads and
checksum verification covered Belarusian Wikibooks and Wikipedia climate-change
mini in each fixture family, including 6.2 and up to 20,568 directory entries.
This is compatibility evidence, not full-Wikipedia performance evidence.

The existing Rust library had incorrect OpenZIM magic, directory layout and
compression mappings, unfinished URL listing, and tests that logged parse
failures. Original sources are retained. The working Node adapter is a corrected
reader-contract implementation, not a claim to have completed/linked the Rust
native library. The invalid original 605-byte `wiki-mini.zim` is rejection
regression evidence, not a valid corpus.

## Build, run and package

From `consolidated`, using Node 24+:

```sh
npm ci
npm run build
npm test
npm start
```

Open `http://127.0.0.1:4173`. Source tests cover storage/identity, corrupt archives,
retrieval/overlays, DynDon recovery/reservations, HTTP integration, streaming and
managed lifecycle, camera mathematics and isolated DOM flows. Mocked protocol
and DOM tests are separate from the real model runs above. Record the exact
final revision's results before packaging; past runs do not validate later edits.
The final source integration run passed **98 tests**. Child-process CLI tests
verify SIGINT/SIGTERM stop the managed engine and release storage locks while
preserving saved data; failed port binding also cleans up. The packaged artifact still
requires its own launch and integrity checks; source results do not establish
native-platform or visual/browser acceptance.

Build a Linux package with Node and the verified CPU inference engine:

```sh
node scripts/package.mjs \
  --node-license /path/to/exact-node-release/LICENSE \
  --llama-runtime /path/to/llama-b10809 \
  --out /path/to/releases
```

Supply the complete matching Node license. Retain the official llama.cpp archive
beside its extracted directory for integrity checks. Packages record runtime/
dependency notices, provenance, `BUILD-INFO.json`, file checksums and an archive
hash. Model weights are not bundled. The host needs the documented Linux runtime
libraries; older ZIMs may need `xz` or `bzip2`. Extracted packages use `./launch.sh`;
`MBA_ROBIN_PORTABLE=1 ./launch.sh` selects adjacent shared data. See
[RUNNING.md](RUNNING.md) for full operator instructions.

## Remaining release gates

The [complete checklist](RELEASE_CHECKLIST.md) retains the broader requirements:
native Tauri Windows/Linux/Android releases; Android SAF and cross-app grants;
browser WebGPU/WASM/OPFS; actual TurboQuant support; the model/device matrix;
live BIDLR billing; prepared Wikipedia manifests; arbitrary corpus authoring,
merge and resize; large-corpus/memory/battery qualification; real browser visual
and accessibility QA; mature backup/migration recovery; and Sanctissimissa
catalogue integration. The working local engine advances those requirements
without automatically completing them.
