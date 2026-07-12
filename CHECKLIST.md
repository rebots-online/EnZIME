# EnZIME Reader/Annotator — Remediation CHECKLIST (v3.0)

> **1:1 linearized transformation of the amended `DOCS/ARCHITECTURE.md` (re-attested
> 2026-06-24).** This checklist contains ONLY the remaining uncompleted work —
> tasks whose architect-committed resolutions have not yet been applied to the
> source. Prior completion history (W1–W11 entity tasks, all marked [x]) is
> preserved in git history. Each task here is idempotent, independently executable,
> and carries semantic acceptance criteria evaluated by the orchestrator per whole
> logical stanzas — never by grep proxies.

## Per-task discipline (binding)

1. Read the task → look up the referenced entity/section in `DOCS/ARCHITECTURE.md`.
2. Implement to match the architect-committed resolution **verbatim**. Use ONLY
   names from the architecture; do not invent.
3. The `Accept:` is the **SEMANTIC** end-state (I-12 — an observable behaviour /
   real-fixture or unit test). It is the real basis the verifier evaluates before
   attesting ✅.
4. `git add <file>` + commit with the `Commit:` message, then flip `[ ]`→`[x]`.
5. ESCALATE only on genuine impossibility (I-4). No self-rescue, no placeholders.

**Markers:** `[ ]` pending · `[x]` coder-done · `✅` verifier-attested (semantic, I-12).

---

## Phase R — Remediation (remaining uncompleted work)

### R1 — Storage schema materialization

The architecture §7.5 resolves RF1–RF6. The current source does not yet reflect
all resolutions. These tasks apply the committed decisions to the code.

- ✅ **R1.1** Unify schema-version to `PRAGMA user_version` as canonical. In
  `src-tauri/src/storage/settings.rs`, remove `get_schema_version`/`set_schema_version`
  from the `SettingsStore` trait and its impl, OR wire them as read-only mirrors
  of `PRAGMA user_version` (architect-committed: `PRAGMA user_version` is canonical;
  the settings-row `schema_version` is dropped or made a read-only mirror).
  Accept: `MigrationRunner::current_version` on a fresh connection → `0`; after
  `apply_pending` with one migration → `1`; `get_schema_version()` (if retained)
  reads from `PRAGMA user_version`, not a settings row. Commit:
  `fix(storage): R1.1 unify schema-version to PRAGMA user_version`

- ✅ **R1.2** Populate `MIGRATIONS` array in `src-tauri/src/storage/migrations.rs`
  with the four `CREATE TABLE` statements (settings, chat_history, bookmarks,
  annotations) per the architecture §7.5 fixture DDL. The current `MIGRATIONS` is
  `&[]` (empty) — `run_migrations` is a no-op. After this task, `run_migrations()`
  creates the full schema.
  Accept: `Storage::open(":memory:")` then `run_migrations()` → all four tables
  exist with correct columns; `PRAGMA user_version` equals the migration count;
  a round-trip write+read through each store succeeds. Commit:
  `feat(storage): R1.2 populate MIGRATIONS with four CREATE TABLE statements`

- ✅ **R1.3** Declare `pub mod annotations; pub mod bookmarks; pub mod chat;` plus
  trait/struct re-exports (`pub use annotations::AnnotationsStore;`,
  `pub use bookmarks::BookmarksStore;`, `pub use chat::ChatHistoryStore;` and
  `ChatMsg`/`Annotation`/`Region`/`Bookmark` as the public surface requires) in
  `src-tauri/src/storage/mod.rs`. The files exist on disk but their traits are
  unreachable from the module path.
  Accept: `use enzime::storage::{AnnotationsStore, BookmarksStore, ChatHistoryStore};`
  compiles; the trait methods are callable through the `Storage` impl. Commit:
  `fix(storage): R1.3 declare submodules + re-exports in mod.rs`

- ✅ **R1.4** Replace `ChatHistoryStore` `Box<dyn Error>` with `StorageError` in
  `src-tauri/src/storage/chat.rs`. The three trait signatures
  (`append`/`list`/`clear`) must return `Result<_, StorageError>`.
  Accept: `grep -c 'Box<dyn' src-tauri/src/storage/chat.rs` == 0; trait methods
  return `StorageError`; behaviour unchanged — append/list/clear round-trip. Commit:
  `refactor(storage): R1.4 ChatHistoryStore typed error`

- ✅ **R1.5** Fix `annotations.rs` compilation: (a) replace every
  `StorageError::Query(String)` construction with `StorageError::Schema(..)` (the
  `StorageError` enum has no `Query` variant); (b) fix the column-index bug in
  `list()` — for `SELECT id,zim_uuid,url,region,body,created_at` (columns 0..5)
  read `region=row.get(3)`, `body=row.get(4)`, `created_at=row.get(5)`.
  Accept: `annotations.rs` compiles; `create(uuid,"/a",Region::Char{0,5},"body")`
  → rowid; `list(Some(uuid))` returns it with `region==Char{0,5}`, `body=="body"`,
  `created_at` as epoch-millis; `export`/`import` round-trip. Commit:
  `fix(storage): R1.5 annotations compile + column-index fix`

**Stanza acceptance (R1 as a whole):** A fresh `enzime.db` opened by
`Storage::open` + `run_migrations()` has all four tables created with the correct
columns; a round-trip write+read through each store (settings, chat, bookmarks,
annotations) succeeds; the schema version reads from `PRAGMA user_version` and
matches the migration count; `cargo check -p enzime` compiles with no
`StorageError::Query` or `Box<dyn Error>` in the storage module.

---

### R2 — state.rs real wiring (RF-STATE-A/B/C/D + EntitlementController signature)

The architecture §7.3 resolves RF-STATE-A/B/C and §7.6 resolves the
`EntitlementController::new` 3-arg signature. The current `state.rs` uses
zero-key seeds, placeholder types, and a 2-arg `EntitlementController::new`.

- [x] **R2.1** Replace `SidecarSigner::from_seed(&[0u8; 32])` with
  `IdentityKeystore::load_or_create(paths.identity_dir.clone())` in all 3 builders
  (`build_for_play`, `build_for_sideload`, `build_for_desktop`).
  `load_or_create` returns `Result<SidecarSigner, IdentityError>` and the builders
  return `Result<Self, AppError>`; `AppError` has **no direct** `From<IdentityError>`
  (only `AppError: From<SidecarError>` and `SidecarError: From<IdentityError>` exist —
  two hops, but `?` converts only one). Therefore the call site MUST be
  `Arc::new(IdentityKeystore::load_or_create(paths.identity_dir.clone()).map_err(SidecarError::Identity)?)`
  so the one-hop `SidecarError → AppError` conversion applies. Bring `SidecarError`
  into scope (`use crate::error::SidecarError;` or the existing `crate::sidecar::SidecarError`
  re-export). Field type `AppState.sidecar_signer: Arc<SidecarSigner>` is unchanged.
  Accept: each install signs sidecars with its OWN device identity — two installs
  produce DISTINCT signatures; the all-zero key path is gone; the 3 builders compile
  (no E0277 on `?`). Commit:
  `fix(state): R2.1 real device-identity signer`

- [x] **R2.2** Replace `MirrorFetcher::new((), ...)` + zero-key verifier with
  `reqwest::Client::new()` + `MirrorManifestVerifier::new(&MIRROR_PUBLIC_KEY)` in
  sideload + desktop builders.
  Accept: a served manifest NOT signed by `MIRROR_PUBLIC_KEY` is REJECTED (the
  zero-key "verifies anything" path is gone). Commit:
  `fix(state): R2.2 real mirror transport + verifier`

- [x] **R2.3** Replace `crate::pack_catalog::Client` → `reqwest::Client::new()` and
  `crate::pack_catalog::ManifestVerifierPlaceholder` →
  `PackCatalogManifestVerifier::new(PACK_CATALOG_PUBLIC_KEY)` in all 3 builders;
  add `mirror: MirrorPackFetcher::new(...)` field to `PackCatalog` construction.
  Accept: a pack manifest NOT signed by `PACK_CATALOG_PUBLIC_KEY` is REJECTED;
  no placeholder types remain in `state.rs`. Commit:
  `fix(state): R2.3 real pack transport + verifier`

