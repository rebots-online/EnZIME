# EnZIME Creator — CHECKLIST (bootstrap)

> **Status:** bootstrap-only. Real CHECKLIST rows for this app are
> authored by the dedicated Creator architect session (Wave 7+ per the
> suite-level numbering, but operationally a "Phase Creator-1" for
> THIS app's own progression).
>
> **Contract:** I-4. Coders read THIS file only when dispatching against
> creator-app tasks. Missing info ⇒ escalate back to architect; never
> spelunk source files for context.
>
> **Coder dispatch — GLM-4.7, one-task atomic** (per INC-5; same idiom
> as reader, with `--add-dir /home/robin/forgejo/EnZIME` because the
> shared crates live one level up). See `./CLAUDE.md` + suite-level
> `../CLAUDE.md` for the full dispatch idiom.

---

## Phase Creator-0 — Bootstrap (this turn)

- [x] **C0.1 Create `creator/` directory + child structure** — bootstrap turn 2026-05-14
- [x] **C0.2 Author `creator/CLAUDE.md`** with inherited constraints
- [x] **C0.3 Author `creator/ARCHITECTURE.md`** stub with pending-work marker
- [x] **C0.4 Author `creator/CHECKLIST.md`** (this file)
- [x] **C0.5 Author `creator/src-tauri/Cargo.toml`** workspace-member stub
- [x] **C0.6 Author `creator/src-tauri/tauri.conf.json`** with bundle id `mba.robin.enzime.creator`
- [x] **C0.7 Author `creator/src-tauri/build.rs`** `tauri_build::build()` stub
- [x] **C0.8 Author `creator/src-tauri/src/{lib,main}.rs`** empty run() stubs
- [x] **C0.9 Author `creator/frontend/package.json`** stub (Vite scaffold deferred to architect session)
- [x] **C0.10 Add `creator/src-tauri` to root `Cargo.toml` workspace members**
- [x] **C0.11 Update root `CLAUDE.md`** with suite-level routing section + per-app naming/identifier scheme
- [ ] **C0.12 First commit of creator/ scaffold** — `feat(creator): C0 bootstrap scaffold for EnZIME Creator app` *(operator-gated; commit on request)*

## Phase Creator-1+ — Real work (Wave 7+, dedicated architect session)

These rows do NOT exist yet. The Creator's architect session is
responsible for filling them in, starting with:

- Author `./ARCHITECTURE/ENTITIES_FULL.md` (the creator's entity table)
- Decide LLM-shape (embedded, shared with reader, or none initially)
- Decide ingestion-source policy (anti-fragility application)
- Decide macOS target (currently closed; may be opened for the
  enterprise segment)
- Decide one-binary-feature-visibility vs two-binary split for the
  two market segments
- Decide free-tier shape per segment
- Generate Phase Creator-2+ rows for actual implementation

Until that work happens, this app has no coder-dispatchable tasks
beyond Phase Creator-0.
