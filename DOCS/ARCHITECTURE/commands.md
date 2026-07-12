<!-- CURATED PARTIAL §7.1 commands (51) + §7.12 ACL. GLM-5.1 (`commands`); Opus-reviewed/accepted 2026-06-13. 51 thin-dispatch commands each → its §7.x manager with end-to-end semantic acceptance; marshal DTOs; least-privilege ACL (default + desktop/play/sideload-only capability files; 51 reachable desktop/sideload, 48 Play). Current placeholder bodies are the substitution points — coders wire each to its manager + map Err→String. -->

# Architect partial — Module `commands` (§7.1 + §7.12)

GLM-5.1 architect, end-state behavioural. Replaces §7.1 (the 51-command Tauri
IPC surface, `src-tauri/src/commands.rs`) and §7.12 (Tauri ACL/capabilities,
`src-tauri/capabilities/` + `tauri.conf.json`). Managers are referenced BY NAME
and defined in their own §7.x partials — this module architects only the command
wiring (validate/marshal → manager → map `Err→String`) and the ACL allow-list.

Airlock (TC6): `.tmp/glm-dispatches/modules/commands.arch.md`. Ends `MODULE-DONE: commands`.

---

## §7.1 Tauri command surface (`src-tauri/src/commands.rs`)

### Design (end-state, binding)

- **Commands are thin.** Each `#[tauri::command]` fn does exactly three things:
  (1) receive + implicitly deserialize args (Tauri marshals from the IPC
  payload); (2) call **one manager method on `AppState`** (the command never
  owns business logic, state, or I/O policy); (3) map the manager's typed error
  into the IPC error channel as `String`. No command holds locks longer than the
  manager call, no command parses ZIM/AI/sidecar bytes itself, no command makes
  a network call in the default path.
- **`State<AppState>` is the single dispatch root.** Every command (except
  `enzime_version`, which is a pure compile-time constant) borrows
  `state: State<AppState>` and reaches its manager through `AppState`'s fields
  (`ZimReader`, `LlmRuntime`, the four stores, `EntitlementController`,
  `DeviceProbe` cache, `VariantPicker`, `ModelFetcher`, the sidecar/trust
  managers, `PackCatalog`, `GlobalSearcher`, `AppUpdater`,
  `WindowStateStore` — each defined in its own §7.x).
- **Streaming commands forward over a Tauri `Channel<T>`** and run the
  (blocking) manager work on `spawn_blocking`, forwarding each event/token/
  progress frame through the channel and returning the terminal result when the
  manager completes: `ai_chat_stream` (token deltas, `Channel<String>`),
  `model_fetch` and `model_import_from_media` (download progress,
  `Channel<DownloadProgress>`), `pack_install` (pack download/verify/copy
  progress, `Channel<PackProgress>`). The channel is the only live back-channel;
  the `Result` carries the terminal value (`()` for pure streams, `PathBuf` for
  fetch/install).
- **INV-OFFLINE.** No command requires network in the default path. Online-only
  commands (`app_update_check`, `app_update_apply`, `pack_install` fetch,
  `model_fetch` network path) are additive: failure/offline degrades to a typed
  `Err(String)`, never a panic, and the offline fallback
  (`model_import_from_media`) is a first-class command that needs zero network.
- **Error contract.** Every command returns `Result<T, String>`; the `Err`
  variant is a human/operator-readable `String` derived from the manager's typed
  error via `.map_err(|e| e.to_string())` (or a context-wrapping `format!`). The
  frontend treats any `Err` as command failure; there is no second out-of-band
  channel.
- **`model_import_from_media` is the one rich command.** It is the INV-OFFLINE
  network-fallback path made explicit: it scans mounted external media for a
  signed `mirror-manifest.json`, verifies it with `MirrorManifestVerifier`
  against `MIRROR_PUBLIC_KEY`, and copies the requested variant's weights into
  `models_dir`. It is wired (not placeholder) because it carries the manifest
  + verifier + importer logic; everything else maps straight to its manager.

### Marshal DTOs (defined in `commands.rs`, JSON boundary types)

These structs/enums live in `commands.rs` and are the serde contract between
Rust and the frontend. They are marshalled by Tauri; commands never construct
them from raw bytes.

| ID | Type | Target | Role | Shape |
|---|---|---|---|---|
| E-CMD-5-type | `ZimMetaJson` | `commands.rs:21` | JSON ZIM metadata for `zim_metadata` | `{ title: String, uuid: String, article_count: u32 }` |
| E-ZIM-21-type | `SearchHit` | `commands.rs:29` | JSON search-result row for `zim_search` | `{ url: String, title: String, score: f32 }` |
| E-STR-15 | `Region` | `commands.rs:143` | Selection region for annotations | `enum { Char{start,end}, Page, Custom(String) }` |
| E-STR-14 | `Annotation` | `commands.rs:151` | Annotation row for `annotations_*` | `{ id, zim_uuid, url, region: Region, body, created_at }` |
| E-STR-18 | `Bookmark` | `commands.rs:199` | Bookmark row for `bookmarks_*` | `{ id, zim_uuid, url, title, created_at }` |
| E-STR-11 | `ChatMsg` | `commands.rs:223` | Chat-history row for `chat_history_*` | `{ id, session, role, content, zim_handle: Option<u64>, ts }` |
| E-SIDE-29 | `ReassembleStatus` | `commands.rs:415` | Result of `chunk_ingest` | `enum { Pending{received,total}, Complete(Vec<u8>), Failed(String) }` |
| E-GSRCH-2 | `GlobalSearchHit` | `commands.rs:448` | Cross-ZIM search row for `pack_search_global` | `{ zim_uuid, zim_title, url, article_title, score }` |

