<!-- CURATED PARTIAL §7.11+§7.13+§7.15+§7.16 foundation. GLM-5.1 (`foundation`); Opus-reviewed/accepted 2026-06-13. Paths/panic REAL; logger PARTIAL (guard built, no subscriber wired — I-10b); app_update verifier REAL but check/apply HOLLOW (end-state: signed-manifest fetch→ed25519 gate→version compare→sha256+size→platform swap/APK intent/Play no-op); global_search HOLLOW (end-state BM25 across packs); window_state REAL. Carry-forward: log subscriber wiring; panic Variant I-10b placeholder → §7.2 Variant on assembly; line-numbers corrected. -->

# ARCHITECTURE PARTIAL — module `foundation` (§7.11 + §7.13 + §7.15 + §7.16)

**Module:** `foundation` — four small runtime subsystems (paths/log/panic/vendored, app
update, global search, window state).
**Authoring seat:** GLM-5.1 architect (per-module dispatch, TC13).
**Airlock file** (TC6) — to be curated by the Opus orchestrator, then assembled into `§7`
of `DOCS/ARCHITECTURE.md` and re-attested as the WHOLE (I-11). Not a live edit.
**Intake honored:** only `paths/*.rs`, `log/*.rs`, `panic/*.rs`, `app_update/*.rs`,
`global_search/*.rs`, `window_state/*.rs` + `§7.11/§7.13/§7.15/§7.16` via sed. The whole
`DOCS/ARCHITECTURE.md` was never read.

**State vocabulary** (every row): `REAL` = behavioural code present and exercised today;
`HOLLOW→ES` = end-state behaviour specified here, current body is a typed-Err/empty
placeholder; `PARTIAL` = compiles and partially behaves, one swap site remaining
(I-10(b)). Mixed real/hollow module; the end-state columns describe the no-placeholder
production-release product (I-11), the `State` column records what is wired now.
**Cross-module references by name only** (not re-defined here): `Storage` / `SettingsStore`
(§7.5), `PackCatalog` (§7.14), `ZimReader` (§7.3), `AppState` (§7.1), AI `Variant`
(§7.2). Each entity carries a **semantic acceptance** (I-12: observable behaviour / a
real-fixture test — never grep-for-existence).

---

## §7.11 Paths, logging, crash handling, vendored deps (`src-tauri/src/paths/`, `log/`, `panic/`)

