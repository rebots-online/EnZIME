<!-- CURATED PARTIAL §7.5 Storage. GLM-5.1 per-module dispatch (`storage`); Opus-reviewed/accepted 2026-06-13. CRITICAL carry-forward (coder tasks): RF1 annotations.rs DOES NOT COMPILE (uses nonexistent StorageError::Query) AND list() has a column-index bug (region/body/created_at off-by-one) — only the real-DB acceptance catches it (I-12); RF2 dual schema-version mechanisms; RF3 no CREATE TABLE ships (MIGRATIONS empty); RF4 annotations/bookmarks/chat submodules undeclared in mod.rs; RF5 ChatHistoryStore returns Box<dyn Error>; RF6 setting_key vocab. ⚠ acceptances must NOT be flipped ✅ until RF1 reconciled. -->

### §7.5 Storage (`src-tauri/src/storage/`)

**Behavioural end-state (INV-OFFLINE).** Pure local SQLite via `rusqlite` — **zero
network in the default path**. One portable single-file DB opened with
`journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`. `Storage` is the
sole connection façade: it owns `Mutex<rusqlite::Connection>` (rusqlite
`Connection` is `Send` but `!Sync`), and the **only sanctioned access** to the
connection is the `with_conn(|conn| …)` closure executor, which locks the mutex
(releasing between calls), maps poison → `StorageError::Poisoned`, and returns
the closure's `Result<_, StorageError>`. Every sub-store across the app
(`SidecarIndex`, `TrustDb`, `WindowStateStore`, `PackCatalog`, …) holds an
`Arc<Storage>` (per `E-STATE-1`) and reaches the DB through one of the four
persistence traits implemented **on `Storage` itself** (`impl X for Storage`):
`SettingsStore` (KV + schema version), `ChatHistoryStore` (assistant/user
turns), `AnnotationsStore` (create/list/delete/export/import), `BookmarksStore`
(toggle/list). These traits are the persistence behind the §7.1 Tauri commands
`settings_*` / `chat_history_*` / `annotations_*` / `bookmarks_*`. Schema
versioning runs through `MigrationRunner` over `PRAGMA user_version`
(`run_migrations()`), invoked once at app start.

> **Verification basis.** Every row below was verified against the live source
> in `src-tauri/src/storage/*.rs` (read 2026-06-13). Line numbers are corrected
> to the real `file:line` of the defining keyword. Five reconciliation flags
> (RF1–RF6) are **surfaced, not applied** (TC13) — see the end of this section.
> Acceptances marked ⚠ cannot pass against the *current* source; they are the
> durable semantic contract the reconciled code must satisfy before the
> orchestrator may flip the row ✅.

**Acceptance test harness (shared fixture).** Each real-DB acceptance opens an
in-memory connection `Storage::open(&PathBuf::from(":memory:"))` (or a temp
file under `.tmp/` per I-8) and, because the storage module ships no `CREATE
TABLE` today (RF3), the test fixture creates the tables the SQL targets:

```sql
CREATE TABLE settings      (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE chat_history  (id INTEGER PRIMARY KEY AUTOINCREMENT, session INTEGER NOT NULL,
                            role TEXT NOT NULL, content TEXT NOT NULL,
                            zim_handle INTEGER, ts INTEGER NOT NULL);
CREATE TABLE bookmarks     (id INTEGER PRIMARY KEY AUTOINCREMENT, zim_uuid BLOB NOT NULL,
                            url TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE annotations   (id INTEGER PRIMARY KEY AUTOINCREMENT, zim_uuid BLOB NOT NULL,
                            url TEXT NOT NULL, region TEXT NOT NULL, body TEXT NOT NULL,
                            created_at INTEGER NOT NULL);
```