### Entity table — 51 commands

`file:line` cites the `#[tauri::command]` attribute line. "Dispatch target"
names the `AppState` manager the command calls (defined in its §7.x).

| ID | Name | Target | Role (behavioural) | Dispatch target | Signature |
|---|---|---|---|---|---|
| E-CMD-1 | `enzime_version` | `commands.rs:37` | Return the compile-time crate version string to the frontend (no state) | — (`CARGO_PKG_VERSION`) | `fn() -> String` |
| E-CMD-2 | `zim_open` | `commands.rs:43` | Open a ZIM archive by path, register it, return a stable handle | `ZimReader`/`RealZim` (§7.3) | `fn(path: String, state) -> Result<u64, String>` |
| E-CMD-3 | `zim_get_article` | `commands.rs:51` | Fetch the rendered article content for a handle+url | `ZimReader` (§7.3) | `fn(handle, url: String, state) -> Result<String, String>` |
| E-CMD-4 | `zim_list_articles` | `commands.rs:59` | Paginated list of article URLs at offset/limit | `ZimReader` (§7.3) | `fn(handle, offset: u64, limit: u32, state) -> Result<Vec<String>, String>` |
| E-CMD-5 | `zim_metadata` | `commands.rs:70` | Archive title/uuid/article_count as `ZimMetaJson` | `ZimReader` (§7.3) | `fn(handle, state) -> Result<ZimMetaJson, String>` |
| E-CMD-6 | `zim_close` | `commands.rs:81` | Release a ZIM handle (drop the reader + free resources) | `ZimReader` (§7.3) | `fn(handle, state) -> Result<(), String>` |
| E-CMD-7 | `zim_search` | `commands.rs:88` | Prefix/text search within one open ZIM, ranked `SearchHit` rows | `ZimReader` (§7.3) | `fn(handle, query: String, limit: u32, state) -> Result<Vec<SearchHit>, String>` |
| E-CMD-8 | `ai_chat` | `commands.rs:102` | Non-streaming completion over an optional open-ZIM context | `LlmRuntime`/`LiteRtLlm` (§7.2) | `fn(prompt: String, zim_handle: Option<u64>, state) -> Result<String, String>` |
| E-CMD-9 | `ai_chat_stream` | `commands.rs:110` | Streaming completion: forward token deltas over a channel | `LlmRuntime` (§7.2) on `spawn_blocking` | `fn(prompt, zim_handle: Option<u64>, on_event: Channel<String>, state) -> Result<(), String>` |
| E-CMD-10 | `ai_voice_chat` | `commands.rs:121` | PCM audio in → text reply (Gemma-tier only) | `AudioEncoder` + `LlmRuntime` (§7.2) | `fn(pcm_b64: String, sr: u32, zim_handle: Option<u64>, state) -> Result<String, String>` |
| E-CMD-11 | `ai_load_model` | `commands.rs:129` | Late-bind a concrete LLM from a model path | `LlmRuntime` (§7.2) | `fn(model_path: String, state) -> Result<(), String>` |
| E-CMD-12 | `ai_unload_model` | `commands.rs:136` | Revert to `NullLlm` (free GPU/CPU memory) | `LlmRuntime` (§7.2) | `fn(state) -> Result<(), String>` |
| E-CMD-13 | `annotations_list` | `commands.rs:162` | All annotations for a handle+url | `AnnotationsStore` (§7.5) | `fn(handle, url: String, state) -> Result<Vec<Annotation>, String>` |
| E-CMD-14 | `annotations_create` | `commands.rs:169` | Persist a new annotation, return its id | `AnnotationsStore` (§7.5) | `fn(handle, url, region: Region, body: String, state) -> Result<u64, String>` |
| E-CMD-15 | `annotations_delete` | `commands.rs:177` | Remove an annotation by id | `AnnotationsStore` (§7.5) | `fn(id: u64, state) -> Result<(), String>` |
| E-CMD-16 | `annotations_export` | `commands.rs:184` | Legacy non-sidecar JSON export (optionally scoped to a handle) | `AnnotationsStore` (§7.5) | `fn(handle: Option<u64>, state) -> Result<String, String>` |
| E-CMD-17 | `annotations_import` | `commands.rs:192` | Import annotations from JSON, return count inserted | `AnnotationsStore` (§7.5) | `fn(json: String, state) -> Result<u32, String>` |
| E-CMD-18 | `bookmarks_list` | `commands.rs:209` | Enumerate all bookmarks | `BookmarksStore` (§7.5) | `fn(state) -> Result<Vec<Bookmark>, String>` |
| E-CMD-19 | `bookmarks_toggle` | `commands.rs:216` | Add-or-remove a bookmark for handle+url, return new state | `BookmarksStore` (§7.5) | `fn(handle, url: String, state) -> Result<bool, String>` |
| E-CMD-20 | `chat_history_list` | `commands.rs:234` | Recent messages (optionally one session) | `ChatHistoryStore` (§7.5) | `fn(session_id: Option<u64>, state) -> Result<Vec<ChatMsg>, String>` |
| E-CMD-21 | `chat_history_append` | `commands.rs:241` | Persist one message, return its id | `ChatHistoryStore` (§7.5) | `fn(role, content: String, handle: Option<u64>, state) -> Result<u64, String>` |
| E-CMD-22 | `chat_history_clear` | `commands.rs:249` | Wipe a session (or all), return rows deleted | `ChatHistoryStore` (§7.5) | `fn(session_id: Option<u64>, state) -> Result<u32, String>` |
| E-CMD-23 | `settings_get` | `commands.rs:256` | Read one settings KV value | `SettingsStore` (§7.5) | `fn(key: String, state) -> Result<Option<String>, String>` |
| E-CMD-24 | `settings_set` | `commands.rs:263` | Write one settings KV value | `SettingsStore` (§7.5) | `fn(key, value: String, state) -> Result<(), String>` |
| E-CMD-25 | `entitlement_check` | `commands.rs:270` | Ask the entitlement controller if a feature is granted | `EntitlementController` (§7.6) | `fn(feature: String, state) -> Result<bool, String>` |
| E-CMD-26 | `billing_open_paywall` | `commands.rs:277` | Present the RevenueCat paywall surface | `PaywallController` (§7.6) | `fn(state) -> Result<(), String>` |
| E-CMD-27 | `billing_restore_purchases` | `commands.rs:284` | Restore prior purchases, return the restore outcome | `PurchaseRestorer` (§7.6) | `fn(state) -> Result<RestoreResult, String>` |
| E-CMD-28 | `device_probe` | `commands.rs:294` | Capability probe; cached after first call via `OnceLock` | `DeviceProbe` (§7.9) | `fn(state) -> Result<DeviceCapability, String>` |
| E-CMD-29 | `variant_current` | `commands.rs:307` | Report the currently active LLM variant | `VariantPicker` (§7.9) | `fn(state) -> Result<Variant, String>` |
| E-CMD-30 | `variant_override` | `commands.rs:314` | Set/clear a user-explicit variant override | `VariantPicker` (§7.9) | `fn(override_: VariantOverride, state) -> Result<(), String>` |
| E-CMD-31 | `model_fetch` | `commands.rs:321` | Fetch variant weights over network w/ progress; return path | `ModelFetcher` (§7.9) | `async fn(variant: Variant, progress: Channel<DownloadProgress>, state) -> Result<PathBuf, String>` |
| E-CMD-32 | `model_present` | `commands.rs:333` | Are the given variant's weights already on disk? | `ModelFetcher`/model storage (§7.9) | `fn(variant: Variant, state) -> Result<bool, String>` |
| E-CMD-33 | `sidecar_create` | `commands.rs:340` | Build + sign a sidecar from a payload | `SidecarSigner` + `SidecarStore` (§7.10) | `fn(payload: Payload, zim_handle: u64, scope: Option<String>, state) -> Result<Sidecar, String>` |
| E-CMD-34 | `sidecar_export` | `commands.rs:352` | Canonical CBOR bytes for a named sidecar | `SidecarStore` (§7.10) | `fn(artifact_id: String, state) -> Result<Vec<u8>, String>` |
| E-CMD-35 | `sidecar_export_json` | `commands.rs:359` | Debug-export a sidecar as JSON | `SidecarStore` (§7.10) | `fn(artifact_id: String, state) -> Result<String, String>` |
| E-CMD-36 | `sidecar_import` | `commands.rs:366` | Decode + verify + trust + store an inbound sidecar | `SidecarVerifier` + `TrustDb` + `SidecarStore` (§7.10) | `fn(bytes: Vec<u8>, state) -> Result<SidecarMeta, String>` |
| E-CMD-37 | `sidecar_list` | `commands.rs:373` | List sidecars for a ZIM (optionally url-prefixed) | `SidecarIndex` (§7.10) | `fn(zim_uuid: String, url_prefix: Option<String>, state) -> Result<Vec<SidecarMeta>, String>` |
| E-CMD-38 | `sidecar_delete` | `commands.rs:380` | Remove a sidecar from the store | `SidecarStore` (§7.10) | `fn(artifact_id: String, state) -> Result<(), String>` |
| E-CMD-39 | `trust_get` | `commands.rs:387` | Read a peer's trust level | `TrustDb` (§7.10) | `fn(pubkey: String, state) -> Result<Option<TrustLevel>, String>` |
| E-CMD-40 | `trust_set` | `commands.rs:394` | Set / edit / revoke a trust mark | `TrustDb` (§7.10) | `fn(pubkey, level: TrustLevel, scope: Option<String>, expires_at: Option<i64>, reason: Option<String>, state) -> Result<(), String>` |
| E-CMD-41 | `trust_list` | `commands.rs:408` | List all trust entries | `TrustDb` (§7.10) | `fn(state) -> Result<Vec<TrustEntry>, String>` |
| E-CMD-42 | `chunk_ingest` | `commands.rs:423` | Feed one received LoRa chunk; report reassembly status | `ChunkReassembler` (§7.10) | `fn(chunk_bytes: Vec<u8>, state) -> Result<ReassembleStatus, String>` |
| E-CMD-43 | `pack_catalog_list` | `commands.rs:430` | List ZIM packs in the operator catalog | `PackCatalog::list` (§7.14) | `fn(state) -> Result<Vec<ZimPack>, String>` |
| E-CMD-44 | `pack_install` | `commands.rs:436` | Download + verify + install a ZIM pack w/ progress; return path | `PackCatalog::install` (§7.14) | `async fn(pack_id: String, progress: Channel<PackProgress>, state) -> Result<PathBuf, String>` |
| E-CMD-45 | `pack_uninstall` | `commands.rs:442` | Remove an installed ZIM pack | `PackCatalog::uninstall` (§7.14) | `fn(pack_id: String, state) -> Result<(), String>` |
| E-CMD-46 | `pack_search_global` | `commands.rs:458` | Search across all installed ZIMs, `GlobalSearchHit` rows | `GlobalSearcher` (§7.15) | `fn(query: String, limit: u32, state) -> Result<Vec<GlobalSearchHit>, String>` |
| E-CMD-47 | `app_update_check` | `commands.rs:465` | Poll the release channel for an available update | `AppUpdater::check` (§7.13) | `async fn(state) -> Result<Option<UpdateManifest>, String>` |
| E-CMD-48 | `app_update_apply` | `commands.rs:472` | Stage + restart onto a new binary (sideload/desktop only) | `AppUpdater::apply_update` (§7.13) | `async fn(state) -> Result<(), String>` |
| E-CMD-49 | `window_state_save` | `commands.rs:479` | Persist the current window pos/size/maximized/fullscreen | `WindowStateStore` (§7.16) | `fn(state) -> Result<(), String>` |
| E-CMD-50 | `window_state_restore` | `commands.rs:486` | Restore window pos/size on launch | `WindowStateStore` (§7.16) | `fn(state) -> Result<WindowState, String>` |
| E-CMD-51 | `model_import_from_media` | `commands.rs:500` | INV-OFFLINE fallback: scan mounted media for signed weights, verify against `MirrorManifest`, copy into `models_dir` | `MirrorManifestVerifier` + `MediaImporter` (§7.9) | `async fn(variant: Variant, progress: Channel<DownloadProgress>, state) -> Result<PathBuf, String>` |

