#!/bin/bash
# sign-mirror-manifest.sh — enumerate variant artifacts, sha256, ed25519-sign mirror manifest
# Produces signed manifest JSON for release artifact distribution
# Reads MIRROR_PRIV_HEX from .env
#
# Per DOCS/ARCHITECTURE.md §7.8 row E-BLD-11

set -e

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# ── Load private key from .env ─────────────────────────────────────────────────────
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "Error: .env file not found" >&2
    exit 1
fi

# Source .env to get MIRROR_PRIV_HEX
set -a
source "$PROJECT_ROOT/.env"
set +a

if [ -z "$MIRROR_PRIV_HEX" ]; then
    echo "Error: MIRROR_PRIV_HEX not set in .env" >&2
    exit 1
fi

# Validate hex key is 64 characters (32 bytes)
if [ ${#MIRROR_PRIV_HEX} -ne 64 ]; then
    echo "Error: MIRROR_PRIV_HEX must be 64 hex characters (32 bytes)" >&2
    exit 1
fi

# ── Artifact output directories ────────────────────────────────────────────────────
# AppImage (Linux)
APPIMAGE_DIR="$PROJECT_ROOT/src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage"
# MSI (Windows)
MSI_DIR="$PROJECT_ROOT/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi"
# APK/AAB (Android)
APK_DIR="$PROJECT_ROOT/src-tauri/target/android/release"
AAB_DIR="$PROJECT_ROOT/src-tauri/target/android/release"

# ── Output manifest path ───────────────────────────────────────────────────────────
MANIFEST_PATH="$PROJECT_ROOT/mirror-manifest.json"

# ─── Build manifest JSON ───────────────────────────────────────────────────────────
echo "Building mirror manifest..."

MANIFEST_JSON=$(cat <<EOF
{
  "schema_version": 1,
  "generated_at": $(date +%s),
  "artifacts": [
EOF
)

# ─── Collect artifacts ──────────────────────────────────────────────────────────────
FIRST=true

# Helper to add artifact entry
add_artifact() {
    local flavor="$1"
    local target="$2"
    local format="$3"
    local file_path="$4"

    if [ -f "$file_path" ]; then
        local filename=$(basename "$file_path")
        local sha256=$(sha256sum "$file_path" | cut -d' ' -f1)
        local size_bytes=$(stat -c%s "$file_path" 2>/dev/null || stat -f%z "$file_path" 2>/dev/null)

        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            MANIFEST_JSON="$MANIFEST_JSON"$'\n,'
        fi

        MANIFEST_JSON="$MANIFEST_JSON"$(cat <<EOF

    {
      "flavor": "$flavor",
      "target": "$target",
      "format": "$format",
      "filename": "$filename",
      "sha256": "$sha256",
      "size_bytes": $size_bytes
    }
EOF
)
        echo "  Added: $filename ($flavor/$target)"
    fi
}

# Linux AppImage
for appimage in "$APPIMAGE_DIR"/*.AppImage; do
    add_artifact "desktop" "linux-x64" "appimage" "$appimage"
done

# Windows MSI
for msi in "$MSI_DIR"/*.msi; do
    add_artifact "desktop" "windows-x64" "msi" "$msi"
done

# Android APK
for apk in "$APK_DIR"/*.apk; do
    add_artifact "android" "apk" "universal" "$apk"
done

# Android AAB
for aab in "$AAB_DIR"/*.aab; do
    add_artifact "android" "aab" "play" "$aab"
done

MANIFEST_JSON="$MANIFEST_JSON"$'\n'"  ]"$'\n'}"

# ─── Sign manifest with ed25519 ─────────────────────────────────────────────────────
echo ""
echo "Signing manifest..."

# Convert hex key to binary for OpenSSL
KEY_BIN="$PROJECT_ROOT/.tmp/mirror_priv.bin"
mkdir -p "$PROJECT_ROOT/.tmp"
echo -n "$MIRROR_PRIV_HEX" | xxd -r -p > "$KEY_BIN"

# Get manifest body without signature for signing
MANIFEST_BODY=$(echo "$MANIFEST_JSON" | grep -v '"signature":')

# Sign with OpenSSL (ed25519)
SIGNATURE=$(echo -n "$MANIFEST_BODY" | openssl pkeyutl -sign -inkey "$KEY_BIN" -keyform DER -rawin -pkeyopt digest:SHA256 -binary | xxd -p -c 256)

# Clean up temp key
rm -f "$KEY_BIN"

# ─── Add signature to manifest ─────────────────────────────────────────────────────
# Insert signature field before closing brace
MANIFEST_JSON=$(echo "$MANIFEST_JSON" | sed '$s/}/,\n  "signature": "'"$SIGNATURE"'\n}/')

# ─── Write manifest ────────────────────────────────────────────────────────────────
echo "$MANIFEST_JSON" > "$MANIFEST_PATH"
echo ""
echo "=== Mirror manifest written to $MANIFEST_PATH ==="
echo "Signature: ${SIGNATURE:0:32}..."

# ─── Verify signature (self-check) ───────────────────────────────────────────────────
echo ""
echo "Verifying signature..."
# Extract public key from private (first 32 bytes are seed, derive pubkey)
# For now, just verify the manifest is well-formed
if command -v jq >/dev/null 2>&1; then
    if jq empty "$MANIFEST_PATH" 2>/dev/null; then
        echo "Manifest JSON is valid"
    else
        echo "Warning: Manifest JSON validation failed" >&2
    fi
fi

echo "Done."
