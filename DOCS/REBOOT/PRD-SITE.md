# EnZIME One — Consolidated Product Requirements Document

**Document role:** product source of truth and PRD-site content model  
**Product:** EnZIME Reader, Annotator, Offline AI, and Personal Knowledge Companion  
**Target repository:** `rebots-online/EnZIME`  
**Status:** implementation directive for the unified Tauri 2 reboot  
**Platforms:** Android, Linux, Windows  
**Default posture:** offline-first, local-first, no login required

> There can be only One. The earlier repositories remain evidence and donor material; they are not separate products to keep alive.

## 1. Executive decision

EnZIME is one installable application that turns ZIM archives and the user's own accumulated material into a durable, searchable, annotatable, conversational knowledge environment. It must work in airplane mode after assets are installed, remain useful without an account or subscription, and scale from an Android phone to a desktop or a small homestead knowledge server.

The surviving implementation foundation is `rebots-online/EnZIME`: Tauri 2, Rust, React/TypeScript, SQLite, an in-tree ZIM reader, on-device AI seams, sidecars, device capability probing, and entitlement seams already coexist there. It is not assumed to be release-ready: its own README and checklist identify compile-clean and real-binding work still outstanding. The reboot therefore repairs and proves the existing foundation before extending it.

The donor repositories contribute product knowledge, not competing runtimes:

| Donor | Keep | Do not carry forward |
|---|---|---|
| `rebots-online/EnZIME` | Tauri/Rust foundation; typed command bridge; SQLite; build flavours; local AI, sidecar, updater, pack, peer, and entitlement seams | Claims of completion without green builds and fixture proof; placeholder or zero-key implementations |
| `Robin-s-AI-World/EnZIME` | Original invariants, pinned-stack intent, earlier architecture vocabulary | Pre-implementation status and stale mirror state |
| `Robin-s-AI-World/EnZIMErgent` and `emergent-EnZIME-Mobile` | Mobile information architecture; offline-only switch; model picker; tier/paywall concepts; voice, drawing, and hosted-inference UI vocabulary | Expo/Metro runtime; mandatory auth; Python server dependency; cloud-first data paths |
| `rebots-online/BoltZIMnote-8mar2026` | Three-pane reader; back/forward/home navigation; text highlighting; comments; drawings; resilient text anchors; annotation panel; import/export interaction | Supabase and login as prerequisites; browser-only ZIM and persistence assumptions |
| `rebots-online/EnZIM-Stitch` and frozen Stitch assets | Visual hierarchy, responsive layouts, component language | A second UI application or a build-time dependency on Stitch |
| `rebots-online/kiwix-zim-updater` | Dry-run planning; update discovery; visible progress; checksums; min/max size constraints; safe replacement and history | Shell-script coupling, filename-only identity, destructive replacement defaults |
| EnZIM/archive repositories | Format research, scaffolding lessons, billing and integration notes | Parallel implementations; outdated format assertions; unproved “clean-room” code treated as production fact |

## 2. Product promise

**Primary promise:** “Your knowledge works when the network does not, and becomes more personally useful the longer you live with it.”

EnZIME combines four jobs that should feel like one continuous activity:

1. **Acquire and maintain knowledge packs.** Discover, download, import, verify, update, copy, and share ZIMs and model packs.
2. **Read and mark them up.** Fast navigation, search, bookmarks, highlights, marginalia, drawings, voice notes, and portable sidecars.
3. **Ask and synthesize.** Local AI answers from the active article, selected passages, multiple packs, notes, and personal memory, with visible citations.
4. **Remember the user.** Automatically retain useful preferences, projects, people, questions, reading trails, notes, and corrections as editable local memory—not as an opaque chat-history dump.

## 3. Users and contexts

### 3.1 Primary users

| User | Situation | Must succeed without |
|---|---|---|
| Prepared household | Internet failure, travel, rural connectivity, emergency reference | Network, account, subscription validation, cloud model |
| Lifelong learner/researcher | Builds a personal corpus and returns to it over years | Re-explaining context each session |
| Field worker | Phone/tablet, gloves or intermittent attention, limited power | Desktop-only controls or large-model assumptions |
| Desktop power user | Multiple large ZIMs, keyboard-driven research, local GPU/CPU | Mobile simplifications or forced hosted inference |
| Family/small group | Shares packs, annotations, and selected lore over LAN or removable media | Central cloud tenancy |
| Publisher/curator | Produces signed collections, companion sidecars, and personalized artifacts | Rebuilding the Reader or owning user data |

### 3.2 Core scenarios

