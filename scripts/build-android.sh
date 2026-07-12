#!/bin/bash
# build-android.sh — NDK + cargo-ndk wrapper for EnZIME Android builds
# Produces AAB (for Play Store) and APK (for sideload)
# Runs on android-linux-amd64 runner with NDK pre-installed
#
# Per DOCS/ARCHITECTURE.md §7.8 row E-BLD-8

set -e

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# ── Init guard (E-BLD-8) ─────────────────────────────────────────────────────────
if [ ! -d "src-tauri/gen/android" ]; then
  echo "Error: src-tauri/gen/android/ does not exist. Run scripts/bootstrap-android-init.sh first." >&2
  exit 1
fi

# ── Android NDK configuration ─────────────────────────────────────────────────
# NDK path is typically set by CI environment or Android SDK installation
if [ -z "${ANDROID_NDK_HOME}" ]; then
  # Fallback to common SDK paths
  for ndk_path in \
    "$ANDROID_SDK_ROOT/ndk"/* \
    "$HOME/Android/Sdk/ndk"/* \
    "/opt/android-sdk/ndk"/*
  do
    if [ -d "$ndk_path" ]; then
      export ANDROID_NDK_HOME="$ndk_path"
      break
    fi
  done
fi

if [ -z "${ANDROID_NDK_HOME}" ] || [ ! -d "${ANDROID_NDK_HOME}" ]; then
  echo "Error: ANDROID_NDK_HOME not set or NDK not found"
  exit 1
fi

echo "Using NDK: ${ANDROID_NDK_HOME}"

# ── Target architectures (arm64 + armv7 for device coverage) ────────────────
# aarch64-linux-android: 64-bit ARM (most modern devices)
# armv7-linux-androideabi: 32-bit ARM (legacy support)
TARGETS="aarch64-linux-android armv7-linux-androideabi"

# ── API level (minimum 21 for Tauri 2, 26 recommended for modern Android) ───
API_LEVEL=26

# ── Build Rust native libraries with cargo-ndk ───────────────────────────────
echo "Building Rust native libraries for Android..."
cd "$PROJECT_ROOT/src-tauri"

for target in $TARGETS; do
  echo ""
  echo "=== Building $target ==="

  # cargo-ndk builds the Rust lib as .so for the target ABI
  # --manifest-path Cargo.toml: build our crate
  # --target $target: cross-compile for Android architecture
  # --platform $API_LEVEL: minimum Android API level
  # -o ../jniLibs/$abi: output to Android jniLibs structure
  cargo ndk \
    --manifest-path Cargo.toml \
    --target "$target" \
    --platform "$API_LEVEL" \
    --no-strip \
    -o ../jniLibs build
done

echo ""
echo "Rust native libraries built successfully"

# ── Build Android APK and AAB with Tauri CLI ───────────────────────────────────
cd "$PROJECT_ROOT"

# Install dependencies first (frontend build)
echo "Installing frontend dependencies..."
pnpm install --frozen-lockfile

echo ""
echo "Building Android APK (sideload)..."
pnpm tauri build --apk --features sideload

echo ""
echo "Building Android AAB (Play Store)..."
pnpm tauri build --aab --features play

# ── Output artifact summary ────────────────────────────────────────────────────
echo ""
echo "=== Build complete ==="
echo "APK (sideload):"
ls -lh "$PROJECT_ROOT/src-tauri/gen/android/app/build/outputs/apk/"*/*/*.apk 2>/dev/null || echo "  (no APK found)"
echo ""
echo "AAB (Play Store):"
ls -lh "$PROJECT_ROOT/src-tauri/gen/android/app/build/outputs/bundle/"*/*/*.aab 2>/dev/null || echo "  (no AAB found)"

# ── Collect unstripped native debug symbols (E-BLD-42) ──────────────────────────────
VERSION=$(jq -r .version src-tauri/tauri.conf.json)
SYMBOLS_ARCHIVE="EnZIME-Android-v${VERSION}-native-debug-symbols.zip"

echo ""
echo "Collecting unstripped .so files for debug symbols..."

# Find any .so files in jniLibs (cargo-ndk output with --no-strip)
SO_COUNT=$(find jniLibs -name "*.so" -type f 2>/dev/null | wc -l)

if [ "$SO_COUNT" -gt 0 ]; then
  (cd jniLibs && zip -r "../$SYMBOLS_ARCHIVE" .) 2>/dev/null
  echo "Native debug symbols archived: $PROJECT_ROOT/$SYMBOLS_ARCHIVE"
else
  echo "Warning: No unstripped .so files found in jniLibs/ for debug symbols"
fi