- [x] **R2.4** Fix `EntitlementController::new` call sites to pass 3 args:
  construct `LocalPayloadVerifier` from `ENTITLEMENT_PUBLIC_KEY` (via
  `include_bytes!`) and pass it as the third argument in all 3 builders. The
  current call sites pass only 2 args (mode, storage); the `new()` signature
  requires `(mode, storage, local: LocalPayloadVerifier)`.
  Accept: `cargo check --features desktop`, `--features sideload`, and
  `--features play` each compile cleanly; the compiled binary's `AppState` uses
  a real `LocalPayloadVerifier` (not `Arc<()>` placeholder). Commit:
  `fix(state): R2.4 EntitlementController 3-arg signature`

- [x] **R2.5** Ensure `storage.run_migrations()?` is called BEFORE any manager
  that queries `storage` is constructed in all 3 builders, and that its error
  propagates as `AppError::Storage`. The schema content is owned by R1.2.
  Accept: a freshly opened `enzime.db` has the full schema after
  `run_migrations()` (a migrated key round-trips through any storage-backed
  manager). Commit:
  `fix(state): R2.5 run_migrations before manager construction`

**Stanza acceptance (R2 as a whole):** `cargo check --features desktop`,
`--features sideload`, and `--features play` each compile cleanly; the compiled
binary's `AppState` uses real device identity (not zero-key), real verifier keys
(not zero-key), and real HTTP clients (not placeholder types); two separate
installs produce distinct sidecar signatures.

---

### R3 — Entitlement gating enforcement (frontend)

The architecture §5.3 specifies frontend-side gating: components call
`useEntitlementStore().check(feature)` before proceeding; if not entitled,
`PaywallOverlay` is shown. The backend `entitlement_check` command exists but
frontend components do not yet enforce gates.

- [x] **R3.1** `ChatPane` calls `useEntitlementStore().check('ai_chat')` before
  sending a prompt; shows `PaywallOverlay` if not entitled.
  Accept: with entitlements absent, attempting AI chat shows PaywallOverlay
  instead of proceeding; with entitlements present, chat proceeds normally. Commit:
  `feat(ui): R3.1 ChatPane ai_chat entitlement gate`

- [x] **R3.2** `ChatPane` mic button calls `check('voice_transcription')` before
  starting voice input; disabled if not entitled.
  Accept: with entitlements absent, the mic button shows PaywallOverlay on tap;
  with entitlements present, voice input proceeds. Commit:
  `feat(ui): R3.2 ChatPane voice_transcription gate`

- [x] **R3.3** `SidecarExportButton` calls `check('sidecar_export')` before export
  flow.
  Accept: with entitlements absent, clicking export shows PaywallOverlay; with
  entitlements present, export proceeds. Commit:
  `feat(ui): R3.3 SidecarExportButton sidecar_export gate`

- [x] **R3.4** `PackCatalogBrowser` calls `check('pack_install')` before pack
  install.
  Accept: with entitlements absent, clicking install shows PaywallOverlay; with
  entitlements present, install proceeds. Commit:
  `feat(ui): R3.4 PackCatalogBrowser pack_install gate`

**Stanza acceptance (R3 as a whole):** With entitlements absent (fresh install,
no payload), attempting AI chat / voice / sidecar export / pack install shows the
PaywallOverlay instead of proceeding; with entitlements present (signed payload
stored), each action proceeds normally; the gate check is cached (second action
does not re-verify).

---

### R4 — Build script + CI fixes

The architecture §7.8 resolves RF-1/3/5/6/7. The current build scripts and CI
config do not reflect the resolved decisions.

- [x] **R4.1** `scripts/version-bump.sh` — change MAJOR from `0` to `1`; fix Cargo
  sed to target root `Cargo.toml` `[workspace.package] version` (the current sed
  targets `src-tauri/Cargo.toml` which uses `version.workspace = true` and has no
  literal version line — the sed matches nothing).
  Accept: running `version-bump.sh` produces a monotonic version bump with
  `MAJOR=1` and a `[skip ci]` commit; the Cargo workspace version is stamped. Commit:
  `fix(build): R4.1 version-bump MAJOR=1 + Cargo workspace sed`

- [x] **R4.2** `.forgejo/workflows/build.yml` — add `pull_request: {}` trigger
  alongside existing `push` and `workflow_dispatch`; fix upload-artifact globs to
  `--target`-qualified output paths (`src-tauri/target/<triple>/release/bundle/…`
  not `src-tauri/target/release/bundle/…`).
  Accept: the Forgejo workflow triggers on push, PR, and manual dispatch;
  artifact upload captures the `--target`-qualified output. Commit:
  `fix(ci): R4.2 PR trigger + target-qualified artifact paths`

- [x] **R4.3** `src-tauri/gen/android/app/build.gradle.kts` — align `keyAlias` to
  `helloword` (matching the existing `production.keystore` alias used by
  `sign-release.sh`).
  Accept: the Gradle release build signs with the `helloword` alias; `jarsigner
  -verify` passes on the produced APK/AAB. Commit:
  `fix(build): R4.3 Android keyAlias helloword`

**Stanza acceptance (R4 as a whole):** Running `version-bump.sh` produces a
monotonic version bump with `MAJOR=1` and a `[skip ci]` commit; the Forgejo
workflow triggers on both push and PR; artifact upload captures the
`--target`-qualified output; the Gradle release build signs with the `helloword`
alias.

---

### R5 — Documentation amendments

- [x] **R5.1** Create `DOCS/NETWORKING.md` recording port `47921` for the bridge
  bind address (E-ENT-18 confirmed non-patterned port per I-16).
  Accept: `DOCS/NETWORKING.md` exists and names port 47921 as the bridge bind
  address. Commit:
  `docs(network): R5.1 NETWORKING.md port 47921`

- [x] **R5.2** Fix §5.3 PlantUML diagram in `ARCHITECTURE.md` to offline-first
  ordering (cache → LocalPayloadVerifier → RC fallback → cache). Done in Phase 0
  architecture amendment. Commit: `docs(arch): R5.2 §5.3 PlantUML offline-first`

---

### R6 — Checkbox corrections (already-completed tasks)

These tasks were marked `[ ]` in the prior CHECKLIST but are confirmed done in
the codebase. Listed here for traceability.

- [x] **R6.1** **E-BLD-18** — `pnpm-lock.yaml` already committed at repo root.
  `pnpm install --frozen-lockfile` is deterministic. Commit: (already committed)

- [x] **R6.2** **E-PACK-18** — Placeholder `Client` and `ManifestVerifierPlaceholder`
  types already removed from `pack_catalog/mod.rs`. The `PackCatalog` struct uses
  real `reqwest::Client` and `PackCatalogManifestVerifier`. Commit: (already
  committed)

- [x] **R6.3** **RF-AI-2** — `system_prompt` application in `LiteRtLlm::generate`
  and `generate_stream` already implemented (prepends `system_prompt` to input
  text when `Some`). Commit: (already committed)

---

### R6b — Compile unblockers (added 2026-07-02, /init-checklist reconciliation vs live `cargo check` audit)

> Source: 2026-07-02 orchestrator audit — `cargo check --features desktop -p enzime`
> fails with 112 errors. The four clusters below are architect-committed
> resolutions verified against source this session. Residual type/signature
> errors (E0061/E0063/E0277/E0283/E0308/E0423/E0425) are expected to shrink
> once R2 tasks + these land; whatever survives at R7.1 maps back to R2 or
> escalates as architect debt — do NOT self-rescue past them.

- [x] **R6b.1** `src-tauri/Cargo.toml` — extend the reqwest dependency (line 42)
  to `reqwest = { version = "0.12", features = ["json", "stream", "blocking"] }`
  and add `futures-util = "0.3"` as a new dependency. `stream` enables
  `Response::bytes_stream()` (consumed by R6b.4); `blocking` enables the
  already-written `reqwest::blocking::get` in `app_update/android.rs:32`
  (`download_apk` is a sync fn — if the I-22 runtime-context check later finds
  it called from async context, that is an escalation, not a rewrite here).
  Accept: both `stream` and `blocking` appear in the reqwest features array and
  `futures-util` resolves in the lockfile; `cargo metadata` lists futures-util
  as a workspace dependency. Commit:
  `fix(deps): R6b.1 reqwest stream+blocking features + futures-util`

