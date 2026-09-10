# EnZIME consolidated market skeleton
An independently runnable reference package with a landing page, traditional PDF/text/media Reader, local shared-root storage, final-text saving, and the preserved Knowledge Pysanky handoff.

## Run
Node 24+ required. From this directory:

```sh
npm ci
npm run build
npm test
npm start
```

Open http://127.0.0.1:4173 . Uses MBA_ROBIN_HOME, otherwise an OS data directory under mba.robin. This is a single-profile, loopback-only reference broker. Do not expose it on a public interface. The public landing should be deployed separately from private storage.

## Purchase routing
Set REVENUECAT_PURCHASE_URL to the actual dashboard-generated HTTPS pay.rev.cat URL and REVENUECAT_REDEMPTION_ENABLED=true only after enabling anonymous redemption in RevenueCat. With no configuration, checkout fails closed and the landing says purchases are not open. Prices are not invented. This package does not issue paid entitlements or receive production webhooks. billing.mjs contains a tested Ed25519 verification primitive for later authenticated BIDLR integration.

## What is demonstrated
Import PDF, text/Markdown, MP3, MP4, ZIM and GGUF bytes; PDFs render through bundled PDF.js; text renders as safe text; media uses native controls. ZIM and model objects are stored but their engines are not connected. Saved place and one per-work note persist in SQLite. Final text produces immutable content-addressed objects. Identical bytes deduplicate; a mature edition/reference layer is still required.

ThinkSpace.tsx is the original uploaded handoff, preserved separately and bundled into /thinkspace.html. It is a demo, not the final secure graph module. Its endpoint requests are restricted by the preview's CSP. Full 6DoF, rare egg, graph persistence and source-reader bridging remain gates.

## Product contract
- docs/PRD.md — mature product specification, including Catholic bookstore and traditional Reader.
- docs/RELEASE_CHECKLIST.md — market readiness gates and evidence template.
- docs/DONOR_AUDIT.md — source comparison and recovery decisions.
- docs/INTEGRATION.md — adapter and deployment boundaries.

Design: https://www.figma.com/design/JgLu0wuuXUwNplf2tjUXwf

## Limits
PDF canvas preview does not yet include selectable text, outline/search or an accessibility text layer. Text preview is limited to 10 MiB. The reference store has no authenticated multi-app grants, migration framework, resumable download, garbage collection or encrypted profiles. A single note is not the mature annotation system. No live payment, native package, or complete ZIM/AI integration is claimed.
