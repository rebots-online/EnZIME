<!-- CURATED PARTIAL §7.8 build/CI/packaging + §7.18 credentials. GLM-5.1 (`build`); Opus-reviewed/accepted 2026-06-13. ~50 entities, semantic Accept = observable build outcome; entry-point lib.rs cfg fetcher-pad→play fix; 3 platforms (Linux AppImage/Windows MSI-xwin-qemu/Android AAB+APK); credentials REPORT-ONLY per I-15. Carry-forward (orchestrator/operator decisions): RF-1 keystore alias upload-vs-helloword; RF-3 version-bump Cargo sed is a no-op (workspace.version); RF-5 versionCode MAJOR=0 hardcoded vs seed 100000 → bump aborts (real bug); RF-6 upload-artifact path vs --target output; RF-2 android runner label; RF-4 storeFile path; RF-7 CI PR triggers. -->

# §7.8 + §7.18 — REPLACEMENT (module `build`, GLM-5.1 architect airlock, TC6)

Behavioural end-state for the **build / CI / packaging** surface (§7.8) and the
**credentials register** (§7.18). Stack: Tauri 2 + Rust (edition 2021, rust-version
1.77) + Vite/React. Bundle identifier `mba.robin.enzime`. Three platforms — Linux
(AppImage), Windows (MSI, cross-compiled from Linux via cargo-xwin, qemu-validated),
Android (AAB for Play, APK for sideload). INV-NO-EXPO (no Expo/Metro) and INV-NO-APPLE
(no iOS/macOS/Catalyst) honored: targets are Linux desktop, Windows desktop, Android
only. I-16 dev port `38417` (high, non-patterned) baked into both `vite.config.ts` and
`tauri.conf.json`. No TBD / placeholder / signature-only rows (I-11).

Every row carries a **semantic Accept** clause (I-12): the observable build/CI outcome
(an artifact is emitted, a cross-compile finishes, a manifest verifies, a script fails
closed when a precondition is violated), **never** grep-for-existence. A grep Verify in
the checklist documents intent only; it is not a runtime gate.

---

## Entry-point fix (FLAGGED — surfaces prior rejected work)

The Tauri 2 entry point is `src-tauri/src/lib.rs::run()` (`E-BLD-38`). An earlier coder
cfg-gated a **ghost** feature `fetcher-pad` that has no row in `Cargo.toml`'s `[features]`;
that path is **REJECTED**. The end-state flavour selection matches the real cargo features
exactly — `default = ["desktop"]`, plus `play`, `sideload`, `desktop`
(`src-tauri/Cargo.toml:17-24`):

```rust
#[cfg(feature = "play")]
fn build_state_for_flavor() -> Result<AppState, AppError> { AppState::build_for_play() }

#[cfg(all(feature = "sideload", not(feature = "play")))]
fn build_state_for_flavor() -> Result<AppState, AppError> { AppState::build_for_sideload() }

#[cfg(all(feature = "desktop", not(feature = "sideload"), not(feature = "play")))]
fn build_state_for_flavor() -> Result<AppState, AppError> { AppState::build_for_desktop() }
```

`run()` resolves `AppPaths`, installs the panic handler (E-PANIC-1), initialises the
logger (E-LOG-1), builds `AppState` for the active flavour, registers the **51** command
handlers in one `tauri::generate_handler!`, then runs the Tauri builder. `main.rs` is a
thin `fn main() { enzime::run(); }` (`#![cfg_attr(not(debug_assertions),
windows_subsystem = "windows")]` so release Windows builds have no console window).

---

### §7.8 Build / CI / packaging (`src-tauri/Cargo.toml`, root, workflows, scripts)