- [x] **R6b.2** `src-tauri/src/commands.rs` — replace every
  `use crate::anzimmermanlib::rust::ZimReader;` with
  `use anzimmermanlib::ZimReader;` (9 sites: lines 59, 74, 89, 122, 596, +4 —
  `anzimmermanlib` is an external path crate per `src-tauri/Cargo.toml:45`, and
  `ZimReader` is the trait at its crate root, `anzimmermanlib/rust/src/lib.rs:36`).
  Touch ONLY the `use` lines; no other change. Accept: zero occurrences of
  `crate::anzimmermanlib` remain in commands.rs; every former error site imports
  the trait through the external crate path and the E0433 cluster for
  commands.rs is gone from `cargo check` output. Commit:
  `fix(commands): R6b.2 anzimmermanlib external-crate import path`

- [x] **R6b.3** `src-tauri/src/billing/mod.rs` — lines 16–17: replace
  `use super::local_payload::{LocalPayload, LocalPayloadVerifier};` with
  `use self::local_payload::{LocalPayload, LocalPayloadVerifier};` and
  `use super::revenuecat::RevenueCatClient;` with
  `use self::revenuecat::RevenueCatClient;` (`billing/mod.rs` is a top-level
  module, so `super::` resolves to the crate root where those modules do not
  exist; the `pub mod` declarations at lines 3–7 are correct and untouched).
  Accept: the two E0432 unresolved-import errors for billing/mod.rs are gone
  from `cargo check` output; `EntitlementController` still resolves
  `LocalPayloadVerifier`/`RevenueCatClient` through the module path. Commit:
  `fix(billing): R6b.3 self:: module paths in mod.rs`

- [x] **R6b.4** Replace the phantom `reqwest::futures` import in exactly three
  files — `src-tauri/src/model_fetcher/mirror.rs:149`,
  `src-tauri/src/pack_catalog/lan.rs:152`, `src-tauri/src/pack_catalog/mirror.rs:113`:
  swap `use reqwest::futures::…` for `use futures_util::StreamExt;` and drive
  the download loop off `response.bytes_stream()` (`while let Some(chunk) =
  stream.next().await`), preserving each file's existing progress/verify logic
  unchanged (`reqwest::futures` is not a real API path; `bytes_stream()` +
  `futures_util::StreamExt` is the committed streaming approach, enabled by
  R6b.1). Accept: no `reqwest::futures` occurrences remain in the tree; each of
  the three fetchers compiles its streaming loop against `futures_util::StreamExt`;
  chunked download behaviour (progress callback + post-download verification)
  is preserved per the surrounding code. Commit:
  `fix(fetch): R6b.4 bytes_stream + futures_util replaces phantom reqwest::futures`

**Stanza acceptance (R6b whole):** the four error clusters (E0433
`crate::anzimmermanlib`, E0432 billing imports, E0432 `reqwest::futures` ×3,
E0433 `reqwest::blocking`) no longer appear in `cargo check --features desktop
-p enzime` output; error count drops materially from 112; surviving errors each
map to an existing R2 task or are escalated as architect debt.

---

### R8 — Deep compile remediation (R7.1 desktop audit)

> Source: 2026-07-02 R7.1 gate `cargo check --features desktop -p enzime` emits ~89
> errors of pre-existing debt the R1–R6b stanzas never scoped. Every fix below was
> verified against live source this session (exact symbols, `file:line`, real API
> shapes from vendored + registry crates). Accept clauses are hermetic end-state
> checks a strict coder self-verifies by READING (I-10 — no `cargo`); the
> orchestrator attests ✅ by semantic codegraph comparison per I-22. Dependencies
> (R8.1) land first; everything else is independently dispatchable. Three clusters
> need architect judgment and are filed under **R8-ESCALATIONS** — do NOT
> self-rescue them.

- [x] **R8.1** `src-tauri/Cargo.toml` — (a) change the rusqlite dependency (line 36)
  from `features = ["bundled"]` to `features = ["bundled", "uuid"]` (rusqlite 0.31's
  `uuid` feature provides `ToSql`/`FromSql` for `uuid::Uuid` storing as a 16-byte
  **BLOB** — confirmed against `rusqlite-0.31.0/src/types/to_sql.rs` test
  `CREATE TABLE foo (id BLOB CHECK(length(id) = 16)…)`, matching the migration's
  `zim_uuid BLOB NOT NULL` in `migrations.rs:23,28`); (b) add `tracing = "0.1"`
  (consumed by `log/mod.rs:57-63` as `tracing::level_filters::LevelFilter`);
  (c) add `tracing-subscriber = { version = "0.3", features = ["fmt", "registry"] }`
  (`fmt` for `tracing_subscriber::fmt::layer()` at `log/mod.rs:28,32`; `registry`
  for `tracing_subscriber::registry()` at `log/mod.rs:36` and the per-layer
  `Filter`/`with_filter` API at `log/mod.rs:30,34` — `tracing-appender = "0.2"`
  already at line 44 pairs with these); (d) add `base64 = "0.22"` (consumed by
  `commands.rs:196` after R8.2). Touch ONLY the `[dependencies]` table.
  Accept: `grep -c 'tracing-subscriber' src-tauri/Cargo.toml` == 1 and that line
  contains `features = ["fmt", "registry"]`; `grep -c 'tracing = "0.1"'
  src-tauri/Cargo.toml` == 1; `grep -c 'base64 = "0.22"' src-tauri/Cargo.toml`
  == 1; the rusqlite line reads `features = ["bundled", "uuid"]`. Commit:
  `fix(deps): R8.1 tracing/tracing-subscriber/base64 + rusqlite uuid feature`

- [ ] **R8.2** `src-tauri/src/commands.rs:196` — replace the legacy
  `base64::decode(&pcm_b64).map_err(|e| format!("Invalid base64 encoding: {}", e))?`
  call (the top-level `decode` fn was removed in base64 0.22) with the Engine API:
  add `use base64::Engine;` inside `ai_voice_chat` and rewrite to
  `base64::engine::general_purpose::STANDARD.decode(pcm_b64.as_bytes()).map_err(|e|
  format!("Invalid base64 encoding: {}", e))?` (`.as_bytes()` yields `&[u8]` which
  unambiguously satisfies `Engine::decode<T: AsRef<[u8]>>`). Depends on R8.1.
  Accept: `grep -c 'base64::decode' src-tauri/src/commands.rs` == 0; `grep -c
  'general_purpose::STANDARD.decode' src-tauri/src/commands.rs` == 1; `grep -c 'use
  base64::Engine;' src-tauri/src/commands.rs` == 1. Commit:
  `fix(commands): R8.2 ai_voice_chat base64 Engine API`

- [ ] **R8.3** `src-tauri/src/ai/litert/mod.rs` — the bare `litert_lm_*` extern
  calls (lines 58, 74, 78, 82, 101, 126, 127, 134, 137, 164, 169, 178, 192, 193,
  210, 234, 235, 241, 243, 274, 285) are unresolved because the `pub use ffi::{…}`
  block at lines 10–14 re-exports only the TYPES, not the functions. Add the
  following 14 function names to that existing `pub use ffi::{ … };` block:
  `litert_lm_engine_settings_create, litert_lm_engine_settings_set_max_num_tokens,
  litert_lm_engine_settings_delete, litert_lm_engine_create,
  litert_lm_session_config_create, litert_lm_session_config_set_sampler_params,
  litert_lm_session_config_set_max_output_tokens, litert_lm_session_config_delete,
  litert_lm_engine_create_session, litert_lm_session_generate_content,
  litert_lm_session_generate_content_stream, litert_lm_session_delete,
  litert_lm_responses_get_response_text_at, litert_lm_responses_delete` (all
  declared `pub fn` inside `extern "C" {}` blocks in `ffi.rs`). Do NOT add
  `litert_stream_trampoline` — it is defined locally in `mod.rs:339` and also in
  `ffi.rs:245` (see R8-ESC-3); importing the ffi copy would collide. Do NOT use a
  glob `use ffi::*` (same collision). Accept: the `pub use ffi::{…}` block in
  `mod.rs` contains all 14 names verbatim and does NOT contain
  `litert_stream_trampoline`; `grep -c 'litert_lm_session_generate_content_stream'
  src-tauri/src/ai/litert/mod.rs` >= 1 within the `pub use` block. Commit:
  `fix(ai): R8.3 re-export litert_lm_* extern fns from ffi module`

