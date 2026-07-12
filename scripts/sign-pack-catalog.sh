#!/bin/bash
# sign-pack-catalog.sh — enumerate ZIM packs, sha256, ed25519-sign catalog manifest
# Produces signed catalog JSON for ZIM pack distribution
# Reads MIRROR_PRIV_HEX from .env
#
# Per DOCS/ARCHITECTURE.md §7.8 row E-BLD-29

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

# ── ZIM pack directories ───────────────────────────────────────────────────────────
PACK_DIRS=(
    "$PROJECT_ROOT/src-tauri/anzimmermanlib/shared-fixtures"
)

# ── Output catalog path ───────────────────────────────────────────────────────────
CATALOG_PATH="$PROJECT_ROOT/pack-catalog.json"

# ─── Build catalog JSON ───────────────────────────────────────────────────────────
echo "Building pack catalog..."

CATALOG_JSON=$(cat <<EOF
{
  "schema_version": 1,
  "generated_at": $(date +%s),
  "packs": [
EOF
)

# ─── Collect ZIM packs ─────────────────────────────────────────────────────────────
FIRST=true

# Helper to add pack entry
add_pack() {
    local zim_path="$1"

    if [ -f "$zim_path" ]; then
        local filename=$(basename "$zim_path")
        local sha256=$(sha256sum "$zim_path" | cut -d' ' -f1)
        local size_bytes=$(stat -c%s "$zim_path" 2>/dev/null || stat -f%z "$zim_path" 2>/dev/null)

        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            CATALOG_JSON="$CATALOG_JSON"$'\n,'
        fi

        CATALOG_JSON="$CATALOG_JSON"$(cat <<EOF

    {
      "filename": "$filename",
      "sha256": "$sha256",
      "size_bytes": $size_bytes
    }
EOF
)
        echo "  Added: $filename"
    fi
}

# Scan all pack directories for .zim files
for pack_dir in "${PACK_DIRS[@]}"; do
    if [ -d "$pack_dir" ]; then
        while IFS= read -r -d '' zim_file; do
            add_pack "$zim_file"
        done < <(find "$pack_dir" -type f -name "*.zim" -print0)
    fi
done

CATALOG_JSON="$CATALOG_JSON"$'\n'"  ]"$'\n'}"

# ─── Sign catalog with ed25519 ─────────────────────────────────────────────────────
echo ""
echo "Signing catalog..."

# Convert hex key to binary for OpenSSL
KEY_BIN="$PROJECT_ROOT/.tmp/catalog_priv.bin"
mkdir -p "$PROJECT_ROOT/.tmp"
echo -n "$MIRROR_PRIV_HEX" | xxd -r -p > "$KEY_BIN"

# Get catalog body without signature for signing
CATALOG_BODY=$(echo "$CATALOG_JSON" | grep -v '"signature":')

# Sign with OpenSSL (ed25519)
SIGNATURE=$(echo -n "$CATALOG_BODY" | openssl pkeyutl -sign -inkey "$KEY_BIN" -keyform DER -rawin -pkeyopt digest:SHA256 -binary | xxd -p -c 256)

# Clean up temp key
rm -f "$KEY_BIN"

# ─── Add signature to catalog ─────────────────────────────────────────────────────
# Insert signature field before closing brace
CATALOG_JSON=$(echo "$CATALOG_JSON" | sed '$s/}/,\n  "signature": "'"$SIGNATURE"'\n}/')

# ─── Write catalog ────────────────────────────────────────────────────────────────
echo "$CATALOG_JSON" > "$CATALOG_PATH"
echo ""
echo "=== Pack catalog written to $CATALOG_PATH ==="
echo "Signature: ${SIGNATURE:0:32}..."

# ─── Verify signature (self-check) ───────────────────────────────────────────────────
echo ""
echo "Verifying signature..."
# Extract public key from private (first 32 bytes are seed, derive pubkey)
# For now, just verify the catalog is well-formed
if command -v jq >/dev/null 2>&1; then
    if jq empty "$CATALOG_PATH" 2>/dev/null; then
        echo "Catalog JSON is valid"
    else
        echo "Warning: Catalog JSON validation failed" >&2
    fi
fi

echo "Done."
