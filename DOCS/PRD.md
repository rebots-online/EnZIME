# PRD — `EnZIME` (Reader)

**Inception date:** `2026-05-14` [INFERRED from git log — first commit `9b4bc63` "chore: initialize EnZIME rearchitecture (2026-05-14)"; predecessor EnZIMErgent (Expo/RN) predates this]
**Owner:** Robin L. M. Cheung
**Status:** `active`
**Reference conversation:** `~/.claude/plans/is-this-repo-the-expressive-tower.md` [INFERRED from README — "Approved scaffolding plan"]

> **Backfill notice.** This PRD was reconstructed 2026-06-11 from project
> artifacts (codegraph index, `DOCS/ARCHITECTURE.md` v1.0 attested snapshot,
> `CHECKLIST.md`, `CLAUDE.md`, CI workflows, git history). Tags: `[INFERRED
> from <source>]` = confident derivation, operator confirms by silence;
> `[VERIFY]` = operator must confirm before next-phase work; `[GAP]` = no
> artifact answers this, operator input required. Gaps are enumerated in §15.
>
> **Scope.** The EnZIME suite repo hosts three apps (Reader, Creator,
> Extension) under soft project boundaries. This PRD scopes the **Reader**
> only, matching `DOCS/ARCHITECTURE.md`'s scope. Creator and Extension get
> their own PRDs at their own inception gates.

---

## 0. Inception Gate — product-or-gtfo

**N/A — extant project (predates the discipline).**

This PRD is reconstructive. Per the project-conventions extant-projects clause,
the inception gate is not applied retroactively. The reboot policy (§13)
governs whether and when the gate must be re-applied.

Original inception context (best-effort reconstruction): EnZIME was
rearchitected on 2026-05-14 from the frozen EnZIMErgent Expo/React-Native
takeout codebase, which is retained as spec-source only (no code porting).
The product premise: an on-device, offline-first ZIM reader and
conversational AI shell for the prepper market — every feature works in
airplane mode, with on-device LLM inference (LiteRT-LM running Gemma 4
E2B / Qwen3-0.6B) over offline knowledge packs. Deployment intent is
external commercial (Play Store + sideload + desktop), with billing
infrastructure (`bridge/` EntitlementSyncBridge, RevenueCat, Stripe/BTCPay)
built production-grade from v1. [INFERRED from README, ARCHITECTURE.md §1,
CLAUDE.md, BILLING_CONVENTIONS posture]

- **Sunset criteria:** [GAP — operator must answer before this PRD is complete. Cannot be inferred from code. Candidate framings: "if v1.0 hasn't shipped to at least one external channel by <date>"; "if no external install signal by <date> after launch."]

---

## 1. Project metadata

- **Stack:** Tauri 2 (vendored at `vendor/tauri/`, patched via `[patch.crates-io]`) + Rust backend + Vite 6 / React 18 / TypeScript / Zustand frontend. On-device AI: LiteRT-LM (vendored at `vendor/litert-lm/`). [INFERRED from Cargo.toml, package.json, ARCHITECTURE.md §3]
- **Target platforms:** Linux desktop (AppImage), Windows desktop (MSI via cargo-wix/cargo-xwin cross), Android (Play AAB + sideload APK). **No Apple targets by invariant (INV-NO-APPLE).** [INFERRED from ARCHITECTURE.md §1, §4; CI build matrix]
- **Bundle ID family:** `mba.robin.enzime` (Reader); suite siblings reserve `mba.robin.enzime.creator` etc. [INFERRED from tauri.conf.json `identifier`, CLAUDE.md]
- **Versioning:** MAJOR.MINOR.BUILD per `~/.claude/BUILD_CONVENTIONS.md`. MINOR autoincrements per CI invocation. Android `versionCode = MAJOR*100000 + MINOR`, enforced against the committed sentinel `src-tauri/android/.last-published-versionCode` by `scripts/version-bump.sh`. [INFERRED from ARCHITECTURE.md DL-13, scripts/version-bump.sh, CHECKLIST W10]
- **Repo location:** `git@git.robin.mba:rcheung/EnZIME.git` (Forgejo origin, canonical, sole LFS host); GitHub mirror `git@github.com:Robin-s-AI-World/EnZIME.git` carries LFS pointers only (per-remote LFS disable + `scripts/hooks/pre-push` blocker). [INFERRED from CLAUDE.md, ARCHITECTURE.md DL-12]
- **Predecessor donor projects** (spec donors only, no source copying): EnZIMErgent (`~/forgejo/EnZIMErgent/`, frozen Expo/RN takeout — spec source only); AnZimmermanLib TypeScript (`~/forgejo/AnZimmermanLib/`) — its 2026-05-06 audit findings (BACKPORT-EN001..EN021-TS) are spec knowledge for the fresh-Rust `src-tauri/anzimmermanlib/rust/`, prove-then-canonicalize. [INFERRED from CLAUDE.md]

