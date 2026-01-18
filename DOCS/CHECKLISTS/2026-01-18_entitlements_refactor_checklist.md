Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# Entitlements Refactor Execution Checklist (2026-01-18)

> Scope: License/headers cleanup (Phase 1) + Entitlements refactor (Phase 2) with docs-first updates.

## Checklist Legend
- [ ] Not yet begun
- [/] In progress
- [X] Completed, not thoroughly tested
- ✅ Tested & complete

## Phase 1 — License + Copyright Headers (BLOCKER)

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Create root `LICENSE` with required proprietary text | Dev | 2026-01-18 | Root `LICENSE` exists with exact 2025–2026 statement and restrictions |
| ✅ | Remove all prior permissive license references outside `DOCS/Cascade` | Dev | 2026-01-18 | `rg -n "license"` confirms removal of permissive license mentions |
| ✅ | Add header to docs (`.md`, `.txt`, `.mmd`, `.puml`) | Dev | 2026-01-18 | Header present at top of each authored doc file |
| ✅ | Add header to code (`.ts`, `.tsx`, `.js`, `.css`, `.rs`, `.sh`, `.ps1`, `.toml`, `.yml`) | Dev | 2026-01-18 | Header present in each authored code file with correct comment syntax |
| ✅ | Commit Phase 1 as dedicated commit | Dev | 2026-01-18 | `git log` shows a single commit for license + headers |

## Phase 2A — Inventory (Read + List)

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Read `CHECKLIST.md` + architecture docs | Dev | 2026-01-18 | Notes logged for current architecture and gating |
| ✅ | Scan for gating/plan checks | Dev | 2026-01-18 | List of gating points with paths + descriptions |

## Phase 2B — Docs First (Update In-Place)

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Add new Section 12 in `CHECKLIST.md` | Dev | 2026-01-18 | Section includes objectives, scope, risks, ordered steps, validation, rollback |
| ✅ | Update `DOCS/ARCHITECTURE/ARCHITECTURE.md` | Dev | 2026-01-18 | New "Entitlements & Billing" section matches capability-first model |
| ✅ | Update diagrams in place (`.puml`, `.mmd`) | Dev | 2026-01-18 | System/context/container/component/sequence/data_flow updated with gatekeeper + billedr |

## Phase 2C — Implementation Commits

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Commit A: scaffolding | Dev | 2026-01-18 | New Entitlements types, Gatekeeper API, provider interface, mock provider wired safely |
| ✅ | Commit B: minimal enforcement | Dev | 2026-01-18 | 1–2 optional features gated via Gatekeeper with user-facing messaging |
| ✅ | Commit C: billedr stub integration | Dev | 2026-01-18 | Remote provider + signed token v0 + cache + offline fallback |
| ✅ | Commit D: hardening | Dev | 2026-01-18 | Tests cover gatekeeper logic; legacy plan checks removed for converted modules |

## Phase 2 Validation

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Run test suite | Dev | 2026-01-18 | Tests pass or warnings explained |
| ✅ | Update checklist statuses | Dev | 2026-01-18 | Checklist updated with `[X]` or ✅ |