| ID | Name | Target | Role | Signature / fields | Type | State |
|---|---|---|---|---|---|---|
| E-PATH-1 | `AppPaths` | `paths/mod.rs:12` | OS-specific data/cache/config dir set, all subordinate app dirs derived from them | `struct { data_dir, cache_dir, config_dir, models_dir, sidecars_dir, voice_blobs_dir, identity_dir, logs_dir, packs_dir: PathBuf }` | struct | REAL |
| E-PATH-2 | `AppPaths::resolve` | `paths/mod.rs:26` | Per-OS resolution via `dirs` crate: Linux=XDG (`~/.local/share|cache`, `~/.config`), Windows=KnownFolders (`%LOCALAPPDATA%`), Android=`context.getFilesDir()`; everything under a joined `"enzime"` root; subordinate dirs are `data_dir`/`cache_dir` joins | `fn() -> Result<Self, PathError>` | fn | REAL |
| E-PATH-3 | `PathError` | `paths/mod.rs:5` | Path-resolution failure (no home, or a dir could not be created) | `enum { NoHome, CreateDir(io::Error) }` (thiserror) | enum | REAL |
| E-LOG-1 | `EnzimeLogger` | `log/mod.rs:19` | Structured logging: holds the non-blocking worker guard so the daily file appender keeps flushing | `struct { _guard: tracing_appender::non_blocking::WorkerGuard }; impl init(&AppPaths) -> Result<Self, LogError>` | struct | PARTIAL |
| E-LOG-2 | `LogError` | `log/mod.rs:10` | Logger init failure | `enum { Io(io::Error), Subscriber(String) }` (thiserror) | enum | REAL |
| E-LOG-3 | `LogLevel` | `log/mod.rs:32` | Compile-time + runtime log level filter | `enum { Trace, Debug, Info, Warn, Error }` (serde, `Copy`) | enum | REAL |
| E-LOG-4 | daily file appender | `log/mod.rs:24` | `tracing_appender::rolling::daily(logs_dir, "enzime.log")` feeding a non-blocking writer; end-state also registers a `tracing_subscriber::fmt` layer (file + stderr) at `LogLevel` | configured inside `EnzimeLogger::init` | concrete | PARTIAL |
| E-PANIC-1 | `install_panic_handler` | `panic/mod.rs:26` | Custom panic hook: on panic, capture `PanicHookInfo` + forced `Backtrace` + `CARGO_PKG_VERSION`, serialize a `CrashReport` as pretty JSON to `<logs_dir>/crash-<ts>.log`, and echo the path to stderr | `fn(paths: &AppPaths)` (called once from `lib.rs::run` before any subsystem starts) | fn | REAL |
| E-PANIC-2 | `CrashReport` | `panic/mod.rs:17` | Crash report JSON shape written to the crash log | `struct { ts: i64, panic_msg: String, backtrace: String, version: &'static str, variant: Option<Variant> }` (serde) | struct | REAL |
| E-PANIC-3 | `Variant` | `panic/mod.rs:10` | **I-10(b) placeholder** for the AI model variant; the authoritative `Variant` lands with `ai/probe.rs` (§7.2). Today it is defined locally here so `CrashReport.variant` type-checks; the panic hook always writes `variant: None`. Swap site: replace this enum + the `None` literal with the §7.2 `Variant` once `ai/probe.rs` lands | `enum { Qwen3_06B_Q4, GemmaE2bQ4 }` (serde, `Copy`) — placeholder | enum | PARTIAL (I-10b) |
| E-VEND-1 | `vendor/tauri/` | `vendor/tauri/` | Tauri 2 source, pinned at release tag, embedded `.git` stripped at assimilation (provenance locked remote+tag+commit+date BEFORE strip, per I3/INC-15) | path-dep crate, consumed via `[patch.crates-io]` | vendored | REAL |
| E-VEND-2 | `vendor/litert-lm/` | `vendor/litert-lm/` | LiteRT-LM source, pinned at release tag, `.git` stripped; `Qwen3DataProcessor` lives here | path-dep crate, consumed via `[patch.crates-io]` | vendored | REAL |
| E-VEND-3 | `Cargo [patch.crates-io]` | `Cargo.toml` | Workspace patches redirect `tauri = { path = "vendor/tauri/…" }` and the litert-lm crate to the vendored paths, making them the single build source | config block | config | REAL |

### Behavioural end-state (§7.11)

- **Paths.** `AppPaths::resolve` is the single bootstrap that locates every on-disk app
  location. It never creates directories itself today (it only computes them); directory
  creation is the owning subsystem's job (`models_dir` → model manager, `packs_dir` →
  pack catalog, `logs_dir` → logger/panic, etc.), and any `CreateDir` failure surfaces as
  `PathError::CreateDir` from the subsystem that owns the dir. The `"enzime"` suffix is the
  one app-discriminator — it is what keeps EnZIME out of sibling apps' dirs on shared hosts.
- **Logging.** `EnzimeLogger::init` constructs the daily-rotating file appender under
  `logs_dir`, wraps it in a non-blocking worker, **and** (end-state) installs a
  `tracing_subscriber::fmt` subscriber whose writer is that non-blocking writer, layered
  with a second `fmt` layer to stderr, filtered to the configured `LogLevel`. The returned
  `EnzimeLogger` owns the `WorkerGuard`; dropping it flushes and shuts down the worker, so
  the guard must live for the whole process lifetime (held in `AppState` / `lib.rs::run`).
  **Current gap (PARTIAL):** the non-blocking writer tuple element is discarded and no
  subscriber is registered — the guard exists but no `tracing` event reaches the file or
  stderr. I-10(b) swap: capture the writer and call `tracing_subscriber::fmt()` wiring.
