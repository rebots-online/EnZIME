# Piper — TTS SDK docs (in-process Rust)

**Status:** Piper is NOT vendored in-tree. Unlike Tauri / LiteRT-LM /
AnZimmermanLib (the four wholesale-import SDKs), Piper is consumed as
an ordinary Rust dependency once a CHECKLIST row introduces it. Until
then, the TTS surface uses `NullTts` from `src-tauri/src/ai/null.rs`.

## Why not vendored

Per the plan's SDK rule, only the four load-bearing audit-critical SDKs
get wholesale vendoring. Piper meets the "in-process Rust TTS" need but:

- It has a clean Rust binding crate (likely `piper-rs` or similar)
- It does not need patches we'd struggle to ship without forking
- Its on-disk voice files are LFS-tracked under `voices/` per
  `.gitattributes`, not under `vendor/`

## Voice files

Voice models live at `voices/<lang>-<speaker>.onnx` + `voices/<lang>-<speaker>.json`
under LFS (Forgejo only). No voices are placed yet; a Phase 7+ row
introduces the bundled default voice.

## V0 → integration TODO

Concrete `PiperTts` impl of `crate::ai::Tts` lands when:
1. The voice file convention is finalized
2. `piper-rs` (or equivalent) is added to `src-tauri/Cargo.toml`
3. A test fixture verifies round-trip text → PCM samples
