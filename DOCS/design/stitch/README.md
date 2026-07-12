# Stitch UI samples — EnZIME

Source: Google Stitch project `projects/10341950726478924497` ("EnZIME"),
fetched 2026-05-14 via `mcp__stitch__list_screens`.

These are **design references**, not production code. Treat them like
Figma exports: the HTML is single-file Tailwind-styled markup useful for
extracting layout, spacing, and color choices; the PNG is the rendered
preview. Production UI lives at `frontend/src/components/**`.

| # | Title | HTML | Screenshot | Device | Size |
|---|---|---|---|---|---|
| 01 | EnZIME Landing Page | [01-landing.html](01-landing.html) | [01-landing.png](01-landing.png) | DESKTOP | 2560×4552 |
| 02 | The Navigator (Flagship View) | [02-navigator.html](02-navigator.html) | [02-navigator.png](02-navigator.png) | DESKTOP | 2560×2048 |
| 03 | Archive Library Manager | [03-archive-library.html](03-archive-library.html) | [03-archive-library.png](03-archive-library.png) | DESKTOP | 2560×2176 |
| 04 | Reading & Annotation Mode | [04-reading-annotation.html](04-reading-annotation.html) | [04-reading-annotation.png](04-reading-annotation.png) | DESKTOP | 2560×2048 |
| 05 | Product Requirements Document | [05-prd.html](05-prd.html) | _(no screenshot)_ | DESKTOP | 600×900 |

## Mapping to entity table

When wiring these into real components, prefer extracting Tailwind class
patterns and layout structure over wholesale copy-paste. The
authoritative component surface is `DOCS/ARCHITECTURE/ENTITIES_FULL.md`
plus `frontend/src/components/**`.

- 02-navigator → `ChatPane` + `ZimBrowser` split view (the flagship)
- 03-archive-library → ZIM file manager (likely a `SettingsPane` tab)
- 04-reading-annotation → `AnnotationsList` + reader pane integration
- 01-landing → marketing/onboarding surface; not in current scaffold
- 05-prd → operator artifact, not a runtime screen

## Refresh

```bash
# From any cwd, with $REPO set to the checkout path:
# (uses mcp__stitch__list_screens via Claude Code; no direct CLI)
```
