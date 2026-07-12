# LiteRT-LM Vendor Pin

**Status:** vendored at main HEAD (SHA 1ff29cc6ce5cfdfe97839c17ecbca32bd16323d6) on 2026-05-14.

## Pin metadata

| Field | Value |
|-------|-------|
| Upstream | https://github.com/google-ai-edge/LiteRT-LM |
| Tag | n/a (main HEAD at pin time) |
| Commit | 1ff29cc6ce5cfdfe97839c17ecbca32bd16323d6 |
| Pinned date | 2026-05-14 |
| Reason for pin | Google AI Edge LiteRT-LM C++ runtime; main HEAD selected because no stable tag published yet. |

## Post-vendor cleanup

`vendor/litert-lm/prebuilt/` (396 MB of `.so` / `.dylib` / `.dll`
release artifacts) was removed in commit following V-LITERT 1.2 per
architect decision 2026-05-14: vendoring is for source only.
Prebuilts are LFS-tagged upstream and conflict with the EnZIME
GitHub-mirror no-LFS policy.

To rebuild prebuilts locally: see upstream LiteRT-LM build docs.
For CI, prebuilts can be fetched as a separate artifact at build time.
