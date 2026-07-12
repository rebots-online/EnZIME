# Gemma 4 e2b — Model docs (EnZIME on-device LLM)

**Status:** model weights NOT yet placed in `models/gemma-4-e2b/`. The
`M-GEMMA 3.2` CHECKLIST task is operator-gated on Hugging Face auth +
Gemma license acceptance.

## Runtime

- Engine: LiteRT-LM (vendored at `vendor/litert-lm/`, see `DOCS/sdk/litert-lm/INDEX.md`)
- Quantization: q4 — file `models/gemma-4-e2b/gemma-4-e2b-q4.litertlm`
- Storage: Forgejo LFS (sole LFS host; GitHub mirror gets pointers only)

## Capabilities (per plan)

- Text generation (the standard LLM use)
- **Native audio encoder** — STT path for the Chat-with-ZIM pipeline.
  Mic input → Gemma audio encoder → text response → Piper TTS. No
  separate Whisper stage.

## Memory budget

- ~2.0 GB working set (q4 weights + KV cache + context window)
  vs ~2.5 GB if Whisper had been kept in the pipeline

## V0 → full-docs TODO

This INDEX is a skeleton. Per the plan, separate files land later:
- `MODEL_CARD.md` — capabilities, training data, evaluations
- `prompt-format.md` — system / user / assistant turn conventions
- `quantization-notes.md` — q4 vs q5 vs fp16 trade-offs for our targets

The `MODEL_CARD.md` skeleton lands via CHECKLIST `M-GEMMA-DOCS 3.3`.
