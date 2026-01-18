// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly TAURI_PLATFORM?: string;
  readonly TAURI_ARCH?: string;
  readonly TAURI_FAMILY?: string;
  readonly TAURI_PLATFORM_VERSION?: string;
  readonly TAURI_PLATFORM_TYPE?: string;
  readonly TAURI_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