- A user installs EnZIME, imports Wikipedia and first-aid ZIMs from an SD card, and reads immediately in airplane mode.
- EnZIME probes RAM, storage, CPU/GPU capability, and available backends, then recommends a model without silently downloading gigabytes.
- A user highlights a passage, sketches over a diagram, records a voice note, and exports those annotations as a portable sidecar.
- A question is answered from the current article and related local sources. Each factual claim links back to the article passage used.
- A returning user asks “How does this connect to the washer-repair research from last month?” and EnZIME retrieves the relevant local lore with an inspectable explanation.
- A desktop downloads packs once and offers them to phones over the LAN. Phones can also import from USB/SD with identical verification.
- An inference backend fails or its GPU is busy. The UI says what happened, falls back automatically when allowed, and offers a CPU/GPU/backend toggle plus Retry.

## 4. Binding product principles

| ID | Principle | Requirement |
|---|---|---|
| P-01 | Offline is a mode of operation, not an error state | Every core workflow has a zero-network path. |
| P-02 | Local data belongs to the user | Notes, chat, memory, indexes, and settings are stored locally and exportable. |
| P-03 | No mandatory identity | Reading, annotation, search, local AI, backup, and restore work without login. |
| P-04 | Automatic, visible, overridable | Model/backend/memory choices are automatic by default, visibly reported, and manually overridable. |
| P-05 | Evidence before fluency | Answers cite local passages; unsupported synthesis is labelled as inference. |
| P-06 | Graceful capability scaling | The same product remains coherent on low-memory phones and GPU desktops. |
| P-07 | One core, replaceable engines | ZIM, inference, embeddings, TTS/STT, downloads, and entitlements sit behind explicit adapters. |
| P-08 | Earned continuity | Long-term memory is useful, editable, attributable, and never silently treated as objective truth. |
| P-09 | Commercially releasable | Distribution, entitlement, update, privacy, and migration paths are product features, not post-launch chores. |
| P-10 | Honest status | Scaffolded, compiled, fixture-tested, and release-proven are distinct states in UI and documentation. |

## 5. Scope

### 5.1 V1 release scope

- Open local ZIM files and registered pack libraries.
- Correctly render articles and their local resources with safe internal navigation.
- Per-ZIM and cross-library search.
- Bookmarks, reading history, highlights, comments, drawings, tags, and voice-note attachments.
- Sidecar export/import with stable archive and article identity.
- Resumable pack/model downloads with plan, pause, resume, checksum/signature verification, and atomic install.
- Removable-media and LAN import paths.
- On-device text chat with streaming, cancellation, citations, and context controls.
- Automatic inference backend/model selection with clear status, manual override, retry, and safe fallback.
- Automatic personal-memory capture with review/edit/delete/pin/forget controls.
- Local backups and deterministic restore.
- RevenueCat-backed entitlements for store purchases, plus signed offline entitlement artifacts for direct sales.
- Linux, Windows, and Android builds from one repository.

### 5.2 Post-V1, architecture-ready

- Creator workflows for building ZIMs and curated packs.
- Browser extension.
- Optional hosted/frontier inference and web retrieval.
- Multi-device encrypted sync through a user-chosen provider.
- LoRa/low-bandwidth chunk transport.
- Collaborative annotation merge and conflict UI.
- Personalized artifacts generated at purchase time.

### 5.3 Explicit non-goals for V1

- iOS/macOS support.
- A required EnZIME cloud account.
- Full web-browser parity with native filesystem and background-task behaviour.
- Training or fine-tuning foundation models on device.
- Autonomous alteration of source ZIM archives.
- Making all previous repositories compile or remain deployable.

## 6. Functional requirements

### 6.1 First launch and capability selection

1. Show a concise “local-first” explanation and data location.
2. Probe platform, RAM, free storage, CPU features, GPU/WebGPU availability where applicable, and supported inference backends.
3. Offer three setup paths: **Use existing files**, **Choose packs/models**, **Explore without AI**.
4. Recommend a backend/model and state the reason, estimated RAM/storage, and expected speed class.
5. Never begin a multi-hundred-megabyte download without explicit approval.
6. Persist the automatic/manual mode independently for compute backend and model.
7. If an accelerator is unavailable or busy, show `Preferred backend unavailable → using <fallback>` and retain a Retry action.

**Acceptance:** first launch completes in airplane mode with an imported ZIM and no model; the reader remains fully usable.

### 6.2 Library and pack lifecycle