- [ ] **R8.4** `src-tauri/src/ai/gemma_audio.rs` — (a) the `use super::litert::ffi::{…}`
  import at lines 6–11 is missing two functions called in the body: add
  `litert_lm_session_config_delete` and `litert_lm_session_generate_content` to
  that import list; (b) line 47 currently calls
  `litert_lm_session_delete(session_config as *mut LiteRtLmSessionConfig)` — this
  passes a `*mut LiteRtLmSessionConfig` to a fn expecting `*mut LiteRtLmSession`
  (E0308). The intent is to free the just-consumed session config, so rewrite line
  47 to `unsafe { litert_lm_session_config_delete(session_config); }` (types now
  match: `litert_lm_session_config_delete(config: *mut LiteRtLmSessionConfig)` per
  `ffi.rs:155`). Accept: `grep -c 'litert_lm_session_config_delete'
  src-tauri/src/ai/gemma_audio.rs` >= 1 in the import AND `grep -c
  'litert_lm_session_delete(session_config' src-tauri/src/ai/gemma_audio.rs` == 0
  and `grep -c 'litert_lm_session_config_delete(session_config)'
  src-tauri/src/ai/gemma_audio.rs` == 1. Commit:
  `fix(ai): R8.4 gemma_audio ffi imports + session_config_delete call`

- [ ] **R8.5** `src-tauri/src/storage/settings.rs` — add a new canonical key to the
  `pub mod setting_key { … }` block (after line 56) matching the existing
  `pub const NAME: &str = "…";` idiom:
  `pub const BILLING_LOCAL_PAYLOAD: &str = "billing.local_payload";`. This key is
  read at `billing/mod.rs:93` (`setting_key::BILLING_LOCAL_PAYLOAD`) to
  store/retrieve the signed `LocalPayload` JSON; it is currently absent from the
  namespace (E0425). Accept: `grep -c 'BILLING_LOCAL_PAYLOAD'
  src-tauri/src/storage/settings.rs` == 1 and it is a `pub const … &str` inside
  `pub mod setting_key`. Commit:
  `feat(storage): R8.5 BILLING_LOCAL_PAYLOAD setting key`

- [ ] **R8.6** `src-tauri/src/billing/local_payload.rs:70-71` — ed25519-dalek 2.1's
  `Signature::from_bytes` takes `&[u8; 64]` (a `SignatureBytes` array, NOT
  `&Vec<u8>`) and returns `Self` infallibly (no `map_err`). Replace lines 70-71:
  `let signature = ed25519_dalek::Signature::from_bytes(&payload.signature)
  .map_err(|_| EntitlementError::NotEntitled)?;` with a length-checked array
  conversion then an infallible `from_bytes`:
  `let sig_bytes: [u8; 64] = payload.signature.as_slice().try_into()
  .map_err(|_| EntitlementError::NotEntitled)?;` /
  `let signature = ed25519_dalek::Signature::from_bytes(&sig_bytes);`
  (`try_into()` on `&[u8]`→`[u8;64]` is in the prelude; wrong-length →
  `NotEntitled`). Accept: `grep -c 'from_bytes(&payload.signature)'
  src-tauri/src/billing/local_payload.rs` == 0; `grep -c 'from_bytes(&sig_bytes)'
  src-tauri/src/billing/local_payload.rs` == 1; `grep -c 'try_into'
  src-tauri/src/billing/local_payload.rs` == 1. Commit:
  `fix(billing): R8.6 local_payload Signature [u8;64] conversion`

- [ ] **R8.7** `src-tauri/src/billing/revenuecat.rs:188` — `DateTime::from(Utc::now())`
  is ambiguous (`Tz2`/`DateTime<_>` cannot be inferred — E0283 ×2). chrono provides
  cross-timezone `PartialOrd`, so compare directly: change
  `Ok(expires) => expires > DateTime::from(Utc::now()),` to
  `Ok(expires) => expires > Utc::now(),` (`expires` is `DateTime<FixedOffset>` from
  `parse_from_rfc3339`; this mirrors the working pattern at lines 80–92). Accept:
  `grep -c 'DateTime::from(Utc::now())' src-tauri/src/billing/revenuecat.rs` == 0
  and the line reads `expires > Utc::now()`. Commit:
  `fix(billing): R8.7 revenuecat expiry comparison disambiguated`

- [ ] **R8.8** `src-tauri/src/global_search/mod.rs:60` — `std::ordering::Ordering`
  is not a path (the module is `std::cmp`). Change
  `unwrap_or(std::ordering::Ordering::Equal)` to
  `unwrap_or(std::cmp::Ordering::Equal)`. Accept: `grep -c 'std::ordering'
  src-tauri/src/global_search/mod.rs` == 0; `grep -c 'std::cmp::Ordering::Equal'
  src-tauri/src/global_search/mod.rs` == 1. Commit:
  `fix(search): R8.8 std::cmp::Ordering path`

- [ ] **R8.9** `src-tauri/src/sidecar/store.rs` — `Storage::with_conn`
  (`storage/mod.rs:53`) requires its closure to return `Result<R, StorageError>`,
  but four closures annotate `Ok::<_, rusqlite::Error>(…)` (lines 155, 163, 221,
  258) and two outer `?` (lines 164, 222, 259) need `From<StorageError>` for
  `StoreError`. (a) Remove the `<_, rusqlite::Error>` turbofish from those four
  `Ok(…)` returns so each infers `Result<_, StorageError>` from the `with_conn`
  bound (the inner `conn.execute(…)?` already converts `rusqlite::Error →
  StorageError` via the existing `#[from]` at `storage/mod.rs:19`); (b) add a new
  variant to the `StoreError` enum (lines 14–24):
  `#[error("storage error: {0}")] Storage(#[from] crate::storage::StorageError),`
  which gives `From<StorageError> for StoreError` via thiserror; (c) the INSERT at
  lines 212–219 passes a heterogeneous array literal (mixing `&&[u8]` and `&&str`,
  E0308 at 215) — replace the `[ … ]` array with the
  `rusqlite::params![artifact_id.as_slice(), zim_uuid.as_slice(), kind.as_str(),
  signer_pubkey.as_slice(), created_at, path_str.as_str()]` macro (path-qualified
  macro invocation needs no `use`). Accept: `grep -c 'Ok::<_, rusqlite::Error>'
  src-tauri/src/sidecar/store.rs` == 0; `grep -c 'Storage(#[from]
  crate::storage::StorageError)' src-tauri/src/sidecar/store.rs` == 1; the INSERT
  uses `rusqlite::params![` not a `[` array. Commit:
  `fix(sidecar): R8.9 store.rs closure error types + params! + StoreError::Storage`

- [ ] **R8.10** `src-tauri/src/commands.rs` — six call sites invoke `Storage` trait
  methods without the trait in scope (E0599 at 323, 330, 349, 374, 544, 567; the
  E0277 `str: Sized` at 546 is downstream of 544 and resolves with it). Add the
  missing per-function `use` (matching the established idiom already present at
  lines 267, 355, 396, 428, 481): `use crate::storage::annotations::AnnotationsStore;`
  inside `annotations_create` (after line 307), `annotations_delete` (line 329
  body), and `annotations_export` (after line 336); `use
  crate::storage::bookmarks::BookmarksStore;` inside `bookmarks_list` (line 371
  body); `use crate::storage::settings::SettingsStore;` inside `variant_current`
  (after line 538) and `variant_override` (after line 563). Accept: each of the six
  named functions contains its respective trait `use` line; `grep -c 'use
  crate::storage::settings::SettingsStore;' src-tauri/src/commands.rs` == 2 (the
  existing settings_get/set at 481/488 are inside `settings_get`/`settings_set`,
  not these — count the two new ones in variant_current/override). Commit:
  `fix(commands): R8.10 per-function storage trait imports`

- [ ] **R8.11** `src-tauri/src/commands.rs:626` — in `sidecar_create`, `zim_uuid`
  (a `uuid::Uuid` from `reader.metadata().uuid`, line 606) is passed to the
  `Sidecar` literal field `zim_uuid: [u8; 16]` (E0308). Change the struct-literal
  line from `zim_uuid,` to `zim_uuid: zim_uuid.into_bytes(),` (`Uuid::into_bytes()
  -> [u8; 16]`, the same conversion used for `artifact_id` at line 609). Accept:
  `grep -n 'zim_uuid: zim_uuid.into_bytes()' src-tauri/src/commands.rs` matches
  line ~626. Commit: `fix(commands): R8.11 sidecar_create zim_uuid Uuid→[u8;16]`

