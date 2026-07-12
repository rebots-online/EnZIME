<!--
CURATED PARTIAL — Dynamic Download (triple-D): §7.9 model fetcher + §7.14 pack catalog +
§7.17 Android platform + NEW §5.7 install sequence. Authored by GLM-5.1 per-module dispatch
(`ddl`); reviewed + accepted by the Opus orchestrator (I-12 semantic eval) 2026-06-13.
Merge: the three §7.x replace their counterparts; §5.7 appends after §5.6.
Carry-forward to CHECKLIST (coder tasks): Cargo deps (reqwest/jni/async-trait/tokio);
AppState::build fetcher wiring (per-channel); assets/default-mirror-manifest.json (signed).
Note: E-PACK-18 is a placeholder REMOVAL row (its acceptance is a grep-for-absence — valid
for a deletion, not a behavioural-completion proxy).
-->

# Dynamic Download (triple-D) — end-state architecture

**Airlock deliverable** (TC6). Replacement content for `DOCS/ARCHITECTURE.md`
**§7.9** (Model fetcher + first-launch), **§7.14** (ZIM pack catalog +
downloader), **§7.17** (Mobile platform integration), plus a new **§5.7**
Dynamic-Download install sequence. Authored by the GLM-5.1 architect seat for
the `ddl` module. Merge target: the three §7.x subsections replace their
current counterparts verbatim; §5.7 is appended after §5.6.

All entity rows below are **behavioural end-state** (I-11): no placeholders,
no `TBD`, no signature-only rows. Every "Semantic acceptance" cell is a
behavioural contract the verifier evaluates directly (I-12) — never a
grep-for-existence. `file:line` anchors are the verified current source
location (or, for genuinely new entities, the target file the coder will
create, marked **NEW**).

---

## Prose — what triple-D is and how it behaves

Dynamic Download ("triple-D", USP #1) is the single subsystem that makes
EnZIME able to **acquire every byte of offline knowledge and on-device AI
weight across all distribution channels and connectivity states**. It governs
two artifact families through one identical behavioural contract:

1. **Knowledge packs** (`.zim` files) — `src-tauri/src/pack_catalog/`.
2. **AI model weights** (`.bin` LiteRT-LM weights) — `src-tauri/src/model_fetcher/`.

Both families resolve through the **same fallback chain, in the same order**
(INV-OFFLINE):

```
media (SD / USB / disc / sibling-fs)  →  LAN peer  →  network (mirror HTTP / Android PAD)
   first-class, zero internet              mDNS              last resort
```

Offline physical media is the **first-class default**, not a corner case. The
network leg is **last**. A user on airplane mode with a pack on an SD card
never touches the network. A user on a slow metered LAN pulls from a sibling
device before any egress mirror. Network is reached only when nothing local
exists.

**Three invariants govern every leg of the chain:**

- **INV-RESUMABLE** — every network/PAD transfer streams into a `<name>.partial`
  file, supports interruption and **HTTP `Range:` resume** (or PAD's native
  resume), and performs an **atomic rename `.partial → final` only after the
  artifact verifies**. A paused/cancelled/interrupted transfer leaves the
  `.partial` on disk so the next attempt resumes from the byte it reached,
  never restarting from zero (the catalog screen's "resumable / pause / close"
  affordances map to this).
- **INV-SIGNED** — the catalog (`PackCatalogSignedManifest`) and the model
  mirror manifest (`MirrorManifest`) are **ed25519-signed** by the operator
  key; the signature is verified **before any entry is trusted**. The single
  trust root is our compile-time-embedded public key
  (`PACK_CATALOG_PUBLIC_KEY` / `MIRROR_PUBLIC_KEY`). Per-artifact `sha256` is
  checked against the signed entry's declared hash. Transports (HTTP mirror,
  LAN peer, PAD) are **never** trusted — only the signature + hash are.
- **INV-OFFLINE-PRIORITY** — the chain is consulted **in order** and **short-
  circuits on first success**; no leg is retried once a later leg has begun.
  `media` and `lan` work with airplane mode on; `network` is gated behind them.

**Per-channel default network leg** (the last-resort tier, chosen at build/runtime):

| Distribution channel | Default network fetcher | Also available |
|---|---|---|
| Play (Android, `feature = "play"`) | `PadFetcher` (Play Asset Delivery, JNI) | `MediaImporter` + `NullFetcher` |
| Sideload / F-Droid (Android + desktop) | `MirrorFetcher` (HTTP, reqwest) | `MediaImporter` + `NullFetcher` |
| Linux / Windows desktop | `MirrorFetcher` (HTTP) + local filesystem | `MediaImporter` + `NullFetcher` |

Every channel always also carries `NullFetcher` (weights already on disk) and
`MediaImporter` (import from physical media). The same three-tier shape
(`media` → `lan` → network) applies to **packs** via `PackMediaImporter` →
`LanPeerPackFetcher` → `MirrorPackFetcher`.

**Progress contract.** Both families stream progress to the frontend over a
Tauri `Channel` — `Channel<PackProgress>` for packs, `Channel<DownloadProgress>`
for models — with identical stage machines (`Probing → Downloading → Verifying
→ Installing → Done | Failed(msg)`). The channel is the cancellation surface:
closing/dropping it (or the frontend "pause"/"close") stops the stream and
**retains the `.partial`** for resume. The frozen catalog screen
(`LIBS/UI/STITCH/screens/03-catalog/`, title "Dynamic Download", tabs
*Knowledge Packs* / *AI Models*, the "No internet?" affordance, the
`2.1 / 4.3 GB · resumable · pause · close` progress affordance and
`check_circle` completion glyph) is the UI realization of exactly this
contract.

**New dependencies this module requires** (to be named in `Cargo.toml`):
`reqwest` (HTTP client, streaming body, `Range` header), `jni` (Android PAD +
platform hooks, `cfg target_os = "android"`), `async-trait` (object-safe-ish
fetcher trait), `ed25519-dalek` + `sha2` (already used by both manifest
modules — reused, not re-added), `tokio` runtime (streaming + cancel token).