- **Crash handling.** `install_panic_handler` replaces the default panic hook with one
  that, for any unwind, writes a self-contained `CrashReport` JSON file under `logs_dir`
  named `crash-<utc-ts>.log` and announces the path on stderr. This is the operator's
  post-mortem trail (the human-visible crash surface pairs with this). It is deliberately
  defensive: serialization and file-write failures fall back to a plain stderr line so the
  hook itself never panics. `CrashReport.variant` is `None` until the AI `Variant` (§7.2)
  is known at crash time — see E-PANIC-3.
- **Vendored deps.** Tauri 2 and LiteRT-LM are cloned once at home and assimilated
  (provenance locked first, `.git` stripped second — never clone-then-move, never strip
  before provenance is recorded). They build from the workspace as patched path-deps, so
  the suite never depends on a crates.io resolution for either. Additive-until-release: no
  embedded-vendor deletion without operator direction.

### Semantic acceptance (I-12 — observable / real-fixture, never grep)

- **E-PATH-2 `resolve`** (Linux fixture): with `XDG_DATA_HOME`/`XDG_CACHE_HOME` pointed at
  temp roots, `resolve()` yields `data_dir` whose tail is `enzime`, `logs_dir ==
  cache_dir.join("logs")`, `models_dir == data_dir.join("models")`,
  `packs_dir == data_dir.join("packs")`, and `data_dir != cache_dir != config_dir`.
  Asserted as `PathBuf` equality/`starts_with`, not file presence.
- **E-PATH-3 `PathError`**: when `dirs::*` would yield `None` (home unreachable),
  `resolve()` returns `Err(PathError::NoHome)` — observed by the variant returned, not a
  string match.
- **E-LOG-1/E-LOG-4 `EnzimeLogger::init`** (end-state fixture): init, `tracing::info!(
  "probe")`, hold the guard, then drop it; the dated file under `logs_dir` contains the
  `probe` event (assert via reading the written line — this is runtime output
  observation, not a grep over source). **Marked PARTIAL until subscriber wiring lands.**
- **E-PANIC-1 `install_panic_handler`** (behavioural): install the hook, trigger a
  `panic!("boom")` in a spawned child process; the child writes
  `<logs_dir>/crash-<ts>.log` whose parsed JSON has `panic_msg` containing `"boom"` and
  `version == CARGO_PKG_VERSION`. Verdict is the written crash file + its parsed fields.
- **E-PANIC-2 `CrashReport`**: `serde_json` round-trip preserves every field; `variant`
  field is present (serializes to `null` today). Real (de)serialization fixture.
- **E-PANIC-3 `Variant`**: flagged I-10(b) — no behavioural acceptance until §7.2 lands;
  the only acceptance now is "type-checks as `CrashReport.variant` and serializes."
  Orchestrator-reconciliation flag, not a coder task.
- **E-VEND-1/2/3**: `cargo` resolves `tauri` and the litert-lm crate to the vendored
  paths (provenance recorded in the assimilation log); observable via the resolved
  manifest, not a directory grep.

---

## §7.13 App update mechanism (`src-tauri/src/app_update/`)