- Sources: Kiwix/OpenZIM catalog adapter, operator mirror, local file, watched folder, SD/USB, LAN peer, and manually supplied manifest.
- Before download, present a plan containing item, version, size, destination, free space after install, source, and verification method.
- Support pause/resume after process restart using `.partial` data and durable job state.
- Verify checksums and signed manifests when provided; never replace a good installed pack until verification succeeds.
- Identify content by manifest identity and content hash, not filename alone.
- Allow update policy per pack: manual, notify, Wi-Fi/LAN only, or scheduled.
- Include min/max size and storage-reserve rules.
- Keep an inspectable job and replacement history.

**Acceptance:** kill the application during a large transfer, relaunch, resume, verify, and atomically install without corrupting the previous version.

### 6.3 Reading and navigation

- Open multiple ZIMs without loading their complete indexes into RAM.
- Render HTML, images, CSS, fonts, redirects, and internal links from the local archive.
- Back, forward, home, article list, in-article find, and keyboard shortcuts on desktop.
- Responsive layout:
  - Desktop: library/sidebar + reader + notes/assistant panel.
  - Tablet: two panes with collapsible third panel.
  - Phone: tab/stack navigation with persistent article and conversation state.
- Restore the last open article and scroll position per device.
- Sanitize active content and mediate external links.

**Acceptance:** verified fixture ZIMs covering redirects, compressed clusters, local assets, Unicode titles, and malformed entries open without process crashes.

### 6.4 Search and retrieval

- Fast title/prefix search inside a pack.
- Full-text search when a compatible index exists; incremental local index otherwise.
- Cross-pack search with pack/title filters.
- Semantic search across article chunks, notes, annotations, and memory when embeddings are installed.
- Every result indicates source type, pack, article, match passage, and score class.
- Indexing is resumable, cancellable, storage-aware, and deprioritized on battery/thermal pressure.

### 6.5 Annotation workspace

- Types: highlight, comment, drawing, bookmark, tag, voice note, and free note.
- Text anchors store multiple selectors: article identity, quoted text, prefix/suffix context, DOM/path hint, and offsets.
- Drawings store normalized coordinates and viewport/article anchor metadata.
- The UI follows the proven donor pattern: toolbar activation, visible placement mode, article overlay, right-side annotation list, edit/delete, global note browser, and import/export.
- Sidecars include schema version, archive identity, annotations, attachments by hash, provenance, timestamps, optional signature, and merge metadata.
- Import modes: preview, merge, replace local copy, or keep as separate layer.

**Acceptance:** annotations survive app restart, theme change, window resize, article rerender, export, fresh-install import, and a compatible newer edition of the same pack where the quoted passage still exists.

### 6.6 Local AI conversation

- Chat against: active selection, active article, selected packs, notes only, memory only, or automatic context.
- Stream tokens with Stop and Regenerate.
- Show the active backend, model, compute path, context size, and whether fallback occurred.
- Cite retrieved passages with clickable source chips.
- Keep generation available when embeddings are absent by using deterministic lexical/context selection.
- Provide separate controls for `Local only`, `Allow hosted fallback`, and `Ask every time`.
- Hosted inference is optional, explicit, and never required to unlock the user's local data.
- Model/backends are hot-swappable through a shared interface; failure does not lose the conversation draft.

**Acceptance:** with network blocked, ask a question whose answer exists in an installed fixture; receive a cited answer, cancel a second generation, switch backend/model, and continue the same conversation.

### 6.7 Lasting user lore memory

Memory is a first-class subsystem, not a larger prompt pasted from chat history.

Memory classes:

| Class | Examples | Default retention |
|---|---|---|
| Preference | desired tone, units, device/backend choice | durable until changed |
| Entity | people, places, projects, devices | durable, mergeable |
| Episode | “washer repair investigation in July” | summarized with source links |
| Claim/belief | user hypothesis or conclusion | attributed and confidence-labelled |
| Task/commitment | unresolved question, follow-up, planned download | until done/expired |
| Reading trace | opened article, highlight, search trail | compressed, lower salience |
| Correction | “that earlier model name was wrong” | high salience, supersedes prior item |

Automatic pipeline:

1. Append user-visible activity events locally.
2. Extract candidate memories asynchronously.
3. Deduplicate and link candidates to existing entities/topics.
4. Score salience, confidence, sensitivity, novelty, and expiry.
5. Commit according to user policy: automatic, ask for sensitive items, or manual-only.
6. Generate embeddings/graph edges when resources permit.
7. Retrieve a bounded set for each query and show “Why this was remembered.”

Controls: Memory Inbox, pin, edit, merge, forget, exclude a conversation, private session, export, and rebuild indexes from the event journal.

**Acceptance:** memory selection and generation happen automatically under the default policy; deleting an item removes it from retrieval; rebuilding derived indexes produces equivalent canonical memories from the journal.