---

## §5.7 Dynamic-Download install sequence (NEW — appends after §5.6)

Sequence for installing a **knowledge pack** from the catalog screen (the
`pack_install` command). The **model-weight** chain is structurally identical
(`model_fetch` command → `ModelFetcher` media/LAN/mirror/PAD) and is already
drawn in §5.1 First-launch; this sequence focuses on the pack path and shows
how the network `MirrorPackFetcher` tier closes the chain.

```plantuml
@startuml
actor User
participant UI as "Catalog screen\n(03-catalog)"
participant Cmd as "pack_install()\nE-CMD-44"
participant Cat as "PackCatalog"
participant Media as "PackMediaImporter"
participant Lan as "LanPeerPackFetcher"
participant Mir as "MirrorPackFetcher\n(NEW)"
participant FS as "packs_dir + installed-packs.json"

User -> UI : taps Download on a pack
UI -> Cmd : pack_install(pack_id, channel)
Cmd -> Cat : install(pack_id, Channel<PackProgress>)

Cat -> Cat : list() -> find pack\n(local/bundled catalog, signature-verified)
Cat -> Media : scan_and_import(packs_dir, pack, ch)
alt candidate .zim found on MEDIA_SEARCH_PATHS
  Media -> Media : compute_sha256(candidate) == pack.sha256
  Media -> FS : copy candidate -> packs_dir/<id>.zim
  Media --> Cat : Ok(dest)  (stage: Done)
else no offline candidate
  Media --> Cat : Err(NotFound)
  Cat -> Lan : fetch(pack, ch)
  alt mDNS peer advertises pack
    Lan -> Lan : GET from peer, ed25519-verify peer-share vs PACK_CATALOG_PUBLIC_KEY
    Lan -> FS : write packs_dir/<id>.zim
    Lan --> Cat : Ok(dest)
  else no peer / peer 404
    Lan --> Cat : Err(Network)
    Cat -> Mir : fetch(pack, ch)
    Mir -> Mir : GET pack.download_url\nRange resume into <id>.partial\nstream -> Downloading events
    Mir -> Mir : sha256(<id>.partial) == pack.sha256 ?
    alt hash matches
      Mir -> FS : atomic rename <id>.partial -> <id>.zim\n(stage: Done)
      Mir --> Cat : Ok(dest)
    else hash mismatch / HTTP error
      Mir -> Mir : delete <id>.partial\n(stage: Failed)
      Mir --> Cat : Err(Verify|Network)
      Cat --> Cmd : Err(NotFound "media, LAN, network all failed")
    end
  end
end

Cat -> FS : register_installed_pack(pack, dest)\n(installed-packs.json)
Cat --> Cmd : Ok(dest)
Cmd --> UI : PathBuf
UI -> User : check_circle — pack ready
@enduml
```

**Pause/resume mapping.** "pause" (UI) → drop interest in the channel + signal
cancel; the active tier stops its stream **and keeps `<id>.partial`**.
"resume"/re-tap Download → `install()` re-enters; `media`/`lan` still miss, the
`MirrorPackFetcher` sees the existing `.partial` and issues `Range: bytes=<len>-`,
appending from where it stopped. "close" → cancel + delete `.partial` (user has
abandoned the transfer). The model chain (`MirrorFetcher`/`PadFetcher`) obeys
the identical mapping against `<variant>.partial`.

---

## §7.9 Model fetcher + first-launch — end-state entity table

Directory: `src-tauri/src/model_fetcher/` (+ `src-tauri/src/launch/` for the
device-probe/variant-picker carry-forward rows E-MOD-1…E-MOD-5, which are
already real and out of the DDL gap; included for enumeration completeness).