| ID | Name | Target | Role (behavioural) | Signature / fields | Type |
|---|---|---|---|---|---|
| E-STR-1 | `Storage` | `storage/mod.rs:22` | Sole connection façade; owns `Mutex<Connection>` (Connection is `Send` but `!Sync`) so all SQL serialises through one lock; carries the on-disk `path` for debugging/`Debug` (which prints only `path`, never credentials) | `struct { db: Mutex<rusqlite::Connection>, path: PathBuf }` | struct |
| E-STR-2 | `Storage::open` | `storage/mod.rs:36` | Open-or-create the DB file and apply the offline pragmas `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`; idempotent (re-opening an existing path preserves rows) | `fn(path: &Path) -> Result<Self, StorageError>` | fn |
| E-STR-3 | `Storage::with_conn` | `storage/mod.rs:47` | The single sanctioned entry to the connection: lock the mutex (poison → `StorageError::Poisoned`), hand `&Connection` to the closure, return its `Result`; lock is released between calls so sequential closures see a consistent, mutable connection | `fn<R, F: FnOnce(&rusqlite::Connection) -> Result<R, StorageError>>(&self, f: F) -> Result<R, StorageError>` | fn |
| E-STR-4 | `Storage::run_migrations` | `storage/mod.rs:55` | Idempotent schema setup: runs `MigrationRunner::apply_pending(conn, &MIGRATIONS)` under `with_conn`; in the current snapshot `MIGRATIONS` is empty so this is a no-op returning `Ok(())` without creating any table (RF3) | `fn(&self) -> Result<(), StorageError>` | fn |
| E-STR-5 | `StorageError` | `storage/mod.rs:11` | Typed error for the whole module; `Sql` is the `#[from]` sink so `?` lifts `rusqlite::Error` automatically; `Poisoned` is the mutex-poison signal from `with_conn` | `enum { Sql(#[from] rusqlite::Error), Migration(String), Schema(String), Poisoned }` (thiserror) | enum |
| E-STR-6 | `MigrationRunner` | `storage/migrations.rs:12` | Schema versioning + ordered migration execution **over `PRAGMA user_version`** (NOT the `settings` table — RF2); reads current version, applies each `Migration` whose `version > current` via `execute_batch`, bumps `user_version` after each | `struct; impl { fn current_version(&self, &Connection) -> Result<u32, rusqlite::Error>; fn apply_pending(&self, &Connection, &[Migration]) -> Result<u32, rusqlite::Error>; }` | struct |
| E-STR-7 | `Migration` | `storage/migrations.rs:2` | Single ordered migration step: a version ordinal, a human name, and a SQL batch body run verbatim | `struct { version: u32, name: &'static str, sql: &'static str }` | struct |
| E-STR-8 | `MIGRATIONS` | `storage/migrations.rs:9` | Static ordered list of migrations shipped in this build — **currently empty (`&[]`)**, so no schema ships from the storage module today (RF3) | `pub const MIGRATIONS: &[Migration] = &[]` | const |
| E-STR-9 | `ChatHistoryStore` | `storage/chat.rs:12` | Chat-history persistence trait: append a turn, list turns (optionally per session, newest-first, bounded by `limit`), clear turns (optionally per session) returning the count deleted. ⚠ Methods return `Box<dyn std::error::Error>`, not the typed `StorageError` used by the other three stores (RF5) | `trait { fn append(&self, ChatMsg) -> Result<u64, Box<dyn Error>>; fn list(&self, Option<u64>, u32) -> Result<Vec<ChatMsg>, Box<dyn Error>>; fn clear(&self, Option<u64>) -> Result<u32, Box<dyn Error>>; }` | trait |
| E-STR-10 | `impl ChatHistoryStore for Storage` | `storage/chat.rs:21` | Concrete impl over the façade: `append` INSERTs and returns the rowid; `list` builds a parameterised SELECT (per-session vs all, `ORDER BY ts DESC`, `LIMIT`) and maps rows; `clear` DELETEs (per-session vs all) and returns affected count; the `StorageError` from `with_conn` is boxed to satisfy the trait's `Box<dyn Error>` return | `impl ChatHistoryStore for Storage` | impl |
| E-STR-11 | `ChatMsg` | `storage/chat.rs:2` | Chat-turn row shape; `id` is the DB-assigned rowid, `session` groups a conversation, `zim_handle` optionally links a turn to a ZIM entry, `ts` is the caller-supplied epoch timestamp | `struct { id: u64, session: u64, role: String, content: String, zim_handle: Option<u64>, ts: i64 }` | struct |
| E-STR-12 | `AnnotationsStore` | `storage/annotations.rs:4` | Annotations persistence trait: create (returns rowid), list (optionally per ZIM, newest-first), delete by id, export to JSON, import from JSON (transactional upsert, returns count). ⚠ The impl does not compile today (RF1(a)); its `list` also has a column-index bug (RF1(b)) | `trait { fn create(&self, Uuid, String, Region, String) -> Result<u64, StorageError>; fn list(&self, Option<Uuid>) -> Result<Vec<Annotation>, StorageError>; fn delete(&self, u64) -> Result<(), StorageError>; fn export(&self, Option<Uuid>) -> Result<String, StorageError>; fn import(&self, &str) -> Result<usize, StorageError>; }` | trait |
| E-STR-13 | `impl AnnotationsStore for Storage` | `storage/annotations.rs:46` | Concrete impl: `create` serialises `Region` to JSON and INSERTs with server-side `created_at = unixepoch()*1000`; `list` SELECTs and **must** map columns `region=3, body=4, created_at=5` (current code is wrong — RF1(b)); `delete` removes by id; `export` serialises `list` output; `import` parses JSON and upserts each row (`ON CONFLICT(id) DO UPDATE`) inside an `unchecked_transaction`. ⚠ Uses non-existent `StorageError::Query` (RF1(a)) → does not compile | `impl AnnotationsStore for Storage` | impl |
| E-STR-14 | `Annotation` | `storage/annotations.rs:23` | Annotation row shape; serde round-trips for export/import; `created_at` set server-side to epoch-millis on create | `struct { id: u64, zim_uuid: Uuid, url: String, region: Region, body: String, created_at: i64 }` (`#[derive(Debug, Clone, Serialize, Deserialize)]`) | struct |
| E-STR-15 | `Region` | `storage/annotations.rs:34` | Region selector persisted as JSON text in `annotations.region`; serde round-trips all three variants with equality preserved | `enum { Char { start: u32, end: u32 }, Page, Custom(String) }` (`#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]`) | enum |
| E-STR-16 | `BookmarksStore` | `storage/bookmarks.rs:14` | Bookmark persistence trait: idempotent `toggle` on the `(zim_uuid, url)` key (add if absent → `true`, remove if present → `false`), and `list` optionally filtered by ZIM, newest-first | `trait { fn toggle(&self, Uuid, String, String) -> Result<bool, StorageError>; fn list(&self, Option<Uuid>) -> Result<Vec<Bookmark>, StorageError>; }` | trait |
| E-STR-17 | `impl BookmarksStore for Storage` | `storage/bookmarks.rs:25` | Concrete impl: `toggle` probes `EXISTS(… WHERE zim_uuid=? AND url=?)`, DELETEs if present (returns `false`) else INSERTs with `created_at = chrono::Utc::now().timestamp()` (returns `true`); `list` builds a parameterised SELECT (per-ZIM vs all, `ORDER BY created_at DESC`) and maps rows | `impl BookmarksStore for Storage` | impl |
| E-STR-18 | `Bookmark` | `storage/bookmarks.rs:5` | Bookmark row shape; serde round-trips through toggle→list | `struct { id: u64, zim_uuid: Uuid, url: String, title: String, created_at: i64 }` (`#[derive(Debug, Clone, Serialize, Deserialize)]`) | struct |
| E-STR-19 | `SettingsStore` | `storage/settings.rs:4` | KV trait over the `settings` table with typed schema versioning stored under key `'schema_version'` — **independent of `PRAGMA user_version`** (RF2) | `trait { fn get(&self, &str) -> Result<Option<String>, StorageError>; fn set(&self, &str, &str) -> Result<(), StorageError>; fn get_schema_version(&self) -> Result<u32, StorageError>; fn set_schema_version(&self, u32) -> Result<(), StorageError>; }` | trait |
| E-STR-20 | `impl SettingsStore for Storage` | `storage/settings.rs:21` | Concrete impl: `get` SELECTs and yields `None` on missing (`.ok()`); `set` is `INSERT OR REPLACE` (upsert); `get_schema_version` reads key `'schema_version'` defaulting to `0`; `set_schema_version(n)` delegates to `set` with the decimal string | `impl SettingsStore for Storage` | impl |
| E-STR-21 | `setting_key` | `storage/settings.rs:62` (re-exported `storage/mod.rs:8`) | Canonical setting-key namespace as a **module of `pub const &'static str`** so call-sites cannot drift on spelling; re-exported from the crate path `storage::setting_key::*`. `TELEMETRY_OPTED_IN` exists for forward-compat only — every v1.0 read of it is treated as `false` per INV-OFFLINE | `pub mod setting_key { pub const AI_VARIANT_OVERRIDE: &str = "ai.variant_override"; pub const AI_ACTIVE_MODEL_PATH: &str = "ai.active_model_path"; pub const AI_SAMPLER: &str = "ai.sampler"; pub const AI_TEMPERATURE: &str = "ai.temperature"; pub const UI_THEME: &str = "ui.theme"; pub const UI_FONT_SCALE: &str = "ui.font_scale"; pub const UI_WINDOW_GEOMETRY: &str = "ui.window_geometry"; pub const UI_LAST_OPEN_ZIM: &str = "ui.last_open_zim"; pub const PACK_CATALOG_URL: &str = "pack.catalog_url"; pub const PACK_AUTO_UPDATE: &str = "pack.auto_update"; pub const UPDATE_CHANNEL: &str = "update.channel"; pub const UPDATE_CHECK_ON_RESUME: &str = "update.check_on_resume"; pub const SIDECAR_AUTO_EXPORT: &str = "sidecar.auto_export"; pub const SIDECAR_DEFAULT_TRUST: &str = "sidecar.default_trust"; pub const TELEMETRY_OPTED_IN: &str = "telemetry.opted_in"; }` | module |