| ID | Name | Target | Role | Signature / fields | Type | State |
|---|---|---|---|---|---|---|
| E-UPD-1 | `AppUpdater` | `app_update/mod.rs:21` | Platform-specific updater dispatcher: holds the fetch channel, signature verifier, and the running `Version`; `check` fetches+verifies the manifest and decides if an update exists; `apply` dispatches to the platform apply path | `struct { channel: UpdateChannel, verifier: UpdateSignatureVerifier, current_version: Version }; impl check(&self) -> Result<Option<UpdateManifest>, UpdateError>; apply(&self, &UpdateManifest) -> Result<(), UpdateError>` | concrete | HOLLOW→ES |
| E-UPD-2 | `UpdateChannel` | `app_update/channel.rs:6` | HTTP fetch of `<base_url>/manifest.json` (concrete `reqwest::Client` + base URL) | `struct { http: reqwest::Client, base_url: &'static str }` | concrete | REAL |
| E-UPD-3 | `UpdateManifest` | `app_update/manifest.rs:6` | Operator-signed release manifest fetched from the channel; `signature` covers the canonical manifest body bytes that the verifier re-derives | `struct { version: Version, artifact_url: String, sha256: [u8;32], size_bytes: u64, signature: Vec<u8>, release_notes_url: Option<String> }` (serde) | struct | REAL |
| E-UPD-4 | `UpdateSignatureVerifier` | `app_update/verifier.rs:10` | ed25519 verifier against the compile-time-embedded operator pubkey; strict verification of the manifest body | `struct { public_key: ed25519_dalek::VerifyingKey }; impl new() -> Result<Self, VerifyError>; verify(&self, body: &[u8], &UpdateManifest) -> Result<(), VerifyError>` | concrete | REAL |
| E-UPD-5 | `UPDATE_PUBLIC_KEY` | `app_update/verifier.rs:8` | Compile-time-embedded operator ed25519 public key (32 bytes); the single trust root for updates — transports are never trusted | `pub const UPDATE_PUBLIC_KEY: &[u8;32] = include_bytes!("../../assets/update_public_key.bin")` | const | REAL |
| E-UPD-6 | `UpdateError` | `app_update/mod.rs:46` | Update-flow failure | `enum { Network(String), Verify(VerifyError), Storage(io::Error), PlayUnsupported, NotImplementedOnPlatform }` (thiserror) | enum | REAL |
| E-UPD-7 | `Version` | `app_update/version.rs:8` | `MAJOR.MINOR.BUILD` per BUILD_CONVENTIONS — NOT semver (no PATCH); lexicographic on the tuple | `struct { major, minor, build: u32 }; impl Ord + PartialOrd; FromStr (errs on !=3 parts); Display` | struct | REAL |
| E-UPD-8 | `apply_desktop` | `app_update/desktop.rs:6` | Linux AppImage binary swap / Windows MSI installer-spawn, then relaunch | `fn(&AppUpdater, &UpdateManifest) -> Result<(), UpdateError>` (dispatched from `AppUpdater::apply` on desktop) | fn | HOLLOW→ES |
| E-UPD-9 | `apply_sideload_android` | `app_update/android.rs:6` | Download the APK from `artifact_url`, verify `sha256`+`size_bytes`, fire an `ACTION_INSTALL_PACKAGE` intent to the system installer | `fn(&AppUpdater, &UpdateManifest) -> Result<(), UpdateError>` (dispatched from `AppUpdater::apply` for sideload Android) | fn | HOLLOW→ES |
| E-UPD-10 | `VerifyError` | `app_update/mod.rs:60` | Signature/manifest verification failure | `enum { InvalidSignature, MalformedManifest }` (thiserror) | enum | REAL |

### Behavioural end-state (§7.13)

- **Single trust root, transports never trusted.** `UPDATE_PUBLIC_KEY` is the only thing
  that attests an update; HTTPS is not trust, channel reachability is not trust. Every
  `check` and every `apply` re-runs `UpdateSignatureVerifier::verify` over the canonical
  manifest body before any artifact is downloaded or installed (I3 single-master
  additive-stewardship applies: provenance lock before any swap).
- **`AppUpdater::check`** fetches `<base_url>/manifest.json` via `UpdateChannel.http`,
  deserializes an `UpdateManifest`, canonicalizes its body, verifies the signature with the
  embedded key, then compares `manifest.version` to `current_version` using `Version::Ord`.
  It returns `Some(manifest)` iff the channel version is strictly greater AND the signature
  verifies; `None` iff verified-but-not-newer; `Err(UpdateError::Verify(..))` iff the
  signature is invalid; `Err(UpdateError::Network(..))` iff the channel is unreachable.
  **INV-OFFLINE (additive):** an offline check returns a typed `Err(Network)` promptly — it
  never hangs, never blocks first-run, and never gates a core flow.