### 6.8 Voice and accessibility

- Voice notes attach to articles/annotations and may be transcribed locally when supported.
- STT/TTS adapters advertise availability; absent engines do not create dead controls.
- Native OS TTS is the universal low-cost baseline; richer offline voices are optional packs.
- Keyboard navigation, screen-reader labels, scalable text, reduced motion, contrast-safe themes, and touch targets suitable for mobile.

### 6.9 LAN and homestead mode

- Desktop may advertise a local pack/sidecar service by mDNS.
- Peers see source identity, item hashes, size, and trust status before transfer.
- The same verification path is used for Internet, LAN, and removable media.
- A peer can never silently overwrite local annotations or trusted packs.
- Server mode is optional and off by default on mobile.

### 6.10 Entitlements and commerce

- RevenueCat is the normalized entitlement authority for store and synced direct purchases, not the owner of local content.
- Product forms:
  - Free reader baseline.
  - Perpetual licence.
  - Subscription.
  - Consumable signed “one month” coupons that activate one entitlement period when redeemed, allowing multiple purchases to be banked.
  - Future personalized artifact/lifetime bundles.
- Direct processors may include Stripe and BTCPay; Gumroad/Lemon Squeezy may act as sales channels through the same bridge.
- Devices cache signed entitlement artifacts with clear issuance, capabilities, redemption state, and expiry semantics.
- Expired commercial entitlements may remove premium execution features but never prevent access to user-created notes, exports, or already-readable local content.

**Acceptance:** a perpetual key and an offline month coupon validate with the network blocked; the same coupon cannot be consumed twice on one ledger; a fresh device can restore through an explicit transfer/online reconciliation path.

### 6.11 Backup, migration, and recovery

- One portable backup contains the SQLite database, sidecars, memory journal, settings, trust records, and manifests; large ZIM/model files may be referenced by hash rather than duplicated.
- Backup creation is atomic and versioned.
- Restore supports preview and conflict reporting.
- Schema migrations are forward-only, tested from every released schema, and never destroy the only copy before backup.
- Derived indexes can be discarded and rebuilt.

## 7. UX and visual system

EnZIME should feel like a calm field instrument rather than a neon AI dashboard. Preserve the donors’ useful spatial logic while removing dependency-driven gates.

### 7.1 Primary navigation

| Area | Purpose |
|---|---|
| Home | Continue reading, recent packs, unresolved tasks, memory inbox, system readiness |
| Library | Packs, downloads, imports, updates, storage planner |
| Reader | Article navigation and annotation canvas |
| Ask | Conversation with explicit source scope and backend status |
| Notes | Cross-pack annotations, notebooks, tags, sidecar layers |
| Memory | Lore browser, inbox, entities, episodes, corrections, controls |
| Settings | Offline/network policy, compute/model choices, accessibility, entitlements, backup |

### 7.2 Persistent status vocabulary

- `Offline ready`
- `Online optional`
- `Indexing 42% — safe to close`
- `GPU preferred / CPU active`
- `Fallback: preferred backend unavailable`
- `Sources: 5 local passages`
- `Memory: 3 items used`
- `Unverified pack` / `Checksum verified` / `Signature verified`

### 7.3 PRD site information architecture

This document may be rendered as a static PRD site. The site should expose:

- **Overview:** promise, status, release target, blocking risks.
- **Experience:** responsive reader, annotation flow, Ask flow, memory flow.
- **Requirements:** filterable requirement list with IDs and acceptance tests.
- **Architecture:** embedded diagrams sourced from `ARCHITECTURE.md`.
- **Donor ledger:** repository-to-feature provenance table.
- **Delivery dashboard:** milestones, test evidence, builds, open decisions.
- **Commercial:** tiers, offline entitlements, channels, non-gating guarantees.
- **Runbook:** developer quick start and the implementation prompt.

The site is a view over these Markdown sources; it must not become a fourth source of truth.

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Startup | Library shell usable within 2 seconds on reference desktop and 4 seconds on reference Android, excluding first migration. |
| Memory | Opening a ZIM must not load the full archive into RAM; indexing and inference declare budgets. |
| Reliability | Downloads and indexes survive kill/restart; database uses WAL and integrity checks. |
| Battery/thermal | Background work pauses or reduces concurrency under platform pressure. |
| Security | External HTML is sandboxed; paths are canonicalized; manifests and offline licences use domain-separated signatures. |
| Privacy | Zero analytics by default; any future diagnostics are opt-in and inspectable. |
| Accessibility | WCAG-oriented contrast, keyboard use, scalable type, screen-reader semantics, reduced motion. |
| Portability | Canonical data can be exported without an EnZIME server. |
| Observability | Local structured logs with redaction and user-controlled export; no automatic upload. |
| Testability | Core managers run without a WebView; engines use conformance fixtures. |