### Per-command semantic acceptance (I-12 — observable end-to-end via the manager, never grep)

Each acceptance is what a verifier observes when the command is invoked against
the real manager — not a file-content check. The placeholder bodies present
today (`I-10(b)` sentinels) are the substitution points; "end-state" is the
behaviour once each command calls its named manager and maps the result.

- **E-CMD-1 `enzime_version`** — returns the crate's `CARGO_PKG_VERSION` (e.g.
  `0.1.0`). Accept: the returned string equals `env!("CARGO_PKG_VERSION")` and
  matches the `version` in `tauri.conf.json`/`Cargo.toml`.
- **E-CMD-2 `zim_open`** — a valid ZIM path returns a fresh, distinct `u64`
  handle; repeated opens return distinct handles; an unreadable/missing path
  returns `Err` carrying the `ZimReader` open error. Accept: open a known ZIM,
  receive a handle, then `zim_metadata` on that handle resolves (proves the
  handle is registered, not the placeholder constant `1`).
- **E-CMD-3 `zim_get_article`** — returns the rendered article content for
  `url` within the open `handle`; a `url` not in the archive returns `Err` (not
  a placeholder string). Accept: fetch a known article and receive its real
  content; fetch a bogus url and receive an `Err`.
- **E-CMD-4 `zim_list_articles`** — `offset`/`limit` paginate real article
  URLs; advancing `offset` yields the next slice (no overlap, no duplicates
  across pages). Accept: page 0 and page 1 of the same ZIM are disjoint and
  their union is contained in the archive's article index.