| ID | Name | file:line | Role (real behaviour) | Signature / fields | Semantic acceptance |
|---|---|---|---|---|---|
| E-MOD-1 | `DeviceCapability` | `launch/device_capability.rs:20` | Probed device facts consumed by `VariantPicker` to choose a `Variant`. Never panics on probe gaps. | `#[derive(Serialize)] struct { ram_total_bytes: u64, ram_available_bytes: u64, storage_free_bytes: u64, has_play_services: bool }` | Given a host with N bytes free storage and Play services present, `probe()` yields a `DeviceCapability` whose `storage_free_bytes`/`has_play_services` equal the observed values; on a probe subsystem failure, returns `ProbeError` rather than panicking. |
| E-MOD-2 | `DeviceProbe` | `launch/device_capability.rs:35` | Probe runner. Conservative; the only failure mode is a typed `ProbeError`. | `struct DeviceProbe; impl { pub fn probe() -> Result<DeviceCapability, ProbeError> }` | On a machine where `sysinfo` reports the RAM/storage and the platform probe resolves `has_play_services`, `probe()` returns `Ok(DeviceCapability{…})` populated from those sources; it never `unwrap()`s an `Option` that could be `None`. |
| E-MOD-3 | `ProbeError` | `launch/device_capability.rs:8` | Typed probe failure. | `#[derive(Error)] enum { Sysinfo(String), Platform(String) }` | A failed `sysinfo` read produces `Err(ProbeError::Sysinfo(msg))`; a failed platform/Play-Services check produces `Err(ProbeError::Platform(msg))`; the `Display` impl renders the inner message. |
| E-MOD-4 | `VariantPicker` | `launch/variant_picker.rs:12` | Deterministic `DeviceCapability → Variant` map; `pick_with_override` honours a settings override. | `struct VariantPicker; impl { pub fn pick(cap: &DeviceCapability) -> Variant; pub fn pick_with_override(cap, override_: VariantOverride) -> Variant }` | Two calls with the **same** `DeviceCapability` (no override) return the **same** `Variant`; an `Auto` override reproduces `pick()`, while `ForceGemmaE2bQ4` returns that variant regardless of capability. |
| E-MOD-5 | `VariantOverride` | `launch/variant_picker.rs:53` | Settings-level variant override. | `#[derive(Serialize, Deserialize)] enum { Auto, ForceQwen3, ForceGemmaE2bQ4 }` | Round-trips through serde (`to_string`/`from_str`) preserving the chosen variant; `Auto` is the absence of an override. |
| E-MOD-6 | `ModelFetcher` | `model_fetcher/mod.rs:45` | Object trait abstracting weight acquisition across Null/Mirror/Pad/Media. The single surface `model_fetch` calls; legs differ, contract identical. | `#[async_trait] pub trait ModelFetcher { async fn fetch(&self, variant: Variant, progress: Channel<DownloadProgress>) -> Result<PathBuf, FetchError>; fn is_present(&self, variant: Variant) -> bool; }` | Any `impl ModelFetcher` whose `is_present(v)` returns `true` must, when `fetch(v, ch).await` returns `Ok(p)`, have produced `p` pointing at a readable weight file that did not exist before (or already matched); `fetch` emits ≥1 `DownloadProgress` per stage transition. |
| E-MOD-7 | `FetchError` | `model_fetcher/mod.rs:17` | Typed fetcher failure. | `#[derive(Error)] enum { Network(String), Verify(String), Storage(io::Error), PadUnavailable, MissingManifest }` | A sha256 mismatch is reported as `Verify`; a missing `MirrorManifest` as `MissingManifest`; a PAD-only build on non-Android as `PadUnavailable`; `Display` renders the inner string. |
| E-MOD-8 | `DownloadProgress` | `model_fetcher/progress.rs:15` | Channel event for model download (mirrors `PackProgress`). | `#[derive(Serialize, Deserialize)] struct { variant: Variant, bytes_downloaded: u64, bytes_total: u64, stage: ProgressStage }` | A frontend receiving the channel observes a monotonic non-decreasing `bytes_downloaded` bounded by `bytes_total`, terminating in `stage: Done` on success or `stage: Failed(msg)` on error; `variant` matches the requested variant on every event. |
| E-MOD-9 | `ProgressStage` | `model_fetcher/progress.rs:35` | Sub-stage state machine. | `#[derive(Serialize, Deserialize, PartialEq, Eq)] enum { Probing, Downloading, Verifying, Installing, Done, Failed(String) }` | A successful fetch's emitted stage sequence is a subsequence of `Probing → Downloading → Verifying → Installing → Done`; a failed fetch terminates in `Failed(String)` with a non-empty message. |
| E-MOD-10 | `NullFetcher` | `model_fetcher/null.rs:11` | "Weights already on disk" leg — the final runtime binding once any other leg has placed weights. `is_present` is the gate the first-launch flow consults. | `struct NullFetcher { models_dir: PathBuf }; impl ModelFetcher` (`fetch` returns `models_dir/<variant>.bin` iff present, else `Err(Storage(NotFound))`; `is_present` tests path existence) | With `<variant>.bin` absent, `is_present(v)` is `false` and `fetch(v,_).await` returns `Err(Storage(NotFound))`; after another leg writes that file, both `is_present(v)` flips `true` and `fetch(v,ch)` returns its path with a single `Done` event. |
| E-MOD-11 | `MirrorFetcher` | `model_fetcher/mirror.rs:25` | **reqwest** HTTPS fetcher — the desktop/sideload network leg. Resumable, sha256-verified, atomic-rename. Substitutes the current `()`/placeholder `http` with `reqwest::Client`. | `struct MirrorFetcher { http: reqwest::Client, verifier: MirrorManifestVerifier, manifest: MirrorManifest }; impl ModelFetcher` (`fetch`: resolve `ManifestEntry` for `variant`; resume `<variant>.partial` via `Range: bytes=<len>-`; stream body appending to the partial, emit `Downloading` per chunk; on completion fsync + sha256 vs `entry.sha256`; on match atomic-rename to `<variant>.bin`, emit `Done`, return path; on mismatch remove partial + `Err(Verify)`; HTTP non-2xx/non-206 → `Err(Network)`) | Given a manifest entry whose `sha256` equals the variant's true bytes, `fetch(v,ch)` (a) resumes an existing partial when the mirror honours `Range` (server returns 206 and the resumed file's total length equals `size_bytes`), (b) emits `Downloading` events whose `bytes_downloaded` advances to `bytes_total`, (c) returns `Ok` pointing at `<variant>.bin` whose sha256 is `entry.sha256`, and (d) leaves **no** `<variant>.partial` behind on success. On a deliberately-corrupted mirror response (wrong bytes), it returns `Err(Verify)` and removes the partial. `is_present(v)` is `true` iff `<variant>.bin` exists. |
| E-MOD-12 | `mirror_base_url` | `model_fetcher/mirror.rs:17` | Compile-time-overridable mirror origin. | `pub fn mirror_base_url() -> &'static str` (`option_env!("ENZIME_MIRROR_URL").unwrap_or("https://models.enzime.dev")`) | Building with `ENZIME_MIRROR_URL=https://x.test` makes `mirror_base_url()` return `"https://x.test"`; with the env unset it returns the documented default. |
| E-MOD-13 | `PadFetcher` | `model_fetcher/pad.rs:117` | **Play Asset Delivery** leg (Android, `cfg(feature = "play", target_os = "android")`). Substitutes the current `()`/JNI placeholders with a real JNI call sequence into `AssetPackManager`. | `struct PadFetcher { models_dir: PathBuf, jvm: jni::JavaVM, asset_pack_manager: jni::objects::GlobalRef }; impl ModelFetcher`. `fetch(variant, ch)`: (1) map `variant → asset-pack name` (`gemma_4_e2b_q4`…); (2) register an `AssetPackStateUpdateListener` native callback bound to the `Channel`; (3) JNI call `AssetPackManager.fetch([packName])`; (4) the listener converts each `AssetPackState` (`DOWNLOADING`/`QUEUED`/`TRANSFERRING`/`COMPLETED`/`FAILED`/`CANCELED`, with `pack.bytes_downloaded()`/`pack.total_bytes_to_download()`) via `PadProgressBridge::forward` into `DownloadProgress`; (5) on `COMPLETED`, JNI `AssetPackManager.getPackLocation(packName).assetsPath()` → copy the weight into `<variant>.partial`, sha256 vs manifest entry, atomic-rename to `<variant>.bin`, emit `Done`; (6) on `FAILED`/`CANCELED` → `Err(Network|PadUnavailable)`; (7) unregister + release listener `GlobalRef`. | On an Android+Play build with a valid signed manifest, `fetch(v,ch)` returns `Ok(<variant>.bin)` whose sha256 equals the manifest entry's, having emitted a `Downloading`→`Done` stage progression driven by live `AssetPackState` callbacks (not a synthetic single event); on a `FAILED` asset-pack state it returns `Err` and writes no final `.bin`. On a non-Android build, the type is absent (cfg-gated) so it cannot be constructed — `PadUnavailable` is unreachable there. |
| E-MOD-14 | `PadProgressBridge` | `model_fetcher/pad.rs:41` | Adapter from `AssetPackState` callbacks → unified `Channel<DownloadProgress>`. Substitutes the current drop-the-send placeholder with an actual `channel.send(...)`. | `struct PadProgressBridge; impl { pub fn forward(&self, state: AssetPackState, channel: &Channel<DownloadProgress>, variant: Variant) }` (`Downloading`→`Downloading`, `Pending`→`Probing`, `Transferring`→`Installing`, `Completed`→`Done`, `Failed(e)`/`Cancelled`→`Failed(e)`) | Calling `forward(AssetPackState::Completed, &ch, v)` causes the channel's consumer to receive a `DownloadProgress{variant: v, stage: Done}`; `forward(Failed("x"), …)` yields `stage: Failed("x")`. Every `AssetPackState` variant maps to exactly one `ProgressStage`. |
| E-MOD-15 | `AssetPackState` | `model_fetcher/pad.rs:17` | PAD callback payload (JNI-marshalled mirror of `com.google.android.play.core.assetpacks.model.AssetPackState` status). | `#[derive(Clone, PartialEq, Eq)] enum { Downloading, Pending, Failed(String), Transferring, Completed, Cancelled }` | Every status code the JNI layer can report from `AssetPackState.status()` maps to exactly one variant (e.g. `STATUS_COMPLETED`→`Completed`, `STATUS_FAILED`→`Failed`), so no PAD status is silently dropped. |
| E-MOD-16 | `MirrorManifest` | `model_fetcher/manifest.rs:35` | Operator-signed catalog of model variants — the trust root for every model download/import. | `#[derive(Serialize, Deserialize)] struct { schema_version: u8, generated_at: i64, variants: Vec<ManifestEntry>, signature: Vec<u8> }` | A `MirrorManifest` whose `signature` was produced by the operator key over its canonical serialization verifies under `MirrorManifestVerifier::verify`; an `E-MOD-17` rejection never marks it valid. `variants` is non-empty for a shipped manifest. |
| E-MOD-17 | `ManifestEntry` | `model_fetcher/manifest.rs:24` | Per-variant row — the hash/url/size triple every fetcher verifies against. | `#[derive(Serialize, Deserialize)] struct { variant: Variant, mirror_url: String, sha256: [u8;32], size_bytes: u64, upstream_url_of_record: String }` | For a given `variant`, the entry's `sha256`/`size_bytes` equal the real artifact's hash/size; `MirrorFetcher` and `MediaImporter` both compare computed sha256 to `entry.sha256` (and treat `[0u8;32]` as "any hash accepted" only for media imports where the operator shipped an unsigned disc). |
| E-MOD-18 | `MirrorManifestVerifier` | `model_fetcher/manifest.rs:43` | ed25519 verifier over `MirrorManifest`. | `struct MirrorManifestVerifier { public_key: VerifyingKey }; impl { new(&[u8;32]) -> Result<Self, VerifyError>; verify(&self, body: &[u8], &MirrorManifest) -> Result<(), VerifyError> }` | `verify(body, manifest)` returns `Ok(())` for a manifest signed by the embedded key, and `Err(BadSignature)` for the same body with a flipped signature byte or a wrong key. |
| E-MOD-19 | `MIRROR_PUBLIC_KEY` | `model_fetcher/manifest.rs:8` | Compile-time-embedded operator ed25519 verifying key (single trust root for models). | `pub const MIRROR_PUBLIC_KEY: &[u8; 32] = include_bytes!("../../assets/mirror_public_key.bin")` | A `MirrorManifest` signed by the matching private key verifies; one signed by any other key fails. The 32 bytes are the same across debug/release builds (committed asset). |
| E-MOD-20 | `VerifyError` | `model_fetcher/manifest.rs:11` | Signature/format failure. | `#[derive(Error)] enum { BadKey, BadSignature, BadJson }` | A malformed 32-byte key → `BadKey`; a signature mismatch → `BadSignature`; unparseable manifest bytes → `BadJson`. |
| E-MOD-21 | `MediaImporter` | `model_fetcher/media.rs:18` | INV-OFFLINE media leg — scans `MEDIA_SEARCH_PATHS` for variant weights, sha256-verifies against the signed `MirrorManifest`, copies into `models_dir`. After a successful import the runtime rebinds to `NullFetcher`. | `struct MediaImporter { models_dir: PathBuf, verifier: MirrorManifestVerifier, manifest: MirrorManifest }; impl { async fn scan_and_import(&self, variant: Variant, progress: Channel<DownloadProgress>) -> Result<PathBuf, FetchError>; fn enumerate_candidates(&self, variant: Variant) -> Vec<PathBuf> }` | With a valid `<variant>.bin` placed under a `MEDIA_SEARCH_PATHS` root whose sha256 equals the manifest entry's, `scan_and_import(v,ch)` returns `Ok(models_dir/<variant>.bin)` (a copy of that candidate), emits `Probing→Verifying→Installing→Done`, and the destination file's sha256 equals `entry.sha256`. With no candidate present it returns `Err(Verify("No offline candidates…"))`. A candidate with a wrong hash is skipped, not trusted. |
| E-MOD-22 | `MEDIA_SEARCH_PATHS` | `model_fetcher/media.rs:12` | Well-known mount roots scanned by `MediaImporter` (per-platform). | `pub const MEDIA_SEARCH_PATHS: &[&str] = &["/media", "/mnt", "/run/media", "/storage"]` (Linux desktop `/media`/`/mnt`/`/run/media`; Android `/storage/<uuid>`; expanded at runtime) | A candidate file placed under any listed root is discovered by `enumerate_candidates`; a file under a non-listed root is not. The list is identical to the pack-catalog `MEDIA_SEARCH_PATHS` (shared convention). |
| E-MOD-23 | `BundledMirrorManifest` | `model_fetcher/manifest.rs` (**extend**) | INV-OFFLINE manifest provenance: the signed `MirrorManifest` baked into the binary (`include_bytes!`) so `MediaImporter`/`MirrorFetcher` can verify hashes **with zero network at first launch**, parallel to `BundledCatalog` (E-PACK-9). Optionally refreshed from the mirror when online. | `pub const BUNDLED_MIRROR_MANIFEST_BYTES: &[u8] = include_bytes!("../../assets/default-mirror-manifest.json"); impl BundledMirrorManifest { pub fn load(verifier: &MirrorManifestVerifier) -> Result<MirrorManifest, VerifyError>; }` (parse → verify signature → return manifest) | `load(verifier)` returns the manifest iff its signature verifies against `MIRROR_PUBLIC_KEY`; a tampered bundled asset yields `Err(BadSignature)` and the app falls back to refusing to trust any model (never returns an unverified manifest). |
| E-MOD-24 | `Channel` (alias) | `model_fetcher/mod.rs:36` | Tauri IPC channel alias used as the progress/cancellation surface. | `pub type Channel<T> = tauri::ipc::Channel<T>;` | The `Channel<DownloadProgress>` passed to `fetch` is the same object the frontend subscribes to; events `send()`-ed on it arrive at the catalog/first-launch UI. |

