# Project Index: EnZIME Suite

Generated: 2026-05-26

> **Parity:** this file is paired with `PROJECT_INDEX.json` in the project root.
> Both must share the same `generated` date and agree on all facts. If they
> diverge, regenerate both with `/sc:index-repo`.

---

## Project Overview

**EnZIME Suite** — three apps + shared infrastructure in one repo.
- **Reader** (`mba.robin.enzime`) — offline-first ZIM consumer, on-device Gemma 4, prepper market. Tauri 2 + Vite/React frontend, Rust backend.
- **Creator** (`mba.robin.enzime.creator`) — ZIM producer/publisher (enterprise + home).
- **Extension** — Chrome MV3 page-clipper feeding Creator.

Stack: Rust backend (Tauri 2), TypeScript/React frontend, vendored Tauri + LiteRT-LM.
License: AGPL-3.0-or-later. Default branch: `master`.

---

## File Tree (top-level, non-vendor)

```
├── bridge/           EntitlementSyncBridge (standalone Axum webhook service)
├── creator/          Creator app (scaffolded)
├── DOCS/             Architecture, specs, SDK docs
├── extension/        Chrome MV3 extension
├── models/           Gemma 4 e2b weights (LFS)
├── scripts/          Build, signing, version-bump scripts
├── src/              React frontend (components, stores, theme)
├── src-tauri/        Rust backend (Tauri 2 entry, all Rust modules)
├── vendor/           Pinned Tauri 2 + LiteRT-LM sources
├── CHECKLIST.md      Implementation task contract
├── CLAUDE.md         Project-local agent rules
├── Cargo.toml        Workspace root
└── DOCS/ARCHITECTURE.md  Entity table + architectural spec
```

---

## Entry Points

| Entry | Path | Description |
|---|---|---|
| Reader Rust binary | `src-tauri/src/main.rs` | Calls `enzime::run()` |
| Reader Tauri lib | `src-tauri/src/lib.rs` | Wires AppState, registers commands, runs Tauri builder |
| Frontend | `src/App.tsx` | React root (currently stub) |
| Bridge binary | `bridge/src/main.rs` | Axum webhook server for entitlement sync |
| Creator binary | `creator/src-tauri/src/main.rs` | Scaffolded |
| Extension BG | `extension/src/background.ts` | Chrome MV3 service worker |
| Extension content | `extension/src/content.ts` | Chrome MV3 content script |

---

## Core Modules (Rust Backend — Reader)

### AI subsystem (`src-tauri/src/ai/`)
- `mod.rs` — traits: `LlmRuntime`, `AudioEncoder`, `Tts`
- `litert/mod.rs` — LiteRT-LM Gemma backend
- `litert/config.rs` — LiteRT config types
- `probe.rs` — `Variant` enum + hardware probe
- `gemma_audio.rs` — Gemma audio encoder impl
- `audio.rs` — audio pipeline types
- `context.rs` — LLM context window management
- `sampler.rs` — token sampling strategies
- `tokens.rs` — tokenizer utilities
- `null.rs` — no-op impls for unsupported hardware

### Billing (`src-tauri/src/billing/`)
- `mod.rs` — `EntitlementController` trait
- `mode.rs` — `BillingMode` enum (play/sideload/desktop)
- `paywall.rs` — paywall gate logic
- `revenuecat.rs` — RevenueCat REST client
- `local_payload.rs` — local entitlement payload parsing
- `restore.rs` — purchase restore flow + `RestoreResult`

### Pack catalog (`src-tauri/src/pack_catalog/`)
- `mod.rs` — `PackCatalog` trait + coordinator
- `manifest.rs` — pack manifest types + verification
- `bundled.rs` — bundled default pack resolution
- `local.rs` — local filesystem pack source
- `lan.rs` — LAN peer pack discovery
- `media.rs` — media-type pack filtering
- `progress.rs` — `PackProgress` event stream
- `types.rs` — `ZimPack` + related types

### Sidecar (`src-tauri/src/sidecar/`)
- `mod.rs` — `Sidecar` + `SidecarMeta` types
- `chunk.rs` — chunked transfer encoding
- `codec.rs` — CBOR/JSON codec
- `identity.rs` — ed25519 identity management
- `payload.rs` — `Payload` struct
- `sign.rs` — `SidecarSigner` (ed25519 signing)
- `store.rs` — `SidecarStore` + `SidecarIndex`
- `trust.rs` — `TrustLevel`, `TrustEntry`, `TrustDb`
- `verify.rs` — signature verification
- `voice_blob.rs` — `VoiceClipBlobStore`

### Model fetcher (`src-tauri/src/model_fetcher/`)
- `mod.rs` — `ModelFetcher` trait
- `manifest.rs` — model manifest parsing
- `mirror.rs` — HTTP mirror download
- `null.rs` — no-op fetcher
- `progress.rs` — `DownloadProgress` event stream
- `pad.rs` — padding/alignment for model files
- `media.rs` — media-type model filtering