---

## 2. Threat model — solopreneur, not corporate

**Motifs (load-bearing):**

- **Anti-loss hardening is mandatory.** Self-inflicted lockout, undocumented change, clobber, deletion-without-backup are the failure modes that have cost real money. Every script that touches credentials/state/config includes: refuse-to-overwrite where applicable, sha256 audit trail on every operation, verify subcommand where round-trippable, log-of-state-changes appended to a per-project log.
- **Attacker-model hardening is opt-in, never default.** `chmod 0600`, `mktemp + shred`, leak-rotation prose, interactive size-sanity prompts, compliance-shaped controls — these address corporate threat models. Do not add by default. Add deliberately only when threat model genuinely changes (paid product, broader user base, multi-user host, regulated data) with a written reason.
- **EV math is allowed and applied.** Probabilistic expected loss from attackers, computed against actual exposure (free software vs. PII repository, etc.), traded against realized friction from hardening ceremony. The corporate "any risk is unacceptable" framing is rejected explicitly.
- **No paying the protection money.** Architecture decisions actively avoid being-in-scope for the typical paid-security stack (SOC2 attestations, mandatory pentests, cyber-insurance-mandated controls, compliance frameworks). When scope expands, re-evaluate per item, never default-yes.

**Project-specific decisions:**

- Credentials handled by this project [INFERRED from DOCS/CREDENTIALS.md (cleartext-canonical per I-15), .gitignore, CHECKLIST W10]:
  - Operator ed25519 signing keypairs: mirror manifest, update manifest, pack catalog (cleartext in `DOCS/CREDENTIALS.md` committed + `.env` gitignored; pubkeys compile-embedded via `include_bytes!`)
  - Android upload keystore (`production.keystore` outside repo; `src-tauri/gen/android/app/keystore.properties` gitignored, password documented in BUILD_CONVENTIONS.md)
  - Per-installation device ed25519 identity keypair (generated on device, never leaves it — user-side, not operator-side)
  - RevenueCat / processor secrets live in `bridge/` deployment surface per `~/.claude/BILLING_CONVENTIONS.md`, not in the client
- Specific anti-loss hardenings applied: rotation policy on signing keys is "rotate on suspected leak only" with documented multi-flavor recompile blast radius; keystore.properties gitignored to prevent diff-noise clobber while password stays documented; versionCode sentinel asserts monotonicity before Play uploads (prevents self-inflicted "versionCode already used" lockout). [INFERRED from DOCS/CREDENTIALS.md, CHECKLIST W10-E-BLD-43/44] [VERIFY — sha256 audit-trail / refuse-to-overwrite coverage of the sign-*.sh scripts not confirmed from artifacts]
- Attacker-model hardenings opted into (with reason): ed25519 signature verification on the update channel, mirror manifest, ZIM pack catalog, and peer sidecars — opted in because the product *distributes executable updates and knowledge packs to external users*; supply-chain integrity for users is product surface, not corporate ceremony. Local trust DB for peer-share (explicit trust levels, no central reputation). [INFERRED from ARCHITECTURE.md DL-14/15/22/23]
- Out-of-scope-by-design: no telemetry of any kind in v1.0 (DL-26: zero outbound analytics/crash-upload — no analytics-privacy scope); no operator-hosted user accounts and no project-owned magic-link auth (no credential-database scope); user content stays on device (no PII-repository scope); no payment data touches the client (processors + RC hold it — no PCI scope). [INFERRED from ARCHITECTURE.md DL-19/20/26, BILLING_CONVENTIONS]

---

## 3. Architectural posture — refuse manufactured asymmetry

**Motifs (load-bearing):**

Refuse the three structural moves that manufacture extractable asymmetry:

