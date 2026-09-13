# Complete-to-market checklist
11 September 2026. Checked means demonstrated in this skeleton, not production-certified.

## PR2 reference scope and review dispositions (13 September 2026)

The owner authorized the existing PR design as an executable Node/esbuild reference and local beta. This scoped exception addresses review 3978345743; native Tauri 2/Rust/Vite packages for Windows, Linux and Android remain a release gate. Apple targets are excluded by `INV-NO-APPLE` (3978345849). Review 3998998904: the approved LFM2.5/Bonsai and llama.cpp-compatible/TurboQuant evaluation requirements are explicitly scoped to this reference/local beta. They do not silently replace the root native Gemma/LiteRT baseline. Reconcile and qualify native model/runtime choices before release; this PR does not install or migrate a model runtime.

ThinkSpace is a labelled interaction demo, outside Reader offline acceptance (3985321551). Its blank embedding host produces deterministic layout vectors, not semantic embeddings; chat requires a configured service. The broker's existing `connect-src 'self'` blocks cross-origin connections, including LAN and other loopback ports. Configuring those hosts does not establish that this bundled demo can connect, and no CSP relaxation or native bridge is supplied here. Production local inference and grounded offline retrieval must pass Stage B.

Model-host reviews 3978403446 and 3985321847 are addressed with explicit, per-endpoint session approval before model listing, embeddings or chat; host, key or protocol-mode edits revoke approval. Only fixed model API routes on credential-free HTTP(S) service origins are allowed. Remote services require HTTPS; API keys require HTTPS except on loopback. Fetches omit browser credentials and referrers and reject redirects. Approved local/LAN services remain an intended integration; this is a browser request boundary, not server-side SSRF. Service operators receive the explicitly disclosed text and any configured key. Local DNS/service integrity and the receiving model service remain trusted; endpoint approval does not authenticate a server or override CSP/CORS. Future native connectivity requires its own permission and offline acceptance evidence.

Local broker review 3978345950 is a documented trust boundary: the loopback broker trusts local-host processes. `X-MBA-Client` is a browser-origin guard, not authentication; a publicly retrievable random token would not isolate hostile local clients. Bind only to `127.0.0.1`, retain private profile directory/file permissions, and do not claim multi-user or hostile-local-process isolation. Such isolation requires a separately authenticated/scoped broker and remains part of STORE-04 acceptance.

ThinkSpace regression scope: bounded JSON bytes and input counts before normalization, at most 800 visible nodes/3,200 edges, sampled repulsion with at most 48 peers per node, and Markdown ingestion limited to 128 documents/512 KiB each/8 MiB total. These bounds are not evidence of the production 30 fps target. Imported HTML uses an opaque-origin, scriptless sandbox with a restrictive resource policy; HTML selection annotations and in-document privileged navigation are unavailable, while graph links and Markdown annotations remain available. Citation chips validate exact, unambiguous titles actually cited in the answer; semantic support for each claim still needs production retrieval evaluation. Sky uses orientation only and remains off if permission is denied or unavailable.

### PR2 verification receipt: 13 September 2026

Run in the shared PR2 worktree with Node v24.18.0, including the integrator's concurrent atomic-state fixes, before the integration commit:

- `cd consolidated && node --test test/thinkspace-review.test.mjs`: exit 0, 27 passed, 0 failed. Includes final SSE/NDJSON records without newlines, split UTF-8 and terminal `[DONE]` cancellation (3998998889), plus rejection of remote domain names resembling private IPv4 prefixes.
- `cd consolidated && npm test`: exit 0, 47 passed, 0 failed, 0 skipped. This is a dated run result, not a permanent suite-size claim.
- `cd consolidated && npm run build`: exit 0; observed `PDF.js and preserved ThinkSpace bundled locally.` The earlier JSX error at ThinkSpace line 755 was corrected before this successful build.

ThinkSpace tests execute the component handlers with a minimal hook/event harness and test the shared guards directly. They assert sandbox attributes/resource policy and mocked network behavior; they do not constitute browser-engine isolation, real model-host connectivity, device sensor, auditory or frame-rate measurements. Those remain named platform/release evidence gates. The parent integrator supplies the publication commit and merge receipt.

## A. Reference skeleton
- [x] Independent build and start command; legacy application unchanged.
- [x] Responsive landing and honest purchase availability CTA.
- [x] Bundled PDF.js page reader, zoom, PDF import; text and MP3/MP4 paths.
- [x] Streamed asset storage, SHA-256 deduplication, SQLite metadata and reading state.
- [x] Save final text without overwriting prior object bytes.
- [x] Original Knowledge Pysanky handoff retained and bundled as a labelled demo.
- [x] Checkout configuration validation and signed entitlement verification primitive.
- [x] Reproducible automated suites: `cd consolidated && npm test`; build: `npm run build`. Named cases cover persistence, integrity, checkout/signed claims, reader state and API boundaries, plus ThinkSpace import, controls, content isolation and model-request regressions. Use the dated PR run receipt for observed results, not a stale prose count (3998998936).
- [x] Mature PRD with named requirements, platform boundaries and release stages.