#### Semantic acceptance — I-12 (real-DB, never grep)

Each acceptance is run against the shared fixture above. ⚠ marks rows the
**current** source cannot satisfy; the orchestrator must NOT flip those ✅ until
RF1/RF2/RF3 are reconciled, then a real-DB run is observed.

- **E-STR-1 `Storage`** — `Storage::open(":memory:")` returns a `Storage` whose
  `.path` is `:memory:` and whose `.db` `Mutex` locks/unlocks cleanly; the
  `Debug` output contains `path` and no connection handle.
- **E-STR-2 `Storage::open`** — after `open`, `with_conn(|c| c.query_row("PRAGMA
  journal_mode", [], |r| r.get::<_,String>(0)))` reads back `wal`;
  `PRAGMA foreign_keys` → `1`; `PRAGMA synchronous` → `1` (NORMAL). Re-opening a
  temp-file path that already holds a row yields the same row (idempotent open).
- **E-STR-3 `Storage::with_conn`** — a first closure runs
  `execute_batch("CREATE TABLE t(x)")`; a second closure `SELECT COUNT(*) FROM t`
  returns `0` → the two closures share one connection and the lock is released
  between calls.
- **E-STR-4 `Storage::run_migrations`** — with shipped `MIGRATIONS` (empty),
  `run_migrations()` returns `Ok(())`, is idempotent (twice → both `Ok`), and
  leaves `PRAGMA user_version` at `0`. Injected-fixture: temporarily pass a
  one-element `MIGRATIONS` containing a `CREATE TABLE` migration and assert the
  table then exists and `PRAGMA user_version` equals the migration's `version`.