1. **Structural diversion** — routing user/operator intent through paid intermediaries that exist because someone built an unfriendly default and someone else built a wrapper around it. Counter-move: pick stacks that don't require the wrapper. (Tauri over Electron, RevenueCat as bridge not destination, self-hosted Forgejo over hosted plans, etc.)
2. **Overload** — burying load-bearing facts under prose that does more work for the seller than the reader. Counter-move: inline the load-bearing fact at the point of use; reject documentation patterns whose first 46 pages are CYA.
3. **Estoppel** — bundle-lock designs that make alternatives technically legal but structurally unviable. Counter-move: every component is swap-out-able via a trait/seam; no vendor owns 2+ of `{distribution, payment, identity, entitlement}`.

**Earned asymmetry is welcomed.** Hardware investment, substrate-accretion through user engagement, real domain expertise — these are legitimate sources of advantage. Manufactured asymmetry is not.

**Project-specific decisions** [INFERRED from ARCHITECTURE.md §4, §8; suite ideologies anti-unnecessary-fragility / non-artificial-gating / rugpull-defence]:

- Components / vendors used, with swap seams:
  - **Tauri 2** (vendored, pinned) — seam: vendored source under operator control; no hosted-service dependency.
  - **LiteRT-LM + Gemma 4 E2B / Qwen3-0.6B weights** — seam: `ModelFetcher` trait with `PadFetcher` / `MirrorFetcher` / `NullFetcher` impls; weights are ordinary `.litertlm` files deliverable by any medium (SD/USB/LAN/disc per INV-OFFLINE).
  - **RevenueCat** — bridge, not destination (see §5); seam: `EntitlementController` + `LocalPayloadVerifier`.
  - **Google Play** — one distribution channel of three; sideload APK and desktop builds are first-class, not afterthoughts.
  - **Forgejo (self-hosted)** — repo, CI, LFS; GitHub is a pointer-only mirror for external tool access.
  - **Piper TTS** — rejected as default backend (DL-11); `Tts` trait + `NullTts` keep the seam open for post-v1.0 OS-native TTS.
- Anti-bundle-lock check: distribution = Google Play / operator web landing / operator mirror (split per channel); payment = Play Billing (Play channel) / Stripe / BTCPay (direct channels); identity = per-device ed25519 keypair (no vendor); entitlement = RevenueCat as transitional bridge; hosting = self-hosted Forgejo + operator endpoints. On the Play channel Google necessarily touches both distribution and payment (store policy — forced, not chosen); the sideload and desktop channels exist precisely so no vendor owns two of the set across the product as a whole.
- Earned-asymmetry sources: user's on-device ZIM pack library, chat history, voice-clip store, and peer trust DB accrete per-user value endemic to engagement; operator's editorial curation of the signed pack catalog (DL-23) is domain-expertise asymmetry.

---

## 4. Identity / per-user artifact strategy

**Motifs:**

Default to **substrate-accretion** (per-user value emerges from use; binary is uniform across users) for personal tools. Consider **download-time per-user build with woven identity** for tools whose outputs carry identity outward (CRM, invoicing, branded exports, white-label, multi-tenant).

If using woven identity:

- **Strewn fragments, not centralized config.** Identity strings appear at each render site as plain literals. No `BusinessName::get()` centralizer that's itself a strip-mining target.
- **Light source-level uniquification** (trailing zero-width marker bytes stripped at render) to defeat compiler/linker dedup.
- **Build flags that prevent cross-unit merging** (`codegen-units` high, LTO off, linker `--no-merge-strings`-equivalents).
- **Post-build fragment-count canary** — load-bearing forward-compat check. Expected count per identity field per release; build fails if dedup collapses the blast radius.
- **Asset baking via per-site includes** for logos, photos, signed-URL endpoints.
- **Rate-limit tiers** for identity changes (address/phone: 1/hour; logo: 1/15min; theme: 1/5min; batched debounce of 5-10min into single builds).
- **No obfuscation** — the strip-mining cost is exhaustive-search across many sites, not cryptographic. Plain text strewn as shrapnel.

**Project-specific decisions:**

- Strategy: `substrate-accretion`. The binary is uniform across users; per-user value lives in user-side substrates. [INFERRED from ARCHITECTURE.md DL-14/15/21 — no woven-identity machinery exists or is planned]
- Substrates creating the binding: per-installation ed25519 identity keypair (`IdentityKeystore`, never leaves device); ZIM pack library; SQLite chat history; content-addressed voice-clip blob store; `sidecar_trust` peer trust DB built through gossip from already-trusted peers.

---

## 5. Entitlement / payment architecture

**Motifs:**