- **E-CMD-5 `zim_metadata`** — returns the archive's real title, uuid, and
  `article_count` (matches the ZIM header). Accept: `article_count` ≥ the number
  of URLs `zim_list_articles` can enumerate for that handle; `uuid` matches the
  archive's stored main-path uuid (non-zero, non-nil).
- **E-CMD-6 `zim_close`** — after close, the handle is released: a subsequent
  `zim_get_article`/`zim_metadata` on the closed handle returns `Err` (handle
  invalidated). Accept: open → close → use-after-close yields `Err`.
- **E-CMD-7 `zim_search`** — ranked `SearchHit` rows whose titles/urls actually
  contain the query term (prefix/text match per the ZIM reader index); an empty
  query or no matches returns an empty vec, not a placeholder row. Accept: index
  a known article title, search its prefix, and the known article appears with a
  real `url`; a query matching nothing returns `[]`.
- **E-CMD-8 `ai_chat`** — returns a full completion string produced by the bound
  `LlmRuntime` (concrete after `ai_load_model`, or `NullLlm`'s deterministic
  stub when no model is loaded). Accept: with a loaded model, the reply is a
  model-generated continuation of the prompt (not the `"<placeholder…>"` echo);
  with no model loaded it returns the `NullLlm` response, not an error.
- **E-CMD-9 `ai_chat_stream`** — streams real token deltas: the frontend
  receives ≥1 `Channel<String>` events whose concatenation equals the same
  completion `ai_chat` would produce, then the command returns `Ok(())`. Accept:
  observe multiple distinct chunk events over the channel ending in a complete
  utterance (not two fixed placeholder chunks); cancelling the client tears down
  generation without panicking.
