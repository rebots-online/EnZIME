# Ready–Set–Go Prompt for Claude: EnZIME One

Copy the prompt below into Claude Code/Devin IDE from the parent workspace that can see the donor checkouts and the new `EnZIME-v3` directory. Give it enough uninterrupted execution time. The prompt is airlock-first: it is designed to regain lost ground without making the old error topology V3’s original sin.

---

## Prompt

You are the lead implementation engineer for EnZIME V3. Initialize and work in a new canonical repository named `EnZIME-v3`, whose authoritative remote is `forgejo.robin.mba/rcheung/EnZIME-v3`. The existing `forgejo.robin.mba/rcheung/EnZIME` checkout and all GitHub repositories enumerated in `DOCS/REBOOT/PRD-SITE.md` §1.1 are read-only archaeological donors. GitHub is at most a vestigial backup/tool-access mirror, never `origin` and never the LFS authority.

This is a clean implementation, but not an amnesiac greenfield rewrite: recover proven behaviours, schemas, fixtures and design insight through a donor airlock without inheriting the current desktop/web-versus-Android error topology. This is not a planning-only task.

Your mission is to create the smallest honest cross-platform vertical slice of the unified Tauri 2 product: the **Prepper Beachhead** path from browser/local capture → mutable Workspace → annotation/chat → explainable storage-bounded field library → reproducible ZIM edition → offline household reading. Preserve the expansion path to ZIM Workspace and Creator Studio as a whole-shelf knowledge-work substrate.

1. `DOCS/REBOOT/PRD-SITE.md`
2. `DOCS/REBOOT/ARCHITECTURE.md`
3. Existing repository docs, code, tests, and history—used as evidence, not assumed truth.

The two REBOOT documents override conflicting aspirational claims elsewhere. Existing working code overrides diagrams. A currently failing or placeholder implementation is not “done” merely because an older checklist marks it complete.

### Non-negotiable constraints

- One product substrate: Tauri 2 + Rust + Vite/React/TypeScript for Workspace/Studio/Reader, plus a bounded Chrome MV3 companion using the shared protocol/schema package.
- Targets: Android, Linux, Windows. Do not add Expo, Metro, React Native, Electron, a required Python server, Supabase, or mandatory auth.
- The app must start and its reader/core data paths must work with all network access blocked.
- Do not require RevenueCat, API keys, model weights, or external services for the free reader baseline.
- Preserve donor/user work by leaving donor repositories untouched. V3 may reference exact commits and copy an approved bounded unit only through the ledger.
- Do not add placeholders, fake adapters, zero keys, one-byte assets, hard-coded “success,” or menus for capabilities that have not passed a fixture.
- Do not claim format/backend/platform support without semantic test evidence.
- Do not push model blobs or secrets to GitHub.
- Forgejo is canonical. Configure GitHub only as an explicitly labelled backup after the Forgejo origin works; never push LFS blobs there.
- Do not modify donor working trees, commit to donor branches, or bulk-copy a donor directory into V3.
- Every donor transplant requires `donor-ledger/<id>.md` with source repo+commit, licence, dependencies, accepted behaviour, rejected material, destination, semantic tests and review decision.
- Published ZIMs are immutable editions. Editing occurs in the mutable Workspace/revision/overlay layer and produces a new deterministic edition.
- Keep desktop and Android green together. Do not advance a feature phase while knowingly leaving one target broken by that phase.
- Do not ask the operator routine implementation questions. Make conservative reversible choices inside the documented seams. Record genuinely product-changing decisions in `DOCS/REBOOT/DECISIONS.md` and continue behind a feature flag when possible.

### Working method

Execute the phases below in order. Maintain `DOCS/REBOOT/IMPLEMENTATION-REPORT.md` as you work. At each phase record:

- starting evidence and reproduced failures;
- files changed and why;
- commands/tests run with results;
- capability evidence state (`declared`, `compiles`, `fixture-proven`, `platform-proven`);
- remaining blockers, with exact error text and the smallest next action.

Make small cohesive commits after green phase gates. Do not make a single giant commit. Do not rewrite history. Do not mark a phase complete if its acceptance command fails.

### Phase 0 — Initialize V3 and establish donor truth