- [ ] **R8.12** `src-tauri/src/commands.rs` (`sidecar_import`, lines 758 & 794–808)
  — (a) line 758 `use crate::sidecar::Payload;` is a private re-export path (E0603);
  change to `use crate::sidecar::payload::Payload;` (`payload` is `pub mod
  payload;` per `sidecar/mod.rs:157`); (b) the index-INSERT closure (794–808)
  returns `Result<usize, rusqlite::Error>` and uses an `ok_or("Invalid path")?` that
  cannot convert `&str → StorageError` (E0277/E0308 ×3). Rewrite the closure body
  to: `let path_str = meta.path.to_str().ok_or(crate::storage::StorageError::Schema("Invalid
  path".to_string()))?;` then `conn.execute("INSERT OR REPLACE INTO sidecar_index …
  VALUES (?1..?6)", rusqlite::params![meta.artifact_id.as_slice(),
  meta.zim_uuid.as_slice(), meta.kind.as_str(), meta.signer_pubkey.as_slice(),
  meta.created_at, path_str])?; Ok(())` — the closure now infers
  `Result<(), StorageError>` from `with_conn`. Keep the trailing
  `.map_err(|e| format!("index update failed: {}", e))?;`. Accept: `grep -c 'use
  crate::sidecar::Payload;' src-tauri/src/commands.rs` == 0; `grep -c 'use
  crate::sidecar::payload::Payload;' src-tauri/src/commands.rs` >= 1; `grep -c
  'rusqlite::params!' src-tauri/src/commands.rs` >= 1; `grep -c 'ok_or("Invalid
  path")' src-tauri/src/commands.rs` == 0. Commit:
  `fix(commands): R8.12 sidecar_import Payload path + index INSERT closure`

- [ ] **R8.13** `src-tauri/src/commands.rs` (`sidecar_delete`, lines 843–873) — the
  two `with_conn` closures return `Result<_, String>`/`Result<usize,
  rusqlite::Error>` but `with_conn` requires `Result<_, StorageError>` (E0277/E0308
  ×6, plus the `??` at 857 is invalid). Rewrite the SELECT closure (843–857) to:
  `let zim_uuid_opt: Option<[u8; 16]> = state.storage.with_conn(|conn| { let mut
  stmt = conn.prepare("SELECT zim_uuid FROM sidecar_index WHERE artifact_id = ?1
  LIMIT 1")?; let mut rows = stmt.query_map([artifact_id_bytes.as_slice()], |row|
  row.get::<_, [u8; 16]>(0))?; Ok(match rows.next() { Some(Ok(zu)) => Some(zu), _
  => None }) }).map_err(|e| format!("Index query failed: {}", e))?;` then
  `let zim_uuid = zim_uuid_opt.ok_or_else(|| format!("Sidecar not found: {}",
  artifact_id))?;`. Rewrite the DELETE closure (868–873) to: `state.storage.with_conn(|conn|
  { conn.execute("DELETE FROM sidecar_index WHERE artifact_id = ?1",
  [artifact_id_bytes.as_slice()])?; Ok(()) }).map_err(|e| format!("Index deletion
  failed: {}", e))?;`. Accept: `grep -c 'Ok::<_, String>' src-tauri/src/commands.rs`
  == 0 (in sidecar_delete); `grep -c 'zim_uuid_opt' src-tauri/src/commands.rs` >= 1;
  no `??` token remains in `sidecar_delete`. Commit:
  `fix(commands): R8.13 sidecar_delete with_conn closures StorageError-typed`

- [ ] **R8.14** `src-tauri/src/commands.rs` (`trust_set`, lines 905–931) — the
  `TrustEntry { … }` literal (913–919) omits the required `source` field (E0063;
  `TrustEntry.source: TrustSource` per `trust.rs:206`) and `trust_db.set(entry)`
  (926) passes a `TrustEntry` where `TrustDb::set` takes five separate args
  (E0061; signature `set(&self, pubkey: [u8;32], level: TrustLevel, scope:
  Option<&str>, expires_at: Option<i64>, reason: Option<&str>)` per `trust.rs:61`).
  Remove the `TrustEntry { … }` literal and change the `else` branch (926) to
  `state.trust_db.set(pubkey_bytes, level, scope.as_deref(), expires_at,
  reason.as_deref()).map_err(|e| e.to_string())?;`. Change the local import at line
  905 from `use crate::sidecar::trust::{TrustDb, TrustEntry};` to `use
  crate::sidecar::trust::TrustDb;` (TrustEntry is no longer referenced here; it
  remains imported module-wide at line 15 for `trust_list`). Leave the `if level ==
  …::Revoked { state.trust_db.remove(…) }` revoke branch (922–925) UNTOUCHED — it
  is resolved by R8-ESC-2. Accept: `grep -c 'let entry = TrustEntry'
  src-tauri/src/commands.rs` == 0; `grep -c 'trust_db.set(pubkey_bytes, level,'
  src-tauri/src/commands.rs` == 1; the revoke branch referencing `Revoked`/`remove`
  is still present (pending R8-ESC-2). Commit:
  `fix(commands): R8.14 trust_set set() individual-args (revoke branch pending ESC)`

- [ ] **R8.15** `src-tauri/src/commands.rs:157` — `ai_chat_stream` declares
  `state: State<AppState>` (E0726 implicit elided lifetime). Every other `async fn`
  command that takes `State` already uses `State<'_, AppState>` (`model_fetch:577`,
  `pack_install:961`, `app_update_check:1006`, `app_update_apply:1022`). Align:
  change `state: State<AppState>` to `state: State<'_, AppState>` on line 157.
  Accept: `grep -n 'state: State<AppState>' src-tauri/src/commands.rs` returns no
  line in `ai_chat_stream` (line 157 now reads `State<'_, AppState>`). Commit:
  `fix(commands): R8.15 ai_chat_stream State<'_, AppState>`

- [ ] **R8.16** `src-tauri/src/sidecar/chunk.rs` + `src-tauri/src/sidecar/codec.rs`
  — `chunk_ingest` returns `Result<ReassembleStatus, String>` (commands.rs:941) but
  `ReassembleStatus` does not satisfy Tauri's `IpcResponse` (E0599), which requires
  `Serialize`. Add `Serialize` to both derives: (a) `chunk.rs:23` change
  `#[derive(Debug, Clone, PartialEq, Eq)]` to `#[derive(Debug, Clone, PartialEq,
  Eq, Serialize)]` (`Serialize` already imported at `chunk.rs:3`); (b) `codec.rs:7`
  change `#[derive(Error, Debug, Clone, PartialEq, Eq)]` to `#[derive(Error, Debug,
  Clone, PartialEq, Eq, serde::Serialize)]` (fully-qualified — `codec.rs` has no
  `serde` import; `CodecError`'s fields are all `String`/`u32`, serializable; this
  unblocks `ReassembleStatus::Failed(CodecError)`). Accept: `grep -c 'Eq,
  Serialize)' src-tauri/src/sidecar/chunk.rs` == 1; `grep -c 'Eq,
  serde::Serialize)' src-tauri/src/sidecar/codec.rs` == 1. Commit:
  `fix(sidecar): R8.16 derive Serialize for ReassembleStatus + CodecError`

- [ ] **R8.17** `src-tauri/src/lib.rs:46` + `src-tauri/src/state.rs` —
  `EnzimeLogger::init` now takes `(paths: &AppPaths, level: LogLevel)` (`log/mod.rs:24`)
  but four call sites pass only `&paths` (E0061 at lib.rs:46 and state.rs:295). Add
  the second argument `crate::log::LogLevel::Info` at all four sites: `lib.rs:46`,
  and the three builders `state.rs:98` (`build_for_play`), `state.rs:193`
  (`build_for_sideload`), `state.rs:295` (`build_for_desktop`) — fixing the latent
  play/sideload sites preempts R7.2/R7.3. (`LogLevel::Info` is the conventional
  default; no config-driven level exists yet — an I-10(b) swap point for a future
  settings/env level.) Accept: `grep -c 'EnzimeLogger::init(&paths)'
  src-tauri/src/lib.rs src-tauri/src/state.rs` == 0; `grep -c
  'EnzimeLogger::init(&paths, crate::log::LogLevel::Info)' src-tauri/src/lib.rs
  src-tauri/src/state.rs` == 4. Commit:
  `fix(state): R8.17 EnzimeLogger::init LogLevel::Info arg`

