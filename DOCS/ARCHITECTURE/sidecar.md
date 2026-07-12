<!-- CURATED PARTIAL §7.10 Sidecar. GLM-5.1 per-module dispatch (`sidecar`); Opus-reviewed/accepted 2026-06-13. Carry-forward (coder tasks): A) SidecarStore (store.rs) is todo!() — .zsc file persistence unwired; B) SidecarIndex (store.rs) is todo!() — SQLite lookup cache unwired (+ DDL-owner question: §7.5 storage or here?). Crypto/codec/sign/verify/trust/chunk/identity/blob are REAL. C-F doc fixes (CodecError 6 variants, two distinct TrustLevel types, line-number drift, promoted folded entities) applied in-partial. -->

# §7.10 Sidecar subsystem (`src-tauri/src/sidecar/`) — behavioural end-state partial

> Per-module architect partial (I-21/TC13). GLM-5.1 author. Airlock only (TC6) — written to
> `.tmp/glm-dispatches/modules/sidecar.arch.md`; no live edits. Awaiting orchestrator curation
> and re-attestation of the whole `DOCS/ARCHITECTURE.md` §7.

## Intake discipline (honoured)

Read ONLY, per dispatch:
- this dispatch file (`.tmp/glm-dispatches/modules/sidecar.dispatch.md`);
- all of `src-tauri/src/sidecar/*.rs` (`mod.rs`, `payload.rs`, `codec.rs`, `sign.rs`, `verify.rs`,
  `store.rs`, `identity.rs`, `trust.rs`, `chunk.rs`, `voice_blob.rs`);
- `§7.10` of `DOCS/ARCHITECTURE.md` (sed, lines 816–857);
- `§5.4` (333–371) and `§5.5` (372–410) sidecar sequences (sed).

The whole `DOCS/ARCHITECTURE.md` was NOT read.

## Behavioural summary

The sidecar subsystem is the **cryptographically-signed annotation-portability layer**: a reader's
annotations/bookmarks/reading-logs/voice-notes/comprehension-responses leave the device as a single
self-describing, self-authenticating `.zsc` artifact, travel as a file (no account, no server), and
re-enter another device where they are decoded, signature-verified, and either admitted (trusted),
prompted (unknown author), or rejected (rejected author or bad signature). The full round trip is
**sign → export → import → verify → trust**.

- **INV-OFFLINE (honoured, binding):** signing, verification, trust evaluation, identity generation,
  chunk reassembly, and blob storage are **pure local operations — zero network**. `ed25519-dalek` for
  signatures, `ciborium`/`serde_cbor` for canonical CBOR, `rusqlite` (`Arc<Storage>`) for the trust DB,
  plain `std::fs` for the `.zsc` file store and the content-addressed voice-blob store. There is no
  fetcher, no socket, no HTTP in any path here. Sidecars arrive by file copy / SD / USB / LAN share
  (the universal offline path); the chunked transport exists for LoRa/constrained links and is still
  pure in-memory reassembly.
- **Single trust root = the device's own ed25519 identity** (`IdentityKeystore` → `SidecarSigner`).
  Transports are **never** trusted — only the signature plus the author-key-match check carry weight.
  A sidecar is self-authenticating: anyone can hand it to you, but you decide per-author trust locally.
- **Realises `§5.4`** (create + export: `IdentityKeystore::load_or_create` → build `Sidecar` →
  `SidecarSigner::sign` → `SidecarStore::write`) and **`§5.5`** (import + verify: `SidecarCodec::decode_cbor`
  → `SidecarVerifier::verify` → `TrustDb::get` → optional trust-prompt → `SidecarStore::write`).
- **UI surface:** `LIBS/UI/STITCH/screens/08-sidecar-share/` (screen IDs cited from the design pass).
- **Module wiring (E-STATE-1 `AppState`):** `sidecar_store: Arc<SidecarStore>`, `sidecar_signer: Arc<SidecarSigner>`,
  `sidecar_index: Arc<SidecarIndex>`, `trust_db: Arc<TrustDb>`, `voice_blobs: Arc<VoiceClipBlobStore>` —
  all built in `AppState::build`. Commands `E-CMD-33..38` (`sidecar_create/export/export_json/import/list/delete`)
  are the frontend entry points.

**Realisation status (verified by reading source, not by grep):** the **crypto/codec/identity/verify/trust/chunk/blob**
surfaces are **REAL and behavioural**. Two entities — `SidecarStore` (E-SIDE-22) and `SidecarIndex`
(E-SIDE-24) — are **`todo!()` stubs** today (file shells with correct types but no body). Their
end-state behaviour is specified below and flagged for coder realisation in §RECONCILE; they are the
only gap between the current tree and the production end-state described here.

