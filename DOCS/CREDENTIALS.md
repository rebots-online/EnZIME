# EnZIME Credentials

Moved 2026-07-11 to `~/Admin-Manual/CREDENTIALS/EnZIME.md` ahead of this
repo going public as `github.com/rebots-online/EnZIME`. This file
intentionally contains no secret values — it exists so anyone reading the
repo knows what `.env` needs and where the real values live.

## What `.env` must contain (values in the central store, not here)

| Var | Purpose |
|---|---|
| `MIRROR_PRIV_HEX` / `MIRROR_PUB_HEX` | Mirror-manifest ed25519 signing keypair |
| `UPDATE_PRIV_HEX` / `UPDATE_PUB_HEX` | Update-manifest ed25519 signing keypair |
| `KEYSTORE_PATH` | Path to the shared HelloWord Android keystore (not in this repo) |
| `KEYSTORE_PASSWORD` / `KEY_PASSWORD` | Android keystore credentials |
| `HF_TOKEN` | Hugging Face model-weight downloads |
| `RC_SECRET_KEY` / `STRIPE_SECRET_KEY` / `BTCPAY_API_KEY` | Payment/entitlement bridge (add when implemented) |

`.env.example` enumerates the same var names with placeholder values.
`.env` itself is gitignored.

## Getting the real values

Read `~/Admin-Manual/CREDENTIALS/EnZIME.md` (operator machine only — that
store is never published). It documents rotation policy and compromise
procedures for each credential.