- **E-CMD-10 `ai_voice_chat`** — decodes the base64 PCM, runs it through the
  Gemma-tier `AudioEncoder` → `LlmRuntime` → returns the text reply. Accept: a
  short recorded utterance returns a coherent text reply; an unsupported PCM
  shape (wrong `sr`, malformed b64) returns `Err`. Gemma-tier gating: below the
  tier, returns `Err` explaining voice chat is unavailable at this variant.
- **E-CMD-11 `ai_load_model`** — after success, `ai_chat` produces model
  (not `NullLlm`) output and `variant_current` reflects the loaded variant.
  Accept: load → `ai_chat` reply changes from the null response to a real
  generation; load of a missing/corrupt path returns `Err`.
- **E-CMD-12 `ai_unload_model`** — after success, `ai_chat` reverts to the
  `NullLlm` response and the runtime's memory is released. Accept: load →
  unload → `ai_chat` returns the null response; GPU/CPU memory footprint drops.
- **E-CMD-13 `annotations_list`** — returns exactly the annotations persisted
  for that handle+url (initially empty for a fresh store). Accept: create two
  annotations for url A and one for url B; `annotations_list(handle, A)` returns
  two, `annotations_list(handle, B)` returns one.
- **E-CMD-14 `annotations_create`** — persists the annotation and returns a
  unique monotonic id; it is immediately visible to `annotations_list`. Accept:
  create → the returned id round-trips through `annotations_list` with the
  stored `region`/`body`.
- **E-CMD-15 `annotations_delete`** — removes the annotation; a subsequent
  `annotations_list` no longer contains that id; deleting a missing id is a
  no-op `Ok(())` (or typed `Err` per store contract — observable, not silent
  data corruption). Accept: create → delete → list omits it.
- **E-CMD-16 `annotations_export`** — returns valid JSON containing the
  exported annotations (legacy, non-sidecar shape). Accept: after creating
  annotations, the returned string parses as JSON and its rows match what
  `annotations_list` reports for the same scope.
- **E-CMD-17 `annotations_import`** — inserts the JSON rows and returns the
  count actually inserted; malformed JSON returns `Err`. Accept: import the
  export from E-CMD-16 into a fresh store; returned count equals the row count
  and the rows appear in `annotations_list`.
- **E-CMD-18 `bookmarks_list`** — returns all persisted bookmarks (empty for a
  fresh store). Accept: toggle a bookmark on, then `bookmarks_list` contains it
  with the correct `zim_uuid`/`url`/`title`.
- **E-CMD-19 `bookmarks_toggle`** — idempotent flip: toggling an absent bookmark
  adds it (returns `true`); toggling an existing bookmark removes it (returns
  `false`). Accept: two consecutive toggles on the same handle+url return
  `true` then `false`, and `bookmarks_list` ends unchanged.
- **E-CMD-20 `chat_history_list`** — returns recent messages (scoped to a
  session when `session_id` is given). Accept: append three messages across two
  sessions; list-with-session returns only that session's messages in timestamp
  order.
- **E-CMD-21 `chat_history_append`** — persists one message, returns its id,
  visible to `chat_history_list`. Accept: append → the returned id appears in
  `chat_history_list` with the stored `role`/`content`.
- **E-CMD-22 `chat_history_clear`** — wipes the session (or all) and returns
  the number of rows deleted; afterwards `chat_history_list` is empty for that
  scope. Accept: append N, clear, observe returned count N and an empty list.
- **E-CMD-23 `settings_get`** — returns the stored value for `key` or `None`
  when unset. Accept: `settings_set("k","v")` then `settings_get("k")` →
  `Some("v")`; `settings_get("never-set")` → `None`.
- **E-CMD-24 `settings_set`** — persists `value` under `key`; a subsequent
  `settings_get` reflects it; overwriting replaces. Accept: set → get round-trip
  equality; set twice → second value wins.