| ID | Name | Target | Role | Note |
|---|---|---|---|---|
| E-BLD-1 | Root `Cargo.toml` | `Cargo.toml` | Workspace + canonical version | `resolver = "2"`; members `src-tauri`, `src-tauri/anzimmermanlib/rust`, `bridge`; `exclude` `vendor/tauri`, `vendor/litert-lm`. `[workspace.package] version = "0.1.0"` (overwritten to `MAJOR.MINOR.BUILD` by E-BLD-7 at stamp time), `edition 2021`, `rust-version 1.77`, `license AGPL-3.0-or-later`, `repository https://git.robin.mba/rcheung/EnZIME`. `[profile.release]` `lto="thin"`, `codegen-units=1`, `strip=true`. `[patch.crates-io]` pins `tauri` → `vendor/tauri/crates/tauri` and `litert_lm_deps` → `vendor/litert-lm`. **Accept:** `cargo metadata --no-deps` resolves the 3 members and the 2 excludes, and `cargo build` in the workspace compiles the vendored Tauri from source. |
| E-BLD-2 | `src-tauri/Cargo.toml` | `src-tauri/Cargo.toml` | Main bin+lib crate; cargo features `play`/`sideload`/`desktop` | `[lib] name="enzime"`, `crate-type = ["staticlib","cdylib","rlib"]`; `[[bin]] name="enzime" path="src/main.rs"`. `[features] default=["desktop"]`, `play`/`sideload`/`desktop` mutually exclusive via cfg gating in `lib.rs` (E-BLD-38). Key deps: `tauri` (workspace, patched to vendored), `anzimmermanlib` (path), `rusqlite` (bundled), `ed25519-dalek`, `reqwest`, `tokio`, `tracing-appender`; build-dep `tauri-build`. **Accept:** `cargo check -p enzime --no-default-features --features desktop`, `…--features sideload`, `…--features play` each compile; enabling more than one at once leaves exactly one `build_state_for_flavor` body compiled (cfg gating), observable as a single resolved AppState. |
| E-BLD-3 | `src-tauri/build.rs` | `src-tauri/build.rs` | `tauri_build::build()` invocation | Reads `tauri.conf.json` at compile time; wired by `[build-dependencies] tauri-build`. **Accept:** removing `tauri.conf.json` breaks the build at `tauri_build::build()` (it fails closed), proving the script reads it; with the config present, `cargo build -p enzime` succeeds. |
| E-BLD-4 | `src-tauri/tauri.conf.json` | `src-tauri/tauri.conf.json` | Tauri config: productName=`EnZIME`, identifier=`mba.robin.enzime`, window, ACL/CSP, Android bundle | `version="0.1.0"` (stamped), `build.devUrl="http://localhost:38417"` (E-BLD-45), `frontendDist="../dist"`. Window `main`: 1280×800, min 800×600, resizable. `security.csp` pins `default-src 'self'`. `bundle.targets="all"`, `bundle.android = { "minSdkVersion": 26, "versionCode": 100000 }` (E-BLD-40 — versionCode overwritten by E-BLD-43). **Accept:** `cargo tauri build` consumes the file (window title is `EnZIME`, identifier `mba.robin.enzime` in the produced bundle); an invalid CSP/identifier fails the Tauri schema check at build time. |
| E-BLD-5 | `.forgejo/workflows/build.yml` | `.forgejo/workflows/build.yml` | Forgejo CI; primary build matrix | Matrix `platform × flavor`: `linux-amd64×{desktop,sideload}`, `windows-x64-cross×{desktop,sideload}`, `android×{sideload,play}`. Exclusions: Android has no desktop variant; Play flavour is Android-only (Play Asset Delivery). `runs-on: ${{ matrix.platform }}` with bare Forgejo labels (no `self-hosted`); `container.image` = the CC5-baked image per platform (E-CI-IMG-1/2/3). Steps: `actions/checkout@v4` → `bash ${{ matrix.build_script }} ${{ matrix.flavor }}` → `actions/upload-artifact@v4`. Triggers: `push: branches:[master]` + `workflow_dispatch`. **Accept:** a push to `master` fans out all six jobs; each job's build script (E-BLD-8/9/10) emits its platform artifact and the upload step captures it (artifact list is non-empty). |
| E-BLD-6 | `.github/workflows/build.yml` | `.github/workflows/build.yml` | GitHub mirror CI; cargo check only, LFS disabled | `cargo-check` job, `runs-on: [self-hosted, linux-amd64]` (CT 111), `checkout` with `lfs: false`, installs `build-essential` then `cargo check` in `src-tauri`. Triggers `push: branches:[master]` + `pull_request`. **Accept:** the job compiles the crate with no LFS fetch (clone succeeds with `lfs:false`); a syntax error in source turns the job red. |
| E-BLD-7 | `scripts/version-bump.sh` | `scripts/version-bump.sh` | Bump MINOR per CI invocation; commit back with `[skip ci]` | Reads `MAJOR.MINOR` from `package.json` (MAJOR hardcoded, manual milestone; MINOR auto-increments when MAJOR unchanged, resets to 0 on MAJOR bump), `BUILD_NUM = epoch_minutes % 100000`. Stamps `package.json`, `src-tauri/tauri.conf.json`, `src/version.json`, and the Cargo manifest. Honors an optional `release.lock` (frozen MAJOR/MINOR/BUILD for coordinated multi-platform releases). `git commit -m "chore(version): bump to <V> [skip ci]"` recursion guard. **Accept:** running the script advances `package.json`'s MINOR by exactly one (or applies the lock) and produces a `[skip ci]` commit; re-running on the same inputs is monotonic. (See reconciliation flag RF-3 on the Cargo target.) |
| E-BLD-8 | `scripts/build-android.sh` | `scripts/build-android.sh` | NDK + cargo-ndk wrapper → AAB (Play) + APK (sideload) | Init guard: exits 1 if `src-tauri/gen/android` missing (directs to E-BLD-39). Resolves `ANDROID_NDK_HOME`. Builds native libs for `aarch64-linux-android` + `armv7-linux-androideabi` at `--platform 26 --no-strip -o ../jniLibs`. `pnpm tauri build --apk --features sideload` and `--aab --features play`. Zips unstripped `.so` → `EnZIME-Android-v${VERSION}-native-debug-symbols.zip` (E-BLD-42). **Accept:** `bash scripts/build-android.sh` produces an `.apk` (sideload) and `.aab` (play) under `gen/android/app/build/outputs/{apk,bundle}/` and the debug-symbols zip; with `gen/android` absent it exits 1 before touching NDK. |
| E-BLD-9 | `scripts/build-windows.sh` | `scripts/build-windows.sh` | mingw-w64 + cargo-xwin wrapper → MSI via cargo-wix | Target `x86_64-pc-windows-msvc`; `XWIN_CACHE_DIR`/`XWIN_ARCH_DIRS=x64`; `xwin splat` on first run. `cargo xwin build --release` (MSVC CRT on Linux from cached headers), then `pnpm tauri build --target x86_64-pc-windows-msvc` for the MSI. qemu-validated per release goal. **Accept:** `bash scripts/build-windows.sh` emits `enzime.exe` and a `*.msi` under `target/x86_64-pc-windows-msvc/release/{,bundle/msi/}`; missing `xwin` fails closed at the install check. |
| E-BLD-10 | `scripts/build-linux.sh` | `scripts/build-linux.sh` | cargo tauri build → AppImage | `pnpm install --frozen-lockfile`; `cargo tauri build --target x86_64-unknown-linux-gnu --appimage`. **Accept:** `bash scripts/build-linux.sh` emits a `*.AppImage` under `target/x86_64-unknown-linux-gnu/release/bundle/appimage/`. |
| E-BLD-11 | `scripts/sign-mirror-manifest.sh` | `scripts/sign-mirror-manifest.sh` | Enumerate variant artifacts, sha256, ed25519-sign mirror manifest | Sources `MIRROR_PRIV_HEX` from `.env` (E-CRED-2); requires 64-hex-char (32-byte) key. Enumerates AppImage/MSI/APK/AAB, records `flavor/target/format/filename/sha256/size_bytes`, signs the manifest body with OpenSSL ed25519, writes `mirror-manifest.json`, self-validates JSON with `jq`. **Accept:** with artifacts present and a valid key, the script writes a `mirror-manifest.json` whose `signature` verifies against the corresponding public key; with `MIRROR_PRIV_HEX` unset or mis-shaped it exits 1 before writing. |
| E-BLD-12 | `scripts/sign-release.sh` | `scripts/sign-release.sh` | Sign release artifacts (AppImage/MSI/APK) | Detached ed25519 (`RELEASE_PRIV_HEX`) signatures → `.tmp/signatures/*.sig` for AppImage + MSI. APK/AAB signed with `jarsigner -sigalg SHA256withECDSA -digestalg SHA-256` using the reused keystore (`KEYSTORE_PATH`/`KEYSTORE_PASSWORD`/`KEY_PASSWORD`, alias `helloword`) and `jarsigner -verify`-checked. **Accept:** each produced `.sig` is a valid ed25519 signature over the artifact sha256; each APK/AAB passes `jarsigner -verify`; missing any keystore credential exits 1. (See RF-1 on alias.) |
| E-BLD-13 | `scripts/hooks/pre-push` | `scripts/hooks/pre-push` | Block LFS blobs from pushing to GitHub mirror | Installed as a git pre-push hook. Scans pushed objects to the `github` remote for the LFS pointer signature (`version https://git-lfs.github.com/spec/v1`); exits 1 with a diagnostic if found. No-op for the `origin` (Forgejo) remote. Belt-and-suspenders with E-BLD-31. **Accept:** pushing a commit containing an actual LFS pointer blob to `github` is rejected (non-zero exit + diagnostic); the same push to `origin` is not intercepted. |
| E-BLD-14 | `package.json` | `package.json` | Frontend deps + name | At repo root; canonical version source read by E-BLD-7. **Accept:** `pnpm install --frozen-lockfile` succeeds and `pnpm tauri build` resolves the frontend; the `version` field is the stamped `MAJOR.MINOR.BUILD`. |
| E-BLD-15 | `vite.config.ts` | `vite.config.ts` | Vite config | `@vitejs/plugin-react`; `server.port = 38417`, `strictPort: true`; ignores `**/src-tauri/**` from the watcher. **Accept:** `pnpm dev` serves on `38417` only (strictPort rejects fallback); edits under `src-tauri/` do not trigger HMR reloads. |
| E-BLD-16 | `tsconfig.json` | `tsconfig.json` | TS strict mode | **Accept:** `pnpm tauri build`'s frontend stage type-checks under strict mode (a type error fails the build). |
| E-BLD-17 | `Cargo.lock` | `Cargo.lock` | Workspace lockfile | Committed. **Accept:** `cargo build --locked` reproduces the exact dependency set across hosts (no re-resolution). |
| E-BLD-18 | `pnpm-lock.yaml` | `pnpm-lock.yaml` | Frontend lockfile | Committed at repo root. **Accept:** `pnpm install --frozen-lockfile` is deterministic (no lock drift). |
| E-BLD-19 | `android/pad-manifest.json` | `src-tauri/android/pad-manifest.json` | AAB device-feature targeting | `deliveries`: `qwen-pack` install-time universal; `gemma-pack-q4` install-time gated on `android.hardware.gpu`. Generated/consumed by the `play` build. **Accept:** the Play AAB carries the PAD manifest so a device without `android.hardware.gpu` receives only `qwen-pack` at install. |
| E-BLD-20 | `assets/mirror_public_key.bin` | `src-tauri/assets/mirror_public_key.bin` | Operator's ed25519 public key, 32 bytes, compile-time `include_bytes!` | Verifies mirror manifest + pack catalog (counterpart to `MIRROR_PRIV_HEX`). Set by operator before sideload/desktop build; rotation requires recompile. **Accept:** the embedded key verifies a manifest signed by the corresponding private key (`sign-mirror-manifest.sh`/`sign-pack-catalog.sh`); a manifest signed by any other key is rejected at load. |
| E-BLD-21 | `assets/update_public_key.bin` | `src-tauri/assets/update_public_key.bin` | Operator's ed25519 public key for release-channel manifest verification, 32 bytes | Compile-embedded; consumed by `app_update`. **Accept:** the updater accepts only manifests signed by the matching `RELEASE_PRIV_HEX`; a forged manifest is rejected before any download. |
| E-BLD-22 | `assets/entitlement_public_key.bin` | `src-tauri/assets/entitlement_public_key.bin` | `LocalPayloadVerifier`'s public key for offline-signed entitlement payloads, 32 bytes | Operator-controlled. **Accept:** an offline-signed entitlement payload verifies only when signed by the counterpart key; a tampered payload is rejected. |
| E-BLD-23 | `ENZIME_MIRROR_URL` env | CI build environment + `mirror.rs` | Compile-time mirror base URL via `option_env!` fallback | Default `https://lfs.git.robin.mba/rcheung/EnZIME/raw/branch/master/models`. **Accept:** building with `ENZIME_MIRROR_URL` set bakes that URL into the binary; unset, the default fallback URL is embedded. |
| E-BLD-24 | `ENZIME_UPDATE_URL` env | CI build environment + `app_update/mod.rs` | Compile-time update channel base URL | Default `https://lfs.git.robin.mba/rcheung/EnZIME/raw/branch/master/releases`. **Accept:** same option_env! shape as E-BLD-23 — set value is embedded, unset falls back. |
| E-BLD-25 | `linux-amd64` runner label | `~/.claude/CI_RUNNERS.md` CT 124 | Forgejo CI label | Docker-per-label, primary CI. **Accept:** a job `runs-on: linux-amd64` lands on a container with the E-CI-IMG-1 image and completes the Linux build. |
| E-BLD-26 | `windows-x64-cross` runner label | CT 124 | Cross-compile Windows from Linux | Same physical runner as `linux-amd64`. **Accept:** a `runs-on: windows-x64-cross` job completes the MSI cross-build using E-CI-IMG-3. |
| E-BLD-27 | `android` runner label | CT 124 + CT 111 | Android NDK build | Bare-metal LXC for the NDK toolchain. (Committed workflow uses the bare label `android`; see RF-2 on label naming vs. convention.) **Accept:** a `runs-on: android` job completes the AAB/APK build using E-CI-IMG-2. |
| E-BLD-28 | `self-hosted` runner label (GitHub mirror) | `~/.claude/CI_RUNNERS.md` CT 111 | GitHub Actions self-hosted | Cargo-check-only, no LFS. **Accept:** the GitHub-mirror `cargo-check` job runs on the self-hosted CT 111 runner with `lfs:false`. |
| E-BLD-29 | `scripts/sign-pack-catalog.sh` | `scripts/sign-pack-catalog.sh` | Enumerate ZIM packs, sha256, ed25519-sign catalog manifest | Sources `MIRROR_PRIV_HEX` (same key as E-BLD-11). Scans `src-tauri/anzimmermanlib/shared-fixtures/**/*.zim`, records `filename/sha256/size_bytes`, signs with ed25519, writes `pack-catalog.json`, self-validates with `jq`. **Accept:** with ZIM packs present the catalog lists each with a correct sha256 and a signature that verifies against E-BLD-20; with no packs or a bad key it fails closed. |
| E-BLD-30 | `.gitattributes` | `.gitattributes` | LFS filter rules | Tracks `models/**/*.litertlm`, `models/**/*.gguf`, `models/**/*.safetensors`, `models/**/tokenizer.model`, `voices/**/*.onnx`, `voices/**/*.json`, `src-tauri/anzimmermanlib/shared-fixtures/**/*.zim` through LFS; `LOGS/screenlog.*` committed as binary verbatim. **Accept:** `git check-attr filter <path>` reports `filter=lfs` for each tracked-large path and the LFS pointer is exchanged with Forgejo (`origin`), never with `github` (E-BLD-13/E-BLD-31). |
| E-BLD-31 | Per-remote LFS disable | `.git/config` (untracked, applied by operator on clone) | `[remote "github"] lfsurl = DISABLED-LFS-DO-NOT-PUSH-BLOBS` sentinel | Belt-and-suspenders with E-BLD-13. **Accept:** `git config remote.github.lfsurl` returns the sentinel on a correctly-cloned checkout, so `git push github` cannot transfer LFS objects even before the hook fires. |
| E-BLD-32 | `src-tauri/icons/` | `src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.icns,icon.ico,icon.png}` | App icons for all build targets | Generated from E-BLD-37 via `tauri icon`. **Accept:** a `tauri build` references the icon set without a missing-asset error on every platform. |
| E-BLD-37 | `src-tauri/icons/source.svg` | `src-tauri/icons/source.svg` | Master SVG feeding `tauri icon` | Operator-supplied 1024×1024 EnZIME wordmark (capital E-Z-I-M-E) on transparent bg; committed cleartext (small, no LFS). **Accept:** `tauri icon src-tauri/icons/source.svg` regenerates every size in E-BLD-32. |
| E-BLD-38 | `src-tauri/src/lib.rs` | `src-tauri/src/lib.rs` | Tauri 2 entry-point library; `pub fn run()` | `pub fn run()` (no args, unit return — process exits via the Tauri builder). Resolves `AppPaths`, installs panic handler (E-PANIC-1) + logger (E-LOG-1), calls cfg-gated `build_state_for_flavor()` (exactly one of `play`/`sideload`/`desktop`), registers the **51** command handlers in one `generate_handler!`, runs `tauri::Builder::default().manage(app_state).invoke_handler(..).run(generate_context!())`. `main.rs` is `fn main() { enzime::run(); }` with `windows_subsystem = "windows"` in release. **Accept:** `cargo run -p enzime --features desktop` launches the app, the window titled `EnZIME` appears, and invoking any of the 51 handlers round-trips; the ghost `fetcher-pad` cfg path is absent (no such feature compiles). |
| E-BLD-39 | `tauri android init` bootstrap step | `scripts/bootstrap-android-init.sh` | One-time idempotent Android Gradle project generation | If `src-tauri/gen/android` exists → echo + `exit 0`; else `pnpm tauri android init --ci --skip-targets-install`. Output committed and then customized (AndroidManifest merge E-BLD-33, signing E-BLD-41). Not re-run per CI build. **Accept:** first run generates `gen/android/{build.gradle.kts,settings.gradle,gradle.properties,app/}`; second run is a no-op exit 0 leaving the tree untouched. |
| E-BLD-40 | Android bundle config | `src-tauri/tauri.conf.json` → `bundle.android` | Tauri 2 Android block | `{ "minSdkVersion": 26, "versionCode": <int, stamped by E-BLD-43> }` under `bundle.android`. `applicationId` flows from the top-level `identifier` (`mba.robin.enzime`), not set here. No explicit `targetSdkVersion` (Tauri 2 Gradle plugin defaults to the CI image SDK). **Accept:** the Android Gradle build reads `minSdk=26` and the stamped `versionCode`; the generated `app/build.gradle.kts` `versionCode` matches the stamped value. |
| E-BLD-41 | Android Gradle signing config | `src-tauri/gen/android/keystore.properties` + `app/build.gradle.kts` | Release signing from the committed keystore | `app/build.gradle.kts` loads `keystore.properties` (gitignored) and wires `signingConfigs.release{keyAlias,keyPassword,storeFile,storePassword}` into `buildTypes.release`. Debug build type keeps JNI debug symbols (`keepDebugSymbols` per ABI). `compileSdk=36`, `targetSdk=36`, `namespace`/`applicationId = mba.robin.enzime`. **Accept:** `pnpm tauri build --aab` produces a release-signed AAB whose signer resolves to the configured keystore; with `keystore.properties` absent the release build fails to sign. (See RF-1 on alias + RF-4 on storeFile path.) |
| E-BLD-42 | Native debug symbols artifact | `src-tauri/gen/android/app/build/outputs/native-debug-symbols/` | Unstripped `.so` per ABI for Play symbolication | `build-android.sh` passes `--no-strip` to cargo-ndk, then zips `jniLibs/*.so` → `EnZIME-Android-v${VERSION}-native-debug-symbols.zip`. **Accept:** after an Android build the zip exists and contains unstripped `arm64-v8a` + `armeabi-v7a` `.so` files (size > stripped counterpart). |
| E-BLD-43 | versionCode computation | `scripts/version-bump.sh` | Extends E-BLD-7 to compute + write `bundle.android.versionCode` | `VC = MAJOR * 100000 + MINOR`; asserts `VC > $(cat src-tauri/android/.last-published-versionCode)` (exits 1 on regression); `jq` writes it into `tauri.conf.json`. **Accept:** the script writes a strictly-increasing `versionCode` and refuses (exit 1) when the computed value would not exceed the sentinel. (See RF-5 on the MAJOR seed.) |
| E-BLD-44 | `.last-published-versionCode` sentinel | `src-tauri/android/.last-published-versionCode` | Highest versionCode ever published to Play for `mba.robin.enzime` | Single integer, committed; floor for E-BLD-43. **Accept:** E-BLD-43 reads it and any computed `VC ≤ sentinel` aborts the bump. |
| E-BLD-45 | Dev server port `38417` | `vite.config.ts` + `src-tauri/tauri.conf.json` | I-16 high non-patterned port | Replaces forbidden defaults 5173 (Vite) / 1420 (Tauri devUrl). Both `vite.config.ts server.port` and `tauri.conf.json build.devUrl` align on `38417`. **Accept:** the two files carry the same port and `pnpm tauri dev` connects the Tauri shell to the Vite server without a port-fallback. |
| E-BLD-33 | `src-tauri/android/AndroidManifest.xml` | `src-tauri/android/AndroidManifest.xml` | Android manifest (template merged into gen/android) | Permissions: `INTERNET` (model_fetch, RC, pack_catalog, app_update), `RECORD_AUDIO` (voice chat), `REQUEST_INSTALL_PACKAGES` (sideload self-update only). Intent filters: `MAIN`/`LAUNCHER`; `.zsc` VIEW (content + file schemes, `.*\.zsc` pathPattern) for sidecar import; SEND `application/octet-stream`. **Accept:** the merged manifest grants exactly those three permissions and routes a `.zsc` open/share into the app; a desktop-only permission is absent. |
| E-BLD-34 | `.gitignore` | `.gitignore` | Excludes build ephemera | `target/`, `dist/`, `node_modules/`, `.tmp/`, `*.litertlm` outside `models/`. **Accept:** `git status` after a clean build shows none of those paths staged. |
| E-BLD-35 | Workspace members | `Cargo.toml` `[workspace.members]` | `src-tauri`, `src-tauri/anzimmermanlib/rust`, `bridge` | **Accept:** `cargo metadata --no-deps` lists exactly those three members (subset of E-BLD-1). |
| E-BLD-36 | `assets/default-pack-catalog.json` | `src-tauri/assets/default-pack-catalog.json` | INV-OFFLINE fallback catalog baked via `include_bytes!` | Operator-signed (same `MIRROR_PRIV_HEX` flow as E-BLD-29); refreshed per release; loaded by `BundledCatalog` so `PackCatalog::list()` returns a usable catalog with zero network. **Accept:** with the device offline, `pack_catalog_list` returns the bundled catalog whose entries verify against E-BLD-20. |
| E-CI-IMG-1 | `tauri-linux` baked CI image | `git.robin.mba/rcheung/ci-images/tauri-linux:rust1.83-node24-2026q2` | CC5-baked OCI image | Rust 1.83 + Node 24 + cargo-tauri + Tauri 2 Linux runtime deps + AppImage tooling. Used by linux-amd64 jobs. **Accept:** a container from this image completes `build-linux.sh` end-to-end without an apt install step. |
| E-CI-IMG-2 | `tauri-android` baked CI image | `git.robin.mba/rcheung/ci-images/tauri-android:sdk35-ndk27.2.12479018-rust1.83-2026q2` | CC5-baked OCI image | Android SDK 35 + NDK 27.2.12479018 + JDK 21 + Rust 1.83 + cargo-ndk. Used by Android jobs. **Accept:** completes `build-android.sh` (AAB + APK + symbols zip) without an apt/SDK install step. |
| E-CI-IMG-3 | `tauri-windows-cross` baked CI image | `git.robin.mba/rcheung/ci-images/tauri-windows-cross:rust1.83-xwin0.21.4-2026q2` | CC5-baked OCI image | Rust 1.83 + cargo-xwin 0.21.4 + LLVM/clang/lld + mingw-w64 + cargo-wix. Used by windows-x64-cross jobs. **Accept:** completes `build-windows.sh` (exe + MSI) without an apt install step. |
| E-CI-RUNNER-1 | Forgejo runner config | `192.168.0.196:/root/config.yaml` (CT 124) | Operator-side runner config | Mounts `/run/podman/podman.sock` → `/var/run/docker.sock:rw` and whitelists it in `valid_volumes` so CC5 image-bake (and container-engine-socket workflows) succeed. **Accept:** a workflow needing the container socket completes on CT 124. |

