#!/bin/bash
# build-linux.sh — cargo bundle wrapper for EnZIME Linux builds
# Produces AppImage distributable
# Runs on linux-amd64 runner
#
# Per DOCS/ARCHITECTURE.md §7.8 row E-BLD-10

set -e

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# ── Install frontend dependencies ─────────────────────────────────────────────────
echo "Installing frontend dependencies..."
pnpm install --frozen-lockfile

# ── Build Linux AppImage with cargo bundle ────────────────────────────────────────
echo ""
echo "Building Linux AppImage..."
cd "$PROJECT_ROOT/src-tauri"

# cargo bundle produces the AppImage via Tauri's bundler
# --target x86_64-unknown-linux-gnu: build for Linux x64
cargo tauri build --target x86_64-unknown-linux-gnu --appimage

# ── Output artifact summary ───────────────────────────────────────────────────────
echo ""
echo "=== Build complete ==="
echo "AppImage:"
ls -lh "$PROJECT_ROOT/src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/"*.AppImage 2>/dev/null || echo "  (no AppImage found)"
