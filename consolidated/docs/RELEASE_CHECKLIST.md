# Complete-to-market checklist
10 September 2026. Checked means demonstrated in this skeleton, not production-certified.

## A. Reference skeleton
- [x] Independent build and start command; legacy application unchanged.
- [x] Responsive landing and honest purchase availability CTA.
- [x] Bundled PDF.js page reader, zoom, PDF import; text and MP3/MP4 paths.
- [x] Streamed asset storage, SHA-256 deduplication, SQLite metadata and reading state.
- [x] Save final text without overwriting prior object bytes.
- [x] Original Knowledge Pysanky handoff retained and bundled as a labelled demo.
- [x] Checkout configuration validation and signed entitlement verification primitive.
- [x] Four focused automated tests for persistence, integrity boundaries, checkout configuration, signed claims and API origin/range handling.
- [x] Mature PRD with named requirements, platform boundaries and release stages.

## B. Reader beta — engineering and QA
### Foundational access gate: DynDon / practical prepper
- [ ] DD-01: coordinated mba.robin budget, safety reserve and peak/final storage accounting. Owner: storage engineering. Evidence: concurrent reservation and low-space fixtures.
- [ ] DD-02/03: balanced topic hierarchy by default; explicit domain and depth/breadth controls. Owner: retrieval/planner engineering. Evidence: skewed-domain fixture, per-topic coverage report and deterministic plans at multiple budgets.
- [ ] DD-04: edition-bound manifest, remote planning without full local source, dependency-complete acquisition and validated sparse-reader or subset-ZIM strategy. Owner: archive engineering. Evidence: actual downloaded Wikipedia fixture and offline resources test.
- [ ] DD-05/08: pause/restart/resume, integrity and offline rehearsal; accurate selected-plan versus full-archive readiness. Owner: QA. Evidence: network-disabled restart with representative articles, search and notes; unavailable account/billing/model services do not block installed reading.
- [ ] DD-06: grow/shrink coverage with pinned material, notes and finished work protected. Owner: storage engineering. Evidence: interrupted resize and rollback test.
- [ ] DD-07: bounded memory and battery-aware operation; verified SD/USB/LAN collection transfer. Owner: platform engineering. Evidence: two-device offline import and private-note consent test.

### Reader and platform integration
- [ ] ZIM-01/02: wire canonical AnZimmermanLib through adapter; run valid and hostile fixture corpus. Owner: reader engineering. Evidence: native and browser fixture report.
- [ ] READ-01/02: PDF text layer, search, outline, thumbnails, continuous rendering and annotation rectangles. Owner: reader engineering. Evidence: 500-page and scanned-book tests, screen-reader run.
- [ ] READ-03: EPUB and sanitized HTML reading, TOC and stable locations. Owner: reader engineering. Evidence: EPUB conformance fixtures and restart test.
- [ ] READ-05/06: multi-note annotation records, anchored selections, export, and orphan repair. Owner: data engineering. Depends: canonical locators.
- [ ] LIB-02/03: separate work/edition references from deduplicated objects; resumable transfer, quotas and staging recovery. Owner: storage engineering.
- [ ] STORE-04: authenticate multi-app broker, scope profiles/grants, Android SAF provider and web OPFS adapters. Owner: platform engineering. Evidence: cross-app denial and explicit-share tests.
- [ ] STORE-05: backup/restore, migration rollback, disk-full and interrupted-write tests. Owner: data engineering.
- [ ] BOOK-01..06: wire Sanctissimissa bookstore adapter and one verified edition end to end. Owner: integration engineering + catalogue editor. Evidence: source/rights record and shared-reader acceptance recording.
- [ ] REL/ACC: native Windows/Linux/Android packages, offline tests, accessibility and performance budgets. Owner: platform QA. Evidence: named hardware/build/fixture report.

## C. Commercial launch — blocking before sales
- [ ] BILL-01: central account authentication and provider-principal mapping. Owner: identity engineering.
- [ ] BILL-02: owner connects payment provider, creates sandbox/production products, offering and hosted purchase links; enable redemption for anonymous checkout. Owner: product owner.
- [ ] BILL-03: implement actual RevenueCat verification/normalization/reconciliation in BIDLR. Current BIDLR inbox capture is insufficient. Owner: billing engineering.
- [ ] BILL-03/05: gauntlet for purchase, pending, failed payment, duplicate, reordered event, refund, expiry, restore, account transfer, forged token, key rotation and offline grace. Owner: billing QA.
- [ ] BILL-04: hosted usage reserve/settle/release and refund accounting before charging usage. Owner: billing engineering.
- [ ] BILL-06: approve exact prices, currency, Studio perpetual terms, update eligibility and hosted service offer. Owner: product owner.
- [ ] BILL-07: account management, support, restore, reconciliation alerts and operational runbook. Owner: operations.
- [ ] Controlled real purchase, entitlement activation on second device, restore and refund; attach redacted provider evidence. Owner: product owner + QA.
- [ ] Public landing terms/privacy/support links, signed installers, update rollback and final catalogue clearance. Owner: release manager.

## D. Mature product
- [ ] KG-01: true six-axis camera including roll; persistent views and accessible list alternative.
- [ ] KG-02..04: source-linked graph edit/persistence, inference provenance and validated imports.
- [ ] KG-05: distinct rare Fabergé-style egg event; opt-in game, mute, reduced motion, isolated scoring.
- [ ] AI-01/02: connect actual local runtime and supported model matrix; measured load/generation/cancel/OOM tests.
- [ ] AI-03/04: grounded retrieval and explicit hosted-provider privacy/cost consent.
- [ ] CREATE-01..03: private drafts, revision lineage, rich exports, explicit publishing and receipt.

## Release evidence template
Requirement ID / owner / commit / platform / fixture hash / procedure / expected outcome / actual result / evidence link / reviewer / remaining defects. Record failures as failures. Completion percentages are not a substitute for these gates.
