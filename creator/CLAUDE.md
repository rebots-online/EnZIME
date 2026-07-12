# EnZIME Creator — project-local Claude Code instructions

> **Placeholder name.** "EnZIME Creator" / "EnZIME Studio" are working
> labels per operator note 2026-05-14. Real name TBD. The `creator/`
> directory name is chosen to be naming-neutral and won't be load-bearing
> when the real name is picked.

Inherits from the suite-level `../CLAUDE.md` and the global spine at
`~/.claude/CLAUDE.md`. This file documents **creator-app-specific**
overrides — the things that differ from the reader (`../`).

## Role in the suite

The Creator is the **producer** end of the EnZIME suite. It ingests
content from the network and from local files, assembles it into ZIM
artifacts with rich metadata, and publishes those artifacts to the
operator-controlled mirror for the Reader app to consume.

Three apps in the suite:

| App | Role | Location |
|---|---|---|
| **Reader** (EnZIME) | Consume ZIMs | `../src-tauri/` + `../frontend/` (still at repo root pending eventual move) |
| **Creator** (this app) | Produce ZIMs | `./src-tauri/` + `./frontend/` |
| **Extension** (Chrome MV3) | Page-clipper that feeds the Creator | `../extension/` |

## Invariants (binding for this app)

- **NOT INV-OFFLINE.** The reader is offline-first; the creator is not.
  Per [[project_creator_not_offline_first]]: network is expected and
  used; web ingestion is in-scope; Forgejo LFS publish is required.
- **INV-NO-EXPO.** Same as the reader and suite. Tauri 2 + Vite only.
- **INV-NO-APPLE — open for this app.** The reader rejects Apple
  ideologically (prepper market + INV-NO-APPLE). The creator's
  enterprise market may include macOS users. **Operator decision
  pending**; default for now is "Linux + Windows + maybe Android, no
  macOS" matching the reader, until operator explicitly opens it.
- **Anti-unnecessary-fragility binds.** Per the suite ideology
  (`~/forgejo/admin/DOCS/IDEOLOGIES/anti-unnecessary-fragility.md`).
  The creator may touch third-party content sources for ingestion,
  but: never as a runtime dependency for *creator-functionality*; only
  as content-of-record being mirrored into operator infrastructure.

## Markets (two segments — one codebase)

Per [[project_creator_two_market_segments]]:

- **Enterprise**: policies / documentation / training material
  ZIMifier (B2B sale). Feature emphasis: bulk import, metadata +
  classification, multi-curator workflow, branded output, audit trail.
- **Home**: scrapbooking / Notion-with-output-focus
  ("formatting-for-consuming, not collecting"). Feature emphasis:
  typography, image/media layout, output-shaped templates (cookbook,
  memoir, journal, reference), WYSIWYG-matches-reader preview.

One codebase serves both; feature visibility per tier; marketing
positioning diverges.

## Stack

- **Shell**: Tauri 2 (shared `../vendor/tauri/`).
- **Backend**: Rust at `creator/src-tauri/`.
- **Frontend**: Vite + React + TypeScript + Zustand (matches reader for
  consistency).
- **ZIM library**: shared `../src-tauri/anzimmermanlib/rust/` —
  **write-side surface is currently unimplemented** and is on the
  per-app architectural-pass agenda. Path-dep into the reader tree for
  now; promotion of anzimmermanlib to a top-level `crates/` directory
  happens when both apps actively use it.
- **LLM**: optional. Whether the creator embeds an on-device LLM is
  per-app architectural-pass decision. Likely yes for synthesis assist
  (clean-room research methodology — see below), but not load-bearing
  the way it is for the reader.
- **Entitlements**: shared `../bridge/` (EntitlementSyncBridge).

## Gating / monetization shape (when architected)

Per [[non-artificial-gating]] + [[feedback_ci_built_per_user_artifact_gating]]:

- **Probably-ultimate model**: CI-built per-user artifact. Payment
  triggers a Forgejo CI build producing a signed binary embedded with
  that user's entitlements / preferred templates / signing keys for
  publishing to operator mirror.
- **Templates as paid content**: weak structurally because the
  on-device LLM forecloses generative-output gating. Carve-outs:
  professional-designer-touched templates (real labor) and curated
  exemplars. Generic "premium templates" is the anti-pattern.
- **Defensibly structural paid surfaces**:
  - Premium curated ZIM packs / templates (real curation labor)
  - Continuous updates (operator labor)
  - Multi-curator / enterprise workflow (real infrastructure)
  - Sync / multi-device (infrastructure cost)
  - Clean-room research methodology bundling (operator labor +
    verifiable provenance)
- **Free tier shape**: TBD per segment; enterprise probably has no
  free tier (B2B sales motion); home likely has a "personal use"
  permanent free tier per [[non-artificial-gating]] preference order.

## Architecturally-significant features (Wave-future)

Forwarded from suite-level memory; will become per-app entity rows
when this app gets its dedicated architect session:

- **Clean-room research methodology**
  ([[project_clean_room_research_methodology]]) — source-read /
  spec-extract / synthesize-clean / attest. Sidecar attestation
  bundled with output ZIM. Particularly load-bearing for the
  enterprise segment (compliance) and the prepper-content-distribution
  case (IP defensibility).
- **Heavy metadata emission for rich consumption**
  ([[project_sidecar_annotations_and_metadata_interactivity]]) —
  cross-references, glossary entries, comprehension checks, audit
  hooks. The creator emits the metadata namespace; the reader honors
  it.
- **Mesh / transport-agnostic sharing protocol participation**
  ([[project_lora_mesh_knowledge_sharing]]) — produced ZIMs must be
  mesh-friendly (article-granular addressable, signed, chunkable).
  This shapes anzimmermanlib write-side from the start; it is not a
  retrofit.

## Phase discipline

Same I-1 through I-10 invariants as the rest of the suite. This app's
`./ARCHITECTURE.md` and `./CHECKLIST.md` will be authored in dedicated
architect sessions per the operator's "different sessions" preference.
Until then, the only thing in those files is bootstrap scaffolding.

## Coder dispatch

GLM-4.7 via `zclaude-coder-47`, one-task atomic — same as reader. See
the suite-level `../CLAUDE.md` for the dispatch idiom.

## Cross-references

- Suite-level `../CLAUDE.md` — routing + shared infrastructure
- `../CLAUDE.md` (when restructured) — reader-specific rules
- `../extension/CLAUDE.md` — extension-specific rules
- Project memory under `~/.claude/projects/-home-robin-forgejo-EnZIME/memory/`
- Suite ideology in `~/forgejo/admin/DOCS/IDEOLOGIES/`