- **Goal state: no entitlement gate at all** if the business model permits (engagement-as-entitlement; substrate-accretion makes the artifact per-user-valuable without runtime checks).
- **If gating is required, gating is processor-agnostic.** A single `EntitlementService` trait + `gated_with_entitlement` wrapper; the trait implementation is swap-out-able.
- **RevenueCat is a bridge, not a destination.** Acceptable transitional dependency because App Store / Play Store force a payment intermediary; gone the moment store payment is optional.
- **Direct processors (Stripe, BTCPay, Lightning, Sol) sync into the entitlement layer through a swap-in/out bridge.** Clients never grant entitlements directly.
- **No party owns more than one of** {distribution, payment, identity, entitlement} **at the same time.** Coinbase Wallet + Coinbase Pay + Coinbase-attested entitlement = lock-in with extra steps.
- **Modular post-install entitlement** is the structural endpoint: user picks backend at install (sideload) or at runtime (settings) or via WASM module dropped into a plugin directory (desktop). Play/App Store binaries revert to the most-baked-in tier per store policy.

**Project-specific decisions:**

- Will this project gate features behind entitlement? `yes` [INFERRED from src-tauri/src/billing/ module, ARCHITECTURE.md DL-3/DL-27, BILLING_CONVENTIONS]. **Which features are gated at v1 vs free:** [VERIFY — the gating *machinery* is fully built (EntitlementController, billing commands, restore flow); the feature-to-entitlement map is not stated in artifacts read. Per the non-artificial-gating ideology, gates must reflect real cost/capability, not marketing tiers.]
- Backends in scope: RevenueCat (runtime entitlement truth) fed by Play Billing (Play flavor), Stripe / BTCPay / Square via `EntitlementSyncBridge` (`bridge/` workspace member, separate operator-deployed binary, production-grade from v1 per BILLING_CONVENTIONS); `LocalPayloadVerifier` for offline-signed entitlement payloads (INV-OFFLINE-compatible entitlement, no network at verify time). [INFERRED from ARCHITECTURE.md DL-3/27, billing/ module list]
- Trait/seam location in code: `src-tauri/src/billing/` (`mode.rs`, `local_payload.rs`, `restore.rs`); controller cached in `AppState` (DL-27). Clients never grant entitlements directly; `bridge/` syncs processors → RC.
- Per-channel default backend: Play → RC + Play Billing; sideload → direct processors by build flag (Stripe/BTCPay); desktop → mirror channel + offline-signed local payload. [INFERRED from cargo features play/sideload/desktop + BILLING_CONVENTIONS] [VERIFY — exact v2+ evolution, e.g. WASM module endpoint, unstated]

---

## 6. Build / CI / release

**Minimum featureset:**

- [x] CI runs on self-hosted Forgejo runner (CT 124 per `CI_RUNNERS.md`); never GitHub-hosted `ubuntu-latest` [INFERRED from .forgejo/workflows/build.yml + operator-built container images at git.robin.mba/rcheung/ci-images/]
- [x] Forgejo workflow `runs-on` uses labels directly: `[linux-amd64]`, `[android, linux-amd64]`, `[windows-x64-cross]` — never `[self-hosted, ...]` [INFERRED from build.yml matrix]
- [x] `build-essential` not needed per-job — jobs run in operator-pinned toolchain container images (`tauri-linux:rust1.83-node24-2026q2` etc.), a stronger form of the same guarantee [INFERRED from build.yml `container.image`]
- [x] Version stamper script bumps MINOR per CI invocation; this project's instance is `scripts/version-bump.sh` (also computes Android versionCode against the published sentinel) [INFERRED from scripts/, CHECKLIST W10-E-BLD-43]
- [x] Build gate command documented in project docs (`cargo check -p enzime`, README Quick start; W9 gate list in CHECKLIST)
- [x] Reproducible-build posture: `pnpm-lock.yaml` + root `Cargo.lock` committed; Tauri + LiteRT-LM vendored and pinned; CI containers version-pinned [INFERRED from repo + DL-28]
- [x] Per-task build gate per global I-10: hermetic per-task Verify clauses; whole-tree compile gating is CI's job (W9 gates)
- [x] Woven-identity canary: N/A — substrate-accretion strategy (§4), no identity payload to canary.

**Motifs:**