1. Read the two REBOOT documents and the complete repository provenance register before opening donor source.
2. Locate both the current donor checkout(s) and the empty/new V3 working directory in Devin IDE. Treat donors as read-only.
3. Initialize `EnZIME-v3` with a clean Git history, Forgejo `origin`, branch policy, README, licence placeholder/decision marker, toolchain files, CI skeleton, `DOCS/REBOOT/`, `donor-ledger/` and the target repository structure from the architecture.
4. Scaffold the minimum Tauri 2/Rust/Vite/React application from official current scaffolding. Add Android through the same Tauri project; do not create a second frontend/application core.
5. Scaffold the Chrome MV3 companion and shared protocol package without capture features yet.
6. Record exact toolchain versions and install only normal V3 dependencies.
7. Run and capture format, typecheck/build, Rust checks/tests and the smallest desktop plus Android build/smoke commands available on the host.
8. Inventory donors into ledger stubs by repository and prospective behaviour. Do not transplant code in Phase 0.

**Gate P0:** V3 has an independent clean history, Forgejo authority, green shared shell evidence for desktop and Android, a compiling extension skeleton, and a donor ledger. No feature work before this exists.

### Phase 1 — Establish canonical V3 primitives

Implement new canonical primitives without donor source: workspace/content/revision/provenance identifiers, SQLite migrations, content-addressed assets, generated JSON schemas, typed Tauri IPC, extension companion protocol, durable jobs and capability evidence.

Required outcomes:

- `cargo fmt --check` passes.
- `cargo check -p enzime` passes for the default and valid `desktop`, `sideload`, and `play` configurations available on the host; platform-unavailable linking is distinguished from Rust compile failure.
- Frontend typecheck and production build pass.
- Storage migrations create the intended minimal V3 schema on a fresh database.
- Workspace and extension generated schemas round-trip through Rust and TypeScript contract tests.
- Tauri commands are registered, reachable under appropriate capabilities and dispatch to real managers or return a truthful `CapabilityUnavailable` result.
- Extension pairing/outbox types compile without requiring the app to be running.
- No accepted V3 source file originated in a donor without a completed ledger record.

Commit as `feat(core): establish clean V3 workspace and protocol primitives` only after the gate passes.

**Gate P1:** clean dual-platform compile/build evidence, schema/job/storage contract tests green and no donor contamination.

### Phase 2 — Prove the Prepper Workspace → publication → reader spine

Create or legally include a tiny deterministic ZIM fixture that exercises the format features the current adapter claims to support. If fixture creation requires a separate tool, document reproduction and commit only redistributable output.

Implement this complete path in V3:

`create/import content → mutable Workspace revision → field-library hierarchy → deterministic tiny ZIM publication → library registration → ZimEngine open → article/resources → navigation/bookmark → restart/restore`

Requirements:

- Do not load the whole archive into RAM.
- Malformed offsets, unsupported compression/version, missing resources, and redirects return typed errors rather than panic.
- Article HTML/resource URLs remain archive-bound and do not silently fetch the Internet.
- Desktop layout is a three-region shell; mobile collapses it coherently.
- Reading does not require auth, entitlement, or model installation.
- Workspace supports the preparedness-critical subset: article/note, heading, list/checklist, link, attachment, metadata, hierarchy and revision history.
- Creator Studio mode exposes source list, field-library hierarchy, metadata, validation and publication profile over the exact same workspace IDs—not a copied project.
- The publication manifest records workspace revision, ordered inputs, converter/writer versions and profile.

Add shared conformance tests for the ZIM adapter and an integration test through the application service. If the in-tree parser cannot pass representative real fixtures, keep the `ZimEngine` seam and add/prepare a proven adapter rather than falsifying tests.

Commit as `feat(workspace): prove author-publish-read field-library slice`.

**Gate P2:** with network blocked, author/edit a tiny field library, switch between Workspace and Studio without migration, publish it, open the resulting fixture on desktop and Android, follow a link, bookmark it, restart and restore state.

### Phase 3 — Build the Chrome adoption edge

Implement the MV3 clipper/annotator/chatty-box companion against the shared V3 protocol.

- Capture whole page, reader-cleaned page, selection, link, image reference and free note.
- Preserve canonical URL, title/byline where available, retrieval time, selection context, capture recipe and hashes.
- Permit immediate highlight/comment/tag/destination choice.
- Persist a browser-local outbox before attempting delivery.
- Pair with the local CompanionGateway; negotiate schema version and ingest by idempotency key.
- If the app is closed, retain the capture and deliver exactly once later.
- Provide page/selection-scoped chat through the configured local backend when reachable; optional hosted use requires an outbound-context preview.
- Never request blanket browser permissions without progressive explanation.

Do not transplant a browser ZIM parser merely to make clipping work. Capture normalizes into the V3 Workspace; standalone mini-ZIM export is an adapter behind the same publication service/protocol.

Commit as `feat(extension): clip annotate chat and hand off durably`.