- [ ] **R8.18** `src-tauri/src/state.rs` — two construction bugs repeated in all
  three builders. (a) The `pack_verifier` `.map_err(|e| AppError::Fetch(
  PackError::Verify(e.to_string())))` (lines 123/225/327) is a category error:
  `AppError::Fetch` holds `FetchError` (`error.rs:28`), not `PackError`. Change
  `crate::pack_catalog::PackError::Verify(e.to_string())` to
  `crate::model_fetcher::FetchError::Verify(e.to_string())` at all three sites
  (`FetchError::Verify(String)` is used at `mirror.rs:204`). (b) `lan:
  crate::pack_catalog::LanPeerPackFetcher,` (lines 132/234/336) treats it as a unit
  struct (E0423) but it has a `pub packs_dir: PathBuf` field (`lan.rs:31`); change
  to `lan: crate::pack_catalog::LanPeerPackFetcher { packs_dir:
  paths.packs_dir.clone() },` at all three sites. Accept: `grep -c
  'PackError::Verify(e.to_string())' src-tauri/src/state.rs` == 0; `grep -c
  'FetchError::Verify(e.to_string())' src-tauri/src/state.rs` == 3; `grep -c
  'LanPeerPackFetcher { packs_dir: paths.packs_dir.clone() }'
  src-tauri/src/state.rs` == 3. Commit:
  `fix(state): R8.18 pack verifier FetchError + LanPeerPackFetcher literal`

- [ ] **R8.19** `src-tauri/src/pack_catalog/lan.rs:90` — mdns-sd 0.11.5 renamed the
  single-address accessor; `ServiceInfo::get_address()` does not exist, but
  `get_addresses(&self) -> &HashSet<IpAddr>` does (`mdns-sd-0.11.5/src/service_info.rs:212`;
  `get_port() -> u16` at line 206 still exists). Change `if let Some(addr) =
  info.get_address() {` to `if let Some(addr) = info.get_addresses().iter().next() {`
  (`addr` is now `&IpAddr`; the existing `addr.to_string()` and `info.get_port()`
  on lines 91–92 are unchanged and type-correct). Accept: `grep -c 'info.get_address()'
  src-tauri/src/pack_catalog/lan.rs` == 0; `grep -c 'info.get_addresses().iter().next()'
  src-tauri/src/pack_catalog/lan.rs` == 1. Commit:
  `fix(pack): R8.19 mdns-sd get_addresses API drift`

- [ ] **R8.20** `src-tauri/src/pack_catalog/lan.rs:214-220` and `:251-258` — two
  `.map_err(|_| { fs::remove_file(&temp_path).await.ok(); … })` closures are
  `async` inside `map_err`, which takes a sync `Fn` (E0728 ×2). Rewrite each to a
  match/if that does the cleanup in the async body, then returns the error. For the
  manifest parse (214–220): `let manifest: PeerShareManifest = match
  serde_json::from_slice(&manifest_bytes) { Ok(m) => m, Err(_) => { let _ =
  fs::remove_file(&temp_path).await; return Err(PackError::Verify("invalid manifest
  JSON".to_string())); } };`. For the signature verify (251–258): `if
  public_key.verify(&manifest_bytes, &signature).is_err() { let _ =
  fs::remove_file(&temp_path).await; return Err(PackError::Verify("signature
  verification failed".to_string())); }`. Preserve all surrounding logic. Accept:
  `grep -c '.await' src-tauri/src/pack_catalog/lan.rs` does not decrease (the
  `.await` moves into the match/if arms); no `.map_err(|_|` closure contains
  `.await` — verify by reading lines 214–220 and 251–258 contain no `=> { … .await`
  inside a `map_err`. Commit:
  `fix(pack): R8.20 lan.rs await-out-of-sync cleanup closures`

- [ ] **R8.21** `src-tauri/src/storage/chat.rs:33-71` (and the identical pattern at
  `annotations.rs:59-98` and `bookmarks.rs:54-90`) — the `list()` match builds
  `let (query, params): (&str, Vec<&dyn rusqlite::ToSql>) = match … { Some(x) => (…,
  vec![&x as &dyn rusqlite::ToSql]), None => (…, vec![]) };` then uses `params` after
  the match. The `&x` borrows a match-arm-local (`sid`/`uuid`) that does not outlive
  the match (E0597 at `chat.rs:42`; the same defect is latent in annotations/bookmarks
  and surfaces once R8.1 satisfies `Uuid: ToSql`). Convert all three to owned
  params: change the binding type to `Vec<Box<dyn rusqlite::ToSql>>`, replace each
  `vec![&x as &dyn rusqlite::ToSql]` with `vec![Box::new(x)]` (and `vec![&limit …]`
  with `vec![Box::new(limit)]`, `vec![]` unchanged), and change the
  `stmt.query_map(params.as_slice(), …)` call to
  `stmt.query_map(rusqlite::params_from_iter(params), …)` (consuming the Vec;
  `Box<dyn ToSql>: ToSql` so `params_from_iter` accepts it). Behavior unchanged.
  Accept: `grep -c 'Vec<&dyn rusqlite::ToSql>' src-tauri/src/storage/chat.rs
  src-tauri/src/storage/annotations.rs src-tauri/src/storage/bookmarks.rs` == 0;
  `grep -c 'params_from_iter' src-tauri/src/storage/chat.rs
  src-tauri/src/storage/annotations.rs src-tauri/src/storage/bookmarks.rs` == 3.
  Commit: `fix(storage): R8.21 list() match-arm borrow → owned Box<dyn ToSql> + params_from_iter`

- [ ] **R8.22** `src-tauri/src/state.rs` (desktop builder `build_for_desktop`,
  sideload builder `build_for_sideload`) — `MirrorFetcher::new`
  (`src-tauri/src/model_fetcher/mirror.rs:41`) takes FOUR args
  `(http: reqwest::Client, verifier: MirrorManifestVerifier, manifest:
  MirrorManifest, models_dir: PathBuf)` but `state.rs:313` (desktop) and
  `state.rs:211` (sideload) pass only three — the `manifest` arg is omitted
  (E0061). `MirrorManifest` is a SIGNED artifact that `MirrorManifestVerifier`
  verifies, so the builder cannot fabricate a real one. Ratified resolution
  (OPTION (a), offline-safe per INV-OFFLINE): source the manifest from disk, not
  the network. In BOTH builders, insert the manifest-source block between the
  existing `let verifier = MirrorManifestVerifier::new(MIRROR_PUBLIC_KEY)…?;`
  binding (desktop line 309 / sideload line 207) and the `let fetcher: Box<dyn
  ModelFetcher …>` binding (desktop line 312 / sideload line 210):
  ```
  let manifest = (|| {
      let content = std::fs::read(paths.models_dir.join("mirror-manifest.json")).ok()?;
      let m = serde_json::from_slice::<crate::model_fetcher::manifest::MirrorManifest>(&content).ok()?;
      verifier.verify(&content, &m).ok()?;
      Some(m)
  })().unwrap_or_else(|| crate::model_fetcher::manifest::MirrorManifest {
      // I-10(b): swap when signed bundled manifest lands
      schema_version: 1,
      generated_at: 0,
      variants: vec![],
      signature: vec![],
  });
  ```
  (this mirrors the load → `serde_json::from_slice` → `verifier.verify` chain at
  `commands.rs:1088-1100` and the empty-variants fallback literal at
  `commands.rs:1102-1124`; `verifier` is the binding two lines above — reuse it,
  do NOT reconstruct; `verifier.verify(&content, &m)` matches the call shape at
  `commands.rs:1093`; the IIFE's shared borrow of `verifier` ends before the later
  move into `MirrorFetcher::new`). Then add `manifest,` as the THIRD argument to
  `MirrorFetcher::new(…)` at both call sites (between `verifier,` and
  `paths.models_dir.clone(),`), so each call reads
  `MirrorFetcher::new(reqwest::Client::new(), verifier, manifest,
  paths.models_dir.clone())`. No new `use` imports (fully-qualified paths;
  `serde_json` and `std::fs` are already used crate-wide). Do NOT add any network
  fetch at startup. Accept: `grep -c 'paths.models_dir.join("mirror-manifest.json")'
  src-tauri/src/state.rs` == 2; `grep -c 'I-10(b): swap when signed bundled
  manifest lands' src-tauri/src/state.rs` == 2; `grep -c 'verifier.verify(&content,
  &m)' src-tauri/src/state.rs` == 2; both `MirrorFetcher::new(` call sites in
  state.rs pass four args with `manifest` as the third (read both sites). Commit:
  `fix(state): R8.22 MirrorFetcher offline manifest source (I-10(b))`

