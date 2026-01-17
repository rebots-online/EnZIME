#!/bin/bash
# EnZIM Build Script
# Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Version info
VERSION="0.1.0"

# Calculate epoch-based build number (last 5 digits of epoch minutes)
get_build_number() {
    local epoch_seconds=$(date +%s)
    local epoch_minutes=$((epoch_seconds / 60))
    local build_number=$((epoch_minutes % 100000))
    printf "%05d" $build_number
}

BUILD_NUMBER=$(get_build_number)
FULL_VERSION="v${VERSION}.${BUILD_NUMBER}"

echo -e "${GREEN}EnZIM Build Script${NC}"
echo -e "Version: ${FULL_VERSION}"
echo -e "Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved."
echo ""

# Update version in tauri.conf.json
update_tauri_version() {
    echo -e "${YELLOW}Updating version in tauri.conf.json...${NC}"
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" src-tauri/tauri.conf.json
}

# Build frontend
build_frontend() {
    echo -e "${YELLOW}Building frontend...${NC}"
    npm run build
    echo -e "${GREEN}Frontend built successfully.${NC}"
}

# Build Tauri for current platform
build_tauri() {
    echo -e "${YELLOW}Building Tauri application...${NC}"
    npm run tauri build
    echo -e "${GREEN}Tauri application built successfully.${NC}"
}

# Build for development
build_dev() {
    echo -e "${YELLOW}Starting development server...${NC}"
    npm run tauri dev
}

# Rename artifacts with version
rename_artifacts() {
    echo -e "${YELLOW}Renaming artifacts with version...${NC}"
    
    local dist_dir="src-tauri/target/release/bundle"
    
    # Linux artifacts
    if [[ -d "${dist_dir}/deb" ]]; then
        for f in ${dist_dir}/deb/*.deb; do
            if [[ -f "$f" ]]; then
                new_name=$(echo "$f" | sed "s/\.deb$/_${BUILD_NUMBER}.deb/")
                mv "$f" "$new_name" 2>/dev/null || true
            fi
        done
    fi
    
    if [[ -d "${dist_dir}/appimage" ]]; then
        for f in ${dist_dir}/appimage/*.AppImage; do
            if [[ -f "$f" ]]; then
                new_name=$(echo "$f" | sed "s/\.AppImage$/_${BUILD_NUMBER}.AppImage/")
                mv "$f" "$new_name" 2>/dev/null || true
            fi
        done
    fi
    
    # Windows artifacts
    if [[ -d "${dist_dir}/msi" ]]; then
        for f in ${dist_dir}/msi/*.msi; do
            if [[ -f "$f" ]]; then
                new_name=$(echo "$f" | sed "s/\.msi$/_${BUILD_NUMBER}.msi/")
                mv "$f" "$new_name" 2>/dev/null || true
            fi
        done
    fi
    
    if [[ -d "${dist_dir}/nsis" ]]; then
        for f in ${dist_dir}/nsis/*.exe; do
            if [[ -f "$f" ]]; then
                new_name=$(echo "$f" | sed "s/\.exe$/_${BUILD_NUMBER}.exe/")
                mv "$f" "$new_name" 2>/dev/null || true
            fi
        done
    fi
    
    echo -e "${GREEN}Artifacts renamed.${NC}"
}

# Show help
show_help() {
    echo "Usage: ./build.sh [command]"
    echo ""
    echo "Commands:"
    echo "  dev       Start development server"
    echo "  build     Build for production (current platform)"
    echo "  frontend  Build frontend only"
    echo "  version   Show version info"
    echo "  help      Show this help message"
    echo ""
    echo "Build number: ${BUILD_NUMBER}"
    echo "Full version: ${FULL_VERSION}"
}

# Main
case "${1:-build}" in
    dev)
        build_dev
        ;;
    build)
        update_tauri_version
        build_frontend
        build_tauri
        rename_artifacts
        echo ""
        echo -e "${GREEN}Build complete!${NC}"
        echo -e "Version: ${FULL_VERSION}"
        ;;
    frontend)
        build_frontend
        ;;
    version)
        echo "${FULL_VERSION}"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
