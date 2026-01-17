#!/bin/bash
# ZIM Downloader Build Script
# Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
#
# Builds cross-platform binaries for:
# - Windows (msi, exe/nsis)
# - Linux (deb, appimage)
# - macOS (dmg, app)

set -e

VERSION="0.1.0"
BUILD_NUMBER=$(( $(date +%s) / 60 % 100000 ))
FULL_VERSION="${VERSION}+${BUILD_NUMBER}"

echo "=========================================="
echo "ZIM Downloader Build Script"
echo "Version: ${FULL_VERSION}"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check dependencies
check_deps() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    command -v cargo >/dev/null 2>&1 || { echo -e "${RED}Rust/Cargo is required but not installed.${NC}"; exit 1; }
    command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required but not installed.${NC}"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed.${NC}"; exit 1; }
    
    echo -e "${GREEN}All dependencies found.${NC}"
}

# Build frontend
build_frontend() {
    echo -e "${YELLOW}Building frontend...${NC}"
    
    cd ui
    npm install
    npm run build
    cd ..
    
    echo -e "${GREEN}Frontend built successfully.${NC}"
}

# Build TUI binary
build_tui() {
    echo -e "${YELLOW}Building TUI binary...${NC}"
    
    cargo build --release --no-default-features --features tui
    
    # Rename with version
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        mv target/release/zim-downloader.exe "target/release/zim-downloader-tui-${FULL_VERSION}.exe"
    else
        mv target/release/zim-downloader "target/release/zim-downloader-tui-${FULL_VERSION}"
    fi
    
    echo -e "${GREEN}TUI binary built successfully.${NC}"
}

# Build Tauri GUI for current platform
build_tauri() {
    echo -e "${YELLOW}Building Tauri GUI...${NC}"
    
    cd ui
    npm run tauri build
    cd ..
    
    echo -e "${GREEN}Tauri GUI built successfully.${NC}"
}

# Build for all platforms (requires cross-compilation setup)
build_all_platforms() {
    echo -e "${YELLOW}Building for all platforms...${NC}"
    
    # Linux builds
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Building Linux targets..."
        
        # Native Linux build
        cd ui
        npm run tauri build -- --target x86_64-unknown-linux-gnu
        cd ..
        
        # Copy artifacts
        mkdir -p dist/linux
        cp -r src-tauri/target/release/bundle/deb/* dist/linux/ 2>/dev/null || true
        cp -r src-tauri/target/release/bundle/appimage/* dist/linux/ 2>/dev/null || true
    fi
    
    # Windows builds (requires cross-compilation or Windows host)
    if command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then
        echo "Cross-compiling for Windows..."
        cd ui
        npm run tauri build -- --target x86_64-pc-windows-msvc
        cd ..
        
        mkdir -p dist/windows
        cp -r src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/* dist/windows/ 2>/dev/null || true
        cp -r src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/* dist/windows/ 2>/dev/null || true
    fi
    
    echo -e "${GREEN}All platform builds completed.${NC}"
}

# Create PWA build
build_pwa() {
    echo -e "${YELLOW}Building PWA...${NC}"
    
    cd ui
    
    # Create PWA manifest
    cat > dist/manifest.json << EOF
{
  "name": "ZIM Downloader",
  "short_name": "ZIM DL",
  "description": "Browse and download ZIM files with annotations",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#f97316",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
EOF

    # Create service worker
    cat > dist/sw.js << 'EOF'
const CACHE_NAME = 'zim-downloader-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
EOF

    cd ..
    
    mkdir -p dist/pwa
    cp -r ui/dist/* dist/pwa/
    
    echo -e "${GREEN}PWA built successfully.${NC}"
}

# Show usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deps      Check dependencies"
    echo "  frontend  Build frontend only"
    echo "  tui       Build TUI binary only"
    echo "  tauri     Build Tauri GUI for current platform"
    echo "  all       Build for all platforms"
    echo "  pwa       Build PWA version"
    echo "  clean     Clean build artifacts"
    echo ""
}

# Clean build artifacts
clean() {
    echo -e "${YELLOW}Cleaning build artifacts...${NC}"
    
    rm -rf target/release/bundle
    rm -rf ui/dist
    rm -rf ui/node_modules
    rm -rf dist
    
    echo -e "${GREEN}Cleaned.${NC}"
}

# Main
case "${1:-all}" in
    deps)
        check_deps
        ;;
    frontend)
        check_deps
        build_frontend
        ;;
    tui)
        check_deps
        build_tui
        ;;
    tauri)
        check_deps
        build_frontend
        build_tauri
        ;;
    all)
        check_deps
        build_frontend
        build_tui
        build_tauri
        build_pwa
        ;;
    pwa)
        check_deps
        build_frontend
        build_pwa
        ;;
    clean)
        clean
        ;;
    *)
        usage
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Build complete!${NC}"
echo "Version: ${FULL_VERSION}"