- Anti-loss build conventions: no force-push to main/master, no `--amend` after publish, never skip hooks (`--no-verify`), always create new commits over amending
- Build artifacts and identity payloads never written to `/tmp` (global rule I-8); use `<repo>/.tmp/` (gitignored) or `$RUNNER_TEMP`

**Project-specific decisions:**

- Build commands: `pnpm install`; `pnpm run build` (Vite); `cargo check -p enzime --features {desktop|sideload|play}`; `cargo check -p enzime-bridge`; `cargo test -p anzimmermanlib` (21 ZIM-spec audit tests); `scripts/build-linux.sh` / `build-windows.sh` / `build-android.sh` (per-channel); `scripts/bootstrap-android-init.sh` (one-time gen/android). [INFERRED from README, CHECKLIST W9/W10, scripts/]
- CI workflow file location: `.forgejo/workflows/build.yml` (primary, matrix platform×flavor); `.github/workflows/build.yml` (mirror).
- Per-task gate: hermetic Verify clause per CHECKLIST task (I-10a); release gates = CHECKLIST W9 GATE-1..10.

---

## 7. Distribution

**Motifs:**

- **Multi-channel from inception.** Never paint into single-channel corners. Default channels for a desktop/Android Tauri app: Play, sideload APK, F-Droid, direct desktop (Tauri build), web (if applicable).
- **Different builds per channel are explicitly allowed.** Per `BILLING_CONVENTIONS.md`: Play uses Play Billing via RC; sideload/F-Droid/direct may opt into Stripe/BTCPay by build flag.
- **Update channels are per-channel.** Don't let a single update server become a chokepoint.
- **Store-bound tier is the floor, not the architecture.** The interesting architecture lives in the sideload/desktop tier where post-install modularity, per-user builds, and substrate-accretion are unrestricted.

**Project-specific decisions** [INFERRED from ARCHITECTURE.md §4, DL-22/29; intent is architect-attested, but channel set is operator-intent — [VERIFY]]:

- Channels in scope at v1: Google Play (AAB, PAD install-time model packs); sideload APK (operator-signed, web landing page "get.enzime", degoogled-phone-compatible); Linux desktop AppImage + Windows MSI (web landing page, ed25519-signed release manifest). Flatpak/Snap explicitly rejected for v1 (DL-29). F-Droid not in v1 artifacts.
- Channels in scope at v2+: [GAP — operator must answer. F-Droid? LAN/peer APK distribution as formal channel (the sidecar/peer-share machinery suggests it)? Creator-bundled distribution?]
- Per-channel build differences:

| Channel | Cargo feature | Model delivery | Payment | Updates |
|---|---|---|---|---|
| Play | `play` | PadFetcher (Play Core JNI, install-time PAD) | Play Billing via RC | Play Store native |
| Sideload APK | `sideload` | MirrorFetcher (reqwest + ed25519) | Stripe/BTCPay by flag | In-app, `ENZIME_UPDATE_URL`, ed25519-verified |
| Desktop (AppImage/MSI) | `desktop` | MirrorFetcher + local filesystem | Direct processors / local payload | In-app, ed25519-verified |

All channels retain the universal offline path (NullFetcher + install-from-media) per INV-OFFLINE.

---

## 8. File / artifact discipline

**Minimum featureset:**

- [x] `.tmp/` directory at repo root, gitignored (`/.tmp/*` + `.gitkeep`), used for all scratch (global rule I-8 — no `/tmp`)
- [x] `.gitignore` includes `.tmp/`, `.claude/`, `target/`, `node_modules/`, `dist`, `.env`, `keystore.properties` — with two deliberate deviations: `LOGS/screenlog.*` are **committed by policy** (operator screen captures, binary verbatim per `.gitattributes`), and `.claude-code-history/` is currently tracked [VERIFY — template default is to ignore it; if tracking is deliberate, note it here; if not, add to .gitignore]
- [x] State-changing scripts log per I-8 (dispatch logs under `.tmp/`)
- [x] Credential-handling posture: signing keys cleartext-canonical in `DOCS/CREDENTIALS.md` + `.env` per global I-15 (deliberate, documented rotation blast radius) — the anti-loss tier here is documentation-of-record rather than refuse-to-overwrite tooling [VERIFY — sha256-audit/verify subcommands on sign-*.sh not confirmed]
- [ ] Pre-commit/CI credential-pattern check: not found in artifacts [GAP — no hook/CI step blocks accidental credential-shaped commits beyond the LFS pre-push blocker; note I-15 makes `DOCS/CREDENTIALS.md` itself exempt by design]

