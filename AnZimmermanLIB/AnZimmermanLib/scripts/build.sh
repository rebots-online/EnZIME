#!/bin/bash
# Build script for AnZimmerman Clean-room ZIM Libraries
# Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
#
# This script generates version and build numbers for all components.
# Build number is the last 5 digits of epoch minutes.

set -e

# Configuration
VERSION="1.0.0"
COPYRIGHT="Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved."
LICENSE="All rights reserved"

# Calculate epoch-based 5-digit build number (last 5 digits of epoch minutes)
EPOCH_SECONDS=$(date +%s)
EPOCH_MINUTES=$((EPOCH_SECONDS / 60))
BUILD_NUMBER=$(printf "%05d" $((EPOCH_MINUTES % 100000)))

# Timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "========================================"
echo "AnZimmerman Build System"
echo "========================================"
echo "Version: ${VERSION}"
echo "Build:   ${BUILD_NUMBER}"
echo "Time:    ${TIMESTAMP}"
echo "${COPYRIGHT}"
echo "========================================"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Update version.json
cat > "${PROJECT_ROOT}/version.json" << EOF
{
  "version": "${VERSION}",
  "build": "${BUILD_NUMBER}",
  "copyright": "${COPYRIGHT}",
  "license": "${LICENSE}",
  "updated": "${TIMESTAMP}"
}
EOF
echo "✓ Updated version.json"

# Update Python library header
PYTHON_LIB="${PROJECT_ROOT}/zimlib.py"
if [ -f "$PYTHON_LIB" ]; then
    # Check if version info already exists, if not add it
    if ! grep -q "__version__" "$PYTHON_LIB"; then
        # Insert version info after the docstring
        sed -i '7a\
__version__ = "'"${VERSION}"'"\
__build__ = "'"${BUILD_NUMBER}"'"\
__copyright__ = "'"${COPYRIGHT}"'"\
' "$PYTHON_LIB"
        echo "✓ Updated zimlib.py version info"
    else
        # Update existing version info
        sed -i 's/__version__ = ".*"/__version__ = "'"${VERSION}"'"/' "$PYTHON_LIB"
        sed -i 's/__build__ = ".*"/__build__ = "'"${BUILD_NUMBER}"'"/' "$PYTHON_LIB"
        echo "✓ Updated zimlib.py version info"
    fi
fi

# Update TypeScript library
TS_LIB="${PROJECT_ROOT}/zimlib.ts"
if [ -f "$TS_LIB" ]; then
    if ! grep -q "export const VERSION" "$TS_LIB"; then
        # Append version exports at the end
        cat >> "$TS_LIB" << EOF

// Version information
export const VERSION = '${VERSION}';
export const BUILD = '${BUILD_NUMBER}';
export const COPYRIGHT = '${COPYRIGHT}';
EOF
        echo "✓ Updated zimlib.ts version info"
    fi
fi

# Update Go library
GO_LIB="${PROJECT_ROOT}/zimlib.go"
if [ -f "$GO_LIB" ]; then
    if ! grep -q "const Version" "$GO_LIB"; then
        # Add version constants after package declaration
        sed -i '/^package zimlib$/a\
\
// Version information\
const (\
	Version   = "'"${VERSION}"'"\
	Build     = "'"${BUILD_NUMBER}"'"\
	Copyright = "'"${COPYRIGHT}"'"\
)' "$GO_LIB"
        echo "✓ Updated zimlib.go version info"
    fi
fi

# Update PHP library
PHP_LIB="${PROJECT_ROOT}/zimlib.php"
if [ -f "$PHP_LIB" ]; then
    if ! grep -q "ZIMLIB_VERSION" "$PHP_LIB"; then
        # Add version constants after opening PHP tag
        sed -i '2a\
define("ZIMLIB_VERSION", "'"${VERSION}"'");\
define("ZIMLIB_BUILD", "'"${BUILD_NUMBER}"'");\
define("ZIMLIB_COPYRIGHT", "'"${COPYRIGHT}"'");\
' "$PHP_LIB"
        echo "✓ Updated zimlib.php version info"
    fi
fi

# Update Cargo.toml for zim-downloader
CARGO_TOML="${PROJECT_ROOT}/TOOLS/zim-downloader/Cargo.toml"
if [ -f "$CARGO_TOML" ]; then
    sed -i 's/^version = ".*"/version = "'"${VERSION}"'"/' "$CARGO_TOML"
    echo "✓ Updated Cargo.toml version"
fi

echo ""
echo "========================================"
echo "Build completed successfully!"
echo "Version: ${VERSION}+${BUILD_NUMBER}"
echo "========================================"
