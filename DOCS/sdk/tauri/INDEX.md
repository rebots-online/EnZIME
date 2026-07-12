# Tauri 2 — SDK docs (vendored snapshot)

**Vendored at:** `tauri-v2.11.1` / SHA `e5ae5b93cdd310045191cc0526f253140ad64b87` (see `vendor/tauri/PINNED.md`).

## In-vendor doc roots

- `vendor/tauri/crates/tauri/README.md` — main Tauri crate
- `vendor/tauri/crates/tauri-build/README.md` — build-script helpers
- `vendor/tauri/crates/tauri-bundler/README.md` — installer/bundler
- `vendor/tauri/crates/tauri-cli/README.md` — CLI tool
- `vendor/tauri/crates/tauri-codegen/README.md` — proc-macros
- `vendor/tauri/crates/tauri-plugin/README.md` — plugin authoring
- `vendor/tauri/crates/tauri-runtime/README.md` — windowing backend trait
- `vendor/tauri/crates/tauri-runtime-wry/README.md` — `wry` (webkit) impl
- `vendor/tauri/crates/tauri-schema-generator/` — config.schema.json source
- `vendor/tauri/CHANGELOG.md` — upstream changelog

## TC7 cross-refs (inline deep-link convention)

Per TC7, source code in `src-tauri/` should include inline comments
referencing specific sections of these in-vendor docs whenever a Tauri
API is non-obvious. Example:

```rust
// vendor/tauri/crates/tauri/README.md § "Commands" — invoke arg shape
#[tauri::command]
fn ...
```

## V0 → full-scrape TODO

This INDEX is a skeleton. The full per-API doc snapshot (e.g.
`tauri-core.md`, `android-plugin.md`, `fs-api.md`, `dialog-api.md` per
the plan) lands as a Phase 7+ CHECKLIST task once the EnZIME app
surface stabilizes and we know which APIs to deep-document.