- **`AppUpdater::apply`** is the platform dispatcher:
  - **Desktop (Linux AppImage / Windows MSI)** → `apply_desktop`: download
    `artifact_url`, assert the downloaded bytes' SHA-256 equals `manifest.sha256` and the
    length equals `size_bytes` (defense-in-depth beyond the signature), then perform the
    platform swap and relaunch (AppImage: atomic replace + re-exec; Windows: spawn the MSI
    installer and exit). Failure at any step → typed `Err`.
  - **Sideload/F-Droid Android** → `apply_sideload_android`: download the APK, verify
    `sha256`+`size_bytes`, then fire the system `ACTION_INSTALL_PACKAGE` intent (the OS
    installer UI is the trust prompt the user sees).
  - **Play Store Android** → updates are managed by Play Billing/Play itself; the in-app
    updater returns `Err(UpdateError::PlayUnsupported)` / no-op (the path is never taken
    for a Play build).
- **Post-v1.0 surface, real behaviour now.** The fetch/apply half is architectured to its
  full end-state here (signed-manifest fetch, signature gate, version compare, sha256+size
  guard, platform swap). Current bodies (`check`, `apply`, `apply_desktop`,
  `apply_sideload_android`) all return `Err(UpdateError::NotImplementedOnPlatform)` — these
  are I-10(b) swap sites for the apply wave, not stubs the architecture tolerates.
- **Version is non-semver on purpose.** `1.2.3` parses; `1.2.3 < 1.10.0` (numeric, not
  lexical); `1.2` is rejected (must be three parts). No PATCH component — matches the
  BUILD_CONVENTIONS `MAJOR.MINOR.BUILD` floor.

### Semantic acceptance (I-12 — observable / real-fixture, never grep)

- **E-UPD-4 `UpdateSignatureVerifier::verify`** (REAL tamper fixture): sign a canonical
  manifest body with the operator *private* key → `verify()` returns `Ok(())`; flip one
  byte of the body (or the signature) → `verify()` returns `Err(VerifyError::InvalidSignature)`;
  feed a 31-byte/malformed key → `new()` returns `Err(MalformedManifest)`. The verdict is
  the `Result` variant, not a log line.
- **E-UPD-7 `Version`** (REAL): `"1.2.3".parse()` succeeds and `Display`s back as
  `"1.2.3"`; `Version::new(1,2,3) < Version::new(1,10,0)` is true; `"1.2".parse()` is
  `Err`. Asserted on the `Ord`/`FromStr` results.
- **E-UPD-2/E-UPD-1 `check`** (end-state fixture against an in-process channel): serve a
  manifest signed with the embedded key whose `version` > `current_version` → `check()`
  returns `Some(m)` and `verify()` on that `m` succeeds; serve one with `version` ==
  current → `None`; serve an unsigned/tampered manifest → `Err(Verify(..))`; with the
  channel socket closed → `Err(Network(..))` returned promptly (INV-OFFLINE no-hang).
  **Marked HOLLOW until the fetch+compare body lands.**
- **E-UPD-8 `apply_desktop`** (end-state): against a fixture artifact whose sha256/size
  match the signed manifest, `apply_desktop` downloads, verifies the hash+size, and
  performs the swap path (in a fixture, the swap is asserted by staging the new binary and
  confirming its hash before the re-exec is attempted); a manifest whose artifact hash does
  not match yields a typed `Err`. **HOLLOW until the swap body lands.**
- **E-UPD-9 `apply_sideload_android`** (end-state, Android fixture): the downloaded APK's
  SHA-256 equals the manifest; an `ACTION_INSTALL_PACKAGE` intent is constructed for the
  staged APK file URI; a hash mismatch aborts before the intent. **HOLLOW until the
  intent body lands.**
- **E-UPD-10 `VerifyError`**: the two variants are produced by `verify`/`new` exactly as
  specified above (covered by the E-UPD-4 fixture).

---

## §7.15 Multi-ZIM (global) search (`src-tauri/src/global_search/`)

