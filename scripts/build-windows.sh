#!/bin/bash
# build-windows.sh — mingw-w64 + cargo-xwin wrapper for EnZIME Windows builds
# Produces MSI installer via cargo-wix
# Runs on windows-x64-cross Linux runner with mingw-w64 + cargo-xwin pre-installed
#
# Per DOCS/ARCHITECTURE.md §7.8 row E-BLD-9

set -e

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# ── mingw-w64 target configuration ──────────────────────────────────────────────
# x86_64-pc-windows-msvc: 64-bit Windows (primary target)
TARGET="x86_64-pc-windows-msvc"

# ── cargo-xwin configuration ─────────────────────────────────────────────────────
# XWIN_CACHE_DIR: where cargo-xwin stores cached CRT headers/libraries
# XWIN_ARCH_DIRS: which architectures to cache (x64 only for now)
export XWIN_CACHE_DIR="${XWIN_CACHE_DIR:-$HOME/.xwin/cache}"
export XWIN_ARCH_DIRS="${XWIN_ARCH_DIRS:-x64}"

# ─── Ensure xwin is installed ───────────────────────────────────────────────────
if ! command -v xwin &> /dev/null; then
  echo "Error: xwin not found. Install with: cargo install xwin"
  exit 1
fi

# ─── Populate xwin cache if needed ──────────────────────────────────────────────
if [ ! -d "$XWIN_CACHE_DIR" ]; then
  echo "Populating xwin cache (this may take a while on first run)..."
  xwin splat --output "$XWIN_CACHE_DIR"
fi

# ── Build Rust binary with cargo-xwin ───────────────────────────────────────────
echo "Building Windows binary with cargo-xwin..."
cd "$PROJECT_ROOT/src-tauri"

# cargo-xwin builds with MSVC CRT on Linux using cached headers/libraries
# --target $TARGET: cross-compile for Windows x64
# --manifest-path Cargo.toml: build our crate
cargo xwin build \
  --manifest-path Cargo.toml \
  --target "$TARGET" \
  --release

echo ""
echo "Rust binary built successfully"

# ── Build Windows MSI with cargo-wix ────────────────────────────────────────────
cd "$PROJECT_ROOT"

# Install dependencies first (frontend build)
echo "Installing frontend dependencies..."
pnpm install --frozen-lockfile

echo ""
echo "Building Windows MSI installer..."
pnpm tauri build --target "$TARGET"

# ── Output artifact summary ──────────────────────────────────────────────────────
echo ""
echo "=== Build complete ==="
echo "MSI installer:"
ls -lh "$PROJECT_ROOT/src-tauri/target/$TARGET/release/bundle/msi/"*.msi 2>/dev/null || echo "  (no MSI found)"
echo ""
echo "Binary:"
ls -lh "$PROJECT_ROOT/src-tauri/target/$TARGET/release/enzime.exe" 2>/dev/null || echo "  (no exe found)"
