# AnZimmermanLib — SDK docs (our own, in-tree)

**Status:** fresh Rust implementation per 2026-05-14 rearchitecture decision.
NOT a port of the TypeScript code at `~/forgejo/AnZimmermanLib/`. That repo's
2026-05-06 audit findings (BACKPORT-EN001..EN021-TS markers) are spec-knowledge
source — each becomes a Rust test fixture.

## In-tree layout

- `src-tauri/anzimmermanlib/rust/` — the Cargo crate
  - `src/lib.rs` — `ZimReader` trait + `version()`
  - `src/null.rs` — `NullZim` placeholder
  - `src/error.rs` — `ZimError` enum
  - `tests/` — Rust integration tests (will host BACKPORT-EN001..EN021 fixtures)
- `src-tauri/anzimmermanlib/shared-fixtures/` — ZIM v5 spec fixtures consumed by tests

## Prove-then-canonicalize

Bugs fixed locally in `src-tauri/anzimmermanlib/rust/`, shipped in EnZIME
releases, field-debugged. Proven fixes propagate upstream to a future
standalone multi-language repo (currently the TS code at
`~/forgejo/AnZimmermanLib/`) — fixes flow OUT of EnZIME, never IN.

## ZIM v5 spec audit findings (carry-over from 2026-05-06)

Each entry below is a Rust test fixture to author in `tests/`. Detailed
spec citations + reproducer expectations come from the audit doc in the
predecessor repo's history.

- EN001..EN021 — 21 compliance bugs identified in the legacy TS impl;
  each becomes one Rust test asserting ZIM v5 correctness for the
  corresponding edge case. Detailed authoring is a Phase 7+ CHECKLIST
  task; this INDEX is the registry.

## V0 → spec-test TODO

`zim-v5-spec-imports.md` with the full 21-row audit-finding table is a
Phase 7+ task scheduled after `A-ENTITIES` 6.2 lands the full entity
table that names each test.