- [ ] **R8.23** `src-tauri/src/sidecar/trust.rs` — add the `Revoked` trust level
  and the `TrustDb::remove` row-deletion method so the revoke branch at
  `commands.rs:922-925` (`if level == crate::sidecar::trust::TrustLevel::Revoked
  { state.trust_db.remove(&pubkey_bytes).map_err(|e| e.to_string())?; }`, left
  untouched by R8.14) compiles. (a) Add a fifth variant to `TrustLevel`
  (`trust.rs:17-22`) after `Unknown,`: `Revoked,` (the enum already derives
  `Serialize, Deserialize` at line 16 — no derive edit; serde round-trips the new
  variant automatically). (b) Arm the ENCODING match in `TrustDb::set`
  (`trust.rs:69-74`, which has NO `_` fallback and is therefore exhaustive —
  adding a variant is a compile error without this arm) with
  `TrustLevel::Revoked => "Revoked",` immediately after the
  `TrustLevel::Unknown => "Unknown",` arm; `set` is never called with `Revoked`
  (the revoke path DELETEs instead), so this arm is effectively unreachable but
  keeps the enum closed. (c) Add the explicit DECODE arm
  `"Revoked" => TrustLevel::Revoked,` to `TrustDb::get` (`trust.rs:46-52`,
  immediately before the `_ =>` arm) AND to `TrustDb::list` (`trust.rs:95-101`,
  immediately before the `_ =>` arm) — both already have a `_` fallback so they
  compile regardless, but the explicit arm keeps the read string-map
  self-consistent with `set` so a `"Revoked"` value decodes deterministically
  rather than erroring through `_`. (d) Add a new method to `impl TrustDb` (after
  `apply_gossip`, before the closing `}` at line 179):
  ```
  /// Delete the trust row for a public key (revoke path).
  pub fn remove(&self, pubkey: &[u8; 32]) -> Result<(), TrustError> {
      self.storage.with_conn(|conn| {
          conn.execute(
              "DELETE FROM trust WHERE pubkey = ?",
              rusqlite::params![pubkey.as_slice()],
          )?;
          Ok(())
      }).map_err(TrustError::Storage)
  }
  ```
  (mirrors the `self.storage.with_conn(|conn| { … }).map_err(TrustError::Storage)`
  idiom of `get` at line 57 / `set` at line 83; the `trust` table name matches
  `set`'s `INSERT … INTO trust` at line 78; `TrustError::Storage` converts
  `StorageError` via the existing `#[from]` at line 12; `pubkey.as_slice()` is the
  same BLOB binding `get`/`set` use at lines 42/80). Do NOT touch `commands.rs` —
  R8.14 owns the `set` call; the revoke branch there already calls
  `remove(&pubkey_bytes)` with `&[u8; 32]` (`pubkey_bytes` is `[u8; 32]` from
  `<[u8; 32]>::from_hex` at `commands.rs:909`), matching this signature. Accept:
  `grep -c 'TrustLevel::Revoked => "Revoked"' src-tauri/src/sidecar/trust.rs` == 1
  (the `set` encode arm); `grep -c '"Revoked" => TrustLevel::Revoked'
  src-tauri/src/sidecar/trust.rs` == 2 (the `get` + `list` decode arms); `grep -c
  'pub fn remove(&self, pubkey:' src-tauri/src/sidecar/trust.rs` == 1; `grep -c
  'DELETE FROM trust WHERE pubkey = ?' src-tauri/src/sidecar/trust.rs` == 1.
  Commit: `feat(trust): R8.23 TrustLevel::Revoked + TrustDb::remove`

- [ ] **R8.24** `src-tauri/src/ai/litert/mod.rs` — delete the DUPLICATE local
  `litert_stream_trampoline` and route the bare call site to the canonical FFI
  copy. `litert_stream_trampoline` is defined TWICE with `#[no_mangle]
  extern "C"`: `ffi.rs:244-275` (canonical — borrows `&*(data)`, never drops,
  correct for a callback invoked repeatedly across the stream; self-contained via
  `use super::{StreamContext, StreamEvent};` at `ffi.rs:9`) and `mod.rs:332-382`
  (local — doc comment at 332-337, `#[no_mangle]` at 338, `extern "C" fn
  litert_stream_trampoline(…)` at 339-382, which takes ownership via
  `Box::from_raw` and re-`leak`s on non-final). R8.3 deliberately EXCLUDED
  `litert_stream_trampoline` from the `pub use ffi::{ … };` block at
  `mod.rs:10-14` because re-exporting the ffi copy WHILE the local def remained
  would collide; this task removes the collision. (a) DELETE the entire local
  definition — `mod.rs:332` through `mod.rs:382` inclusive (the trailing `}` that
  closes the fn body): the doc-comment lines, the `#[no_mangle]` line, and the
  whole `extern "C" fn litert_stream_trampoline(…) { … }` body. (b) Add
  `litert_stream_trampoline,` to the existing `pub use ffi::{ … };` block at
  `mod.rs:10-14` (inside the braces, after `LiteRtLmSessionConfig,`) so the bare
  call site at `mod.rs:278` (`Some(litert_stream_trampoline)`) resolves to the ffi
  copy now that the local def is gone. Do NOT touch `ffi.rs`. The ONLY in-file
  reference to the local symbol is `mod.rs:278` (`Some(litert_stream_trampoline)`);
  no other `mod.rs` code names `litert_stream_trampoline`, so deleting the local
  def + adding the re-export is the complete fix. **Supersedes R8.3's exclusion:**
  R8.3's Accept clause "does NOT contain `litert_stream_trampoline`" held only
  while the local def existed; once R8.24 lands the trampoline MUST be in the
  `pub use` block (added here), so that R8.3 clause no longer applies — the I-22
  stanza gate reads the post-both-land state. Accept: `grep -c 'fn
  litert_stream_trampoline' src-tauri/src/ai/litert/mod.rs` == 0 (no local
  function definition remains — neither the `Some(litert_stream_trampoline)` call
  nor the `pub use` entry carries an `fn ` prefix); `grep -c
  'litert_stream_trampoline,' src-tauri/src/ai/litert/mod.rs` == 1 (exactly the
  `pub use ffi::{ … litert_stream_trampoline, … }` re-export entry; the bare call
  has no trailing comma). Commit:
  `fix(ai): R8.24 remove duplicate litert_stream_trampoline (route to ffi)`

**Stanza acceptance (R8 as a whole):** after R8.1–R8.24 land (R8.22–R8.24 are the
three R8-ESCALATIONS below, resolved), `cargo check --features desktop -p enzime`
finishes with `Finished` (R7.1 green); the four error clusters that comprised the
~89-error snapshot — LiteRT-LM FFI resolution, missing crate deps/features
(tracing/tracing-subscriber/base64/rusqlite-uuid), `with_conn`/sidecar-index
error typing, and API drift (mdns-sd `get_addresses`, ed25519 `Signature`,
`DateTime`) — are all absent from the output. Latent play/sideload sites fixed in
R8.17/R8.18 also clear R7.2/R7.3.

#### R8-ESCALATIONS (architect debt — ✅ RESOLVED by R8.22–R8.24, ratified 2026-07-02; retained for traceability)

> **All three escalations below are RESOLVED as coder tasks** (ratified
> 2026-07-02): **R8-ESC-1 → R8.22** (offline-safe manifest source — OPTION (a)),
> **R8-ESC-2 → R8.23** (`TrustLevel::Revoked` + `TrustDb::remove`),
> **R8-ESC-3 → R8.24** (delete duplicate trampoline, route bare call to ffi).
> The original design-gap records are retained verbatim below for traceability.

- **R8-ESC-1 — `MirrorFetcher::new` manifest argument (blocks R7.1 desktop +
  R7.2 sideload).** `model_fetcher/mirror.rs:41` defines `pub fn new(http,
  verifier, manifest: MirrorManifest, models_dir)` (4 args), but
  `state.rs:313` (desktop) and `state.rs:211` (sideload) call it with 3 args
  (`reqwest::Client::new(), verifier, paths.models_dir.clone()`) — no manifest is
  supplied (E0061). There is no manifest source wired into `AppState::build_for_*`:
  `MirrorManifest` is a signed artifact (`MirrorManifestVerifier` verifies it), so
  the builder cannot fabricate one. `commands.rs:1086-1124` (`model_import_from_media`)
  constructs a fallback `MirrorManifest` with empty variants as an I-10(b)
  placeholder. **Design gap:** decide the desktop/sideload manifest source at
  startup — (a) load+verify `mirror-manifest.json` from `paths.models_dir` if
  present (mirroring `commands.rs:1088-1100`), falling back to an empty-variants
  `MirrorManifest` placeholder, or (b) embed a bundled signed manifest, or (c)
  fetch from `mirror_base_url()` at startup (violates INV-OFFLINE for first run).
  Until decided, state.rs:313/211 will not compile.