| ID | Name | Target | Role | Signature / fields | Type | State |
|---|---|---|---|---|---|---|
| E-GSRCH-1 | `GlobalSearcher` | `global_search/mod.rs:23` | Cross-ZIM search: for each installed pack + each in-memory open handle, run that ZIM's search (§7.3 `ZimReader`), merge, score, rank, and truncate | `struct { catalog: Arc<PackCatalog> }; impl search(&self, query: &str, limit: u32, app_state: &AppState) -> Result<Vec<GlobalSearchHit>, ZimError>` | concrete | HOLLOW→ES |
| E-GSRCH-2 | `GlobalSearchHit` | `global_search/mod.rs:13` | One ranked result row, attributed to its ZIM of origin | `struct { zim_uuid: Uuid, zim_title: String, url: String, article_title: String, score: f32 }` (serde) | struct | REAL |
| E-GSRCH-3 | `RankingConfig` | `global_search/ranking.rs:10` | BM25-style ranking knobs applied during merge/rank; `Default` = `{ k1: 1.2, b: 0.75, title_boost: 2.0 }` | `struct { k1: f32, b: f32, title_boost: f32 }; impl Default` | struct | REAL |

### Behavioural end-state (§7.15)

- **Pure-local, INV-OFFLINE.** Global search never touches the network: it iterates the
  installed packs known to `PackCatalog` (§7.14) and the ZIM handles already open in
  `AppState` (§7.1), runs each ZIM's own `ZimReader::search` (§7.3), and merges the
  per-ZIM hit lists. There is no remote index, no telemetry, no cloud ranking.
- **`GlobalSearcher::search`** fans out across packs, scoring each candidate article with
  the BM25-style formula parameterized by `RankingConfig` (`k1` term saturation, `b`
  length normalization), then applies `title_boost` to matches in the article title versus
  the body. Hits from every ZIM are pooled, sorted by `score` descending, and truncated to
  `limit`. Each emitted `GlobalSearchHit` carries its ZIM-of-origin `zim_uuid` + `zim_title`
  (so the UI can group/attribute results) plus the article `url` + `article_title` and the
  final `score`. This realizes the §7.1 `pack_search_global` command row.
- **Failure mode.** A per-ZIM search error propagates as `ZimError` (the same error surface
  §7.3 uses); a single unreadable pack does not silently drop — it either aborts the query
  or is reported per the §7.3 contract (observable, not swallowed).
- **Current body.** `search` returns `Ok(Vec::new())` — an I-10(b) placeholder. The
  end-state behaviour above is the contract for the search wave; the `RankingConfig` and
  `GlobalSearchHit` shapes it depends on are already real.

### Semantic acceptance (I-12 — observable / real-fixture, never grep)

- **E-GSRCH-1 `search`** (end-state fixture): install two fixture packs, place an article
  titled exactly the query in pack A and a body-only match in pack B; `search("query", 10,
  state)` returns hits whose pack-A row has `zim_uuid == A.uuid`, `score` strictly greater
  than the pack-B body-only row's score (title_boost > 1), the list is sorted by `score`
  descending, and `len() <= 10`. The verdict is the returned `Vec` contents and ordering,
  not a count. **Marked HOLLOW until the merge/rank body lands.**
- **E-GSRCH-2 `GlobalSearchHit`**: `serde_json` round-trip preserves all five fields; a hit
  built from pack A carries A's `zim_uuid`/`zim_title`. Real (de)serialization fixture.
- **E-GSRCH-3 `RankingConfig`**: `RankingConfig::default() == { 1.2, 0.75, 2.0 }`; and the
  ranking is *sensitive* to it — with `title_boost = 1.0` a title match and an otherwise-
  identical body match score equally, with `title_boost = 2.0` the title match scores
  higher (asserted via the score delta between two fixture hits, not a field read).

---

## §7.16 Window state persistence (`src-tauri/src/window_state/`)

| ID | Name | Target | Role | Signature / fields | Type | State |
|---|---|---|---|---|---|---|
| E-WIN-1 | `WindowState` | `window_state/mod.rs:5` | Persisted desktop window geometry | `struct { x: i32, y: i32, width: u32, height: u32, maximized: bool, fullscreen: bool }` (serde) | struct | REAL |
| E-WIN-2 | `WindowStateStore` | `window_state/mod.rs:15` | Save/restore geometry through `Storage` (§7.5) under the `ui.window_geometry` setting key (`crate::storage::setting_key::UI_WINDOW_GEOMETRY`); `restore` returns a 1280×720 un-maximized un-fullscreen default on first run / missing key | `struct { storage: Arc<Storage> }; impl save(&self, &WindowState) -> Result<(), StorageError>; restore(&self) -> Result<WindowState, StorageError>` | concrete | REAL |

