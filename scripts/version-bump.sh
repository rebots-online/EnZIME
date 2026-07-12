#!/usr/bin/env bash
# E-BLD-7 version-bump.sh — automatic versioning for EnZIME
# MAJOR.MINOR from package.json (MAJOR manual; MINOR auto-increments when MAJOR unchanged, resets to 0 on MAJOR bump)
# BUILD = epoch_minutes % 100000 (auto-increment on each run)
# Stamps: package.json, tauri.conf.json, src/version.json, workspace Cargo.toml
# Honors optional release.lock for pinned versions

set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_ROOT="$(pwd)"
PACKAGE_JSON="${PROJECT_ROOT}/package.json"
TAURI_CONF="${PROJECT_ROOT}/src-tauri/tauri.conf.json"
SRC_VERSION="${PROJECT_ROOT}/src/version.json"
CARGO_TOML="${PROJECT_ROOT}/Cargo.toml"
RELEASE_LOCK="${PROJECT_ROOT}/release.lock"

# Calculate BUILD number from epoch minutes
BUILD_NUM=$(($(date +%s) / 60 % 100000))

# Check for release.lock (optional pinned version)
if [ -f "$RELEASE_LOCK" ]; then
    echo "Found release.lock — using pinned version"
    LOCKED_MAJOR=$(grep -E '^MAJOR=' "$RELEASE_LOCK" | cut -d= -f2 || true)
    LOCKED_MINOR=$(grep -E '^MINOR=' "$RELEASE_LOCK" | cut -d= -f2 || true)
    LOCKED_BUILD=$(grep -E '^BUILD=' "$RELEASE_LOCK" | cut -d= -f2 || true)

    if [ -n "$LOCKED_MAJOR" ] && [ -n "$LOCKED_MINOR" ] && [ -n "$LOCKED_BUILD" ]; then
        MAJOR="$LOCKED_MAJOR"
        MINOR="$LOCKED_MINOR"
        BUILD_NUM="$LOCKED_BUILD"
        echo "Pinned version: ${MAJOR}.${MINOR}.${BUILD_NUM}"
    else
        echo "WARNING: release.lock malformed — ignoring"
        rm -f "$RELEASE_LOCK"
    fi
fi

# Extract current MAJOR.MINOR from package.json
CURRENT_VERSION=$(jq -r '.version' "$PACKAGE_JSON")
CURRENT_MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
CURRENT_MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)

# Determine new MAJOR.MINOR
if [ -z "${MAJOR:-}" ]; then
    # No lock file — auto-increment MINOR
    MAJOR="1"
    MINOR=$((CURRENT_MINOR + 1))
    echo "Auto-increment: ${MAJOR}.${MINOR}.${BUILD_NUM}"
fi

FULL_VERSION="${MAJOR}.${MINOR}.${BUILD_NUM}"
COMMIT_MSG="chore(version): bump to ${FULL_VERSION} [skip ci]"

echo "Stamping version: ${FULL_VERSION}"

# Stamp package.json
jq --arg v "$FULL_VERSION" '.version = $v' "$PACKAGE_JSON" > "${PACKAGE_JSON}.tmp"
mv "${PACKAGE_JSON}.tmp" "$PACKAGE_JSON"

# Stamp tauri.conf.json
jq --arg v "$FULL_VERSION" '.version = $v' "$TAURI_CONF" > "${TAURI_CONF}.tmp"
mv "${TAURI_CONF}.tmp" "$TAURI_CONF"

# Create/update src/version.json
cat > "$SRC_VERSION" <<< "{\"version\":\"${FULL_VERSION}\"}"

# Stamp workspace Cargo.toml (RF-3: sed-only, no placeholder escaping)
sed -i "s/^[[:space:]]*version = \".*\"/version = \"${FULL_VERSION}\"/" "$CARGO_TOML"

# Git commit
git add "$PACKAGE_JSON" "$TAURI_CONF" "$SRC_VERSION" "$CARGO_TOML"
git commit -m "$COMMIT_MSG"

echo "Committed: ${COMMIT_MSG}"