## B. Prepper Reader and local-intelligence beta — engineering and QA
### Foundational access gate: DynDon for all ZIM downloads and generations
- [ ] DD-01: coordinated mba.robin budget, safety reserve and peak/final storage accounting. Owner: storage engineering. Evidence: concurrent reservation and low-space fixtures.
- [ ] DD-02/03: balanced topic hierarchy by default; explicit domain and depth/breadth controls. Owner: retrieval/planner engineering. Evidence: skewed-domain fixture, per-topic coverage report and deterministic plans at multiple budgets.
- [ ] DD-04: edition-bound manifest, remote planning without full local source, dependency-complete acquisition and validated sparse-reader or subset-ZIM strategy. Owner: archive engineering. Evidence: Wikipedia and non-Wikipedia downloaded fixtures, complete-work preservation and offline resources tests.
- [ ] DD-05/08: pause/restart/resume, integrity and offline rehearsal; accurate selected-plan versus full-archive readiness. Owner: QA. Evidence: network-disabled restart with representative articles, search and notes; unavailable account/billing/model services do not block installed reading.
- [ ] DD-06: grow/shrink coverage with pinned material, notes and finished work protected. Owner: storage engineering. Evidence: interrupted resize and rollback test.
- [ ] DD-07: bounded memory and battery-aware operation; verified SD/USB/LAN collection transfer. Owner: platform engineering. Evidence: two-device offline import and private-note consent test.

- [ ] DD-09: all ZIM generation/regeneration paths consume the shared plan; reserve peak scratch space, validate actual compressed size and atomically commit valid new artifacts. Owner: writer/storage engineering. Evidence: new archive, edited collection, underestimated output, cancellation and interrupted-write fixtures.
- [ ] DD-10: common routing across EnZIME/Sanctissimissa and source capability discovery. Owner: integration engineering. Evidence: Wikipedia download, non-Wikipedia download, new generation and regeneration use the same service; missing taxonomy/manifest has an explicit supported route.

### Mandatory local practical intelligence — launch blocker
- [ ] AI-01/02: ship an installed local runtime and baseline model on every launch profile; CPU, accelerator, startup, cancel, recovery and offline tests. Owner: inference/platform engineering. Evidence: terminate the local embedding engine mid-import, verify responsive controls and preserved source/progress, then resume locally without reimport.
- [ ] AI-03/05: local retrieval and cross-source practical synthesis with exact citations, supported constraints, permissioned local tools and persistent drafts. Owner: retrieval/application engineering. Evidence: source-conflict, tool/DOM and ask-to-save fixtures, plus new-document indexing with real embeddings while WAN/LAN are blocked.
- [ ] AI-06: qualified compact LFM2.5 and Bonsai27B binary/ternary profiles, in-app choice, reproducible uncensored/abliterated derivatives and exact model/runtime catalogue. Owner: model engineering. Evidence: hash/licence/template/kernel matrix and measured quality/speed/RAM.
- [ ] AI-07: role-specific fine-tuning with provenance-tracked data and held-out practical task improvement; evaluate ablation and tool reliability. Owner: model/evaluation engineering. A prompt-only persona does not pass.
- [ ] AI-08: integrate and measure TurboQuant KV/weight modes separately; prove selected Bonsai/kernel/cache combinations. Owner: runtime engineering. Evidence: memory, speed and quality comparisons on each shipped profile; qualified local recovery path.
- [ ] AI-09 and section 16: meet context, latency, sustained generation and practical-quality floors on modest CPU/Android profiles. Owner: performance QA. Evidence: pinned 16K context/tool/RAG fixture, 15-minute thermal run and frozen scoring rubric.
- [ ] AI-10/DD-01: complete offline readiness pack and shared model/ZIM reservations; preserve the only qualified model during DynDon resizing. Owner: storage/platform engineering. Evidence: fresh offline install, USB transfer, cold restart and source-synthesis rehearsal.
- [ ] AI-04/BILL-06: local capability included in every prepper offer; no cloud fallback, hosted credits or fresh entitlement dependency. Owner: commercial QA. Evidence: provider/account outage and hosted-plan expiry.

### Reader and platform integration
- [ ] CREATE-01/AI-05/10: baseline private draft, source/model provenance and immutable local save support the complete ask-to-save launch journey. Owner: application/data engineering. Evidence: offline draft recovery, explicit finalization and prior-object preservation.
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
- [ ] All Stage B local-AI and DynDon gates passed; practical intelligence is demonstrated as a launch selling point on every advertised profile. Owner: release manager.
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
- [ ] Expand local models, domain tuning and synthesis beyond the mandatory launch baseline; retain all launch quality gates.
- [ ] CREATE-01..03 expansion: advanced revision management, rich PDF/EPUB/ZIM exports and explicit external publishing with receipts, beyond the mandatory launch draft/save/provenance path.

## Release evidence template
Requirement ID / owner / commit / platform / fixture hash / procedure / expected outcome / actual result / evidence link / reviewer / remaining defects. Record failures as failures. Completion percentages are not a substitute for these gates.
