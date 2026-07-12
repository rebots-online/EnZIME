# Gemma 4 e2b — Model Card

> **Status:** placeholder. Real content lands once `M-GEMMA 3.2` (Hugging
> Face weight download, operator-gated on Gemma license acceptance)
> completes. Until then this card documents the *intent* for the slot.

## Identity

- **Model:** Gemma 4 e2b (effective-2B-parameter family)
- **Provider:** Google
- **License:** Gemma Terms of Use (see `LICENSE` in this directory)
- **Quantization in-tree:** q4 — file `gemma-4-e2b-q4.litertlm`

## Why this model for EnZIME

- Native multimodal audio encoder — collapses the Chat-with-ZIM voice
  pipeline (no separate Whisper STT stage)
- Effective-2B class — fits the desktop + Android memory budget
- LiteRT-LM is Google AI Edge's runtime, so a Google model + Google
  runtime is a coherent integration unit

## Capabilities (per upstream)

- Text generation
- Audio understanding (PCM in → text out via the audio encoder)
- Long-context with KV cache management

## Evaluations (placeholder)

To be populated from the upstream HF card upon weight acquisition.

## Limitations

- Not a frontier model — accuracy below the 70B+ class
- Audio encoder accuracy depends on input sample rate (target 16 kHz)
- Quantization to q4 trades ~1-2% benchmark accuracy for ~4x size
  reduction vs fp16; acceptable for the on-device pipeline
