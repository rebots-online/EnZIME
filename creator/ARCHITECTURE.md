# EnZIME Creator — Architecture (stub)

> **Status:** bootstrap stub only. Real architecture pass — entity
> table, flow diagrams, decision log — is authored in a dedicated
> session per the operator's "different sessions almost" project-
> boundary preference. This file exists to (a) mark the slot, (b)
> capture the architecturally-relevant facts already established at
> suite design time so the architect session inherits them rather than
> rediscovering them.

## Suite role recap

The Creator is the ZIM **producer** end of the EnZIME suite. Reader
consumes ZIMs; Creator produces them. Chrome Extension feeds the
Creator.

## Inherited constraints (from suite-level + operator memory)

These are established and binding before the architect session begins:

| Topic | Constraint | Source |
|---|---|---|
| **Invariants** | NOT INV-OFFLINE (network-using); INV-NO-EXPO binds; INV-NO-APPLE open | `./CLAUDE.md`, [[project_creator_not_offline_first]] |
| **Markets** | Two segments: enterprise (policies/docs ZIMifier) + home (scrapbook/Notion-output-focus); one codebase | [[project_creator_two_market_segments]] |
| **Stack** | Tauri 2 + Vite + React + TypeScript + Zustand; shared anzimmermanlib (write-side surface needs adding) | suite consistency |
| **Anti-fragility** | No third-party at runtime; ingestion sources are content-of-record only | `~/forgejo/admin/DOCS/IDEOLOGIES/anti-unnecessary-fragility.md` |
| **Gating** | CI-built per-user artifact is preferred terminal model; no generative-output gating (LLM forecloses); curation labor / infrastructure / capability-tier are defensible paid surfaces | [[feedback_ci_built_per_user_artifact_gating]], `~/forgejo/admin/DOCS/IDEOLOGIES/non-artificial-gating.md` |
| **Output shape** | ZIM artifacts with rich metadata namespace + sidecar provenance; mesh-friendly (article-granular signed addressable) | [[project_sidecar_annotations_and_metadata_interactivity]], [[project_lora_mesh_knowledge_sharing]] |
| **Methodology** | Clean-room research methodology surface (defensible non-plagiarism compilation with attested process log) | [[project_clean_room_research_methodology]] |

## Pending architectural work (Wave 7+ Creator session)

The dedicated architect session for this app will produce:

1. **Entity table** (`./ARCHITECTURE/ENTITIES_FULL.md`) for the creator
   app: ingestion pipeline, ZIM-write surface, metadata emission,
   methodology log, publish-to-mirror flow, UI components for each
   market segment, anzimmermanlib write-side extensions.
2. **Decision log** entries for:
   - Whether the creator embeds its own LLM or shares the reader's
     weights / runtime
   - Whether ingestion-time third-party calls (OCR, transcription) are
     in-scope at all, and if so, what the operator-mirror substitution
     looks like
   - Whether the macOS target is opened for this app
   - Whether home and enterprise are one binary with feature visibility
     or two binaries with shared core
   - Free-tier shape for each segment
3. **CHECKLIST.md** rows for bootstrapping the creator codebase — empty
   skeleton → Tauri shell → ingestion → ZIM write → publish.

## What's in this directory already (bootstrap state)

- `CLAUDE.md` — project-local rules (this is the binding contract until
  the entity table is authored).
- `ARCHITECTURE.md` — this file.
- `CHECKLIST.md` — bootstrap rows only.
- `src-tauri/Cargo.toml` — workspace member stub, path-deps to shared
  crates.
- `src-tauri/tauri.conf.json` — bundle identifier `mba.robin.enzime.creator`.
- `src-tauri/build.rs` — `tauri_build::build()` stub.
- `src-tauri/src/{main,lib}.rs` — empty `run()` stubs; will be filled
  by the architect session.
- `frontend/package.json` — stub naming; Vite scaffold pending.

## What this directory does NOT have yet

- A real Vite frontend (deliberate; the architect session decides
  initial frontend shape).
- A real entity table.
- A real CHECKLIST beyond bootstrap rows.
- ZIM-write surface in anzimmermanlib.
- Any actual ingestion / metadata / publish code.
- CI workflow extension to build this app.

## Reading order for the future architect session

Before writing any of this app's entity table:

1. Read `./CLAUDE.md` (this app's local rules).
2. Read the suite-level `../CLAUDE.md` (will be restructured into a
   routing file as part of the bootstrap turn that created this
   directory).
3. Read the inherited-constraints memory entries listed above.
4. Read the suite-level ideology docs in
   `~/forgejo/admin/DOCS/IDEOLOGIES/` — particularly
   `non-artificial-gating.md` and `anti-unnecessary-fragility.md`.
5. Read the existing reader's entity table at
   `../DOCS/ARCHITECTURE/ENTITIES_FULL.md` for the shared
   anzimmermanlib + bridge + vendor surface — those are partially
   reusable.
6. Then begin architect work.
