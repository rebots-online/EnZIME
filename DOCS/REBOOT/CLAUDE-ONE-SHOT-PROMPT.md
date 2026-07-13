# Ready–Set–Go Prompt for Claude: EnZIME One

Copy the prompt below into Claude Code from the root of the target `EnZIME` checkout. Give it repository access and enough uninterrupted execution time. The prompt is intentionally repair-first: it is designed to regain lost ground without birthing EnZIME Yet Again.

---

## Prompt

You are the lead implementation engineer for the EnZIME One reboot. Work directly in the existing `rebots-online/EnZIME` repository. This is not a greenfield rewrite and not a planning-only task.

Your mission is to turn the repository into the smallest honest, working vertical slice of the unified Tauri 2 product, while preserving a path to the complete product described in:

1. `DOCS/REBOOT/PRD-SITE.md`
2. `DOCS/REBOOT/ARCHITECTURE.md`
3. Existing repository docs, code, tests, and history—used as evidence, not assumed truth.

The two REBOOT documents override conflicting aspirational claims elsewhere. Existing working code overrides diagrams. A currently failing or placeholder implementation is not “done” merely because an older checklist marks it complete.

### Non-negotiable constraints

- One product and one application shell: Tauri 2 + Rust + Vite/React/TypeScript.
- Targets: Android, Linux, Windows. Do not add Expo, Metro, React Native, Electron, a required Python server, Supabase, or mandatory auth.
- The app must start and its reader/core data paths must work with all network access blocked.
- Do not require RevenueCat, API keys, model weights, or external services for the free reader baseline.
- Preserve user work. Do not delete archives, logs, donor material, migrations, or existing implementations merely to make checks pass.
- Do not add placeholders, fake adapters, zero keys, one-byte assets, hard-coded “success,” or menus for capabilities that have not passed a fixture.
- Do not claim format/backend/platform support without semantic test evidence.
- Do not push model blobs or secrets to GitHub.
- Do not ask the operator routine implementation questions. Make conservative reversible choices inside the documented seams. Record genuinely product-changing decisions in `DOCS/REBOOT/DECISIONS.md` and continue behind a feature flag when possible.

### Working method

Execute the phases below in order. Maintain `DOCS/REBOOT/IMPLEMENTATION-REPORT.md` as you work. At each phase record:

- starting evidence and reproduced failures;
- files changed and why;
- commands/tests run with results;
- capability evidence state (`declared`, `compiles`, `fixture-proven`, `platform-proven`);
- remaining blockers, with exact error text and the smallest next action.

Make small cohesive commits after green phase gates. Do not make a single giant commit. Do not rewrite history. Do not mark a phase complete if its acceptance command fails.

### Phase 0 — Establish repository truth

1. Read the two REBOOT documents, `README.md`, `CLAUDE.md`, the current architecture/checklist, root and `src-tauri` manifests, workflows, and relevant source entry points.
2. Inventory the actual tree and map existing modules to the target architecture. Identify duplicate, dead, placeholder, unreachable, and platform-specific code. Do not delete yet.
3. Record exact toolchain versions and install only normal project dependencies.
4. Run and capture:
   - `git status --short`
   - frontend install using the committed package manager/lockfile
   - frontend typecheck/build/lint if configured
   - `cargo fmt --check`
   - `cargo check -p enzime` and each supported feature/flavour
   - existing unit/integration tests
5. Reconcile manifest contradictions (for example React version, claimed TTS/backend, or “complete” architecture versus pending compile errors) in the implementation report.

**Gate P0:** the report contains a factual baseline and a prioritized error ledger. No feature work before this exists.

### Phase 1 — Make the baseline green without feature expansion

Repair compilation and contract breakage in the smallest semantic units. Prefer fixing the implementation to match an already sound interface; change an interface only when it is internally contradictory or untestable.

Required outcomes:

- `cargo fmt --check` passes.
- `cargo check -p enzime` passes for the default and valid `desktop`, `sideload`, and `play` configurations available on the host; platform-unavailable linking is distinguished from Rust compile failure.
- Frontend typecheck and production build pass.
- Storage migrations create the intended schema on a fresh database.
- All production builders use real per-device identity and real verifier public keys or return an explicit configuration error; never zero keys.
- Tauri commands are registered, reachable under the appropriate capabilities, and dispatch to real managers or return a truthful `CapabilityUnavailable` result.

Add regression tests for each nontrivial repair. Commit as `fix: establish compile-clean EnZIME baseline` only after the gate passes.

**Gate P1:** clean compile/build evidence, tests green, no new placeholder paths.

### Phase 2 — Prove the offline reader spine

Create or legally include a tiny deterministic ZIM fixture that exercises the format features the current adapter claims to support. If fixture creation requires a separate tool, document reproduction and commit only redistributable output.

Implement or repair this complete path:

`file picker/path adapter → library registration → ZimEngine probe/open → metadata/main page → article/resources → internal navigation → history/bookmark → restart/restore`

Requirements:

- Do not load the whole archive into RAM.
- Malformed offsets, unsupported compression/version, missing resources, and redirects return typed errors rather than panic.
- Article HTML/resource URLs remain archive-bound and do not silently fetch the Internet.
- Desktop layout is a three-region shell; mobile collapses it coherently.
- Reading does not require auth, entitlement, or model installation.

Add shared conformance tests for the ZIM adapter and an integration test through the application service. If the in-tree parser cannot pass representative real fixtures, keep the `ZimEngine` seam and add/prepare a proven adapter rather than falsifying tests.

Commit as `feat(reader): prove offline ZIM vertical slice`.