### Storage (`src-tauri/src/storage/`)
- `mod.rs` — `Storage` struct (SQLite via rusqlite)
- `annotations.rs` — annotation CRUD
- `bookmarks.rs` — bookmark CRUD
- `chat.rs` — chat message persistence
- `migrations.rs` — schema migrations
- `settings.rs` — key-value settings store

### Other backend modules
- `commands.rs` — All Tauri `#[tauri::command]` handlers (E-CMD-1 through E-CMD-N)
- `state.rs` — `AppState` struct (global state container)
- `error.rs` — `AppError` enum
- `launch/` — device capability probe + variant picker
- `app_update/` — self-update (manifest, verifier, desktop/Android channels)
- `global_search/` — full-text search + ranking
- `paths/mod.rs` — `AppPaths` (app data/config directories)
- `log/mod.rs` — `EnzimeLogger`
- `panic/mod.rs` — panic handler (E-PANIC-1)
- `window_state/mod.rs` — window geometry persistence
- `platform_android/` — Android-specific (foreground service, lifecycle, permissions, share)

### Bridge (`bridge/src/`)
- `main.rs` — Axum server entry
- `lib.rs` — router + shared types
- `webhook.rs` — Stripe/BTCPay webhook handlers
- `rc.rs` — RevenueCat REST client
- `hmac.rs` — HMAC webhook verification
- `ledger.rs` — idempotent entitlement ledger
- `health.rs` — `/health` endpoint

---

## Frontend (React/TypeScript)

### Components (`src/components/`)
AnnotationsList, ArticleViewer, BookmarksList, ChatPane, FirstLaunchGate,
GlobalSearchBar, MediaImportFlow, MessageItem, MessageList, ModelDownloadProgress,
PackCatalogBrowser, PackInstallProgress, PaywallOverlay, PeerTrustManager,
SettingsPane, SidecarExportButton, SidecarImportFlow, UpdateNotification,
VariantBadge, VariantOverridePanel, ZimBrowser

### Stores (`src/stores/`)
app, chat, entitlement, pack, sidecar, variant, zim

### Other
- `src/theme.ts` — theme configuration
- `src/bridge.ts` — Tauri IPC bridge

---

## Configuration

| File | Purpose |
|---|---|
| `Cargo.toml` | Workspace root (members: src-tauri, anzimmermanlib, bridge) |
| `src-tauri/Cargo.toml` | Reader crate (features: play/sideload/desktop) |
| `src-tauri/tauri.conf.json` | Tauri 2 config (identifier: `mba.robin.enzime`) |
| `bridge/Cargo.toml` | EntitlementSyncBridge crate |
| `.forgejo/workflows/build.yml` | Forgejo CI |
| `.github/workflows/build.yml` | GitHub Actions mirror CI |

---

## Build Features (Reader)

| Feature | Description |
|---|---|
| `desktop` (default) | Local filesystem + optional mirror download |
| `play` | Play Billing via RevenueCat |
| `sideload` | Direct HTTP download from mirror |

---

## Key Dependencies (Rust)

- `tauri` 2 (vendored) — app framework
- `anzimmermanlib` — shared ZIM read library
- `rusqlite` 0.31 — embedded SQLite
- `ed25519-dalek` 2.1 — sidecar signing
- `reqwest` 0.12 — HTTP client
- `tokio` 1 — async runtime
- `serde`/`serde_json`/`ciborium` — serialization
- `axum` 0.8 (bridge) — webhook server

---

## Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `build-android.sh` | Android APK build |
| `build-linux.sh` | Linux desktop build |
| `build-windows.sh` | Windows desktop build |
| `sign-release.sh` | Release signing |
| `sign-mirror-manifest.sh` | Mirror manifest signing |
| `sign-pack-catalog.sh` | Pack catalog signing |
| `version-bump.sh` | MINOR version autoincrement |
| `hooks/pre-push` | Pre-push guard (LFS to GitHub block) |

---

## Gotchas

1. **No LFS to GitHub** — `scripts/hooks/pre-push` blocks LFS blobs; GitHub is mirror-only.
2. **INV-OFFLINE** — every feature must work in airplane mode; online is additive only.
3. **INV-NO-EXPO** — no Expo/RN runtime; Tauri 2 + Vite only.
4. **INV-NO-APPLE** — no Apple targets on ideological grounds.
5. **Vendored SDKs** — Tauri and LiteRT-LM are source-vendored, not crate deps.
6. **Three flavors** — `desktop`/`play`/`sideload` are compile-time features, not runtime toggles.
7. **Versioning** — MAJOR.MINOR.BUILD (no PATCH); MINOR autoincrements on every CI invocation.
8. **Forgejo = canonical** — SSH remotes only (`git@git.robin.mba`); HTTPS can 504 on large pushes.
