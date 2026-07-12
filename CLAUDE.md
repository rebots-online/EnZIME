# EnZIME Suite — project-local Claude Code instructions

This repository is the **EnZIME Suite** — three apps + shared
infrastructure, developed in **soft project boundaries within one repo**
(operator preference 2026-05-14: "different sessions and as different
projects almost, but not as strong as separate repos"). Each app has
its own `CLAUDE.md` / `ARCHITECTURE.md` / `CHECKLIST.md`.

## Suite-level routing

If you're working on a specific app, read that app's `CLAUDE.md` AFTER
this file:

| App | Role | Local `CLAUDE.md` |
|---|---|---|
| **Reader** (EnZIME) | ZIM consumer — offline-first, prepper market, on-device Gemma 4 | (this file's body below; reader rules currently live at root pending eventual move to `apps/reader/`) |
| **Creator** (placeholder name) | ZIM producer / publisher / editor — NOT offline-first, two markets (enterprise + home) | `creator/CLAUDE.md` |
| **Extension** (placeholder name) | Chrome MV3 page-clipper that feeds the Creator | `extension/CLAUDE.md` |

Shared infrastructure (used by multiple suite members):

- `vendor/tauri/` — Tauri 2 source, pinned
- `vendor/litert-lm/` — LiteRT-LM source, pinned
- `src-tauri/anzimmermanlib/rust/` — shared ZIM library (read + eventually write surface)
- `bridge/` — `EntitlementSyncBridge` (separate operator-controlled binary)
- `models/` — Gemma 4 e2b weights (Forgejo LFS placeholders)
- `DOCS/sdk/` — local SDK doc snapshots (TC7)

Suite-level ideologies (read these once per session for any app):

- `~/forgejo/admin/DOCS/IDEOLOGIES/anti-unnecessary-fragility.md`
- `~/forgejo/admin/DOCS/IDEOLOGIES/non-artificial-gating.md`
- `~/forgejo/admin/DOCS/IDEOLOGIES/rugpull-defence.md`

## Per-app naming + bundle identifier scheme

| App | Display name (placeholder) | Bundle identifier |
|---|---|---|
| Reader | `EnZIME` | `mba.robin.enzime` |
| Creator | `EnZIME Creator` / `EnZIME Studio` | `mba.robin.enzime.creator` |
| Extension | `EnZIME Extension` | (Chrome Web Store ID at submission time) |

Real names pending operator decision. Directory names (`creator/`,
`extension/`) are deliberately naming-neutral so the eventual real
names don't trigger directory renames.

---

## Reader-specific rules (this section will become `apps/reader/CLAUDE.md` when the reader is moved)

Inherits from `~/.claude/CLAUDE.md` (global spine). This file documents
**reader-specific** overrides — and currently doubles as the suite-level
file because the reader hasn't been moved to `apps/reader/` yet.

- **PRD:** `DOCS/PRD.md` — premise, inception gate (N/A — extant, backfilled
  2026-06-11), deployment vector, open gaps (§15).

## Invariants (binding)

- **INV-OFFLINE** — every feature must work with airplane mode on. Online
  features are additive, never gate core flows, never required for first-run.
- **INV-NO-EXPO** — no Expo runtime, no Metro bundler, no `expo-*` imports,
  no `app.json`. Tauri 2 + Vite only.
- **INV-NO-APPLE** — no Apple ecosystem on ideological grounds. Targets are
  Linux desktop, Windows desktop, Android. iOS / macOS / Catalyst proposals
  are rejected by invariant alone.

## Naming discipline

The product is `EnZIME` — capital E-Z-I-M-E, from the ZIM file format.
Never autocorrect to "enzyme" or lowercase to "enzime."

## Branch + hosting

- Default branch: **`master`** (per [[feedback_branch_naming_master]]).
- `origin` = Forgejo (`git@git.robin.mba:rcheung/EnZIME.git`) — canonical,
  **sole LFS host**.
- `github` = `git@github.com:Robin-s-AI-World/EnZIME.git` — mirror for
  external tool access (Jules, Codex). **No LFS blobs ever push to GitHub**
  (per-remote LFS disable + `scripts/hooks/pre-push` blocker).

## Vendoring

Four SDKs are imported wholesale (source + docs, in-tree):

| SDK | Source location | Docs location |
|---|---|---|
| Tauri 2 | `vendor/tauri/` | `DOCS/sdk/tauri/` |
| LiteRT-LM | `vendor/litert-lm/` | `DOCS/sdk/litert-lm/` |
| AnZimmermanLib (ours, Rust) | `src-tauri/anzimmermanlib/rust/` | `DOCS/sdk/anzimmermanlib/` |
| Gemma 4 e2b (weights) | `models/gemma-4-e2b/` (Forgejo LFS) | `DOCS/sdk/gemma-4-e2b/` |

Other dependencies stay as ordinary crates.io / npm deps. Local SDK doc
snapshots are mandatory per TC7 (inline deep-link comments).

## AnZimmermanLib provenance

**Fresh Rust implementation.** Not a port of the TypeScript code at
`~/forgejo/AnZimmermanLib/`. That repo's 2026-05-06 audit findings
(BACKPORT-EN001..EN021-TS) are spec-knowledge source, not a porting source.
Prove-then-canonicalize: fixes land here first, propagate upstream later.

## Predecessor

`~/forgejo/EnZIMErgent/` is the frozen Expo/RN takeout. Spec-source only —
not a code-porting source.

## On-device AI stack

- LiteRT-LM running Gemma 4 e2b q4.
- STT: Gemma 4 e2b's native audio encoder. **No separate Whisper.**
- TTS: Piper, in-process.
- Pipeline: mic → Gemma audio encoder → Gemma text gen → Piper → speakers,
  all in-process Rust, no cloud calls in default path.

## Phase discipline

`DOCS/ARCHITECTURE.md` (entity table) and `CHECKLIST.md` are the contract
surfaces. Coders read CHECKLIST only. The ~240+ row entity table lives in
`DOCS/ARCHITECTURE.md` §4 plus per-domain partials under `DOCS/ARCHITECTURE/`.

## Coder dispatch — GLM-4.7, one-task atomic

Per `~/.claude/MODEL_ROUTING.md` and INC-5
(`~/forgejo/admin/DOCS/INCIDENTS/glm-5.1-overindependence-self-rescue.md`),
the canonical coder substrate for this project is **GLM-4.7** dispatched
via `zclaude-coder-47`, one CHECKLIST task per invocation:

```bash
zclaude-coder-47 --add-dir /home/robin/forgejo/EnZIME \
  -p "$(cat <<'TASK'
Execute CHECKLIST.md task <N.M> <task title>.
Read the Do / Verify / Accept clauses verbatim. Touch only the files
listed in Do. After verification, commit per I-10 (c) with message
'<conventional-type>(<scope>): <N.M> <task title>', then flip the
marker to [x]. If any Do step references a missing entity, file, or
signature, emit an ESCALATION block — do NOT self-rescue, do NOT
mutate the CHECKLIST surface, do NOT invent.
TASK
)"
```

**Do NOT** use `zclaude-opus` for coder dispatch — that's the legacy
GLM-5.1 path, deprecated per INC-5 because 5.1's agentic instincts
elide failing tests and self-rescue past architect debt. GLM-4.7 is
the strict-execution tier: follows imperatives literally, escalates
on gaps, never invents — which is exactly what I-4 + I-6 + I-10 (b)
require.

Architect-flavored work (judgment, design, ambiguity, security,
multi-file refactor, novel architectural decisions) stays in Opus
via the `Agent` tool with the appropriate `subagent_type` — NEVER
dispatched to GLM-4.7. If a CHECKLIST task starts to need judgment,
that's INC-6: the task wasn't modular enough and must be bounced
back to the architect for re-decomposition before re-dispatching.

### One-task atomic — what it means here

- One `zclaude-coder-47` invocation = one CHECKLIST `[ ]` → `[x]`
  transition + one commit. No multi-task dispatches.
- Parallel CHECKLIST rows that are genuinely independent can fire as
  parallel `Bash(zclaude-coder-47 ...)` calls in a single orchestrator
  turn — they run as concurrent OS processes, results return as
  independent stdouts.
- If a task escalates, the orchestrator runs the appropriate
  `Agent(subagent_type=...)` to repair the architecture / CHECKLIST,
  then re-dispatches the now-complete task. Coders never self-rescue
  (I-6).

## LOGS/

`LOGS/screenlog.*` are operator screen-session captures, committed as
binary verbatim (`.gitattributes` rule). Do **not** add to `.gitignore`.
