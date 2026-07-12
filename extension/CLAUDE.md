# EnZIME Extension — project-local Claude Code instructions

> **Placeholder name.** "EnZIME Extension" / "EnZIME Firefox or
> whatever Chrome Extension" are working labels per operator note
> 2026-05-14. Real name TBD. The `extension/` directory name is chosen
> to be naming-neutral and won't be load-bearing when the real name is
> picked.

Inherits from the suite-level `../CLAUDE.md` and the global spine at
`~/.claude/CLAUDE.md`. This file documents **extension-specific**
overrides.

## Role in the suite

The Extension is a **browser-side page-clipper** that feeds the
Creator app. It does NOT do its own ZIM production; it captures
content (rendered HTML, metadata, user-annotated highlights) from
pages the user is browsing and queues that content for the Creator
app to encode into a ZIM later.

Three apps in the suite:

| App | Role | Location |
|---|---|---|
| **Reader** (EnZIME) | Consume ZIMs | `../src-tauri/` + `../frontend/` |
| **Creator** | Produce ZIMs | `../creator/` |
| **Extension** (this) | Browser-side clipper that feeds Creator | `./` |

## Browser target

**Chrome MV3 primary; Firefox-portable secondary.** Manifest V3 works
on both Chrome (Chromium-derivatives) and Firefox (with minor caveats
around event pages vs service workers). The bootstrap manifest targets
the common subset; Firefox-specific overrides go in
`./firefox-overrides.json` when Firefox build is added.

Per operator's working-label note: "EnZIME Firefox or whatever Chrome
Extension" — the operator hasn't decided Chrome-only vs cross-browser
yet. Default for the scaffold is Chrome MV3 with cross-browser
portability preserved.

## Role-specific constraints

- **Lightweight.** The extension is NOT the primary collection
  mechanism. The Creator app has its own ingestion (drag-and-drop,
  URL paste, batch import). The extension is a convenience for "I'm
  reading this page anyway; clip it now while it's in front of me."
- **Doesn't process content.** Capture only. No ZIM encoding in the
  browser. No metadata interpretation beyond what's needed to
  preserve the capture (URL, title, timestamp, optional user
  highlight ranges).
- **Communicates with the Creator app, not the Reader.** The Creator
  may be running locally or may receive captured items via a
  shared queue (browser local storage, native messaging, or a
  per-user cloud sync — architect-session decision).
- **Network-using by definition.** It's a browser extension; the
  browser is online. No INV-OFFLINE concerns.

## Invariants

- **INV-NO-EXPO** binds (trivially — no React Native in a Chrome
  extension).
- **INV-NO-APPLE** does not really apply (Safari extension is a
  different format, possibly excluded by ideological inheritance
  but TBD).
- **Anti-unnecessary-fragility** applies — extension should not
  depend on third-party services for its core function. Sending
  captures to the user's Creator instance (local or operator-mirror)
  is the only network destination.

## Gating / monetization shape

The extension is likely **free with no gates** — it's a top-of-funnel
acquisition surface. Charging for a page-clipper would be artificial
gating in the [[non-artificial-gating]] sense (the user can clip
pages by other means; the extension's value is convenience). The
Creator app is where monetization lives; the extension is the funnel.

Exception: a premium extension feature could be "auto-clip to a
named Creator project" requiring entitlement-level Creator features.
That's structural (it uses paid Creator infrastructure) so it's
defensible.

## Stack

- **TypeScript** with strict mode.
- **Build tool**: Vite or esbuild (lightweight; Vite for
  consistency with reader/creator frontend if possible).
- **No React** by default — the popup UI is small enough for plain
  DOM. Architect session may overrule.
- **Manifest V3** with service worker background, content script,
  popup HTML.

## Architecturally-significant features (Wave-future)

Forwarded from suite-level memory; will become per-app entity rows
when this app gets its dedicated architect session:

- **Capture queue + Creator handoff** — how clipped pages reach the
  Creator app. Options: native messaging host, local server endpoint,
  shared cloud queue (paid-only). Architect-session decision.
- **Sidecar annotation creation in-browser** — user highlights a
  passage in the browser; the extension captures it as a sidecar
  annotation that ships with the page-clip to the Creator. Aligns
  with [[project_sidecar_annotations_and_metadata_interactivity]].
- **Mesh-shareability of clips** — clipped pages, once in the
  Creator, become mesh-shareable artifacts per
  [[project_lora_mesh_knowledge_sharing]]. The extension itself
  doesn't participate in mesh (browser context), but its outputs do.
- **Clean-room research methodology participation** — the extension
  could be the "source-reading stage" surface
  ([[project_clean_room_research_methodology]]). User browses
  sources; extension captures with attestation; methodology log
  flows to Creator for synthesis. This is interesting and
  defensible.

## Phase discipline

Same I-1 through I-10 invariants as the rest of the suite. Real
`./ARCHITECTURE.md` and `./CHECKLIST.md` rows beyond bootstrap are
authored in the Extension's dedicated architect session.

## Cross-references

- Suite-level `../CLAUDE.md`
- `../creator/CLAUDE.md` (the Creator app this extension feeds)
- `../CLAUDE.md` (reader, for context)
- Project memory + suite ideology directories.