- **E-CMD-25 `entitlement_check`** — returns the `EntitlementController`'s
  verdict for `feature` (true only when genuinely entitled, false otherwise).
  Accept: with a granted entitlement the feature returns `true`; with it
  revoked/absent it returns `false`; the command never grants entitlement
  itself.
- **E-CMD-26 `billing_open_paywall`** — surfaces the RevenueCat paywall via the
  `PaywallController`; returns `Ok(())` once presented (or `Err` if the paywall
  surface is unavailable). Accept: invoking it raises the paywall UI/flow
  (observable presentation), no purchase is forced.
- **E-CMD-27 `billing_restore_purchases`** — runs `PurchaseRestorer` and returns
  a `RestoreResult` whose `restored` count and `errors` reflect actual restore
  outcome. Accept: with a prior purchase on the account, `restored ≥ 1` and the
  corresponding entitlement becomes active; with nothing to restore,
  `restored == 0` and `errors` empty.
- **E-CMD-28 `device_probe`** — returns the probed `DeviceCapability`; the
  result is memoized so the second call returns an equal value without
  re-probing (cache hit). Accept: two calls return `==` capability and the
  returned tier is consistent with the host (e.g. GPU presence reflected).
- **E-CMD-29 `variant_current`** — returns the `VariantPicker`'s currently
  active variant, reflecting any override + probe. Accept: with no override on
  a capable device it returns the probe-chosen variant; after a user override,
  it returns the overridden variant.
- **E-CMD-30 `variant_override`** — sets (non-`None`) or clears (`None`) the
  user-explicit override; `variant_current` reflects it on the next read.
  Accept: set override → `variant_current` returns it; clear → reverts to
  probe-chosen.
- **E-CMD-31 `model_fetch`** — downloads the variant weights, emits
  `DownloadProgress` frames over the channel (bytes/total), and returns the on-
  disk path. Accept: a successful fetch yields increasing-progress events
  ending at 100%, the returned path exists and is non-empty, and `model_present`
  for that variant is `true` afterwards; a network failure mid-fetch returns
  `Err` and leaves no partial install claimed as complete.
- **E-CMD-32 `model_present`** — returns `true` iff the variant's weights exist
  (and verify) on disk. Accept: before `model_fetch`/import → `false`; after a
  successful fetch/import of that variant → `true`.
- **E-CMD-33 `sidecar_create`** — builds a signed `Sidecar` from the `Payload`,
  scoped to `zim_handle` (+optional scope), and stores it. Accept: the returned
  `Sidecar` verifies under the `SidecarVerifier` and is retrievable via
  `sidecar_list` for that ZIM.
- **E-CMD-34 `sidecar_export`** — returns the canonical CBOR bytes for the named
  sidecar; a missing `artifact_id` returns `Err`. Accept: export → re-import the
  same bytes via `sidecar_import` yields an equivalent `SidecarMeta` (round-trip
  stable).
- **E-CMD-35 `sidecar_export_json`** — returns a human-readable JSON form of the
  sidecar (debug). Accept: the returned string parses as JSON and mirrors the
  CBOR export's logical fields.
- **E-CMD-36 `sidecar_import`** — decodes, verifies the signature, applies trust
  (per `TrustDb`), stores, and returns `SidecarMeta`. Accept: importing a valid,
  trusted sidecar returns `SidecarMeta` and the sidecar appears in
  `sidecar_list`; importing a tampered/untrusted sidecar returns `Err` and
  stores nothing.
- **E-CMD-37 `sidecar_list`** — returns sidecars for `zim_uuid`, optionally
  filtered by `url_prefix`. Accept: create two sidecars (different urls) under
  one ZIM; list-all returns both; list-with-`url_prefix` returns only the
  matching one.
- **E-CMD-38 `sidecar_delete`** — removes the named sidecar; afterwards
  `sidecar_list` omits it. Accept: create → delete → list omits it; deleting a
  missing id returns `Err` (observable, not silent).
- **E-CMD-39 `trust_get`** — returns the stored `TrustLevel` for `pubkey` or
  `None` when unset. Accept: `trust_set` a level → `trust_get` returns it; an
  unknown pubkey returns `None`.
- **E-CMD-40 `trust_set`** — sets, edits, or revokes (level permitting) a trust
  mark with optional scope/expiry/reason. Accept: set → `trust_get`/`trust_list`
  reflect it; revoke → entry removed or level reflects revocation.
- **E-CMD-41 `trust_list`** — returns all trust entries. Accept: after setting
  two distinct pubkeys, `trust_list` contains both with the stored levels.
- **E-CMD-42 `chunk_ingest`** — feeds one chunk to the `ChunkReassembler` and
  returns the status: `Pending{received,total}` until complete, then
  `Complete(bytes)` when the final chunk assembles the whole, or `Failed(msg)`
  on a corrupt/missing chunk. Accept: ingest the chunk sequence for a known
  artifact; the final chunk returns `Complete` whose bytes equal the original,
  and a chunk for an unknown set returns `Failed`.