**Motifs:**

- Ephemeral artifacts leave no trace beyond their log entry; the log is the audit trail.
- Persistent state changes are logged with sha256 / before-after, not just executed.

---

## 9. Documentation / decision discipline

**Minimum featureset:**

- [x] Project-level `CLAUDE.md` written from visible project facts (suite routing + reader rules)
- [x] codegraph index maintained out of band (1,237 files / 27,831 nodes / 60,341 edges indexed at backfill time); agents query only
- [x] `DOCS/ARCHITECTURE.md` with complete entity table (§7, ~305 rows) + attestation blocks (§10, §11 re-attestation for Android enablement); architect-only surface
- [x] `CHECKLIST.md` as the coder contract; four-state markers; per-task commit clauses
- [x] Idempotent Accept clauses (per global I-7) — CHECKLIST Verify clauses are grep/ls/git-shaped end-state assertions
- [x] Phase separation MAP → ARCHITECT → PLAN → CODE respected (W-phase structure)
- [x] Coder escalation discipline: GLM-4.7 one-task atomic dispatch with explicit ESCALATION-block protocol (project CLAUDE.md), per global I-4/I-6

**Motifs:**

- Terse documentation. No marketing language. No "this elegantly implements..." prose. State what changed and why.
- Decision logs (DL-N entries in ARCHITECTURE.md) capture *why* a decision was made, not just *what*; the why is what allows future revisitation.
- When a failure reveals a discipline gap, update the smallest applicable rule file (`~/.claude/*.md`, `~/forgejo/admin/DOCS/*`); cross-project lessons go up.

