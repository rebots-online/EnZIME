#!/bin/bash
# sign-release.sh — sign release artifacts (AppImage/MSI/APK)
# Produces detached ed25519 signatures for Linux/Windows artifacts
# Signs Android APK/AAB with jarsigner using HelloWord keystore
#
# Per DOCS/ARCHITECTURE.md §7.8 row E-BLD-12

set -e

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# ── Load credentials from .env ─────────────────────────────────────────────────────
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "Error: .env file not found" >&2
    exit 1
fi

set -a
source "$PROJECT_ROOT/.env"
set +a

# ── Release signing key (ed25519 for detached signatures) ─────────────────────────
if [ -z "$RELEASE_PRIV_HEX" ]; then
    echo "Error: RELEASE_PRIV_HEX not set in .env" >&2
    exit 1
fi

# Validate hex key is 64 characters (32 bytes)
if [ ${#RELEASE_PRIV_HEX} -ne 64 ]; then
    echo "Error: RELEASE_PRIV_HEX must be 64 hex characters (32 bytes)" >&2
    exit 1
fi

# ── Android keystore credentials ───────────────────────────────────────────────────
if [ -z "$KEYSTORE_PATH" ]; then
    echo "Error: KEYSTORE_PATH not set in .env" >&2
    exit 1
fi

if [ ! -f "$PROJECT_ROOT/$KEYSTORE_PATH" ]; then
    echo "Error: Keystore not found at $PROJECT_ROOT/$KEYSTORE_PATH" >&2
    exit 1
fi

if [ -z "$KEYSTORE_PASSWORD" ]; then
    echo "Error: KEYSTORE_PASSWORD not set in .env" >&2
    exit 1
fi

if [ -z "$KEY_PASSWORD" ]; then
    echo "Error: KEY_PASSWORD not set in .env" >&2
    exit 1
fi

# ── Artifact output directories ───────────────────────────────────────────────────
APPIMAGE_DIR="$PROJECT_ROOT/src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage"
MSI_DIR="$PROJECT_ROOT/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi"
APK_DIR="$PROJECT_ROOT/src-tauri/target/android/release"
AAB_DIR="$PROJECT_ROOT/src-tauri/target/android/release"

# ── Signature output directory ─────────────────────────────────────────────────────
SIG_DIR="$PROJECT_ROOT/.tmp/signatures"
mkdir -p "$SIG_DIR"

# ── Convert ed25519 key to binary for OpenSSL ───────────────────────────────────────
KEY_BIN="$PROJECT_ROOT/.tmp/release_priv.bin"
mkdir -p "$PROJECT_ROOT/.tmp"
echo -n "$RELEASE_PRIV_HEX" | xxd -r -p > "$KEY_BIN"

# ── Sign Linux AppImage ─────────────────────────────────────────────────────────────
echo "Signing Linux AppImage..."
for appimage in "$APPIMAGE_DIR"/*.AppImage; do
    if [ -f "$appimage" ]; then
        filename=$(basename "$appimage")
        echo "  Signing: $filename"

        # Sign with OpenSSL (ed25519)
        sig=$(sha256sum "$appimage" | cut -d' ' -f1 | openssl pkeyutl -sign -inkey "$KEY_BIN" -keyform DER -rawin -pkeyopt digest:SHA256 -binary | xxd -p -c 256)

        # Write detached signature
        echo "$sig" > "$SIG_DIR/${filename}.sig"
        echo "    Signature: $SIG_DIR/${filename}.sig"
    fi
done

# ── Sign Windows MSI ───────────────────────────────────────────────────────────────
echo ""
echo "Signing Windows MSI..."
for msi in "$MSI_DIR"/*.msi; do
    if [ -f "$msi" ]; then
        filename=$(basename "$msi")
        echo "  Signing: $filename"

        # Sign with OpenSSL (ed25519)
        sig=$(sha256sum "$msi" | cut -d' ' -f1 | openssl pkeyutl -sign -inkey "$KEY_BIN" -keyform DER -rawin -pkeyopt digest:SHA256 -binary | xxd -p -c 256)

        # Write detached signature
        echo "$sig" > "$SIG_DIR/${filename}.sig"
        echo "    Signature: $SIG_DIR/${filename}.sig"
    fi
done

# ── Clean up temporary ed25519 key ─────────────────────────────────────────────────
rm -f "$KEY_BIN"

# ── Sign Android APK ───────────────────────────────────────────────────────────────
echo ""
echo "Signing Android APK..."
for apk in "$APK_DIR"/*.apk; do
    if [ -f "$apk" ]; then
        filename=$(basename "$apk")
        echo "  Signing: $filename"

        # Sign with jarsigner using HelloWord keystore
        jarsigner -verbose -sigalg SHA256withECDSA -digestalg SHA-256 \
            -keystore "$PROJECT_ROOT/$KEYSTORE_PATH" \
            -storepass "$KEYSTORE_PASSWORD" \
            -keypass "$KEY_PASSWORD" \
            "$apk" \
            helloword

        # Verify signature
        if jarsigner -verify -verbose "$apk" >/dev/null 2>&1; then
            echo "    Verified: $filename"
        else
            echo "    Warning: signature verification failed for $filename" >&2
        fi
    fi
done

# ── Sign Android AAB ───────────────────────────────────────────────────────────────
echo ""
echo "Signing Android AAB..."
for aab in "$AAB_DIR"/*.aab; do
    if [ -f "$aab" ]; then
        filename=$(basename "$aab")
        echo "  Signing: $filename"

        # Sign with jarsigner using HelloWord keystore
        jarsigner -verbose -sigalg SHA256withECDSA -digestalg SHA-256 \
            -keystore "$PROJECT_ROOT/$KEYSTORE_PATH" \
            -storepass "$KEYSTORE_PASSWORD" \
            -keypass "$KEY_PASSWORD" \
            "$aab" \
            helloword

        # Verify signature
        if jarsigner -verify -verbose "$aab" >/dev/null 2>&1; then
            echo "    Verified: $filename"
        else
            echo "    Warning: signature verification failed for $filename" >&2
        fi
    fi
done

echo ""
echo "=== Release signing complete ==="
echo "Detached signatures: $SIG_DIR/"