**Gate P3:** while EnZIME is closed, clip and annotate a preparedness page; reopen it, ingest exactly once, edit in Workspace, publish and read the captured content offline with provenance intact.

### Phase 4 — Port the best annotation experience through the donor airlock

Use `rebots-online/BoltZIMnote-8mar2026` only as behavioural/design donor material under a completed ledger record. Reproduce its useful interaction pattern—highlight, comment, drawing, toolbar placement mode, article overlays, annotation panel, edit/delete, import/export—inside V3 React UI and Rust/SQLite services.

Do not port Supabase, `AuthGate`, remote user IDs, or browser-only persistence.

Implement multi-selector text anchors:

- exact quote + prefix/suffix;
- normalized text positions;
- DOM/path hint;
- article/archive identity.

Implement normalized drawing coordinates, attachments by hash, and versioned sidecar import/export. Prefer canonical CBOR with JSON debug export. Import must preview and support merge without silently overwriting a local layer.

Tests must prove persistence, resize/rerender recovery, export/import round trip, duplicate import idempotence, and low-confidence orphan reporting.

Commit as `feat(annotations): durable local markup and sidecars`.

**Gate P4:** a fresh installation can import a sidecar and reproduce highlights/comments/drawings against the fixture on desktop and Android.

### Phase 5 — Dynamic Library Composer and durable pack/model jobs

Implement `LibraryComposer` first: convert a preparedness scenario, existing inventory, household/workspace lore and device/storage/bandwidth constraints into an explainable corpus plan. Then unify approved downloads, removable-media imports, LAN imports, updates and indexing under a durable `JobManager`. Bring forward the good safety semantics of `kiwix-zim-updater` through a donor ledger—plan/dry-run, progress, checksum, size policy, safe replacement and history—but reimplement them in V3 Rust application services, not as a shell dependency.

Implement:

- normalized catalog and transfer-source traits;
- deterministic baseline scoring for scenario relevance, source trust, freshness, overlap, marginal coverage, language/geography, size and device fit;
- named Prepper scenario profiles and household-device projections;
- plan reasons, rejected alternatives and acquire/update/retain/archive actions;
- explicit approval for every eviction/archive action;
- durable job/job-part/job-event tables;
- ranged resume where the source supports it;
- pause/cancel/retry;
- staging by content hash;
- checksum then signature verification;
- atomic registry switch while retaining the previous good version;
- explicit storage reserve and size constraints;
- local/removable-media source first; network sources optional.

Use a local test HTTP server and deterministic fixture bytes. Kill/reopen the store between transfer chunks in tests.

Commit as `feat(library): compose and execute verified field-library plans`.

**Gate P5:** from a scenario and storage ceiling, produce an explainable plan without an LLM, approve it, interrupt execution, resume after restart and prove corrupt bytes cannot replace a valid installed pack.

### Phase 6 — One real local inference path, then routing/fallback

Inventory donor LiteRT-LM, model fetcher, tokenizer, sampler and audio code through ledger records. Independently determine what can compile and perform a smoke generation in V3 on the host/platform. Do not preserve a backend merely because prior architecture named it.

Implement the `InferenceBackend`/`InferenceSession` registry from the architecture. Integrate at least one genuinely functioning local text-generation backend on the current reference platform using a tiny legal test model or an operator-provided local model path. Keep other backends as absent adapters discovered by build features—not runtime fakes.

Add:

- capability probe and smoke-test evidence;
- automatic candidate ranking by compatibility, memory fit, user policy, and recent failures;
- separate Auto/CPU/GPU/backend override controls where supported;
- visible `preferred`, `active`, `fallback`, reason, and Retry state;
- load/unload and generation cancellation;
- no loss of conversation draft/state when fallback occurs.

Candidate backends may include LiteRT-LM, a llama.cpp-family native adapter, or wllama in a WebView/WASM path, but only advertise compute modes that `probe()` plus smoke generation prove on that platform.

Commit as `feat(ai): proven local backend with visible automatic fallback`.

**Gate P6:** block the network, generate text locally, cancel a generation, force an unavailable preferred backend, observe a clear fallback indicator, retry, and continue the conversation.

### Phase 7 — Retrieval and citations

Implement lexical retrieval first and optional embeddings second. The system must answer from an active article without an embedding model.

- Chunk articles and notes deterministically with stable locators.
- Candidate sources: selected text, current article, selected packs, annotations, and memory.
- Use FTS/title search as universal baseline.
- Put embeddings behind a replaceable `EmbeddingBackend` and make vectors disposable/rebuildable.
- Assemble context within a declared token budget.
- Persist the exact passages supplied to generation and map citations to those passages.
- Reject or label citations that do not map to supplied context.

