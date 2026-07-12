# EnZIME Suite — Build Environment

This document describes environment variables and configuration options for building the EnZIME Suite.

## Environment Variables

### `ENZIME_MIRROR_URL`

Compile-time mirror base URL for model weight downloads. Used by `model_fetcher/mirror.rs` via `option_env!()` with a fallback default.

**Default value:** `https://lfs.git.robin.mba/rcheung/EnZIME/raw/branch/master/models`

**Usage:** Set this at compile time to override the mirror URL for CI builds or alternative model sources.

```bash
# Example: Override for CI build
ENZIME_MIRROR_URL="https://alternative-mirror.example.com/models" cargo build
```

**Entity reference:** E-BLD-23 in `DOCS/ARCHITECTURE.md` §7.8

### `ENZIME_UPDATE_URL`

Compile-time update channel base URL for app updates. Used by `app_update/mod.rs` via `option_env!()` with a fallback default.

**Default value:** `https://lfs.git.robin.mba/rcheung/EnZIME/raw/branch/master/releases`

**Usage:** Set this at compile time to override the update server URL for CI builds or alternative update sources.

```bash
# Example: Override for CI build
ENZIME_UPDATE_URL="https://alternative-updates.example.com/releases" cargo build
```

**Entity reference:** E-BLD-24 in `DOCS/ARCHITECTURE.md` §7.8
