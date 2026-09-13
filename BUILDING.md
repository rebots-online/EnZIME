# Build EnZIME from source

13 September 2026. Platform priority, explicitly confirmed by the owner:

1. Android, offline first.
2. Offline desktop: Linux and Windows.
3. Web application.

The Node application in `consolidated/` is a tested local-engine reference, not
the primary product platform and not evidence that the Android application is
buildable or that the same functionality has been integrated into native Rust.
There is no verified all-platform build command from this work.

## Local repository locations

The single canonical checkout for ongoing EnZIME work is:

```text
/home/robin/Desktop/devProjects/EnZIME
```

This is a standalone Git repository on `master`, with its own `.git` directory.
It does not depend on the staging clone. Use this path for builds, edits and
future agent sessions. The earlier worktrees under
`/home/robin/Admin-Manual/.staging/enzime-pr2-pr3-20260913/` are historical
working copies, not the canonical location.

GitHub repository: https://github.com/rebots-online/EnZIME

PR #2 merged as `958172f6b21bed842a7f6880859154e2ca559694`; PR #3 merged
as `c1157716f586a4f1594729e5c621c450c96b78c2`. At completion of the merge,
the PR3 worktree's committed files matched GitHub master. The canonical checkout
was created from that merged state. Build instructions and README corrections
belong in this canonical repository and are maintained alongside the code.

Other existing Git checkouts were found at `/home/robin/github/EnZIME` and
`/home/robin/forgejo/EnZIME`. Their revisions and local modifications were not
checked or synchronized in this task. Do not assume they contain the merged
changes. Preserve local work before updating either checkout.

The current app workspace directory
`/home/robin/CascadeProjects/EnZIME-Reboot-v3-20jul2026` has no `.git` entry;
it is not the checkout used for these builds.

## Shared native setup

Run native commands from the repository root, not `consolidated/`:

```bash
cd /home/robin/Desktop/devProjects/EnZIME
pnpm install --frozen-lockfile
pnpm run build
```

Install a compatible Node/pnpm toolchain and Rust through rustup beforehand.
The root package uses pnpm/Vite and includes the Tauri CLI. The separate
`consolidated/` package uses npm/esbuild; do not interchange their lockfiles.

Build Vite explicitly: `src-tauri/tauri.conf.json` currently has an empty
`beforeBuildCommand` and expects `../dist`. A successful frontend build is
not a successful Rust/native package build.

The native workspace is preserved from earlier work. Its README reports
compile-hardening and runtime-integration gaps; native compilation was not
attempted during the PR review repair or this documentation task. Real model
weights, native inference bindings and platform dependencies must be available;
historical scaffold completion and model placeholders do not satisfy that gate.

## 1. Android: primary target

Prerequisites: JDK, Android SDK/platform/build tools, an installed NDK and the
matching Rust Android targets. Use the versions required by the committed
Android Gradle project rather than selecting unrelated latest versions.
The generated project already exists at `src-tauri/gen/android/`, including
its Gradle wrapper. Do not regenerate it casually and overwrite configuration.

Set the actual installed SDK/NDK locations, for example:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
# Replace the placeholder with the installed, project-compatible NDK version.
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/<installed-version>"
export NDK_HOME="$ANDROID_NDK_HOME"
rustup target add aarch64-linux-android
```

Intended Tauri Android CLI build sequence, NOT executed/qualified in this task:

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm tauri android build --target aarch64 --apk --features sideload
# For the Play distribution, with its signing and billing setup configured:
pnpm tauri android build --target aarch64 --aab --features play
```

The feature names above are those requested by the existing Android script;
their current native compilation and distribution configuration remain to be
qualified. Add other supported ABIs deliberately after the ARM64 build works.
Configure release signing before expecting an installable/distributable release.
APK/AAB output belongs under `src-tauri/gen/android/app/build/outputs/`.

### Existing script: not a verified build path

`scripts/build-android.sh` exists and attempts cargo-ndk builds followed by
APK/AAB packaging. Its current packaging commands are
`pnpm tauri build --apk ...` and `pnpm tauri build --aab ...`: they omit the
`android` subcommand. It also does not explicitly build Vite before packaging.
Do not treat its existence or its final output listing as proof of a successful
Android build. This task documents the issue; it does not repair the script or
claim the intended command sequence above passes.

### Offline Android acceptance

Provision permitted content and an actual on-device runtime/model first. Then
test the installed APK with network access disabled: launch, reopen ZIM/PDF/EPUB
content, search/read, persist notes and position, restart, and perform local
inference if that feature is included. No developer-machine Node server, LAN
model endpoint, cloud model or online authentication may be required for the
core offline experience. Android storage/SAF permissions and model lifecycle
need real-device acceptance. The Node reference tests do not establish this.

## 2. Offline desktop

### Linux native Tauri package

Install the Linux development dependencies documented by the repository:

```bash
sudo apt install build-essential pkg-config libssl-dev libgtk-3-dev \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev
pnpm install --frozen-lockfile
pnpm run build
pnpm tauri build
```