## Entity table — verified against `src-tauri/src/sidecar/*.rs`

Columns: `ID | Name | Target (file:line) | Behavioural role | Signature / fields | Type`.
`[REAL]` = read in source and behavioural; `[STUB]` = `todo!()` shell awaiting coder body (see §RECONCILE).
Line numbers are the real `pub` definition site as read.

| ID | Name | Target | Behavioural role | Signature / fields | Type |
|---|---|---|---|---|---|
| E-SIDE-1 | `Sidecar` | `sidecar/mod.rs:16` | [REAL] Top-level self-authenticating container; the `.zsc` artifact. Carries schema version, a UUIDv7 artifact id, the ZIM it attaches to (+ optional URL scope), author identity, the typed `Payload`, inter-sidecar refs, the optional `SignatureEnvelope`, and optional self-disclosed `Provenance`. Is the unit signed, exported, imported, and verified. Derives `serde` so it is (de)serializable to canonical CBOR; derives `PartialEq+Eq` so round-trips are assertable. | `struct { schema_version: u8, artifact_id: [u8;16], zim_uuid: [u8;16], zim_url_scope: Option<String>, created_at: i64, author: PeerIdentity, payload: Payload, refs: Vec<SidecarRef>, signature_envelope: Option<SignatureEnvelope>, provenance: Option<Provenance> }` (`#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]`) | struct |
| E-SIDE-2 | `PeerIdentity` | `sidecar/mod.rs:41` | [REAL] Author identity carried inside the sidecar. `pubkey` is the trust anchor against which `signature_envelope.pubkey` is matched (`AuthorKeyMismatch` on divergence). `handle`/`device` are human hints, never security inputs. | `struct { pubkey: [u8;32], handle: Option<String>, device: Option<String> }` (serde, `PartialEq+Eq`) | struct |
| E-SIDE-3 | `SidecarRef` | `sidecar/mod.rs:52` | [REAL] Typed edge to another sidecar (artifact id + that author's pubkey + relation). Lets a sidecar declare "extends/responds-to/supersedes/annotates" another — the basis for annotation threads and supersession without a server. | `struct { artifact_id: [u8;16], pubkey: [u8;32], relation: RelationKind }` (serde, `PartialEq+Eq`) | struct |
| E-SIDE-3a | `RelationKind` | `sidecar/mod.rs:63` | [REAL] Discriminator for `SidecarRef`. (Promoted to its own row — was folded into E-SIDE-3; it is a distinct public serde enum.) | `enum { Extends, RespondsTo, Supersedes, Annotates }` (serde, `PartialEq+Eq`) | enum |
| E-SIDE-4 | `Provenance` | `sidecar/mod.rs:76` | [REAL] Reader self-disclosure (reader version/variant, device class, network context, cleanroom flag). Optional, advisory, never security-relevant — lets a recipient judge context. | `struct { reader_version: String, reader_variant: Option<String>, device_class: Option<String>, network_context: Option<String>, cleanroom: Option<bool> }` (serde, `PartialEq+Eq`) | struct |
| E-SIDE-5 | `SignatureEnvelope` | `sidecar/mod.rs:91` | [REAL] The ed25519 signature over the canonical-CBOR encoding of the sidecar **with the envelope cleared**. `alg` is the algorithm tag (only `"ed25519"` accepted); `pubkey`/`signature`/`signed_at` complete the detached signature. The 64-byte `signature` uses a custom serde module (`big_array_64`, `mod.rs:103`) that serializes as a byte array and **rejects on deserialize any length ≠ 64**. | `struct { alg: String, pubkey: [u8;32], signature: [u8;64] (serde with big_array_64), signed_at: i64 }` (serde, `PartialEq+Eq`) | struct |
| E-SIDE-6 | `Payload` | `payload.rs:7` | [REAL] Typed payload discriminator (CBOR-tagged via serde enum). Selects one of seven concrete bodies or an `Unknown{kind, body}` forward-compat variant that preserves a future payload kind without a schema bump. | `enum { AnnotationSet(AnnotationSetBody), BookmarkSet(BookmarkSetBody), ReadingLog(ReadingLogBody), ComprehensionResponse(ComprehensionResponseBody), VoiceNoteCollection(VoiceNoteCollectionBody), TrustMarkUpdate(TrustMarkUpdateBody), Manifest(ManifestBody), Unknown { kind: String, body: serde_cbor::Value } }` (serde, `PartialEq+Eq`) | enum |
| E-SIDE-7 | `AnnotationSetBody` | `payload.rs:74` | [REAL] Annotation payload — a bundle of highlights + text/voice notes (`Annotation` list). | `struct { annotations: Vec<Annotation> }` (serde, `PartialEq+Eq`) | struct |
| E-SIDE-7a | `Annotation` | `payload.rs:81` | [REAL] Single highlight + attached note. UUIDv7 id, document `Region`, text body, optional `VoiceClip` + Gemma-4 transcript, timestamps, tags. | `struct { id: [u8;16], region: Region, body_text: String, body_voice: Option<VoiceClip>, body_transcript: Option<String>, created_at: u64, updated_at: Option<u64>, tags: Vec<String> }` | struct |
| E-SIDE-7b | `Region` | `payload.rs:102` | [REAL] Document selector wrapper (`RegionKind`). | `struct { kind: RegionKind }` | struct |
| E-SIDE-7c | `RegionKind` | `payload.rs:109` | [REAL] Selector variants: char range, page, URL, or custom. | `enum { CharRange { start: u64, end: u64 }, Page { page: u64 }, Url { url: String }, Custom { selector: String } }` | enum |
| E-SIDE-7d | `VoiceClip` | `payload.rs:122` | [REAL] Inline recorded audio note (codec, sample rate, duration, raw bytes) embedded directly in an annotation (distinct from blob-referenced `VoiceNoteRef`). | `struct { codec: String, sample_rate: u64, duration_ms: u64, audio: Vec<u8> }` | struct |
| E-SIDE-8 | `BookmarkSetBody` | `payload.rs:28` | [REAL] Saved reading locations (`Bookmark` list). | `struct { bookmarks: Vec<Bookmark> }` | struct |
| E-SIDE-8a | `Bookmark` | `payload.rs:35` | [REAL] One saved location: UUIDv7 id, `Region`, optional title/note, timestamps, tags. | `struct { id: [u8;16], region: Region, title: Option<String>, note: Option<String>, created_at: u64, updated_at: Option<u64>, tags: Vec<String> }` | struct |
| E-SIDE-9 | `ReadingLogBody` | `payload.rs:135` | [REAL] Chronological reading-session record (`ReadingEvent` list). | `struct { events: Vec<ReadingEvent> }` | struct |
| E-SIDE-9a | `ReadingEvent` | `payload.rs:142` | [REAL] One discrete reading action: id, kind, timestamp, optional CBOR context. | `struct { id: [u8;16], kind: ReadingEventKind, timestamp: u64, context: Option<serde_cbor::Value> }` | struct |
| E-SIDE-9b | `ReadingEventKind` | `payload.rs:155` | [REAL] Action discriminator. | `enum { SessionStart, SessionEnd, Bookmark, Highlight, Note, Progress }` | enum |
| E-SIDE-10 | `ComprehensionResponseBody` | `payload.rs:172` | [REAL] Answers to creator-embedded prompts (`ComprehensionResponse` list). | `struct { responses: Vec<ComprehensionResponse> }` | struct |
| E-SIDE-10a | `ComprehensionResponse` | `payload.rs:179` | [REAL] One answer: creator prompt id, answer text, timestamp, optional correctness flag. | `struct { prompt_id: String, answer: String, ts: u64, correct: Option<bool> }` | struct |
| E-SIDE-11 | `VoiceNoteCollectionBody` | `payload.rs:192` | [REAL] Collection of references into `VoiceClipBlobStore` (`VoiceNoteRef` list) — voice notes shipped as content-addressed blobs, not inlined. | `struct { notes: Vec<VoiceNoteRef> }` | struct |
| E-SIDE-11a | `VoiceNoteRef` | `payload.rs:199` | [REAL] One blob reference: UUIDv7 id, blob key, timestamp. | `struct { id: [u8;16], blob_ref: String, created_at: u64 }` | struct |
| E-SIDE-12 | `TrustMarkUpdateBody` | `payload.rs:238` | [REAL] Gossip bundle of peer-trust marks (`TrustMark` list) — how trust decisions propagate peer-to-peer. Carries `payload::TrustLevel` (E-SIDE-12a), **distinct** from the DB `trust::TrustLevel` (E-SIDE-31). | `struct { marks: Vec<TrustMark> }` | struct |
| E-SIDE-12a | `TrustMark` | `payload.rs:223` | [REAL] One gossip mark about a peer. `level` is `payload::TrustLevel`. | `struct { pubkey: [u8;32], level: payload::TrustLevel, scope: Option<String>, expires_at: Option<i64>, reason: Option<String> }` | struct |
| E-SIDE-12b | `TrustLevel` (payload) | `payload.rs:210` | [REAL] Trust enum **used inside gossip payloads only** (serde-tagged for CBOR transport). Distinct type from `trust::TrustLevel` (E-SIDE-31) despite identical variant names — the payload one is not `Copy` and exists so wire-format and DB stay decoupled. | `enum { Trusted, Verified, Rejected, Unknown }` (serde, `PartialEq+Eq`) | enum |
| E-SIDE-13 | `ManifestBody` | `payload.rs:67` | [REAL] Sidecar-of-sidecars — "I also carry these other sidecars" (`ManifestEntry` list). Enables batching + integrity-listing without a manifest server. | `struct { entries: Vec<ManifestEntry> }` | struct |
| E-SIDE-13a | `ManifestEntry` | `payload.rs:54` | [REAL] Reference to another sidecar with its payload kind, byte size, and sha256 of its canonical CBOR (envelope excluded) for integrity. | `struct { artifact_id: [u8;16], kind: String, size_bytes: u64, sha256: [u8;32] }` | struct |
| E-SIDE-14 | `SidecarCodec` | `codec.rs:31` | [REAL] Stateless encoder/decoder. `encode_cbor`/`decode_cbor` are the `.zsc` wire format (`ciborium`); `encode_canonical_for_signing` yields the deterministic byte string that is signed/verified (ciborium's canonical map-key ordering + fixed-width ints ⇒ byte-stable across runs); `encode_json_debug` is a human-readable debug dump. | `struct SidecarCodec; impl { encode_cbor(&Sidecar) -> Result<Vec<u8>, CodecError>; decode_cbor(&[u8]) -> Result<Sidecar, CodecError>; encode_canonical_for_signing(&Sidecar) -> Result<Vec<u8>, CodecError>; encode_json_debug(&Sidecar) -> Result<String, CodecError> }` (ciborium) | concrete |
| E-SIDE-15 | `CodecError` | `codec.rs:7` | [REAL] Codec + chunk-transport error. **Has six variants** (the old table listed only three; `InvalidChunkIndex`/`DuplicateChunk`/`MissingChunk` were added when `chunk.rs` landed and are raised by `ChunkReassembler`). | `enum { Cbor(String), Json(String), Schema(String), InvalidChunkIndex { index: u32, total: u32 }, DuplicateChunk { index: u32 }, MissingChunk { index: u32 } }` (thiserror, `Clone+PartialEq+Eq`) | enum |
| E-SIDE-16 | `SidecarSigner` | `sign.rs:23` | [REAL] Holds the device's ed25519 signing key. `sign(&mut Sidecar)` clears any existing envelope, canonical-encodes, signs, and attaches a fresh `SignatureEnvelope{alg:"ed25519", pubkey, signature, signed_at}`. `from_seed` builds from a stored 32-byte seed; `pubkey()` derives the verifying key. | `struct { signing_key: ed25519_dalek::SigningKey }; impl { from_seed(&[u8;32]) -> Self; sign(&self, &mut Sidecar) -> Result<(), SignError>; pubkey(&self) -> [u8;32] }` | concrete |
| E-SIDE-17 | `SignError` | `sign.rs:10` | [REAL] Signing failure (codec or crypto). | `enum { Codec(CodecError), Crypto(String) }` (thiserror) | enum |
| E-SIDE-18 | `SidecarVerifier` | `verify.rs:40` | [REAL] Stateless verifier. `verify`: rejects wrong schema version (`EXPECTED_SCHEMA_VERSION = 1`), missing envelope, non-ed25519 alg, author/envelope pubkey mismatch, then re-canonical-encodes (envelope cleared) and verifies the ed25519 signature — returns `VerifiedSidecar` or a precise error. `verify_with_trust` runs `verify` then consults `TrustDb`; **only `Rejected` fails** (Unknown/Verified/Trusted all pass, level attached). | `struct SidecarVerifier; const EXPECTED_SCHEMA_VERSION: u8 = 1; impl { verify(&Sidecar) -> Result<VerifiedSidecar, SidecarVerifyError>; verify_with_trust(&Sidecar, &TrustDb) -> Result<TrustedSidecar, SidecarVerifyError> }` | concrete |
| E-SIDE-19 | `VerifiedSidecar` | `verify.rs:126` | [REAL] Newtype proof token: signature + schema + author-key-match all passed. Carries the inner sidecar and the signer pubkey. Only obtainable from `SidecarVerifier::verify`. | `struct { inner: Sidecar, signer_pubkey: [u8;32] }` (`Debug, Clone, PartialEq, Eq`) | struct |
| E-SIDE-20 | `TrustedSidecar` | `verify.rs:135` | [REAL] Stronger proof token: signature passed AND author is not `Rejected`. Carries `VerifiedSidecar` + the resolved `TrustLevel`. Only obtainable from `verify_with_trust`. | `struct { inner: VerifiedSidecar, trust_level: trust::TrustLevel }` (`Debug, Clone, PartialEq, Eq`) | struct |
| E-SIDE-21 | `SidecarVerifyError` | `verify.rs:10` | [REAL] Verification failure with one variant per rejection reason (used by both `verify` and `verify_with_trust`; `TrustRejected` is raised on `Rejected` author or on a `TrustDb` read failure). | `enum { Codec(CodecError), BadSignature, MissingSignature, UnsupportedAlg(String), DelegationNotSupported, SchemaVersion(u8), AuthorKeyMismatch, TrustRejected }` (thiserror) | enum |
| E-SIDE-22 | `SidecarStore` | `store.rs:27` | **[STUB — `todo!()`]** Filesystem-of-truth: the `.zsc` store at `<root>/<zim_uuid>/<artifact_id>.zsc`. **End-state behaviour:** `write(&VerifiedSidecar)` canonical-CBOR-encodes and atomically writes the file under the ZIM/artifact path, returning the `PathBuf`; `read(artifact_id, zim_uuid)` decodes it back to `Sidecar`; `list_for_zim(zim_uuid)` enumerates paths; `delete(artifact_id, zim_uuid)` removes the file. Today all four bodies are `todo!()` — coder realisation pending (see §RECONCILE). | `struct { root: PathBuf }; impl { new(PathBuf) -> Self; write(&self, &VerifiedSidecar) -> Result<PathBuf, StoreError>; read(&self, artifact_id:[u8;16], zim_uuid:[u8;16]) -> Result<Sidecar, StoreError>; list_for_zim(&self, zim_uuid:[u8;16]) -> Result<Vec<PathBuf>, StoreError>; delete(&self, artifact_id:[u8;16], zim_uuid:[u8;16]) -> Result<(), StoreError> }` | concrete |
| E-SIDE-23 | `StoreError` | `store.rs:14` | [REAL] Store failure. | `enum { Io(io::Error), Codec(CodecError), Verify(SidecarVerifyError) }` (thiserror) | enum |
| E-SIDE-24 | `SidecarIndex` | `store.rs:66` | **[STUB — `todo!()`]** SQLite-derived cache over the file store for fast URL/ZIM lookups. **End-state behaviour:** `rebuild_from_files(&SidecarStore)` scans the store, decodes each sidecar's `SidecarMeta` (artifact id, zim uuid, payload kind, signer pubkey, created_at, path) into the `sidecar`-adjacent SQLite table, returns the count; `find_for_url(zim_uuid, url)` queries by ZIM + URL/scope pattern and returns matching `SidecarMeta` rows. Today both bodies are `todo!()` — coder realisation pending (see §RECONCILE). | `struct { storage: Arc<Storage> }; impl { new(Arc<Storage>) -> Self; rebuild_from_files(&self, &SidecarStore) -> Result<u32, StoreError>; find_for_url(&self, zim_uuid:[u8;16], url:&str) -> Result<Vec<SidecarMeta>, StoreError> }` | concrete |
| E-SIDE-25 | `SidecarMeta` | `store.rs:55` | [REAL] Index/manifest row (pure data; serde for SQLite/JSON). | `struct { artifact_id: [u8;16], zim_uuid: [u8;16], kind: String, signer_pubkey: [u8;32], created_at: i64, path: PathBuf }` (`Debug, Clone, Serialize, Deserialize`) | struct |
| E-SIDE-26 | `Chunk` | `chunk.rs:11` | [REAL] One LoRa-friendly transport slice: artifact id, index, total, and the partial CBOR bytes. | `struct { artifact_id: [u8;16], chunk_index: u32, total_chunks: u32, payload_part: Vec<u8> }` (serde, `PartialEq+Eq`) | struct |
| E-SIDE-27 | `ChunkEncoder` | `chunk.rs:35` | [REAL] Splits a sidecar's full CBOR encoding into `ceil(len / max_payload_bytes)` ordered `Chunk`s, each tagged with artifact id / index / total. | `struct { max_payload_bytes: usize }; impl { new(usize) -> Self; encode(&self, &Sidecar) -> Result<Vec<Chunk>, CodecError> }` | concrete |
| E-SIDE-28 | `ChunkReassembler` | `chunk.rs:102` | [REAL] In-memory reassembly buffer keyed by artifact id. `ingest` validates index range, rejects duplicates, buffers the part, and when all `total_chunks` are present concatenates them **in index order** and `decode_cbor`s the result → `Complete(Sidecar)`; else `Pending{received,total}`; on bad index/duplicate/missing/decode → `Failed(CodecError)`. `cleanup_expired(threshold)` drops stale buffers. `Default`-constructible. | `struct { buffers: HashMap<[u8;16], ChunkBuffer> }; impl { new() -> Self; ingest(&mut self, Chunk) -> ReassembleStatus; cleanup_expired(&mut self, threshold_timestamp: i64) }` (also `impl Default`) | concrete |
| E-SIDE-29 | `ReassembleStatus` | `chunk.rs:24` | [REAL] Outcome of `ChunkReassembler::ingest`. | `enum { Pending { received: u32, total: u32 }, Complete(Sidecar), Failed(CodecError) }` (`PartialEq+Eq`) | enum |
| E-SIDE-30 | `TrustDb` | `trust.rs:25` | [REAL] SQLite-backed local peer-trust registry (`Arc<Storage>`). `get` reads the non-expired level for a pubkey (NULL or future `expires_at` ⇒ live; past ⇒ treated as absent → `None`). `set` upserts a `Manual`-source entry. `list` returns all rows with decoded level + `TrustSource`. `apply_gossip` upserts every mark from a `TrustMarkUpdateBody`, tagging source `Gossip:<from_pubkey hex>`, returning the count. | `struct { storage: Arc<Storage> }; impl { new(Arc<Storage>) -> Self; get(&self, &[u8;32]) -> Result<Option<TrustLevel>, TrustError>; set(&self, pubkey:[u8;32], level:TrustLevel, scope:Option<&str>, expires_at:Option<i64>, reason:Option<&str>) -> Result<(), TrustError>; list(&self) -> Result<Vec<TrustEntry>, TrustError>; apply_gossip(&self, &TrustMarkUpdateBody, from_pubkey:[u8;32]) -> Result<u32, TrustError> }` | concrete |
| E-SIDE-31 | `TrustLevel` (trust/DB) | `trust.rs:17` | [REAL] Trust enum **used by the DB and by `TrustedSidecar`** (the one re-exported from `mod.rs:166`). `Copy` + serde. Distinct type from `payload::TrustLevel` (E-SIDE-12b) — same variant names, different module/identity. | `enum { Trusted, Verified, Rejected, Unknown }` (serde, `Copy`, `PartialEq+Eq`) | enum |
| E-SIDE-32 | `TrustEntry` | `trust.rs:194` | [REAL] One decoded trust row. | `struct { pubkey: [u8;32], level: trust::TrustLevel, scope: Option<String>, expires_at: Option<i64>, reason: Option<String>, source: TrustSource }` (serde, `PartialEq+Eq`) | struct |
| E-SIDE-32a | `TrustSource` | `trust.rs:183` | [REAL] Provenance of a trust decision. (Promoted to its own row — was folded into E-SIDE-32; distinct public serde enum.) `Manual` = local user; `Gossip{from_pubkey}` = learned from a peer (stored as `Gossip:<hex>`); `Operator` = bundled (e.g. blocklist). | `enum { Manual, Gossip { from_pubkey: [u8;32] }, Operator }` (serde, `PartialEq+Eq`) | enum |
| E-SIDE-33 | `TrustError` | `trust.rs:10` | [REAL] Trust-DB failure (wraps `StorageError`). | `enum { Storage(StorageError) }` (thiserror) | enum |
| E-SIDE-34 | `IdentityKeystore` | `identity.rs:24` | [REAL] Per-installation ed25519 keypair manager. `load_or_create(dir)` — if `<dir>/signing-key.bin` exists, loads + validates the 32-byte seed; else generates a fresh `OsRng` seed, writes it with **0600 perms** (unix) + `sync_all`, and returns the `SidecarSigner`. This seed is the device's durable identity root; its `pubkey()` is what recipients see as `author.pubkey`. | `struct { path: PathBuf }; impl { load_or_create(dir: PathBuf) -> Result<SidecarSigner, IdentityError> }` (file `0600`, `<data_dir>/identity/signing-key.bin`) | concrete |
| E-SIDE-35 | `IdentityError` | `identity.rs:11` | [REAL] Identity load/create failure. | `enum { Io(io::Error), Crypto(String) }` (thiserror) | enum |
| E-SIDE-36 | `VoiceClipBlobStore` | `voice_blob.rs:8` | [REAL] Content-addressed (sha256) filesystem blob store for `VoiceNoteCollectionBody`-referenced audio. `write` hashes, shards to `<root>/<hex[..2]>/<hex[2..]>`, `create_dir_all`s, writes; `read`/`delete` address by the 32-byte hash. INV-OFFLINE: plain `std::fs`, no net. | `struct { root: PathBuf }; impl { write(&self, &[u8]) -> Result<[u8;32], io::Error>; read(&self, [u8;32]) -> Result<Vec<u8>, io::Error>; delete(&self, [u8;32]) -> Result<(), io::Error> }` (sha256 content-addressed, 2-hex-char sharded paths) | concrete |
| E-SIDE-37 | `SidecarError` | `mod.rs:133` | [REAL] Umbrella error for the whole subsystem; `AppError::Sidecar(SidecarError)` consumes it. `#[from]` impls for every underlying error let `?` propagate across codec/sign/verify/store/trust/identity boundaries. | `enum { Codec(CodecError), Sign(SignError), Verify(SidecarVerifyError), Store(StoreError), Trust(TrustError), Identity(IdentityError) }` (thiserror, `#[from]` on each) | enum |

## Semantic acceptance (I-12 — real-crypto / round-trip, NEVER grep)

These are the behavioural assertions each entity must satisfy. Acceptance is **direct observation of
crypto/round-trip behaviour**, not a presence check. (A verifier/runner implements these as real
`ed25519_dalek` + `ciborium` + temp-`rusqlite` tests; grep/line-count is explicitly NOT acceptance.)

1. **Sign→verify happy path (E-SIDE-1,5,16,18,19).** Build a `Sidecar` with schema_version `1`,
   real `author.pubkey`. `SidecarSigner::from_seed(k).sign(&mut s)` ⇒ `Ok(())` and `s.signature_envelope`
   becomes `Some` with `alg == "ed25519"`. `SidecarVerifier::verify(&s)` ⇒ `Ok(VerifiedSidecar{..})` with
   `signer_pubkey == signer.pubkey()`.

2. **Tamper detection (E-SIDE-18,21).** Take the signed sidecar from (1), flip one byte in
   `payload` (re-signing is NOT done), `verify` ⇒ `Err(SidecarVerifyError::BadSignature)`.

3. **Author-key mismatch (E-SIDE-18,21).** Sign with key A but set `author.pubkey` to key B's pubkey ⇒
   `verify` ⇒ `Err(AuthorKeyMismatch)`.

4. **Missing signature (E-SIDE-18,21).** `signature_envelope = None` ⇒ `Err(MissingSignature)`.

5. **Wrong schema / alg (E-SIDE-18,21).** `schema_version != 1` ⇒ `Err(SchemaVersion(_))`; `alg != "ed25519"`
   ⇒ `Err(UnsupportedAlg(_))`.

6. **CBOR round trip + canonical determinism (E-SIDE-14).** For any `Sidecar`:
   `decode_cbor(encode_cbor(s)) == s` ( PartialEq ). And
   `encode_canonical_for_signing(s1) == encode_canonical_for_signing(s2)` byte-for-byte whenever
   `s1 == s2` (determinism is what makes (1)/(2) meaningful). `SignatureEnvelope.signature` deserialized
   from a 63- or 65-byte array ⇒ `Err` (big_array_64 length guard).

7. **Trust gating (E-SIDE-18,20,30,31).** With a temp `TrustDb`: after `set(pub, Rejected, …)`,
   `verify_with_trust(&signed, &db)` ⇒ `Err(TrustRejected)`. After `set(pub, Trusted, …)` ⇒
   `Ok(TrustedSidecar{ trust_level: Trusted })`. With no row ⇒ `Ok(TrustedSidecar{ trust_level: Unknown })`.
   An entry whose `expires_at` is in the past ⇒ `get` returns `None` (so it no longer blocks).

8. **Gossip round trip (E-SIDE-12,12a,12b,30,32a).** Build a `TrustMarkUpdateBody` with marks for two
   pubkeys; `apply_gossip(&body, from_pub)` ⇒ `Ok(2)`; `list()` then contains both rows with
   `source == TrustSource::Gossip { from_pubkey: from_pub }`.

9. **Chunk split→reassemble, out-of-order + tamper (E-SIDE-26,27,28,29).** `ChunkEncoder::new(N).encode(&s)`
   yields `k` chunks with correct index/total; feed them to a fresh `ChunkReassembler` in **reverse** order ⇒
   final `ingest` ⇒ `ReassembleStatus::Complete(decoded)` with `decoded == s`. Re-ingesting an already-held
   index ⇒ `Failed(DuplicateChunk{..})`. A `Chunk` with `chunk_index >= total_chunks` ⇒
   `Failed(InvalidChunkIndex{..})`. Dropping one chunk of a complete set ⇒ `Pending` forever (or
   `Failed(MissingChunk{..})` only on the final-ordering pass).

10. **Identity persistence (E-SIDE-34,16).** `load_or_create(tmpdir)` on a missing dir creates
    `signing-key.bin`, returns signer P₁. A second `load_or_create(same_dir)` returns signer P₂ with
    `P₂.pubkey() == P₁.pubkey()` (stable identity). On unix the file mode is `0600`.

11. **Voice blob content addressing (E-SIDE-36).** `write(data)` ⇒ hash H; `read(H)` ⇒ `data` (byte-equal);
    `delete(H)`; then `read(H)` ⇒ `Err(io::Error)`. Two different payloads yield two different hashes.

12. **Store/Index round trip — END-STATE (E-SIDE-22,24,25).** *(Currently blocked by `todo!()` stubs —
    see §RECONCILE.)* Once realised: `write(verified)` ⇒ path P; `read(artifact_id, zim_uuid)` ⇒ sidecar
    equal to the original (modulo the unsigned envelope); `list_for_zim(zim_uuid)` ⇒ contains P;
    `SidecarIndex::rebuild_from_files(&store)` ⇒ count ≥ 1; `find_for_url(zim_uuid, scope)` ⇒ returns a
    `SidecarMeta` matching the written artifact; `delete(artifact_id, zim_uuid)`; then `read` ⇒ `Err`.

## RECONCILE — seat-raised flags for orchestrator curation (not silently applied)

The orchestrator must reconcile these before flipping §7.10 to ✅ / re-attesting the whole. None require
architect re-dispatch of this module; items A–B are coder-realisation gaps, C–E are doc-accuracy fixes.

- **A. E-SIDE-22 `SidecarStore` is a `todo!()` stub (store.rs:36–50).** `write`/`read`/`list_for_zim`/`delete`
  all `todo!()`. The crypto/codec/verify path is real, but the **persisted `.zsc` round trip is not yet wired**
  — §5.4's `Store → write file <data_dir>/sidecars/<zim>/<artifact>.zsc` and §5.5's `Store → write` are
  unrealised end-to-end. Needs a coder task (I-10(b) modular, hermetic Verify): implement the four bodies,
  path layout `<root>/<zim_uuid>/<artifact_id>.zsc`, atomic write (temp file + rename), CBOR encode/decode
  via `SidecarCodec`. Acceptance #12. *Suggested CHECKLIST scope: `T7.10.store`.*

- **B. E-SIDE-24 `SidecarIndex` is a `todo!()` stub (store.rs:75–81).** `rebuild_from_files`/`find_for_url`
  both `todo!()`. §5.5's `Index → rebuild row` / `sidecar_list` (E-CMD-37) depend on it. Needs a coder task:
  SQLite table (columns per `SidecarMeta`), `rebuild_from_files` scans + decodes + upserts, `find_for_url`
  ZIM-uuid + URL/scope-prefix query. Note the storage schema for the `trust` table already lives elsewhere
  (`TrustDb` uses table `trust`); confirm/define the sidecar-index table DDL owner (storage layer §7.5) so
  this task references a real DDL site. Acceptance #12. *Suggested CHECKLIST scope: `T7.10.index` — and the
  DDL ownership is an **orchestrator ask**: is the sidecar-index table DDL defined in §7.5 storage, or does
  this module own it?*

- **C. `CodecError` (E-SIDE-15) had only 3 variants in the old table; real source has 6** —
  `InvalidChunkIndex`/`DuplicateChunk`/`MissingChunk` must be added (they are raised by `ChunkReassembler`).
  Fixed in this partial; no coder action.

- **D. Two distinct `TrustLevel` types exist** — `payload::TrustLevel` (E-SIDE-12b, gossip wire format) and
  `trust::TrustLevel` (E-SIDE-31, DB + `TrustedSidecar`, the one re-exported at `mod.rs:166`). Same variant
  names, different module identity. The old table's single `TrustLevel` row conflated them. This partial
  disambiguates with `(payload)` / `(trust/DB)` qualifiers. No coder action; flagged so the orchestrator
  does not collapse them during curation.

- **E. Cosmetic line-number drift in the old table.** Multiple `Target` cells cited line numbers that
  predate later edits (e.g. `Sidecar` `:10`→`:16`, `SidecarSigner` `:10`→`:23`, `TrustDb` `:10`→`:25`,
  `ChunkReassembler` `:70`→`:102`, `SidecarError` `:200`→`:133`, several `payload.rs` bodies were `:30/:120/…`
  placeholders). All corrected to real definition sites in this partial. No coder action; the master doc's
  §7.10 Target column should take these values on assembly.

- **F. Entity-table completeness (I-11).** The old table folded several distinct public types into other
  rows (`RelationKind`, `TrustSource`) and represented the payload bodies as "per spec" placeholders. This
  partial promotes them to first-class rows (E-SIDE-3a, 7a–7d, 8a, 9a–9b, 10a, 11a, 12a–12b, 13a, 32a) with
  real fields, removing all "per spec"/TBD/placeholder wording. Orchestrator: confirm the row-id scheme
  (the `a/b/c` suffixes) is acceptable for the master, or renumber sequentially at assembly time.

---