- **E-STR-5 `StorageError`** — `?`-lifting a `rusqlite::Error` (e.g. `execute`
  on a missing table) yields `Err(StorageError::Sql(_))`; forcing a panic inside
  a `with_conn` closure on a separate thread (so the mutex poisons) makes a
  subsequent `with_conn` return `Err(StorageError::Poisoned)`.
- **E-STR-6 `MigrationRunner`** — `current_version` on a fresh connection → `0`;
  after `apply_pending` with `[{version:1, sql:"CREATE TABLE x(id)"}]` it → `1`
  and the table exists; a second `apply_pending` with the same list is a no-op
  (version `1` not `> 1`).
- **E-STR-7 `Migration`** — a `Migration { version:1, name:"init",
  sql:"CREATE TABLE x(id INTEGER PRIMARY KEY)" }` carries its fields and its
  `sql` runs cleanly via `execute_batch`.
- **E-STR-8 `MIGRATIONS`** — `assert!(MIGRATIONS.is_empty())` holds in the
  current build (documents: no migrations ship yet).
- **E-STR-9 / E-STR-10 / E-STR-11 chat_history** — fixture-create `chat_history`;
  `append(ChatMsg{session:7, role:"user", content:"hi", zim_handle:None, ts:1})`
  returns a `u64` rowid; a second `append` in `session:7` with a later `ts`;
  `list(Some(7), 10)` returns exactly those two, **newest-first** (later `ts`
  first), with `id`/`session`/`role`/`content`/`zim_handle`/`ts` equal and
  `zim_handle == None` round-tripping; `list(None, 1)` returns just one row
  across sessions; `clear(Some(7))` returns `2` and `list(Some(7),10)` is now
  empty while other sessions survive; `clear(None)` returns the remaining count
  and empties the table.