- **R8-ESC-2 — `TrustLevel::Revoked` + `TrustDb::remove` (blocks `trust_set`).**
  `commands.rs:922-925` (`trust_set`) implements a revoke path: `if level ==
  TrustLevel::Revoked { state.trust_db.remove(&pubkey_bytes)?; }`. But
  `TrustLevel` (`trust.rs:17-22`) has variants `Trusted/Verified/Rejected/Unknown`
  only — no `Revoked` (E0599) — and `TrustDb` has no `remove` method (E0599; only
  `get/set/list/apply_gossip`). R8.14 repairs the *set* branch; this revoke branch
  needs new entities. **Design gap:** the command treats `Revoked` as a transient
  signal meaning "DELETE the trust row" (not a persisted level), but `TrustLevel`
  is `Serialize/Deserialize` and shared with the sidecar `TrustMark` payload
  (`payload.rs:208`), and `TrustDb::set/get/list` string-map the enum exhaustively.
  Decide: add `TrustLevel::Revoked` (and arm it in `set`'s match as an unreachable
  `"Revoked"` mapping since `set` is never called with it) + add `TrustDb::remove
  (&self, pubkey: &[u8;32]) -> Result<(), TrustError>` doing `DELETE FROM trust
  WHERE pubkey = ?`; OR replace the revoke signal with a separate command / use
  `Rejected` + a delete. The chosen design must keep the persisted/gossip
  `TrustLevel` enum self-consistent. Until resolved, `trust_set` (and thus R7.1)
  will not compile.

- **R8-ESC-3 — duplicate `#[no_mangle] litert_stream_trampoline` (blocks R7.7/R7.8
  link, not R7.1 `cargo check`).** `litert_stream_trampoline` is defined TWICE with
  `#[no_mangle] pub extern "C" fn`: `ffi.rs:245` and `mod.rs:339`. `cargo check`
  does not link so R7.1 does not surface it, but the production build (R7.7
  AppImage / R7.8 MSI) will fail with a multiple-definition linker error. The two
  implementations differ in `StreamContext` ownership: `ffi.rs:245-275` borrows
  (`&*(data)`), never drops (correct for a callback invoked repeatedly across the
  stream); `mod.rs:339-382` takes ownership (`Box::from_raw`), re-`leak`s on
  non-final, drops on final/error. **Design gap:** pick the canonical trampoline
  and delete the other (recommend keeping `ffi.rs`'s borrow model — it is the FFI
  home and the borrow/never-drop semantics match `mod.rs:268-279` which
  `Box::into_raw`s the context and drains it from the `rx` loop; delete
  `mod.rs:332-382`). Either way one definition must go before the full link gates.

---

### R7 — Build gates (run after R1–R6 are all [x])

> Gates are the real build outcomes (not hermetic). Their Accept = the observed
> build result.

- [ ] **R7.1** Gate: `cargo check --features desktop -p enzime` exits 0.
  Accept: command finishes with `Finished`. Commit:
  `chore(ci): R7.1 desktop cargo check green`

- [ ] **R7.2** Gate: `cargo check --features sideload -p enzime` exits 0.
  Accept: `Finished`. Commit:
  `chore(ci): R7.2 sideload cargo check green`

- [ ] **R7.3** Gate: `cargo check --features play --target aarch64-linux-android -p enzime` exits 0.
  Accept: `Finished`. Commit:
  `chore(ci): R7.3 play cargo check green`

- [ ] **R7.4** Gate: `cargo check -p enzime-bridge` exits 0.
  Accept: `Finished`. Commit:
  `chore(ci): R7.4 bridge cargo check green`

- [ ] **R7.5** Gate: `cargo test -p anzimmermanlib` passes.
  Accept: test run reports 0 failed. Commit:
  `chore(ci): R7.5 anzimmermanlib tests green`

- [ ] **R7.6** Gate: `pnpm run build` exits 0 (Vite + tsc strict, no errors).
  Accept: `built` emitted, no TS error. Commit:
  `chore(ci): R7.6 pnpm build green`

- [ ] **R7.7** Gate: `bash scripts/build-linux.sh` emits a `*.AppImage`.
  Accept: an AppImage exists under
  `target/x86_64-unknown-linux-gnu/release/bundle/appimage/`. Commit:
  `chore(ci): R7.7 linux AppImage`

- [ ] **R7.8** Gate: `bash scripts/build-windows.sh` emits `enzime.exe` + `*.msi`.
  Accept: the MSI exists under the windows target bundle dir. Commit:
  `chore(ci): R7.8 windows MSI cross`

- [ ] **R7.9** Gate: `bash scripts/build-android.sh` emits `.apk` + `.aab`.
  Accept: the apk/aab exist under `gen/android/app/build/outputs/`. Commit:
  `chore(ci): R7.9 android AAB+APK`

**Stanza acceptance (R7 as a whole):** All 9 gates pass; the produced artifacts
are real (not empty/zero-byte); the app launches and the 51 command handlers
round-trip.

---

## Assumptions and judgement calls

1. **Clean-slate CHECKLIST:** Per user direction, this checklist contains only
   remaining uncompleted work. Prior completion history (W1–W11, ~200 entity
   tasks all marked [x]) is preserved in git history.

2. **R1 storage tasks may partially overlap with prior [x] tasks:** The original
   E-STR-8 verified `MIGRATIONS` is empty (correct at the time). R1.2 now
   populates it per the amended architecture. This is new work, not a regression.

3. **R2 state.rs tasks are the former ESCALATE items:** RF-STATE-A/B/C/D were
   escalated as operator decisions in the prior CHECKLIST. The architect has now
   committed resolutions; they are coder tasks here.

4. **R3 entitlement gating is frontend-side only:** Per architecture §5.3, the
   backend exposes `entitlement_check` as a query; enforcement is frontend-side.
   No backend guards are added to Tauri command handlers.

5. **R4 build fixes are the former RF-1/3/5/6/7 ESCALATE items:** The architect
   has committed resolutions (MAJOR=1, helloword alias, PR trigger,
   target-qualified paths, root Cargo.toml sed target).

6. **R6 items are confirmed-done:** Code inspection confirms E-BLD-18
   (pnpm-lock.yaml exists), E-PACK-18 (placeholders removed), and RF-AI-2
   (system_prompt prepend implemented). These are marked [x] for traceability.

---

## §11 1:1 transformation attestation

```
─────────────────────────────────────────────────────────────────────
CHECKLIST.md ARCHITECT ATTESTATION (global rule I-11 + §11)
─────────────────────────────────────────────────────────────────────
I certify that this CHECKLIST.md (v3.0) is a 1:1 linearized transformation
of the amended behavioural DOCS/ARCHITECTURE.md (re-attested 2026-06-24)
into remaining-work-only coder tasks:

  - every task is directly derived from an architect-committed resolution
    in the amended ARCHITECTURE.md; no invented work, no dropped entity;
  - each task's Accept is a SEMANTIC acceptance (I-12 — observable
    behaviour / real-fixture test), NEVER a grep-for-existence;
  - per-task commit (I-10c); markers [ ]→[x]→✅;
  - phases R1–R6 follow dependency topology (storage → state wiring →
    entitlement gating → build scripts → documentation → corrections),
    R7 is the build gates;
  - all prior reconciliation flags (RF-STATE-A/B/C/D, RF1–RF7, RF-AI-1/2,
    FLAG-1/2) are resolved in ARCHITECTURE.md and represented here as
    concrete coder tasks or confirmed-done [x] items.

This supersedes the prior CHECKLIST v2.0 (which contained ~200 entity
tasks across W1–W11, all completed). Prior completion history is in git.

Timestamp:     2026-06-24 (ISO-8601 UTC date)
Authoring agent: Opus orchestrator (I-21/TC13)
─────────────────────────────────────────────────────────────────────
```
