# LiteRT-LM — SDK docs (vendored snapshot)

**Vendored at:** main HEAD `1ff29cc6ce5cfdfe97839c17ecbca32bd16323d6` (see `vendor/litert-lm/PINNED.md`).
**Prebuilts stripped** per V-LITERT-FIX-PREBUILT — vendored source only.

## In-vendor doc roots

- `vendor/litert-lm/README.md` — top-level overview
- `vendor/litert-lm/docs/` — Google AI Edge LiteRT-LM docs
- `vendor/litert-lm/runtime/README.md` — C++ runtime structure (if present)
- `vendor/litert-lm/schema/` — flatbuffer schemas + capabilities
- `vendor/litert-lm/c/` — C API headers (FFI boundary for our Rust shim)
- `vendor/litert-lm/python/` — Python bindings (reference only, not used)
- `vendor/litert-lm/kotlin/` — Kotlin bindings (Android reference)

## Integration plan

EnZIME's Rust FFI shim against LiteRT-LM is gated on a future
CHECKLIST row that wires `cc-rs` + bindgen against `vendor/litert-lm/c/`.
Until then, the AI surface uses `NullLlm` from `src-tauri/src/ai/null.rs`.

## V0 → full-scrape TODO

This INDEX is a skeleton. Per-API docs (`android-mediapipe-llm-inference.md`,
`desktop-cpp-runtime.md`, `inference-api.md` per the plan) land in a
later CHECKLIST task when the FFI shim is being authored.
