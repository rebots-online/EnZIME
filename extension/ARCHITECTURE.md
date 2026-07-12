# EnZIME Extension — Architecture (stub)

> **Status:** bootstrap stub. Real architecture pass is authored in a
> dedicated session per "different sessions almost" project-boundary
> framing. This file captures the inherited constraints already
> established at suite design time.

## Suite role recap

Browser-side page-clipper. Captures content from pages the user is
browsing. Feeds the Creator app. Does NOT do ZIM production itself.

## Inherited constraints

| Topic | Constraint | Source |
|---|---|---|
| **Browser target** | Chrome MV3 primary; Firefox-portable secondary | `./CLAUDE.md`, operator note 2026-05-14 |
| **Scope** | Capture only, no processing; feeds Creator app | `./CLAUDE.md` |
| **Stack** | TypeScript strict; Vite or esbuild; no React by default | `./CLAUDE.md` |
| **Gating** | Free with no gates by default (top-of-funnel acquisition); structural carve-out for Creator-paid-feature integrations | `~/forgejo/admin/DOCS/IDEOLOGIES/non-artificial-gating.md` |
| **Output** | Clipped page = HTML + metadata + optional user-highlight sidecar; flows to Creator via TBD handoff | [[project_sidecar_annotations_and_metadata_interactivity]] |
| **Anti-fragility** | No third-party service dependencies for core function | `~/forgejo/admin/DOCS/IDEOLOGIES/anti-unnecessary-fragility.md` |

## Pending architectural work (Wave-future Extension session)

1. **Entity table** for the extension: manifest structure, content
   script, background service worker, popup UI, capture API, handoff
   protocol to Creator.
2. **Decision log** entries for:
   - Capture-to-Creator handoff mechanism (native messaging vs local
     HTTP vs cloud queue)
   - Whether Firefox build is shipped at v1 or deferred
   - Whether the popup UI uses React or plain DOM
   - Sidecar annotation creation in-browser (yes/no/Wave-future)
   - Clean-room research methodology participation
   - Premium-tier Creator-integration features
3. **CHECKLIST.md** rows for: manifest finalization, background worker
   skeleton, content script, popup UI, capture flow, Creator handoff.

## What's in this directory already (bootstrap state)

- `CLAUDE.md` — project-local rules.
- `ARCHITECTURE.md` — this file.
- `CHECKLIST.md` — bootstrap rows only.
- `manifest.json` — MV3 stub with name/version/permissions placeholders.
- `package.json` — stub naming; build toolchain pending.
- `src/background.ts` — service worker stub.
- `src/popup.html` — placeholder.
- `src/content.ts` — placeholder.

## What this directory does NOT have yet

- Real capture logic.
- Handoff mechanism to Creator.
- Sidecar annotation UI.
- Build configuration (no Vite config yet).
- Real popup UI beyond an HTML placeholder.
- Firefox-specific overrides.
- An icon set.