- **E-CMD-43 `pack_catalog_list`** — returns the operator catalog's `ZimPack`
  rows from `PackCatalog::list` (already wired). Accept: returns the catalog
  entries with real ids/titles/sizes (non-empty when the catalog is populated);
  an empty catalog returns `[]`.
- **E-CMD-44 `pack_install`** — downloads + verifies + installs `pack_id`,
  emitting `PackProgress` frames, returns the installed path (already wired via
  `PackCatalog::install`). Accept: progress events advance to completion, the
  returned path exists, and `pack_catalog_list`/uninstall treat it as installed;
  a bad pack id returns `Err`.
- **E-CMD-45 `pack_uninstall`** — removes an installed pack (already wired).
  Accept: after `pack_install`, `pack_uninstall` returns `Ok(())` and the pack's
  files are gone; uninstalling a non-installed id returns `Err`.
- **E-CMD-46 `pack_search_global`** — searches across all installed ZIMs via
  `GlobalSearcher`, returning `GlobalSearchHit` rows attributed to their source
  ZIM. Accept: with two installed ZIMs sharing a topic, a query returns hits
  from both with distinct `zim_uuid`; a query matching nothing returns `[]`.
- **E-CMD-47 `app_update_check`** — polls the release channel via
  `AppUpdater::check`; returns `Some(UpdateManifest)` when a newer build exists,
  `None` when up-to-date, `Err` on a network/manifest failure. Accept: against a
  release channel advertising a newer version it returns `Some`; against the
  current version it returns `None`; offline it returns `Err` (not a hang).
- **E-CMD-48 `app_update_apply`** — stages the new binary and restarts
  (sideload/desktop only); returns `Err` if no staged update exists or the
  platform cannot self-update. Accept: after `app_update_check` reports an
  update, `apply` stages it and the relaunched process reports the new version;
  apply with nothing staged returns `Err`.
- **E-CMD-49 `window_state_save`** — persists the current window geometry via
  `WindowStateStore`. Accept: move/resize the window, save, then
  `window_state_restore` returns the just-saved geometry (x/y/w/h/maximized).
- **E-CMD-50 `window_state_restore`** — returns the persisted `WindowState`
  (sane default on first run: `1280×720`, not maximized/fullscreen). Accept:
  after `window_state_save` of a known geometry, restore returns that exact
  geometry; on first run it returns the documented default.
- **E-CMD-51 `model_import_from_media`** — INV-OFFLINE fallback: scans
  `MEDIA_SEARCH_PATHS` for a signed `mirror-manifest.json`, verifies it with
  `MirrorManifestVerifier` against `MIRROR_PUBLIC_KEY`, then `MediaImporter`
  copies the requested variant into `models_dir` emitting `DownloadProgress`,
  returning the path. Accept: with a correctly signed manifest + weights on
  mounted media (airplane mode), the variant imports and `model_present`
  becomes `true`; with a tampered manifest or bad signature it returns `Err`
  ("Failed to initialize verifier" or verification error) and copies nothing;
  with no media present it reports no manifest found without crashing.

### Wiring + error-mapping contract (binding)

- Every command (except `enzime_version`) ends in `.map_err(|e| e.to_string())`
  (or an equivalent `format!` context wrap) — the typed manager error becomes
  the IPC `String`. The command itself adds no business logic beyond arg
  presence where the manager requires it.
- Streaming commands (`ai_chat_stream`, `model_fetch`, `pack_install`,
  `model_import_from_media`) own the `Channel<T>` lifetime: they forward every
  manager event before returning the terminal `Result`. Cancellation/early-drop
  of the channel must not panic the manager.
- `device_probe` retains its `OnceLock` cache so the probe runs at most once per
  process — the command is the cache boundary, the probe is the manager.
- The `State<AppState>` borrow is shared (`State` is `Send + Sync` via the
  manager interiors); no command takes a long-held exclusive lock.

---

## §7.12 Tauri ACL / capabilities (`src-tauri/capabilities/` + `tauri.conf.json`)

### Design (end-state, binding — least-privilege)

- **Exactly the 51 commands are callable from the frontend; nothing broader.**
  Every frontend-reachable command must be granted by a capability file's
  `permissions[]` array; a command invoked with no matching grant is rejected at
  the Tauri 2 IPC ACL boundary before it reaches its handler. The ACL is the
  sole gate — commands are not additionally guarded in the frontend.