- **E-STR-12 / E-STR-13 / E-STR-14 / E-STR-15 annotations** ⚠ — fixture-create
  `annotations`; `create(uuid, "/a".into(), Region::Char{start:0,end:5}, "body")`
  returns a rowid and `list(Some(uuid))` returns it newest-first with
  `created_at` an epoch-millis (>0) set server-side; `list(None)` returns all.
  **Correct-column assertion (fails on current source — RF1(b)):** the returned
  `Annotation` has `region == Region::Char{start:0,end:5}`, `body == "body"`,
  `created_at` equal to the stored value — proving `list` reads `region=3,
  body=4, created_at=5`, **not** the indices currently in `annotations.rs`.
  `delete(id)` removes exactly that row. `export(Some(uuid))` yields JSON that
  `serde_json::from_str::<Vec<Annotation>>` parses back to an equal set (incl.
  `Region::Page` and `Region::Custom("s")` round-trips). `import(json)` into a
  fresh DB inserts N rows inside one transaction, returns `N`, and re-`export`
  yields an equal set; a duplicate-id `import` upserts (`ON CONFLICT(id)`) rather
  than erroring. **All gated on RF1(a):** the file must first compile
  (`StorageError::Query` does not exist).
- **E-STR-16 / E-STR-17 / E-STR-18 bookmarks** — fixture-create `bookmarks`;
  `toggle(uuid, "/a".into(), "A".into())` → `true` and `list(Some(uuid))`
  returns one `Bookmark` with `title=="A"` and `created_at>0`; `toggle` again on
  the same `(uuid,"/a")` → `false` and `list` is empty (idempotent toggle on the
  pair); toggling a different `(uuid,"/b")` does not affect the first;
  `list(None)` returns all newest-first.
- **E-STR-19 / E-STR-20 settings** — fixture-create `settings`; `get("nope")` →
  `None`; `set("k","v")` then `get("k")` → `Some("v")`; `set("k","v2")` then
  `get("k")` → `Some("v2")` (INSERT OR REPLACE upsert). `get_schema_version()`
  on an empty table → `0`; `set_schema_version(3)` then `get_schema_version()` →
  `3`, and `get("schema_version")` → `Some("3")` (proving it uses the settings
  row, independent of `PRAGMA user_version` per RF2).
- **E-STR-21 `setting_key`** — `assert_eq!(setting_key::UI_THEME, "ui.theme")`
  and the same for every listed const. **INV-OFFLINE gate assertion:** a settings
  read where `get(setting_key::TELEMETRY_OPTED_IN)` returns a truthy value is
  treated as `false` at the telemetry gate — i.e. the key is forward-compat
  storage only; v1.0 never acts on a truthy read.

#### Reconciliation flags surfaced — TC13 (surface, do not silently apply)

These were raised by verifying the dispatch's codegraph skeleton against the
live `src-tauri/src/storage/*.rs`. The orchestrator (Opus) decides; coders do
not self-repair (I-6).

