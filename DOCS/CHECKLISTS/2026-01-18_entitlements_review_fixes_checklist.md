Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# Entitlements Review Fixes Checklist (2026-01-18)

## Checklist Legend
- [ ] Not yet begun
- [/] In progress
- [X] Completed, not thoroughly tested
- ✅ Tested & complete

## Phase A — Architecture + Checklist

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Create AST abstraction doc | Dev | 2026-01-18 | `DOCS/ARCHITECTURE/2026-01-18_entitlements_review_fixes_ast.md` exists |
| ✅ | Create execution checklist | Dev | 2026-01-18 | `DOCS/CHECKLISTS/2026-01-18_entitlements_review_fixes_checklist.md` exists |

## Phase B — Reactive Entitlements Store

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Add `src/entitlements/store.ts` with Zustand store | Dev | 2026-01-18 | Store exposes gatekeeper, ready, lastUpdated, setters |
| ✅ | Update `initializeEntitlements` to update store | Dev | 2026-01-18 | Refresh triggers store update + ready true |

## Phase C — UI Re-render After Refresh

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Update `HistoryView` to read store | Dev | 2026-01-18 | Entitlement state re-renders after refresh |
| ✅ | Update `MeshPanel` to read store | Dev | 2026-01-18 | Entitlement state re-renders after refresh |

## Phase D — Token Verification

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Implement canonical payload + RSA verification | Dev | 2026-01-18 | `verifySignedToken` uses WebCrypto with public key |
| ✅ | Ensure no public key => deny token | Dev | 2026-01-18 | Verification returns false when key missing |

## Phase E — Validation

| Status | Task | Owner | Due | Acceptance Criteria |
|---|---|---|---|---|
| ✅ | Run unit tests | Dev | 2026-01-18 | `npm test -- --run` passes or warnings noted |
| ✅ | Update checklist statuses | Dev | 2026-01-18 | All tasks marked ✅ where tested |
