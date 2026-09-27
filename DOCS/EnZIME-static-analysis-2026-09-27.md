# EnZIME static analysis — 27 September 2026

## Verdict and evidence boundary

**Not ready for commercial release. Repository consolidation exists; native
runtime convergence and release qualification remain incomplete.** This is a
fresh static inspection, not a rerun of historical builds or model/device tests.

Analyzed checkout: `/home/robin/Desktop/devProjects/EnZIME`, `master`, source
revision `979391f61a543d3f1dc7275b408f0eb4bf5ae403`. A successful GitHub origin
fetch on this pass confirmed `origin/master` at the same revision. No tracked
source changes were present before analysis; untracked `AGENTS.md` was preserved.
This report is the only authored repository change.

Forgejo is unavailable by operator instruction. No Forgejo fetch, push, repair,
remote reconfiguration, or LFS migration was attempted. GitHub availability does
not prove that its history contains work held only on Forgejo or other machines.
Local Admin-Manual revision used: `3046baa`, with local convention contents.
Its remote freshness could not be established under the outage instruction.

The deployed sesh procedure and sc-analyze static-analysis boundaries were used.
CodeGraph bootstrap succeeded: initialized, SQLite quick_check=ok, 197 files,
2,355 nodes, 7,418 edges. Graph queries returned current on-disk source. Markdown,
workflow YAML, shell scripts and package/configuration metadata were read directly
where required. This was an assessment, not architecture or implementation work.
No source fixes, dependency installation, application execution, compilation,
model inference, device testing, payment tests or third-party dependency audit
were performed.

## Checkout reconciliation

| Checkout | Observed HEAD | Observed state and relevance |
|---|---|---|
| `CascadeProjects/EnZIME-Reboot-v3-20jul2026` | None | Current task folder is not a Git repository. |
| `Desktop/devProjects/EnZIME` | `979391f` | Canonical location declared by BUILDING.md; merged engine/native repository; freshly matches GitHub origin/master. |
| `github/EnZIME` | `5dc9967` | Four commits ahead of cached origin/master; untracked metadata/transcripts. Its origin is Forgejo, so cached ahead count is not a live remote comparison. |
| `forgejo/EnZIME` | `5d10098` | Three modified generated Gradle locks plus untracked audit/log material. No upstream marker in status. |
| `forgejo/EnZIME-reader-rebuild-2026-07-18` | `259b163` | Untracked .codegraph directory; upstream equality is cached, not freshly verified. |

These local commits match the earlier inspection. No attempt was made to merge
these lineages, publish old commits, or claim remote/NAS donor completeness.
BUILDING.md names the canonical checkout and Android-first platform order.
Its documented repository identity agrees with the actual GitHub origin, while
CLAUDE.md still describes an older Forgejo-origin/Robin-s-AI-World mirror setup.
That documentation mismatch should be reconciled before future automated dispatch.

## Architecture and metrics

```text
consolidated/ Node engine + browser UI + local model connector
    proven historical reference behavior; current source defects below
                         |
                  parity work remains
                         v
root React/Vite + Rust/Tauri + AnZimmerman + LiteRT-LM
                         |
             Android -> offline desktop -> web
```

The two implementations are not interchangeable release evidence.
BUILDING.md:9-12 explicitly scopes the Node application as a reference.
consolidated/docs/RELEASE_CHECKLIST.md separates bounded implementation from
native, intelligence, storage, device and commercial acceptance.

| Measurement | Current static result |
|---|---|
| Tracked files in selected first-party source/script scope | 178 |
| Physical lines in that inventory | 24,449 |
| Languages/extensions | 100 Rust, 23 TSX, 34 MJS, 9 shell, 1 JSX, 11 TypeScript files |
| Root checklist task markers | 22 [x], 32 [ ] |
| Native compile-remediation frontier | R8.2–R8.24: 23 unchecked tasks |
| Native/build acceptance frontier | R7.1–R7.9: 9 unchecked gates |
| Reference release checklist markers | 16 [x], 41 [ ] |
| Tracked files under root dist/ | 0; does not establish absence of artifacts elsewhere |
| Scoped files exceeding 500 lines | ThinkSpace.tsx 1,210; commands.rs 1,129; SettingsPane.tsx 1,125 |

Inventory includes source, tests and scripts under src/, src-tauri/src/,
src-tauri/anzimmermanlib/rust/src/, bridge/src/, consolidated/, scripts/,
creator/ and extension/, excluding public/vendor and validation records.
It is a size metric, not a claim that every line was individually audited.
Checked markers are documentation state, not fresh behavioral verification.