---

## §7.14 ZIM pack catalog + downloader — end-state entity table

Directory: `src-tauri/src/pack_catalog/`. The **network mirror leg
(`MirrorPackFetcher`, E-PACK-15) is the new entity** that closes the chain;
`PackCatalog::install` is updated to consult it as the third tier.

| ID | Name | file:line | Role (real behaviour) | Signature / fields | Semantic acceptance |
|---|---|---|---|---|---|
| E-PACK-1 | `PackCatalog` | `pack_catalog/mod.rs:61` | Catalog client + local pack registry. `list()` try-order **local → bundled** (INV-OFFLINE). `install()` try-order **local-media → LAN-peer → mirror-HTTP (network)**, short-circuiting on first success and reporting through `PackProgress`. Substitutes the current placeholder `http: Client` / `verifier: ManifestVerifierPlaceholder` with real types. | `struct PackCatalog { http: reqwest::Client, catalog_url: String, packs_dir: PathBuf, storage: Arc<Storage>, bundled: BundledCatalog, local: LocalCatalogLoader, media: PackMediaImporter, lan: LanPeerPackFetcher, mirror: MirrorPackFetcher, verifier: PackCatalogManifestVerifier }; impl { fn list(&self) -> Result<Vec<ZimPack>, PackError>; async fn install(&self, pack_id: &str, progress: Channel<PackProgress>) -> Result<PathBuf, PackError>; fn uninstall(&self, pack_id: &str) -> Result<(), PackError>; fn installed_packs(&self) -> Result<Vec<InstalledPack>, PackError> }` | For a pack present on `MEDIA_SEARCH_PATHS`, `install(id,ch)` returns its path **without** touching the network (LAN/mirror tiers never execute). For a pack absent locally but fetchable from the mirror, `install` returns the mirror-fetched path. For a pack absent everywhere, `install` returns `Err(NotFound)` whose message names all three tiers. `list()` returns the local-signed catalog when present, else the bundled-signed catalog, else an empty vec — never an unverified catalog. |
| E-PACK-2 | `ZimPack` | `pack_catalog/types.rs:8` | Signed catalog entry describing one installable `.zim` — the hash/url triple every install tier verifies against. | `#[derive(Serialize, Deserialize)] struct { id: String, title: String, description: String, language: String, size_bytes: u64, sha256: [u8;32], download_url: String, license: String, upstream_url: String }` | A `ZimPack` reaching `install` has survived catalog-signature verification; its `sha256`/`size_bytes` are the authoritative values the media/LAN/mirror tiers compare computed hashes against. |
| E-PACK-3 | `InstalledPack` | `pack_catalog/types.rs:22` | Local registry row (one per installed pack). | `#[derive(Serialize, Deserialize)] struct { id: String, zim_uuid: Uuid, path: PathBuf, installed_at: i64, sha256: [u8;32] }` | After `install(id)`, `installed_packs()` contains a row with that `id`, a `path` that exists on disk and is readable, and `sha256` equal to the catalog entry's. After `uninstall(id)`, no such row remains and the file is gone. |
| E-PACK-4 | `PackProgress` | `pack_catalog/progress.rs:9` | Channel event for pack install (mirrors `DownloadProgress`). | `#[derive(Serialize, Deserialize)] struct { pack_id: String, bytes_downloaded: u64, bytes_total: u64, stage: PackStage }` | Catalog-screen consumer sees `pack_id` matching the requested pack, monotonic non-decreasing `bytes_downloaded ≤ bytes_total`, terminating in `Done` or `Failed`. |
| E-PACK-5 | `PackStage` | `pack_catalog/progress.rs:26` | Pack install stage machine (superset of model stages: adds `Indexing`). | `#[derive(Serialize, Deserialize, PartialEq, Eq)] enum { Probing, Downloading, Verifying, Installing, Indexing, Done, Failed(String) }` | Successful pack install's stages are a subsequence of `Probing → (Downloading|Verifying) → Installing → [Indexing] → Done`; failures end in `Failed(String)` with a non-empty message. |
| E-PACK-6 | `PackError` | `pack_catalog/mod.rs:32` | Typed pack-op failure. | `#[derive(Error)] enum { Network(String), Verify(String), Storage(io::Error), NotFound(String), AlreadyInstalled(String) }` | A sha256 mismatch → `Verify`; a missing pack id → `NotFound`; an io failure during copy → `Storage`; `Display` renders the inner message. |
| E-PACK-7 | `PackCatalogSignedManifest` | `pack_catalog/manifest.rs:23` | Operator-signed pack catalog (same ed25519 pattern as the model manifest). | `#[derive(Serialize, Deserialize)] struct { schema_version: u8, generated_at: i64, packs: Vec<ZimPack>, signature: Vec<u8> }` | A manifest signed by the operator key verifies under `PackCatalogManifestVerifier::verify`; its `packs` are the only entries `list()` may return from that source. |
| E-PACK-8 | `PACK_CATALOG_URL` | `pack_catalog/mod.rs:7` | Compile-time default catalog origin (user-overridable). | `pub const PACK_CATALOG_URL: &str = match option_env!("ENZIME_PACK_CATALOG_URL") { Some(v) => v, None => "https://enzime.robin.mba/catalog/v1/catalog.json" }` | Built with `ENZIME_PACK_CATALOG_URL=https://y.test`, the constant is `"https://y.test"`; unset → the documented default. |
| E-PACK-9 | `BundledCatalog` | `pack_catalog/bundled.rs:6` | INV-OFFLINE catalog tier: sha-pinned `default-pack-catalog.json` baked into the binary via `include_str!`; parsed as a signed manifest. | `struct BundledCatalog; impl BundledCatalog { pub fn new() -> Self; pub fn load(&self) -> Vec<ZimPack> }` (`load` parses `assets/default-pack-catalog.json` as `PackCatalogSignedManifest`; on parse failure returns `Vec::new()`) | `BundledCatalog::new().load()` returns the `packs` from the committed signed catalog (non-empty for a real release); if the asset is malformed it returns an empty vec rather than panicking, and `list()` then reports no packs (never an unverified catalog). |
| E-PACK-10 | `LocalCatalogLoader` | `pack_catalog/local.rs:7` | INV-OFFLINE catalog tier: load a user-pointed signed `catalog.json` from `packs_dir`; signature-verified before use. First tier consulted by `list()`. | `struct LocalCatalogLoader; impl LocalCatalogLoader { pub fn load(&self, packs_dir: &Path, verifier: &PackCatalogManifestVerifier) -> Vec<ZimPack> }` | With a valid signed `catalog.json` in `packs_dir`, `load(dir, verifier)` returns its `packs`; with a tampered/unsigned one it returns an empty vec (signature failure is treated as "no local catalog", never trusted). |
| E-PACK-11 | `PackMediaImporter` | `pack_catalog/media.rs:15` | INV-OFFLINE install tier 1: scan `MEDIA_SEARCH_PATHS` for `<pack_id>.zim`, sha256-verify against `ZimPack.sha256`, copy into `packs_dir`. | `struct PackMediaImporter; impl { fn enumerate_candidates(&self, pack_id: &str) -> Vec<PathBuf>; async fn scan_and_import(&self, packs_dir: &Path, pack: &ZimPack, progress: Channel<PackProgress>) -> Result<PathBuf, PackError> }` (private `walk_dir` depth-3 search, `compute_sha256`) | With a valid `<pack_id>.zim` under a media root whose sha256 equals `pack.sha256`, `scan_and_import` returns `Ok(packs_dir/<id>.zim)` (copied) emitting `Probing→Verifying→Installing→Done`, and the copy's sha256 equals `pack.sha256`. No candidate → `Err(NotFound)`; wrong-hash candidate → skipped (not trusted). |
| E-PACK-12 | `LanPeerPackFetcher` | `pack_catalog/lan.rs:9` | INV-OFFLINE install tier 2: mDNS-discover sibling EnZIME devices advertising `_enzime-pack._tcp`, fetch the named pack over HTTP from a peer, ed25519-verify against a peer-share manifest signed under `PACK_CATALOG_PUBLIC_KEY`. (End-state behaviour; the current source returns `Err(Network)` pending the LAN transport implementation.) | `struct LanPeerPackFetcher; impl { async fn fetch(&self, pack: &ZimPack, progress: Channel<PackProgress>) -> Result<PathBuf, PackError> }` (resolves peers → GET pack from peer → verify peer-share signature + sha256 → write `packs_dir/<id>.zim` → `Done`) | When a peer advertises the pack and the peer-share manifest verifies, `fetch(pack,ch)` returns `Ok(packs_dir/<id>.zim)` whose sha256 equals `pack.sha256` without any internet egress. With no peer or a peer whose share fails verification, it returns `Err(Network)` so `install` proceeds to the mirror tier. |
| E-PACK-13 | `MirrorPackFetcher` | `pack_catalog/mirror.rs` (**NEW file**) | INV-OFFLINE install tier 3 — the **network leg**: resumable HTTPS download of the pack `.zim` from the signed `download_url`, sha256-verified against `ZimPack.sha256`, atomic-rename. Parallel to `MirrorFetcher` but reports through `PackProgress` and verifies against the catalog entry. | `struct MirrorPackFetcher { http: reqwest::Client, packs_dir: PathBuf }; impl MirrorPackFetcher { pub fn new(http: reqwest::Client, packs_dir: PathBuf) -> Self; pub async fn fetch(&self, pack: &ZimPack, progress: Channel<PackProgress>) -> Result<PathBuf, PackError> }` (`fetch`: resume `<id>.partial` via `Range: bytes=<len>-`; stream body appending, emit `Downloading` per chunk; fsync + sha256 vs `pack.sha256`; match → atomic rename to `<id>.zim`, emit `Done`; mismatch → remove partial + `Err(Verify)`; non-2xx/non-206 → `Err(Network)`) | Given a `ZimPack` whose `download_url` serves bytes whose sha256 equals `pack.sha256`, `fetch(pack,ch)` (a) resumes an interrupted transfer when the server honours `Range`, (b) returns `Ok(packs_dir/<id>.zim)` whose sha256 is `pack.sha256`, (c) emits `Downloading` events advancing to `bytes_total` then `Done`, and (d) leaves no `<id>.partial` on success. On corrupted bytes it removes the partial and returns `Err(Verify)`. It is the **third** tier consulted by `install`, reached only after media and LAN both fail. |
| E-PACK-14 | `PACK_CATALOG_PUBLIC_KEY` | `pack_catalog/manifest.rs:7` | Compile-time-embedded ed25519 verifying key for `PackCatalogSignedManifest` (Bundled/Local/LAN-peer catalogs). Parallel to `MIRROR_PUBLIC_KEY`. | `pub const PACK_CATALOG_PUBLIC_KEY: &[u8; 32] = include_bytes!("../../assets/pack_catalog_public_key.bin")` | A catalog signed by the matching private key verifies; any other key fails. Distinct from `MIRROR_PUBLIC_KEY` (separate operator key per artifact family). |
| E-PACK-15 | `PackCatalogManifestVerifier` | `pack_catalog/manifest.rs:31` | ed25519 verifier for `PackCatalogSignedManifest`. | `struct PackCatalogManifestVerifier { public_key: VerifyingKey }; impl { new(&[u8;32]) -> Result<Self, VerifyError>; verify(&self, body: &[u8], &PackCatalogSignedManifest) -> Result<(), VerifyError> }` | `verify` returns `Ok(())` for an operator-signed catalog and `Err(BadSignature)` for a flipped signature byte; every catalog entry `list()`/`install()` can return has passed this check. |
| E-PACK-16 | `VerifyError` (pack) | `pack_catalog/manifest.rs:9` | Pack-catalog signature/format failure (shared with model `VerifyError` shape). | `#[derive(Error)] enum { BadKey, BadSignature, BadJson }` | Malformed key → `BadKey`; signature mismatch → `BadSignature`; unparseable catalog → `BadJson`. |
| E-PACK-17 | `MEDIA_SEARCH_PATHS` (pack) | `pack_catalog/media.rs:11` | Well-known mount roots scanned by `PackMediaImporter` (same convention as E-MOD-22). | `pub const MEDIA_SEARCH_PATHS: &[&str] = &["/media", "/mnt", "/run/media", "/storage"]` | A `.zim` placed under any listed root is discovered by `enumerate_candidates`; under a non-listed root it is not. |
| E-PACK-18 | `Client`/`ManifestVerifierPlaceholder` (REMOVED) | `pack_catalog/mod.rs:51` & `:55` | **Removed placeholders.** The placeholder `Client` (line 51) and `ManifestVerifierPlaceholder` (line 55) are deleted; `PackCatalog.http` becomes `reqwest::Client` and `PackCatalog.verifier` becomes `PackCatalogManifestVerifier`, and a new `mirror: MirrorPackFetcher` field is added. | (deletion — no row produced) | After the change, `grep -c 'ManifestVerifierPlaceholder' src-tauri/src/pack_catalog/mod.rs == 0` and the `install` chain compiles against the real `reqwest::Client`/`PackCatalogManifestVerifier`/`MirrorPackFetcher` types. |