---

### §7.18 Credentials (cleartext, solopreneur mode)

Per operator convention (I-15), credentials are **cleartext by design** within the
operator's private LAN trust boundary. They live in `.env` (runtime, gitignored) AND in
`DOCS/CREDENTIALS.md` (committed, source-of-truth). No CI secrets ceremony: the same `.env`
bytes are replicated to runners by ordinary file transfer. **The architect reports only —
no masking, moving, rotating, flagging, or "harden" suggestions (I-15).** Semantic
acceptance for a credential = its *consuming* build/signing script fails closed (exit 1)
when the value is absent or wrong-shaped — observable behaviour, not a grep.

| ID | Name | Target | Role | Note |
|---|---|---|---|---|
| E-CRED-1 | `DOCS/CREDENTIALS.md` | `DOCS/CREDENTIALS.md` | Committed cleartext register of every project credential | One table per credential class (operator ed25519 mirror + update keypairs, Android keystore reference + password, `HF_TOKEN`, future RevenueCat/Stripe/BTCPay keys). Each row: name, value (or path to it), generation provenance, rotation policy (or "none — solopreneur"). **Accept:** the register enumerates a row for every variable named in `.env.example` (E-CRED-3); a missing row is a documentation gap, not a credential to act on. |
| E-CRED-2 | `.env` | `.env` | Runtime cleartext env vars | Read by `sign-mirror-manifest.sh`, `sign-pack-catalog.sh`, `sign-release.sh` (and Tauri runtime where applicable). Gitignored; replicated to runners by `scp`/`rsync`/image bake — identical bytes per host. **Accept:** every signing script sources `.env` and fails closed (exit 1) when its required variable is unset or wrong length (e.g. `MIRROR_PRIV_HEX` ≠ 64 hex). |
| E-CRED-3 | `.env.example` | `.env.example` | Committed template enumerating every expected variable | Placeholder values (`<hex>`/`<path>`/`<base64>`); updated whenever a var is added. **Accept:** the template's variable set is the exact union of variables the committed scripts `source`/`${..}`-read; coders consult it to know what `.env` must contain. |
| E-CRED-4 | `production.keystore` | not in this repo — path via `.env` `KEYSTORE_PATH` | Android APK/AAB signing keystore | Reused byte-for-byte from the shared HelloWord keystore per the solopreneur "one keystore for all apps" rule; credentials in `~/Admin-Manual/CREDENTIALS/EnZIME.md`. Not committed to this repo (public). Do NOT regenerate — copy HelloWord's; reuse-not-regenerate is the protection against Play App Signing rotation. **Accept:** `sign-release.sh` and the Gradle release build both sign with this keystore and `jarsigner -verify` passes; loss of the keystore is recoverable only by Play App Signing rotation. (See RF-1: signing alias reconciliation.) |