- **RF1 — `annotations.rs` does not compile, and `list()` has a column-index
  bug.** (a) **Compile blocker:** `create`/`export`/`import` (and transitively
  `list`'s serde-failure path) construct `StorageError::Query(String)`, but the
  `StorageError` enum (`storage/mod.rs:11`) has **no `Query` variant** — only
  `Sql`/`Migration`/`Schema`/`Poisoned`. Decision needed: add `Query(String)` to
  the enum, or map serde/JSON errors onto the existing `Schema(String)` (and
  rusqlite conversion failures onto `Sql`). (b) **Runtime bug:** in `list`,
  `SELECT id,zim_uuid,url,region,body,created_at` is columns `0..5`, but the
  closure reads region from `row.get(4)` (the `body` column), `body` from
  `row.get(5)` (the `created_at` column), and `created_at` from `row.get(6)`
  (out of range → `rusqlite::InvalidColumnIndex`). Correct indices are
  `region=3, body=4, created_at=5`. This is precisely the kind of defect a grep
  "Verify" passes silently on (the methods and SQL strings all exist) — only the
  E-STR-13 real-DB acceptance catches it (I-12). **Blocks ✅ on E-STR-12/13/14/15
  until resolved.**
- **RF2 — dual, inconsistent schema-version mechanisms.** `MigrationRunner`
  versions the schema via `PRAGMA user_version` (`migrations.rs:16-17`), while
  `SettingsStore::get_schema_version`/`set_schema_version` version via the
  `settings`-table row `key='schema_version'` (`settings.rs:43-57`). The two are
  independent and neither is written by the other. The dispatch skeleton's claim
  that migrations "use `SettingsStore::get/set_schema_version`" is **not borne
  out by the source.** Decision needed: unify on one canonical version store
  (recommend `PRAGMA user_version` as the migration runner's source of truth and
  drop the `settings`-row scheme, or wire them together explicitly). Non-blocking
  for the chat/bookmarks/settings behavioural acceptances, but should be resolved
  before the schema is real (RF3).
- **RF3 — no `CREATE TABLE` ships from this module; `run_migrations` is a
  no-op.** `MIGRATIONS` is `&[]` (`migrations.rs:9`) and no `CREATE TABLE` for
  `settings`/`chat_history`/`bookmarks`/`annotations` exists anywhere in
  `storage/*.rs`. Where these tables are created is **outside the verified
  scope** (intake discipline limited reads to this module + §7.5). Either the
  DDL lives in a parent init path not in this module, or it is missing. Decision
  needed: add the four `CREATE TABLE` statements as `MIGRATIONS` entries (the
  intended design — `MigrationRunner` exists for exactly this) so `run_migrations`
  produces the schema, and document the canonical DDL. The acceptances above use
  a fixture DDL as a placeholder until this lands.
- **RF4 — submodules `annotations`/`bookmarks`/`chat` are not declared in
  `storage/mod.rs`.** `mod.rs` declares only `pub mod migrations; pub mod
  settings;` (lines 5-6) and re-exports `pub use settings::{SettingsStore,
  setting_key};` (line 8). The `annotations.rs`/`bookmarks.rs`/`chat.rs` files
  exist on disk but are **not declared as submodules in this `mod.rs`** within
  the verified scope. Decision needed: confirm whether they are declared
  elsewhere (e.g. a parent module) and add the three `pub mod` declarations +
  trait re-exports here if not. **Blocks the module from compiling with its full
  trait surface.**
- **RF5 — `ChatHistoryStore` returns `Box<dyn Error>`; the other three return
  typed `StorageError`.** As flagged in the dispatch (non-blocking): unify
  `ChatHistoryStore`'s signatures to `Result<_, StorageError>` for a consistent
  module error surface. The concrete impl already boxes a `StorageError`, so the
  change is signature-only at the trait.
- **RF6 — E-STR-21 vocabulary correction.** The pre-existing table named this
  entity `SettingKey` (a `const` namespace) at `settings.rs:50`. The source
  defines it as a **module** `setting_key` (lowercase) at `settings.rs:62`,
  re-exported from `storage/mod.rs:8`. Corrected to `setting_key` / `module` in
  the table above (I-3 — vocabulary from source).

*Partial authored by GLM-5.1 architect seat under TC13 per-module dispatch
(2026-06-13): intake-limited to `src-tauri/src/storage/*.rs` + §7.5 of
`DOCS/ARCHITECTURE.md`; every row verified against live source; line numbers
corrected; RF1–RF6 surfaced for orchestrator decision. This partial is the
durable interim state — the master `DOCS/ARCHITECTURE.md` §7.5 is re-attested
only by the orchestrator after curation (I-11 — no mid-pass master attestation).*