---

## §7.17 Mobile platform integration — end-state entity table

Directory: `src-tauri/src/platform_android/` (`cfg target_os = "android"` for
the JNI-bearing members). These entities cooperate with the DDL fetchers:
`AndroidForegroundService` keeps the process alive for a minutes-long PAD/model
fetch; `AndroidLifecycle` pauses/downloads on `onPause`; `AndroidPermissions`
gates the storage/network/mic capabilities the fetchers need;
`AndroidShareIntent` is the inbound `.zsc` path (orthogonal to DDL but in this
module). All four currently carry `todo!()`/TODO stubs; the end-state specifies
the real JNI sequences.

| ID | Name | file:line | Role (real behaviour) | Signature / fields | Semantic acceptance |
|---|---|---|---|---|---|
| E-AND-1 | `AndroidPermissions` | `platform_android/permissions.rs:3` | JNI request flow for the capabilities the fetchers depend on: `RECORD_AUDIO` (Gemma-tier mic), `READ_EXTERNAL_STORAGE`/`READ_MEDIA_*` (open ZIM from disk + `PackMediaImporter`), `INSTALL_PACKAGES`/`REQUEST_INSTALL_PACKAGES` (sideload self-update), and `POST_NOTIFICATIONS` + `FOREGROUND_SERVICE_*` (foreground service for PAD/model downloads). Substitutes the current `todo!()`. | `struct AndroidPermissions; impl AndroidPermissions { pub fn request(&self, env: &JNIEnv, perm: &str) -> Result<bool, JniError> }` (builds the `ACTION_REQUEST_PERMISSION` intent or checks `checkSelfPermission`, returns the granted boolean; never `todo!()`) | For an already-granted permission, `request(env, perm)` returns `Ok(true)` without re-prompting; for a denied one it returns `Ok(false)`; for a malformed permission string or detached JNI env it returns `Err(JniError)`. Calling it never panics (`todo!` removed). The fetchers gate their work on these results rather than assuming grant. |
| E-AND-2 | `AndroidLifecycle` | `platform_android/lifecycle.rs:7` | JNI hooks for `onPause`/`onResume` that **pause/cancel active downloads and flush logs** (so a backgrounded PAD/model/pack transfer does not leak resources or get killed mid-write). Substitutes the current `todo!()`. | `struct AndroidLifecycle; impl AndroidLifecycle { pub fn install_hooks(&self, env: &JNIEnv, on_pause: impl Fn() + Send + 'static, on_resume: impl Fn() + Send + 'static) -> Result<(), JniError> }` (registers native callbacks on the Activity's `onPause`/`onResume`; `on_pause` signals the active fetcher to checkpoint + stop, retaining the `.partial`; `on_resume` re-arms for Range-resume / PAD re-fetch) | On a real `onPause`, the registered callback fires and the active `MirrorFetcher`/`MirrorPackFetcher`/`PadFetcher` stream stops with its `.partial` retained (resumable); on `onResume` the next `install`/`fetch` resumes from the partial. Logs are flushed on pause. `install_hooks` returns `Ok(())`; it does not `todo!()`-panic. |
| E-AND-3 | `AndroidShareIntent` | `platform_android/share.rs:6` | JNI handler for inbound `.zsc` share intents → invokes `sidecar_import` (annotation re-entry, §5.5). Orthogonal to DDL but lives in this module. Substitutes the current `todo!()`. | `struct AndroidShareIntent; impl AndroidShareIntent { pub fn register_handler(&self, env: &JNIEnv, import: impl Fn(&Path) -> Result<(), ImportError> + Send + 'static) -> Result<(), JniError> }` | Receiving a `.zsc` via share intent invokes the registered `import` closure with the temp file path; a non-`.zsc` payload is ignored. Registration returns `Ok(())`; no `todo!()`. |
| E-AND-4 | `AndroidForegroundService` | `platform_android/foreground.rs:4` | Foreground service wrapping real `startForegroundService`/`startForeground` so the OS does not kill EnZIME during a long PAD/model/pack download (Android will background-kill a non-foreground app mid-transfer, losing the `.partial`). Substitutes the current bool-flip `start`/`stop`. | `struct AndroidForegroundService { notification_id: u32, active: bool }; impl { pub fn new() -> Self; pub fn start(&mut self, env: &JNIEnv, notification_text: &str) -> Result<(), JniError>; pub fn stop(&mut self, env: &JNIEnv) -> Result<(), JniError>; pub fn is_active(&self) -> bool }` (`start`: JNI `context.startForegroundService(Intent(FgService))` + `service.startForeground(notification_id, ongoing Notification)` with the supplied text; `stop`: `stopForeground(STOP_FOREGROUND_REMOVE)` + `stopSelf()`) | `start(env, text)` raises an ongoing notification (visible to the OS as a foreground service) and `is_active()` becomes `true`; while active, an `onPause` does **not** cause the OS to kill the process during a PAD fetch. `stop(env)` dismisses the notification and `is_active()` becomes `false`. Wraps JNI calls returning `Result`, never silently flipping the bool. |
| E-AND-5 | (PAD JNI bridge) | `model_fetcher/pad.rs:117` (cross-ref) | The PAD JNI call sequence itself is specified in **E-MOD-13** (`PadFetcher::fetch`); `platform_android` only provides the supporting foreground/lifecycle/permission scaffolding. (No new entity here — this row exists to make the cross-module wiring explicit and avoid duplicating PAD behaviour in two places.) | — (see E-MOD-13) | `PadFetcher::fetch` is the sole owner of the `AssetPackManager` JNI sequence; `AndroidForegroundService::start` is invoked around it by the launch/fetch orchestration so the long transfer survives backgrounding. |

---

## Wiring notes (for the orchestrator's CHECKLIST generation)

- **`Cargo.toml` additions**: `reqwest = { version = "0.12", features = ["stream"] }`,
  `jni = { version = "0.21" }` (Android target), `async-trait` (already a dep of
  the trait — confirm), `ed25519-dalek` + `sha2` (already present in both
  `manifest.rs` files — reuse), `tokio` with `io-util` + a `CancellationToken`
  for resumable pause.
- **`AppState::build` wiring** (the I-10(b) swap site): construct
  `PackCatalog` with a real `reqwest::Client`, the `PackCatalogManifestVerifier`
  from `PACK_CATALOG_PUBLIC_KEY`, and a `MirrorPackFetcher`; construct the model
  fetcher chain per channel (Play→`PadFetcher`, else→`MirrorFetcher`) plus
  `MediaImporter` + `NullFetcher` everywhere. Default to `NullFetcher` until a
  first fetch lands (weights-on-disk state), per §5.1.
- **`assets/` additions**: `default-mirror-manifest.json` (signed, for
  `BundledMirrorManifest` / E-MOD-23); `mirror_public_key.bin` and
  `pack_catalog_public_key.bin` already committed.
- **Hermetic Verify (I-10a)** for the resulting CHECKLIST tasks: each task's
  `Verify` asserts only its own file via `grep -c '<exact Do-block content>'`
  or `sha256sum`/`git ls-files` — no transitive `cargo build`/`cargo test`
  (compile gating is CI's job).

---

## Attestation (I-11)

This document is the **complete, stub-free, end-state** behavioural
specification for EnZIME's Dynamic-Download subsystem (modules `pack_catalog`,
`model_fetcher`, `platform_android`): every named entity has an exact
`file:line` target, a real-behaviour role, a signature, and a semantic
acceptance criterion. No `TBD`, no placeholder/signature-only rows, no
"future work" deferrals. It is the replacement content for
`DOCS/ARCHITECTURE.md` §7.9 + §7.14 + §7.17 and the new §5.7 sequence, pending
orchestrator merge and GLM-4.7 coder realisation of the named NEW/hollow
entities (`MirrorFetcher::fetch`, `PadFetcher::fetch`/`PadProgressBridge::forward`,
`MirrorPackFetcher`, `BundledMirrorManifest`, the four `platform_android` JNI
bodies).

- **Scope**: `ddl` module only (`§7.9` + `§7.14` + `§7.17` + `§5.7`). No other
  module architected.
- **Intake**: dispatch file; `src-tauri/src/pack_catalog/*.rs`,
  `src-tauri/src/model_fetcher/*.rs`, `src-tauri/src/platform_android/*.rs`;
  `DOCS/ARCHITECTURE.md` §5.1/§7.9/§7.14/§7.17 only (via sed); catalog screen
  `LIBS/UI/STITCH/screens/03-catalog/`.
- **Authored**: 2026-06-14T00:11:52Z
- **Authoring agent**: GLM-5.1 architect seat (model family GLM, version 5.1),
  module dispatch `ddl`.
- **Status**: airlock deliverable — ready for orchestrator review →
  `DOCS/ARCHITECTURE.md` merge → CHECKLIST generation.