Static syntax validation ran `bash -n` on tracked scripts/*.sh and `node --check`
on tracked consolidated/*.mjs and consolidated/public/*.mjs paths: **42 checks,
40 passed, 2 failed**. Both failures are recorded as F12. These commands parse
without running the application or script bodies. package.json,
consolidated/package.json and src-tauri/tauri.conf.json also parsed as valid JSON.
Passing syntax does not establish behavior, types, native linkage or security.

## Prioritized current findings

P1 means a defect or missing required behavior that should block the affected
beta/release path. P2 means a quality/performance/verification deficiency that
must be addressed within qualification. Runtime consequences below are static
inferences from the cited control/data flow unless explicitly stated otherwise.

### F01 — P1: Saved chat history is truncated and older citations are discarded

Evidence: consolidated/server.mjs:197-198, consolidated/public/app.mjs:151,
consolidated/storage.mjs:156-160.

The server slices incoming history to 12 messages for inference, then saves that
same shortened array plus the new answer. Storage replaces the entire chat row.
The client sends previous messages as role/content only, omitting citations.
Therefore later saves remove early turns and citation metadata from older answers.

Recommendation: retain the complete authoritative durable transcript; construct
a separate bounded inference context. Preserve per-message source references
through subsequent turns, reload, export and restore. Qualification should cover
at least eight exchanges, restart, and reopening citations from the first answer.

### F02 — P1: Completed DynDon acquisitions escape the configured allocation

Evidence: consolidated/server.mjs:125-131, consolidated/storage.mjs:175-183,
consolidated/dyndon.mjs:24-32 and 98-100.

Adoption registers outputs through store.mount(), making them mounted objects.
budgets() counts only managedBytes as installedBytes and enables liveDiskFree.
Completed jobs then contribute zero outstanding reservation. Real free-disk
checks still exist, but a user's smaller configured allocation can be exceeded
by successive acquisitions because completed mounted outputs are not charged.

Recommendation: distinguish application-owned downloaded bytes from externally
linked material, and charge installed content/models/caches plus outstanding
peak reservations exactly once. Test successive jobs against a fixed allocation,
including completion, release, restart and concurrent pending transfers.

### F03 — P1: Required built-in library discovery is still absent from the reference UI

Evidence: consolidated/public/app.mjs:178-180 and BUILDING.md's open downloader
acceptance section.

The download form constructs a collection from an imported manifest or manually
entered URL, size and SHA-256. It does not provide the required built-in Kiwix
and custom-library browse/search/select experience. Configurable trusted download
origins are transport configuration, not catalog discovery.

Recommendation: implement the approved catalog source interface and useful
metadata/filter/error/offline states, feeding verified selections into DynDon.
Persist defaults and per-job overrides; retain installed-library offline use.

### F04 — P1, security/integrity: Zero expected hashes bypass media verification

Evidence: src-tauri/src/model_fetcher/media.rs:123-134 and
src-tauri/src/pack_catalog/media.rs:94-105.

Both import paths accept any computed hash when the expected digest is all zero.
The user can receive a successful installation for bytes without a trusted
expected digest. This is a confirmed conditional validation bypass, not a claim
that every current manifest supplies a zero hash or that exploitation was run.

Recommendation: fail closed for unknown digests, require a trusted exact digest
and size, verify a staged copy, then atomically install that verified payload.
The current verify-original/copy-later sequence also deserves mutation-race tests.

### F05 — P1: Closing one archive invalidates the identities of other open archives

Evidence: src-tauri/src/state.rs:388-392 and src-tauri/src/commands.rs:58-64,
108-115, 121-127.

Handles are vector indices. Vec::remove shifts later entries while clients retain
their old handles. For handles 0=A, 1=B, 2=C, closing A makes old handle 1 address
C and old handle 2 invalid. This can return content from the wrong archive.

Recommendation: use stable IDs or a registry with vacant slots/generations. Verify
that closing one of three archives preserves the remaining handles and that a
stale closed handle never silently resolves to a newly opened archive.

### F06 — P1: Native article browsing and cross-library search have empty implementations

Evidence: src-tauri/anzimmermanlib/rust/src/real.rs:249-252 and
src-tauri/src/global_search/mod.rs:28-65; caller commands.rs:73-83.

RealZim::list_urls ignores pagination and returns an empty vector. Global search
initializes an empty result vector; the only proposed population loop is commented
out. It also contains std::ordering::Ordering at line 60, a visible unresolved
standard-library path. These are native implementation defects, separate from
F03's online discovery gap; they do not prove that remote catalog failures have
the same root cause.

Recommendation: implement paginated archive enumeration and UUID-to-reader
search aggregation under the existing contract; verify nonempty fixture results
and cross-archive origin attribution. Address R8.8's ordering-path correction.

### F07 — P1: Native chat ignores its supplied archive context

Evidence: src-tauri/src/commands.rs:145-152 and 157-169.

ai_chat discards zim_handle and passes no system/context prompt to the runtime.
The streaming entry point also passes None without resolving zim_handle. Thus
the reference engine's cited retrieval loop does not establish native grounded
chat parity, even after unrelated compile repairs.

Recommendation: wire the specified native retrieval/context/citation path and
verify source-bound answers and reopening citations with all network access off.

### F08 — P1: Android packaging script retains a documented command-path defect

Evidence: scripts/build-android.sh:79-87, src-tauri/tauri.conf.json:8-10,
BUILDING.md Android script warning.

The script installs frontend dependencies, then calls pnpm tauri build --apk/--aab
without the android subcommand. It does not build Vite, and beforeBuildCommand is
empty. The repository's own build guide explicitly documents this as unqualified.
No Android build or CLI execution was performed in this audit.

Recommendation: reconcile the sanctioned script with the installed Tauri CLI,
ensure fresh frontend output precedes packaging, and qualify the signed offline
Android artifact. A successful Node reference build cannot satisfy this gate.

### F09 — P2: Frontend build command does not implement its claimed typecheck gate

Evidence: package.json:8, CHECKLIST.md:872; .github/workflows/local-engine.yml:14-24.

The root build script is only vite build, while R7.6 describes Vite plus strict
TypeScript. Reference CI runs the separate consolidated package. A reference CI
pass therefore does not prove root frontend type correctness or native parity.
The historical Rust/TypeScript diagnostic counts were not rerun and are not
reported as current counts.

Recommendation: make strict TypeScript checking an explicit native frontend
acceptance step, separate from bundling and native compilation. The reference
workflow also uses ubuntu-latest despite the central self-hosted convention;
reconcile that workflow within the build contract, without starting CI here.

### F10 — P2, performance: Native title search scans the entire index on a miss

Evidence: src-tauri/anzimmermanlib/rust/src/search.rs:92-130.

Search iterates title entries from the beginning and compares starts_with(query).
On a miss it traverses every title; matching is case-sensitive. The worst-case
scan is linear in title count with directory-entry parsing per item. No latency,
RAM or device benchmarks were run.

Recommendation: specify matching/normalization semantics and use an index or
appropriate lower-bound lookup. Qualify misses and late-alphabet queries against
large real archives; avoid claiming full-text search for prefix-only behavior.

### F11 — P2: Offline reader styling references a remote font blocked by its own CSP

Evidence: src/components/ArticleViewer.tsx:25 and src-tauri/tauri.conf.json:27.

The reader inserts a Google Fonts stylesheet while the configured CSP allows
only self. The desired typography cannot depend on that request in the offline
product. No browser rendering was performed, so exact fallback appearance and
inline-style behavior remain to be observed.

Recommendation: bundle permitted font assets and qualify iframe styling with
the actual CSP and network disabled.

### F12 — P1: Both manifest-signing scripts fail shell parsing

Evidence: scripts/sign-mirror-manifest.sh:115 and
scripts/sign-pack-catalog.sh:94. The closing JSON-string assignments have
unbalanced quotation. Independently observed `bash -n` diagnostics:

```text
scripts/sign-mirror-manifest.sh: line 158: unexpected EOF while looking for matching `"'
scripts/sign-pack-catalog.sh: line 137: unexpected EOF while looking for matching `"'
```

These scripts cannot complete their signing flow as written. Their purported
signature self-checks also only run jq JSON validation (mirror:149-155,
catalog:128-134), which cannot establish signature validity.

Recommendation: repair shell/JSON construction, then qualify signature generation
and verification against the application's exact verifier using test keys. Include
tampered-manifest rejection. No signing commands or key access were executed here.

## Additional high-priority validation lead

LiteRT-LM lifecycle needs focused review before native inference qualification.
src-tauri/src/ai/litert/mod.rs:273-299 deletes the session before consuming the
terminal callback event. Both mod.rs:339 and ffi.rs:245 define a no_mangle
litert_stream_trampoline, with different ownership rules. R8.24 already covers
the duplicate. The early-delete lifetime risk depends on the pinned FFI's
completion/deletion guarantees; this pass did not audit the external dependency
or reproduce a use-after-free. Do not promote that historical claim to a fresh
confirmed runtime vulnerability without this validation.

## Useful existing controls

The reference broker checks loopback Host, same-origin requests and a mutation
header (server.mjs:172-175); it intentionally trusts local processes. It applies
CSP, constrains download origins, uses hash-checked transfer paths, and keeps
explicit partial retrieval status (server.mjs:121-122). Those are meaningful
controls, not proof of native parity or complete threat-model coverage.

The release checklist explicitly retains native packages, Android SAF,
model/runtime/device qualification, actual TurboQuant, full DynDon behavior,
and commercial activation/restore/refund evidence as open requirements.
Those requirements remain binding until the operator changes release scope.

## Repair sequence and handoff

1. Keep the canonical GitHub-backed checkout and preserve other local histories.
   Do not resume work from the empty task folder or push an old lineage blindly.
2. Restore native executability through the existing R8 frontier, Android pipeline
   and signing-script repairs; report actual gate outputs in the implementation task.
3. Close native integrity/identity defects F04–F06, then grounded-chat parity F07.
4. Close beta durability/allocation/discovery defects F01–F03 and carry their
   acceptance scenarios into the native implementation rather than maintaining
   permanently divergent behavior in two products.
5. Qualify offline Android first, then desktop and web, followed by all applicable
   model, performance, storage and commercial gates. Preserve the distinction
   between a component implementation and a demonstrated shipping product.

This is an analysis handoff, not an amendment to ARCHITECTURE.md or CHECKLIST.md.
No checked markers were changed. Forgejo-only history, remote workstations,
uncommitted work elsewhere, external dependency internals and current payment
service state remain outside this audit's evidence boundary.