- **Per-flavor capability sets.** Four capability JSONs are conditionally
  included per build flavor (the build selects which capability files are
  compiled into the main window via the flavor's `tauri.conf.json`/feature set):
  - `default.json` — the platform-agnostic baseline granted on every flavor's
    main window: the bulk of the 51 commands (ZIM, AI, stores, entitlement,
    device/variant, model, sidecar/trust/chunk, pack, global search,
    `app_update_check`, `model_import_from_media`).
  - `desktop-only.json` — Linux/Windows extras: `app_update_apply`
    (E-CMD-48), `window_state_save` (E-CMD-49), `window_state_restore`
    (E-CMD-50), plus the `core:window` control perms
    (`allow-set-title`, `allow-show`, `allow-hide`).
  - `play-only.json` — Google Play flavor: **excludes** `app_update_apply`
    (Play manages updates) and the window-state commands (Android has no
    freeform window); grants Play-Billing-appropriate perms only.
  - `sideload-only.json` — F-Droid/direct-APK flavor: **includes**
    `app_update_apply` (via APK install intent) and the `core:window` perms.
- **No global grant.** No capability uses a blanket permission; each command is
  enumerated. App-defined `#[tauri::command]` functions require their generated
  permission identifiers (one per command) in the `permissions[]` array; core
  window perms use the `core:window:allow-*` form already present.
- **INV-OFFLINE alignment.** The ACL never gates a command on network presence;
  it only gates reachability. The offline-first commands (`zim_*`, `ai_*` with a
  loaded/null model, stores, `device_probe`, `variant_*`, `sidecar_*`/`trust_*`,
  `chunk_ingest`, `model_import_from_media`) are all granted in `default.json`.

### Entity table — ACL

| ID | Name | Target | Role (behavioural) | Grant shape |
|---|---|---|---|---|
| E-ACL-1 | `default.json` | `src-tauri/capabilities/default.json` | Baseline main-window capability set: grants the platform-agnostic command surface so core offline flows work on every flavor | `permissions[]` enumerates the command perms for E-CMD-1..47 (excl. the flavor-gated set), E-CMD-51, + core IPC perms; `windows: ["main"]`, `local: true` |
| E-ACL-2 | `desktop-only.json` | `src-tauri/capabilities/desktop-only.json` | Desktop-flavor extras: self-update + window-state persistence + window control, unavailable on Android | `permissions[]`: `app_update_apply`, `window_state_save`, `window_state_restore` + `core:window:allow-set-title/-show/-hide` |
| E-ACL-3 | `play-only.json` | `src-tauri/capabilities/play-only.json` | Play-flavor restriction marker: no `app_update_apply` (Play handles updates), no window-state | `permissions[]` excludes `app_update_apply` and window-state; Play-Billing perms as applicable |
| E-ACL-4 | `sideload-only.json` | `src-tauri/capabilities/sideload-only.json` | Sideload-flavor extras: self-update via APK install intent + window control | `permissions[]`: `app_update_apply` + `core:window:allow-set-title/-show/-hide` |
| E-ACL-5 | command allow-list | per-capability `permissions[]` arrays | The explicit, per-command, least-privilege enumeration that makes exactly the 51 commands frontend-reachable | enforced by the Tauri 2 ACL runtime: a command with no matching grant is denied at the IPC boundary |

### Per-ACL-row semantic acceptance (I-12)

- **E-ACL-1 `default.json`** — On a flavor whose main window carries only this
  capability, every platform-agnostic command (e.g. `zim_open`, `ai_chat`,
  `settings_get`, `sidecar_import`, `pack_search_global`,
  `model_import_from_media`) is invokable and reaches its handler, while the
  flavor-gated commands (`app_update_apply`, `window_state_*`) are rejected at
  the IPC boundary. Accept: invoke `zim_open` → handler runs; invoke
  `window_state_save` with only this capability → ACL denial.
- **E-ACL-2 `desktop-only.json`** — On a desktop build, `app_update_apply`,
  `window_state_save`, and `window_state_restore` become reachable and function
  (per E-CMD-48/49/50). Accept: on desktop, `window_state_save`→`restore`
  round-trips and `app_update_apply` is callable; the `core:window` perms allow
  title/show/hide without denial.
- **E-ACL-3 `play-only.json`** — On a Play build, `app_update_apply` is denied
  (Play owns updates) and there is no self-update path through this command.
  Accept: on the Play flavor, invoking `app_update_apply` returns an ACL denial;
  all default-platform commands still work.
- **E-ACL-4 `sideload-only.json`** — On a sideload build, `app_update_apply` is
  reachable (stages via APK install intent). Accept: on the sideload flavor,
  `app_update_apply` is callable and proceeds per E-CMD-48; window control perms
  are granted.
- **E-ACL-5 command allow-list** — The union of granted commands across the
  compiled-in capabilities for a flavor equals exactly the intended set for that
  flavor (all 51 on desktop/sideload via default+flavor; the 48 non-`apply`/
  non-window-state set on Play). Accept: for each flavor, a frontend attempt to
  invoke any **non-granted** command is denied at the IPC boundary (observable
  ACL rejection), and every **granted** command reaches its handler — proving
  least-privilege with no broader grant.

### ACL ↔ command coverage check (binding)

- `app_update_apply` (E-CMD-48) is granted **only** by `desktop-only.json` and
  `sideload-only.json`; never by `default.json` or `play-only.json`.
- `window_state_save`/`window_state_restore` (E-CMD-49/50) are granted **only**
  by `desktop-only.json`.
- All other commands (E-CMD-1..47, E-CMD-51) are granted by `default.json` and
  therefore reachable on every flavor.
- Total frontend-reachable commands: 51 on desktop, 51 on sideload, 48 on Play
  (excludes `app_update_apply` + the two window-state commands).

---

