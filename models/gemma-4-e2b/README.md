# models/gemma-4-e2b/

On-device LLM weights for EnZIME's Chat-with-ZIM pipeline. Loaded by
LiteRT-LM. Gemma 4 e2b's audio encoder also serves as the STT stage (no
separate Whisper).

## Expected files (placed by CHECKLIST task **M-GEMMA**)

- `gemma-4-e2b-q4.litertlm` — quantized weights, LFS-tracked
- `tokenizer.model` (or `tokenizer.json`) — LFS-tracked
- `MODEL_CARD.md` — committed plaintext
- `LICENSE` — committed plaintext (Gemma terms)

## Current state (2026-05-14, post M-GEMMA 3.2)

The two LFS-tracked files in this directory (`gemma-4-e2b-q4.litertlm`,
`tokenizer.model`) are **zero-byte placeholders**. Real weight content
requires operator Hugging Face authentication + Gemma license acceptance,
which is the follow-up CHECKLIST task `M-GEMMA-WEIGHTS-REAL` (to be
added once the operator is ready).

Until then, the app's LLM surface remains on `NullLlm` (returns
`llm: not loaded` to any `ai_chat` call). This is the v0 success
criterion — the round-trip works; the model is the swap-in unit.

## LFS host

Forgejo CT 106 (`192.168.0.159`) is the sole LFS host. GitHub mirrors source
+ pointers only, never blobs. Per-remote LFS disable on the `github` remote
plus the `scripts/hooks/pre-push` blocker enforce this.

CT 106 LFS disk capacity must be confirmed before placement — see
CHECKLIST task **M-GEMMA-PRECHECK**.