## 9. Release milestones and gates

### M0 — Establish truth

- Reproduce current build failures.
- Remove stale completion claims.
- Make `cargo check`, frontend build/typecheck, and unit tests green on Linux.
- Add a small legal ZIM fixture or deterministic fixture generator.

**Exit:** clean baseline commit and evidence log.

### M1 — Reader spine

- Open/render/navigate/search fixture ZIMs.
- Persistent library, history, bookmarks, and responsive shell.
- Android filesystem flow proven on emulator/device.

**Exit:** airplane-mode reading demo on desktop and Android.

### M2 — Annotation durability

- Highlights/comments/drawings/voice attachments.
- Stable anchoring, sidecar import/export, merge preview.

**Exit:** round-trip annotation compatibility test.

### M3 — Pack lifecycle

- Catalog, plan, resumable jobs, verification, atomic update, removable media.

**Exit:** interrupted multi-part transfer recovery test.

### M4 — Local AI and retrieval

- At least one genuinely working local backend per release platform.
- Backend/model auto-selection, manual override, fallback indicator, citations.

**Exit:** offline cited-answer test on each platform.

### M5 — Lore memory

- Journal, extraction, consolidation, retrieval, review/delete/export/rebuild.

**Exit:** multi-session continuity scenario with inspectable memory provenance.

### M6 — Commerce and release

- Entitlements, perpetual/offline coupon, backup/restore, installers, updates, accessibility and privacy review.

**Exit:** signed release candidates and clean-install upgrade matrix.

## 10. Success measures

Because analytics are not required, measures may come from opt-in reports, support, release testing, and small user studies.

- Time from install to first locally rendered article.
- Percentage of tested core workflows passing with network physically blocked.
- Recovery rate after killed downloads/indexes.
- Citation-open rate and source correctness in evaluation fixtures.
- Annotation survival across pack update and sidecar round trip.
- Memory precision: accepted/edited/deleted candidate ratio.
- Number of sessions before a user must manually re-explain durable context.
- Crash-free reference test suite and successful upgrade/restore matrix.
- Conversion by entitlement channel without loss of free-reader usefulness.

## 11. Risks and mitigations

| Risk | Consequence | Mitigation |
|---|---|---|
| Existing architecture overstates implementation | False progress and brittle one-shot coding | M0 compile/fixture truth gate; capability registry generated from working adapters |
| ZIM parser incompleteness | Fails on real Kiwix archives | Conformance fixtures and adapter seam; do not advertise formats until proven |
| Mobile inference fragmentation | Crashes, thermal pressure, user distrust | Probe, budgets, model tiers, fallback, visible status, manual override |
| Long-term memory becomes prompt sludge | Worse answers and privacy anxiety | Typed memories, provenance, salience/expiry, bounded retrieval, edit/delete/rebuild |
| Offline entitlements become either porous or punitive | Revenue leakage or user lockout | Signed artifacts, local ledger, reconciliation, perpetual/free-content guarantees |
| Sidecar anchors break on updates | Lost scholarship | Multi-selector anchors, preview/repair tools, content-hash identity, compatibility tests |
| One-shot agent performs a greenfield rewrite | Lost ground again | Repair-first prompt, protected paths, incremental commits, semantic gates |

## 12. Definition of done

EnZIME V1 is done only when:

- one repository produces Android, Linux, and Windows release candidates;
- core reading, annotation, search, backup, and local AI scenarios pass with the network blocked;
- at least one real ZIM and one real local inference backend are proven on each platform;
- downloads, indexes, and migrations survive interruption;
- annotations and lore memory are portable, inspectable, editable, and recoverable;
- the UI visibly distinguishes automatic selection, active backend, and fallback;
- entitlements do not gate access to user-authored data;
- documentation describes observed behaviour rather than intended scaffolding.

## 13. Open decisions that do not block the reboot

- Final product tier names and prices.
- Which optional hosted providers ship in the first commercial release.
- Whether the first desktop local backend is LiteRT-LM or a llama.cpp-family adapter; the interface and acceptance tests are binding, not the vendor.
- Whether peer sync encrypts all payloads in V1 or ships as trusted-LAN transfer with signatures first.
- Exact sunset criterion if V1 does not ship.

These decisions must not be silently made by an implementation agent. Defaults may be feature-flagged behind the stable seams in `ARCHITECTURE.md`.