### Behavioural end-state (§7.16)

- **Desktop-only.** Window geometry is meaningful only on Linux/Windows desktop, where the
  OS gives the app a freeform, movable, resizable window. Android has no freeform window,
  so this subsystem is simply not constructed on Android (no save, no restore, no default
  applied) — the absence is by platform, not a runtime branch that errors.
- **Round-trip.** On close/exit the app calls `save` with the live geometry; on next launch
  it calls `restore` and applies the result. `save` serializes the `WindowState` to JSON
  and writes it through `Storage` under `ui.window_geometry`; `restore` reads that key,
  deserializes it, and on a missing/corrupt value falls back to the documented default
  (`{ x:0, y:0, width:1280, height:720, maximized:false, fullscreen:false }`). First run
  therefore opens a 1280×720 window.
- **Delegates, does not own, persistence.** `WindowStateStore` holds an `Arc<Storage>` and
  routes through `SettingsStore`; it owns the *shape* and the *key*, not the storage engine
  (§7.5). A corrupt-JSON read surfaces as `StorageError::Schema`, not a panic.

### Semantic acceptance (I-12 — observable / real-fixture, never grep)

- **E-WIN-2 `restore` (default path)**: against a fresh/empty `Storage`, `restore()`
  returns `WindowState { 0, 0, 1280, 720, false, false }` — asserted by field equality on
  the returned struct, not by inspecting the key.
- **E-WIN-2 `save`→`restore` (round-trip)**: `save(state)` then `restore()` on the same
  `Storage` returns a `WindowState` equal to `state` for a maximized+fullscreen, off-origin
  geometry (e.g. `{ -10, 20, 1600, 900, true, true }`); after `save`, the value is readable
  under the `ui.window_geometry` key. The verdict is the struct equality + the stored value.
- **E-WIN-1 `WindowState`**: `serde_json` round-trip preserves all six fields including the
  negative `x`/`y` and the `maximized`/`fullscreen` booleans. Real (de)serialization fixture.

---

## Module reconciliation flags (for orchestrator curation, not coder tasks)

1. **E-LOG-1/E-LOG-4 PARTIAL (I-10b).** `EnzimeLogger::init` builds the guard but discards
   the non-blocking writer and registers no `tracing_subscriber`; no log event reaches file
   or stderr today. End-state wires a `fmt` subscriber (file + stderr) at `LogLevel` and
   holds the guard for process lifetime. Needs a CHECKLIST task in the logging wave.
2. **E-PANIC-3 `Variant` (I-10b).** `Variant` is a local placeholder in `panic/mod.rs` so
   `CrashReport.variant` type-checks; the authoritative AI `Variant` lands with
   `ai/probe.rs` (§7.2), at which point this enum and the `variant: None` literal are
   swapped. Cross-module dependency on §7.2 — reconcile when §7.2 partial is authored.
3. **E-UPD-1/E-UPD-8/E-UPD-9 HOLLOW.** `check`/`apply`/`apply_desktop`/
   `apply_sideload_android` all return `Err(NotImplementedOnPlatform)`. End-state behaviour
   (signed-manifest fetch, signature gate, version compare, sha256+size guard, platform
   swap, APK intent, Play no-op) is fully specified above for the app-update wave.
   Verifier half (E-UPD-4/5/7/10) is already REAL.
4. **E-GSRCH-1 HOLLOW.** `GlobalSearcher::search` returns `Ok(Vec::new())`; merge/rank
   depends on the §7.3 `ZimReader::search` surface and the §7.14 catalog iteration.
   `GlobalSearchHit` + `RankingConfig` are already REAL.
5. **Line-number drift corrected.** Existing `§7` table targets were stale (e.g.
   `AppPaths :10`→`:12`, `AppUpdater :10`→`:21`, `GlobalSearcher :10`→`:23`,
   `WindowStateStore :30`→`:15`); corrected to actual `file:line` throughout. Added missing
   rows `E-PANIC-3` (`Variant`) and `E-UPD-10` (`VerifyError`) observed in source.