This is the intended native packaging path, not a run result. A plain
`cargo build -p enzime --release` builds Rust but is not equivalent to producing
a complete installer. Use the artifact locations reported by Tauri; workspace
Cargo output normally lives beneath the root `target/` directory unless
`CARGO_TARGET_DIR` overrides it. Qualify native compile/inference dependencies
and packaged offline behavior before calling a desktop release ready.

### Windows native package

The simplest intended path is a Windows build host with the supported Rust,
MSVC/Windows SDK and Tauri prerequisites, followed by the same root commands:
`pnpm install --frozen-lockfile`, `pnpm run build`, `pnpm tauri build`.
Provision the WebView runtime appropriately for offline installation.

`scripts/build-windows.sh` also exists for Linux cross-building. It uses xwin,
cargo-xwin and the MSVC target, then attempts Tauri bundling. Despite its
comments/output text, a Windows MSI produced successfully on Linux has not been
established here. Toolchain availability, installer tooling, frontend build
ordering and artifact paths need qualification; do not advertise this script
as a verified all-in-one Windows installer build.

### Tested local-engine reference (not native-platform completion)

With Node 24+, the separate reference can be built and run locally:

```bash
cd consolidated
npm ci
npm run build
npm start
```

It serves `http://127.0.0.1:4173`. Its merged code passed 223 tests and the build
during the PR integration; those were reference-app tests, not Android/native
acceptance. Runtime/model weights must be installed locally for local inference.

A Linux portable reference packager also exists. From `consolidated/`:

```bash
node scripts/package.mjs \
  --node-license /path/to/exact-node-release/LICENSE \
  --llama-runtime /path/to/llama-b10809 \
  --out /path/to/releases
```

Keep the matching official runtime archive beside its extracted directory and
provide the exact Node license as described in `docs/LOCAL_ENGINE_RELEASE.md`.
Model weights are not bundled. This packager was not run in this task. It
packages the local reference, not the Android app or native desktop parity.

## 3. Web application

The root `pnpm run build` produces the Vite frontend, but that UI depends on
native Tauri commands. It is not thereby a standalone browser application.
Likewise, `consolidated/` requires its Node backend and is not a static web export.

The browser-native storage/archive/model implementation and offline acceptance
remain release work. Do not deploy either frontend alone and claim equivalent
offline reading, persistence or inference. There is no verified standalone web
release build documented by the merged work.

## Open product acceptance: library downloader and DynDon

Owner report, 13 September 2026: the library downloader offers no useful
catalogue and search does not work. The expected experience is an informative
library browser comparable in usefulness to Emergent/Kiwix-style downloaders,
not merely a search bar. These are unresolved product acceptance failures;
their root cause has not been diagnosed in this documentation task.

Required work before calling this flow complete:

- Provide a populated, browsable catalogue without requiring a search query.
  Entries should expose useful selection information: title/description,
  language, source/publisher, edition/date, subject, full download size and
  installed/download state. Missing metadata must be explicit, not invented.
- Make catalogue search actually return selectable downloads, with useful
  filters and distinct loading, empty-result, offline and error states. Installed
  library search must remain usable offline; remote catalogue acquisition and
  downloads must not be confused with offline reading readiness.
- Expose persistent DynDon defaults in Settings, using the existing planner's
  supported vocabulary and validation. Make the shared storage budget, safety
  reserve and supported coverage/planning choices understandable to the user.
- Before each download, show the effective defaults and allow supported
  per-download overrides. Explain whether a choice changes only this job or
  explicitly saves a new default; never change global defaults silently.
- Show the selected plan, dependency/completeness implications, estimated
  transfer size and peak/final disk requirements before starting. Do not offer
  arbitrary archive subsets where the source lacks a supported manifest or
  generation route. Distinguish selected-plan completion from full-library
  availability.
- Persist the selected per-job configuration for inspection and restart.
  Confirm actual acquisition/adoption, progress, pause/resume/release, storage
  accounting and preservation of installed content, notes and pinned material.
- Exercise the complete catalogue-to-download-to-offline-read flow on the
  Android primary target, including default persistence and two downloads with
  different overrides. A mock catalogue or passing planner unit tests does not
  establish this acceptance.

The merged work includes DynDon planning, reservation, recovery and API repairs.
It does not establish that the owner's catalogue UX, working search, persistent
defaults and per-download configuration requirements are complete. Keep them
open and prioritized alongside the Android build pipeline. Do not mark them
implemented or verified from the 223-test reference-engine result alone.

## What this task did not do

No dependencies were installed, builds/tests run, or native scripts repaired
during documentation and canonical checkout setup.
The canonical checkout was subsequently prepared at the owner's requested path;
other existing checkouts were preserved. This guide records
the observed build surfaces, intended platform commands and known gaps while
preserving quota. Next implementation priority is a reproducible, actually
tested Android APK pipeline, not promotion of the reference web UI.
