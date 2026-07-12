#!/bin/bash
set -e
cd "$(dirname "$0")/.."
if [ -d "src-tauri/gen/android" ]; then echo "gen/android already exists, skipping init"; exit 0; fi
pnpm tauri android init --ci --skip-targets-install