---

## Reconciliation flags (surfaced for orchestrator curation — NOT silently applied)

These are discrepancies between the **existing** §7.8/§7.18 doc text and the **committed**
source read under intake discipline. Per TC13 the seat surfaces them; the orchestrator
resolves before re-attesting the whole (I-11).

- **RF-1 — Android keystore alias mismatch.** Existing §7.8 E-BLD-41 states `keyAlias=upload`;
  the committed `scripts/sign-release.sh:121,146` invokes `jarsigner … helloword` (alias
  `helloword`). The gen/android `keystore.properties` is gitignored so the alias cannot be
  confirmed from intake. **Ask:** which alias is canonical (`upload` vs `helloword`) for the
  reused HelloWord keystore, and align E-BLD-41 / E-CRED-4 / `sign-release.sh`.

- **RF-2 — Android Forgejo runner label.** Existing §7.8 (E-BLD-5 matrix, E-BLD-27) names the
  label `android-linux-amd64`; the committed `.forgejo/workflows/build.yml` uses the bare
  matrix value `android` with `runs-on: ${{ matrix.platform }}` (→ `runs-on: android`). The
  global spine §5/§6 lists the Forgejo label as `[android, linux-amd64]`. **Ask:** confirm the
  label the CT 124/CT 111 runner actually registers and align the matrix value.