**Gate P2:** with network blocked, a clean local run opens the fixture, renders its main page and resource, follows a link, bookmarks it, restarts, and restores state.

### Phase 3 — Port the best annotation experience, locally

Use `rebots-online/BoltZIMnote-8mar2026` only as behavioural/design donor material. Reproduce its useful interaction pattern—highlight, comment, drawing, toolbar placement mode, article overlays, annotation panel, edit/delete, import/export—inside the target React UI and Rust/SQLite services.

Do not port Supabase, `AuthGate`, remote user IDs, or browser-only persistence.

Implement multi-selector text anchors:

- exact quote + prefix/suffix;
- normalized text positions;
- DOM/path hint;
- article/archive identity.

Implement normalized drawing coordinates, attachments by hash, and versioned sidecar import/export. Prefer canonical CBOR with JSON debug export. Import must preview and support merge without silently overwriting a local layer.

Tests must prove persistence, resize/rerender recovery, export/import round trip, duplicate import idempotence, and low-confidence orphan reporting.

Commit as `feat(annotations): durable local markup and sidecars`.

**Gate P3:** a fresh installation can import a sidecar and reproduce highlights/comments/drawings against the fixture.

### Phase 4 — Durable pack/model jobs

Unify downloads, removable-media imports, LAN imports, updates, and indexing under a durable `JobManager` state machine. Bring forward the good safety semantics of `kiwix-zim-updater`: plan/dry-run, progress, checksum, size policy, safe replacement, and history—but implement them in Rust application services, not as a shell dependency.

Implement:

- normalized catalog and transfer-source traits;
- durable job/job-part/job-event tables;
- ranged resume where the source supports it;
- pause/cancel/retry;
- staging by content hash;
- checksum then signature verification;
- atomic registry switch while retaining the previous good version;
- explicit storage reserve and size constraints;
- local/removable-media source first; network sources optional.

Use a local test HTTP server and deterministic fixture bytes. Kill/reopen the store between transfer chunks in tests.

Commit as `feat(packs): resumable verified offline-first lifecycle`.

**Gate P4:** an interrupted transfer resumes after process restart and cannot replace a valid installed pack with corrupt bytes.

### Phase 5 — One real local inference path, then routing/fallback

Inventory existing LiteRT-LM, model fetcher, tokenizer, sampler, and audio code. Determine what actually compiles and can perform a smoke generation on the host/platform. Do not preserve a backend merely because prior architecture named it.

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

**Gate P5:** block the network, generate text locally, cancel a generation, force an unavailable preferred backend, observe a clear fallback indicator, retry, and continue the conversation.

### Phase 6 — Retrieval and citations

Implement lexical retrieval first and optional embeddings second. The system must answer from an active article without an embedding model.

- Chunk articles and notes deterministically with stable locators.
- Candidate sources: selected text, current article, selected packs, annotations, and memory.
- Use FTS/title search as universal baseline.
- Put embeddings behind a replaceable `EmbeddingBackend` and make vectors disposable/rebuildable.
- Assemble context within a declared token budget.
- Persist the exact passages supplied to generation and map citations to those passages.
- Reject or label citations that do not map to supplied context.

Commit as `feat(retrieval): offline context assembly and verifiable citations`.

**Gate P6:** an offline question over the fixture returns an answer with a clickable citation to the exact supplied passage.

### Phase 7 — Automatic lasting user lore memory

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

**Gate P7:** across separate app sessions, a relevant durable fact is automatically captured, retrieved with provenance, edited, then forgotten; index rebuild preserves the edited canonical state and does not resurrect the forgotten item.

### Phase 8 — Entitlements without captivity

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

**Gate P8:** perpetual and month artifacts validate offline, duplicate redemption is rejected/idempotent, and removing all billing configuration still leaves the reader/data export functional.

### Phase 9 — Platform and release proof

- Build Linux, Windows, and Android from the one source tree using documented flavours.
- Add platform adapters rather than domain forks.
- Prove Android file selection/content-URI handling and lifecycle recovery.
- Run accessibility checks and keyboard/touch navigation review.
- Add backup/restore and migration fixtures.
- Update README quick start to match the exact commands that passed.
- Generate `DOCS/REBOOT/CAPABILITY-EVIDENCE.json` from test outcomes.
- Remove or clearly archive stale completion claims; do not erase history.

Commit platform fixes separately by platform. Finish with `docs: attest EnZIME One implementation evidence` only when the report is complete.

### Required final response

At the end, report:

1. What is demonstrably working, by capability and platform.
2. Exact validation commands and their results.
3. Commits created.
4. Files deliberately left unchanged.
5. Remaining blockers separated into code, external assets/credentials, hardware/platform access, and product decisions.
6. The single next highest-value action.

Do not use “complete,” “production-ready,” or “supports” for any capability below `platform-proven` evidence. If time/context runs short, stop after the last green phase gate, leave the tree buildable, and write a precise continuation entry in `IMPLEMENTATION-REPORT.md`. A smaller proven EnZIME is more valuable than another silver-plated scaffold that never makes it to the starting line.

---

## Expected first command sequence

Claude should adapt this to the committed toolchain rather than blindly copy it:

```bash
git status --short
git branch --show-current
sed -n '1,240p' DOCS/REBOOT/PRD-SITE.md
sed -n '1,280p' DOCS/REBOOT/ARCHITECTURE.md
pnpm install --frozen-lockfile
pnpm build
cargo fmt --check
cargo check -p enzime
cargo test -p enzime
```

If the existing lockfile or scripts make one command wrong, Claude must document and use the repository-correct equivalent. It must not create a second lockfile.