(This project's decision log lives at `DOCS/ARCHITECTURE.md` §8, entries 1–29, plus §9 supersession notes.)

---

## 10. Session continuity / orchestration

**Minimum featureset:**

- [x] Project registered with `context-mcp` for `/sesh resume` support [VERIFY — registration status not confirmed during backfill; Step-1 local briefing is the load-bearing path either way]
- [x] Architect/coder/orchestrator role separation respected (per `~/.claude/CLAUDE.md`)
- [x] Coder dispatches: this project **overrides** the template default — coder substrate is GLM-4.7 via `zclaude-coder-47` one-task atomic (per project CLAUDE.md + INC-5; `zclaude-opus` GLM-5.1 is the *verifier* seat, deprecated for coding)
- [x] CHECKLIST.md state markers are the coordination protocol: `[ ] → [/] → [X] → ✅`
- [x] Background dispatch logs to `<repo>/.tmp/`, never `/tmp`
- [x] Self-paced `/loop` monitoring acceptable; never poll faster than 240s (cache window)

**Motifs:**

- Coders never query codegraph or read ARCHITECTURE, or any file not named by their task body.
- Orchestrator role is the only one that consults Pieces LTM (4D trajectory data); architect/coder are snapshot-bound.

---

## 11. Communication style

**Motifs:**

- Terse, direct, no marketing prose
- Trade-offs named explicitly; recommendations include the alternative considered and why rejected
- Honest about what was tried, what failed, what was skipped
- No emoji unless explicitly requested
- Default to no comments in code; only WHY-non-obvious comments, never WHAT-the-code-does narration
- PR descriptions follow the structured template (Summary / Test plan / generated-with attribution)

---

## 12. Deployment vector decision

**Choose one (from §0). Document the *why* — this is the test record.**

- [x] **Product (external commercial undertaking).** [INFERRED — the artifacts overwhelmingly indicate product intent: three distribution channels built from inception, Play Store PAD packaging within the 4 GB cap, production-grade billing bridge mandated from v1, signed update/catalog channels for external users, prepper market named in CLAUDE.md. A dogfood or appliance project would not carry Play Billing, RevenueCat, or operator-signed public update manifests.] [VERIFY — operator must confirm the vector and supply the missing pieces: target-user definition beyond "prepper market," business model (one-time purchase vs subscription vs pack sales), and the market analysis the template requires. The §0 business case is N/A retroactively, but §12's *why* should still be written down.]

---

## 13. Reboot / sunset policy

**Reboot triggers re-application of §0 inception gate.**

- Clean rewrite (from scratch, not incremental refactor) → re-apply gate
- Stack migration that drops the existing artifact → re-apply gate
- Consolidation with another project into a new substrate → re-apply gate
- Fork with explicit legacy-drop intent → re-apply gate
- Repackaging that changes audience/distribution model → re-apply gate

**Continuations do not trigger the gate:**

- Incremental refactors
- Phase additions within existing roadmap
- Architecture revisions that don't change premise
- Bug-fix releases

**Sunset is a first-class option.** If sunset criteria from §0 are met, the project is killed. "I built it and I still use it occasionally" is not a counterargument; that's sunk-cost inertia.

**Project-specific notes:** the 2026-05-14 rearchitecture from EnZIMErgent was itself a reboot-shaped event (stack migration dropping the Expo artifact); it predates this discipline and is grandfathered. The next reboot-shaped event — e.g., consolidating Reader/Creator/Extension into a single substrate, or repackaging for a non-prepper market — re-applies §0 in full, including sunset criteria. [GAP — this-project-specific triggers beyond the template list (e.g., "if Play Console rejects PAD strategy, that's a repackaging-grade event") need one operator pass.]

---

## 14. Reference conversations & documents

- **Inception conversation:** `~/.claude/plans/is-this-repo-the-expressive-tower.md` (approved 2026-05-14 scaffolding plan) [INFERRED from README; re-read on reboot, on revisitation, on doubt]
- **Global rules spine:** `~/.claude/CLAUDE.md`
- **Routed conventions used:** `~/.claude/BUILD_CONVENTIONS.md`, `~/.claude/BILLING_CONVENTIONS.md`, `~/.claude/CI_RUNNERS.md`, `~/.claude/MODEL_ROUTING.md`
- **Suite ideologies (read once per session):** `~/forgejo/admin/DOCS/IDEOLOGIES/anti-unnecessary-fragility.md`, `non-artificial-gating.md`, `rugpull-defence.md`
- **Related projects whose ARCHITECTURE.md is relevant context:** EnZIMErgent (frozen, spec-source); AnZimmermanLib TS (audit-findings donor); Creator (`creator/`) and Extension (`extension/`) suite siblings; `bridge/` EntitlementSyncBridge

---

## 15. Open questions / explicit gaps

List the unresolved decisions at inception. These are NOT TBDs to be hand-waved past — they're explicit gaps that must be closed before the corresponding phase starts. If a gap is too vague to enumerate, that itself is a signal to re-run §0.

- **GAP-1 (§0) Sunset criteria** — no artifact states when this project should be deliberately killed. Operator must supply a date/milestone/condition. Blocks: PRD completeness; nothing in-flight.
- **GAP-2 (§5) Feature-to-entitlement map** — the gating machinery is built, but *which features are paid* is unstated in the artifacts read. Must be closed before any store listing / pricing work. (Constrained by the non-artificial-gating ideology.)
- **GAP-3 (§7) v2+ channel set** — F-Droid, formal LAN/peer distribution, Creator-bundled distribution: in or out? Blocks: nothing at v1; close before v2 planning.
- **GAP-4 (§12) Deployment-vector "why"** — product vector inferred with high confidence, but target user, business model, and pricing shape need an operator paragraph. Close before launch-facing work (store listing, landing page).
- **GAP-5 (§13) Project-specific reboot triggers** — one operator pass to name EnZIME-specific reboot-grade events beyond the template list.
- **GAP-6 (§8) Credential-pattern commit guard** — no pre-commit/CI check blocks credential-shaped files beyond the LFS pre-push blocker; decide whether the I-15 cleartext-canonical posture makes this deliberately out of scope (likely) or worth a narrow guard for *non-canonical* secret patterns.
- **VERIFY items** (operator confirms or corrects, lower ceremony than gaps): §2 sign-script anti-loss tier coverage; §8 `.claude-code-history/` tracking deliberateness; §10 context-mcp registration status; §6/§7 channel-set confirmation.

---

*Backfilled 2026-06-11 by Claude (Fable 5) from: codegraph index (1,237 files), `DOCS/ARCHITECTURE.md` (v1.0 attested, DL 1–29), `CHECKLIST.md` (W1–W10 + gates), `CLAUDE.md`, `README.md`, `DOCS/CREDENTIALS.md`, `DOCS/BUILD.md`, `.forgejo/workflows/build.yml`, `Cargo.toml`/`package.json`/`tauri.conf.json`/`.gitignore`, git history (inception `9b4bc63` 2026-05-14). Template: `~/forgejo/admin/DOCS/PRD_TEMPLATE.md` (read 2026-06-11, not paraphrased from memory).*