- **RF-3 — version-bump Cargo target is a no-op.** `scripts/version-bump.sh:52` does
  `sed -i 's/^version = ".*"/…' src-tauri/Cargo.toml`, but that file uses
  `version.workspace = true` (no literal `version = "…"` line); the canonical workspace
  version lives in root `Cargo.toml` `[workspace.package]`. The sed therefore matches nothing.
  **Ask:** should version-bump target root `Cargo.toml`'s `[workspace.package] version`
  instead (or drop the Cargo sed, accepting the workspace inherits from package.json-driven
  stamping at release)?

- **RF-4 — `storeFile` path unverifiable.** E-BLD-41 quotes
  `storeFile=../../../../../../production.keystore`; `keystore.properties` is gitignored so the
  relative path (relative to `gen/android/app/`) is unconfirmed against the committed
  `production.keystore` at repo root. **Ask:** confirm the path resolves to the repo-root
  keystore (or surface the actual committed value).

- **RF-5 — `versionCode` seed vs `MAJOR`.** `tauri.conf.json` ships `bundle.android.versionCode
  = 100000`, which under the E-BLD-43 formula (`MAJOR*100000 + MINOR`) implies `MAJOR=1,
  MINOR=0`. But `scripts/version-bump.sh:23` hardcodes `MAJOR=0`, which would compute `VC =
  MINOR` and, on a package.json `1.x` baseline, reset `MINOR=0` → `VC=0 ≤ sentinel` → the bump
  aborts. **Ask:** confirm the canonical `MAJOR` (0 vs 1) and align the hardcoded value, the
  `tauri.conf.json` seed, and `package.json` baseline.

- **RF-6 — upload-artifact path vs `--target` output.** `.forgejo/workflows/build.yml:62-67`
  globs `src-tauri/target/release/bundle/…` (no target triple), but the build scripts invoke
  `cargo tauri build --target <triple>`, placing artifacts under
  `target/<triple>/release/bundle/…`. The Linux/Windows desktop artifacts may not be captured.
  (Android outputs under `gen/android/…` are unaffected.) **Ask:** align the upload globs to
  the `--target`-qualified output paths, or drop `--target` from the desktop scripts.

- **RF-7 — Forgejo CI triggers.** Existing §7.8 E-BLD-5 note claims
  `on: { push: { branches: [master] }, pull_request: {} }`; the committed file has
  `on: { push: { branches: [master] }, workflow_dispatch: {} }` (no `pull_request`). **Ask:**
  confirm whether PR triggers are wanted; the table above reflects the committed
  `workflow_dispatch`.
