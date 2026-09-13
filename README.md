# EnZIME

**Current runnable local engine:** [consolidated/README.md](consolidated/README.md).
The `consolidated/` application now connects real ZIM/PDF/EPUB reading, bounded
knowledge-mesh retrieval, persistent notes/revisions, DynDon and local LFM2.5
inference. Run `cd consolidated && npm ci && npm run build && npm start`, or use
the Linux portable bundle. See [verified release evidence and remaining platform gates](consolidated/docs/LOCAL_ENGINE_RELEASE.md).

The older Tauri workspace below is preserved as a platform donor. Its historical
scaffold/compile-status claims do not describe the independently tested local engine.


On-device, offline-first ZIM reader and conversational AI shell.

**Name:** `EnZIME` (capital E-Z-I-M-E, from the [ZIM file format](https://wiki.openzim.org/wiki/OpenZIM)). Not "enzyme."

## Quick start

EnZIME has **two halves that must both be set up**:

| Half | Lives in | Language | Role |
|---|---|---|---|
| Backend | `src-tauri/` | Rust | Tauri shell, on-device AI, ZIM reader, storage, billing |
| UI | `src/` | TypeScript / Vite / React | Window contents — components, state, the bridge to Rust |

Together they make the app. The UI alone won't run; `src-tauri/`
alone has no window contents to display. The dev command starts both
at once.

### Setup

1. **Install JS deps** — from the repo root:
   ```bash
   pnpm install
   ```

   **Why pnpm** (not npm / yarn): the committed lockfile is
   `pnpm-lock.yaml` and CI installs from it; npm or yarn would write
   their own lockfile and silently diverge from CI's resolution. pnpm
   also uses content-addressable storage with hardlinks (smaller disk
   footprint), and its strict resolution prevents phantom-dependency
   bugs — code can only import packages that are explicitly declared.

2. **Check the Rust workspace** — from the repo root:
   ```bash
   cargo check -p enzime
   ```

   > Linux deps required first — see § System dependencies.

3. **Run the dev shell** (Vite + Tauri together) — in `src-tauri/`:
   ```bash
   cargo tauri dev
   ```

   Tauri's dev mode launches the Vite dev server for the root-level
   UI source (`src/`, etc.), opens the desktop window, and rebuilds
   the Rust side on changes. Vite HMR handles the UI side.

> **Current state:** the structural scaffold (Phase W5+, 52 dispatchable
> rows) is complete and committed. Compile-clean hardening (Wave 6) is
> pending — `cargo check -p enzime` currently surfaces accumulated trait /
> dep mismatches that are tracked as a separate fix-forward pass.

## Status

Rearchitected from the EnZIMErgent (Expo/RN) takeout codebase on
**2026-05-14**. Approved scaffolding plan at
`~/.claude/plans/is-this-repo-the-expressive-tower.md`.

Phase progress:

- **Phase 0–6 + Wave 4 (29/29)** — repo, vendoring, V0 entity table,
  Tauri shell wiring, frontend bridge, CI stubs, DOCS/sdk skeletons.
  `cargo check -p enzime` was green at this milestone.
- **Phase W5+ (52/52)** — full implementation scaffold across 7 tiers:
  CI cross-builds, Tauri commands, storage, ZIM v5 reader, AI traits,
  EntitlementSyncBridge, frontend components. Structural completion only;
  concrete impls use `I-10 (b)` placeholder substitution.
- **Wave 6 (pending)** — compile-clean fix-forward, real LiteRT / Piper
  bindings, real ZIM fixture tests, real RC webhook handling.

Predecessors:
- Tauri/Android prior attempt: [`rcheung/EnZIME.archive-2026-05-14`](https://git.robin.mba/rcheung/EnZIME.archive-2026-05-14)
- Expo/RN takeout: `~/forgejo/EnZIMErgent/` (frozen, spec-source only)

## Non-negotiable invariants

- **INV-OFFLINE** — fully usable with airplane mode on. No required
  server, no cloud-LLM default, no remote auth in critical path.
- **INV-NO-EXPO** — no Expo runtime, no Metro, no `expo-*` imports, no
  `app.json`. Tauri 2 + Vite only.
- **INV-NO-APPLE** — no Apple ecosystem. Targets: Linux desktop, Windows
  desktop, Android.

## Stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (vendored in `vendor/tauri/`, pinned v2.11.1) |
| Backend | Rust workspace at repo root |
| Frontend | Vite + React 19 + TypeScript + Zustand |
| ZIM reader | AnZimmermanLib (fresh Rust crate at `src-tauri/anzimmermanlib/rust/`) |
| On-device LLM runtime | LiteRT-LM (vendored in `vendor/litert-lm/`, pinned `1ff29cc6`) |
| LLM weights | Gemma 4 e2b (`models/gemma-4-e2b/`, Forgejo LFS) |
| STT | Gemma 4 e2b's native audio encoder (no separate Whisper) |
| TTS | Piper (in-process) |
| Storage | SQLite via `rusqlite` (bundled, no system libsqlite) |
| Entitlements | RevenueCat + `EntitlementSyncBridge` (separate `bridge/` binary) |
| Local-payload signing | `ed25519-dalek` |

## Repository layout

```
EnZIME/
├── Cargo.toml                       # Rust workspace root
├── package.json                     # JS tooling (Vite, React, TypeScript)
├── src-tauri/                       # Tauri 2 Rust backend
│   ├── src/
│   │   ├── lib.rs, main.rs
│   │   ├── commands.rs              # #[tauri::command] surface (30 cmds)
│   │   ├── state.rs                 # AppState (manage())
│   │   ├── ai/                      # LLM/STT/TTS traits + Null* + LiteRT/Piper/...
│   │   ├── storage/                 # rusqlite stores (chat/annotations/bookmarks/settings)
│   │   └── billing/                 # RevenueCat client, local payload, controller, paywall
│   ├── anzimmermanlib/rust/         # fresh Rust ZIM v5 reader (own crate)
│   ├── tauri.conf.json
│   └── icons/
├── bridge/                          # EntitlementSyncBridge (axum binary)
│   ├── Cargo.toml
│   ├── src/main.rs, webhook.rs, hmac.rs, ledger.rs, rc.rs, health.rs
│   └── README.md
├── src/                             # Vite + React UI source (components, stores, etc.)
│   ├── App.tsx, main.tsx, bridge.ts, theme.ts
│   ├── components/                  # ChatPane, ZimBrowser, SettingsPane, PaywallOverlay, ...
│   └── stores/                      # zustand: app, chat, zim, entitlement, voice
├── vendor/
│   ├── tauri/                       # full upstream, pinned, .git stripped
│   └── litert-lm/                   # full upstream, pinned, .git stripped (prebuilt/ removed)
├── models/
│   └── gemma-4-e2b/                 # 1-byte LFS placeholders; real weights gated on HF auth
├── DOCS/
│   ├── ARCHITECTURE.md              # entity-table index
│   ├── ARCHITECTURE/
│   │   ├── ENTITIES_V0.md           # ~30 row bootstrap subset
│   │   └── ENTITIES_FULL.md         # ~120 row architect pass
│   └── sdk/                         # tauri, litert-lm, anzimmermanlib, gemma-4-e2b, piper
├── scripts/
│   ├── build-windows.sh             # mingw-w64 cross-build
│   ├── build-android.sh             # cargo-ndk
│   ├── version-bump.sh              # MINOR auto-bump (called by CI)
│   └── hooks/pre-push               # refuses LFS blobs to GitHub
├── .forgejo/workflows/build.yml     # Forgejo CI (linux-amd64 + windows-x64-cross + android)
├── .github/workflows/build.yml      # GitHub mirror CI (cargo check only, no LFS)
├── CHECKLIST.md                     # I-4 contract surface (Phase 0–W5+, all [x])
├── CLAUDE.md                        # project-local agent rules
└── LOGS/                            # operator screen-session captures, tracked
```

## System dependencies (Linux dev box)

`cargo` building Tauri requires GTK/WebKit/etc. on Linux:

```bash
sudo apt install -y build-essential pkg-config libssl-dev \
    libgtk-3-dev libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev
```

Windows cross-build (from Linux runner) uses `mingw-w64`; Android uses
`cargo-ndk` + Android NDK. See `scripts/build-windows.sh` and
`scripts/build-android.sh`.

## Development workflow

1. Install JS deps — from repo root: `pnpm install`
2. Start dev shell (Vite + Tauri together) — in `src-tauri/`:
   `cargo tauri dev`
3. Edits to `src-tauri/src/**` rebuild the Rust side; edits to
   `src/**` hot-reload through Vite.
4. Tauri commands live in `src-tauri/src/commands.rs`; the frontend
   invokes them via `src/bridge.ts` (typed wrappers around
   `@tauri-apps/api/core#invoke`).

## Build

CI (self-hosted Forgejo runners) auto-bumps the MINOR component on every
push to `master` and produces per-target artifacts:

- `linux-amd64` — native cargo build
- `windows-x64-cross` — mingw-w64 cross to `x86_64-pc-windows-gnu`
- `android-linux-amd64` — `cargo-ndk` for aarch64 / armv7 / x86_64 JNI libs

Local equivalents — run from the repo root:

- Linux: `cargo build -p enzime --release`
- Windows cross-build: `bash scripts/build-windows.sh`
- Android: `bash scripts/build-android.sh`

## Versioning

`MAJOR.MINOR.BUILD` — semantically versioned but **not semver**, no PATCH.

- **MINOR** autoincrements on every CI invocation (the "experimental
  iteration discriminant" — only way to tell builds apart in a folder
  full of artifacts). CI commits the bump back with `[skip ci]`.
- **MAJOR** is manual.
- Android `versionCode = MAJOR * 100000 + MINOR`.

## Coder substrate

All implementation work is dispatched to **GLM-4.7** via `zclaude-coder-47`
in one-CHECKLIST-row-per-invocation form (per INC-5; GLM-5.1 is
deprecated for coder dispatch in this repo). Architecture decisions and
ambiguity stay in Opus orchestrator + `Agent` subagents.

Example dispatch:

```bash
zclaude-coder-47 --add-dir /home/robin/forgejo/EnZIME \
  -p "$(cat <<'TASK'
Execute CHECKLIST.md task <N.M> <task title>.
Read the Do / Verify / Accept clauses verbatim. Touch only files listed
in Do. After verification, commit per I-10 (c) with message
'<conventional-type>(<scope>): <N.M> <task title>', then flip the marker
to [x]. ESCALATE on any missing entity, file, or signature — do NOT
self-rescue.
TASK
)"
```

See `CLAUDE.md` § "Coder dispatch — GLM-4.7, one-task atomic" and the
global routing rules in `~/.claude/CLAUDE.md` and
`~/.claude/MODEL_ROUTING.md`.

## Branching & hosting

- Default branch: **`master`** (never `main`).
- `origin` = Forgejo (`git@git.robin.mba:rcheung/EnZIME.git`) — canonical,
  sole LFS host.
- `github` = `git@github.com:Robin-s-AI-World/EnZIME.git` — mirror for
  external tool access (Jules, Codex). **No LFS blobs ever push to
  GitHub** (per-remote LFS disable + `scripts/hooks/pre-push` blocker).
- Repository visibility: **private by default** everywhere, per global
  rule precipitated by the 2026-05-14 credential-leak incident
  (`LOGS/screenlog.0`). `LOGS/` itself stays tracked (solopreneur-mode
  full-history rule) — both remotes are private.

## Other folders in this repo (parked)

- `creator/` and `extension/` — scaffolded but currently parked
  side-projects. Not part of the EnZIME product; not currently in
  development. Ignore unless explicitly working on one of them.

## License

TBD.