Commit as `feat(retrieval): offline context assembly and verifiable citations`.

**Gate P7:** an offline question over the fixture returns an answer with a clickable citation to the exact supplied passage.

### Phase 8 — Automatic lasting user lore memory

Implement memory as journal → extraction → consolidation → retrieval, not “append all chat history.”

1. Add an append-only `activity_events` journal for eligible user actions.
2. Add typed canonical memory items: preference, entity, episode, claim/belief, task, reading trace, correction.
3. Implement a deterministic local rule extractor as the minimum working path, then optionally use the installed local model through `MemoryExtractor`.
4. Queue extraction automatically after eligible events under resource/privacy policy.
5. Deduplicate, merge, supersede, score, expire, and link candidates with full source provenance.
6. Build FTS retrieval and optional derived embeddings/edges.
7. Add Memory Inbox, pin/edit/merge/forget, private session, export, and rebuild controls.
8. Show why each memory was retrieved.

Sensitive/low-confidence candidates go to review; ordinary high-confidence preferences/corrections may commit automatically under the default policy. Deleting a memory removes it from retrieval immediately. Derived indexes must rebuild from canonical journal/items.

Commit as `feat(memory): automatic inspectable lore continuity`.

**Gate P8:** across separate app/extension sessions, a relevant durable fact is automatically captured, retrieved with provenance, edited, then forgotten; index rebuild preserves the edited canonical state and does not resurrect the forgotten item.

### Phase 9 — Entitlements without captivity

Keep the free reader/local-data baseline independent of billing. Normalize store purchases and direct sales into effective capabilities.

Implement and test:

- RevenueCat cache/client only where configured;
- signed offline perpetual artifacts;
- signed unique “one month” coupon artifacts whose redemption advances paid-through from `max(now, current_paid_through)`;
- a local redemption ledger and idempotence;
- explicit reconciliation/transfer seams;
- bridge interfaces for Stripe/BTCPay and optional reseller channels;
- entitlement failure that never blocks reading/export of existing user content.

No private signing key in the client or repository. Tests use ephemeral test keys.

Commit as `feat(entitlements): perpetual and consumable offline grants`.

**Gate P9:** perpetual and month artifacts validate offline, duplicate redemption is rejected/idempotent, and removing all billing configuration still leaves the reader/data export functional.

### Phase 10 — Platform and release proof

- Build Linux, Windows, and Android from the one source tree using documented flavours.
- Package and smoke-test the Chrome extension plus local companion handshake/outbox recovery.
- Add platform adapters rather than domain forks.
- Prove Android file selection/content-URI handling and lifecycle recovery.
- Run accessibility checks and keyboard/touch navigation review.
- Add backup/restore and migration fixtures.
- Update README quick start to match the exact commands that passed.
- Generate `DOCS/REBOOT/CAPABILITY-EVIDENCE.json` from test outcomes.
- Confirm Forgejo is `origin`; any GitHub remote is named/labeled as backup and excludes LFS blobs.
- Publish the synchronized repository provenance register and completed donor transplant ledger.

Commit platform fixes separately by platform while restoring the shared green matrix before advancing. Finish with `docs: attest EnZIME V3 implementation evidence` only when the report is complete.

### Required final response

At the end, report:

1. What is demonstrably working, by capability and platform.
2. Exact validation commands and their results.
3. Commits created.
4. Files deliberately left unchanged.
5. Remaining blockers separated into code, external assets/credentials, hardware/platform access, and product decisions.
6. Donor repositories/commits actually used, rejected or still pending review.
7. Canonical Forgejo remote and any backup mirror state.
8. The single next highest-value action.

Do not use “complete,” “production-ready,” or “supports” for any capability below `platform-proven` evidence. If time/context runs short, stop after the last green phase gate, leave the tree buildable, and write a precise continuation entry in `IMPLEMENTATION-REPORT.md`. A smaller proven EnZIME is more valuable than another silver-plated scaffold that never makes it to the starting line.

---

## Expected first command sequence

Claude should adapt this to the committed toolchain rather than blindly copy it:

```bash
pwd
git status --short
git remote -v
git branch --show-current
sed -n '1,240p' DOCS/REBOOT/PRD-SITE.md
sed -n '1,280p' DOCS/REBOOT/ARCHITECTURE.md
pnpm install --frozen-lockfile
pnpm build
cargo fmt --check
cargo check -p enzime
cargo test -p enzime
```

During the initial empty-repository bootstrap, create exactly one chosen lockfile and commit it. If later scripts make one example command wrong, document and use the V3-correct equivalent; do not create a second package-manager lockfile.
