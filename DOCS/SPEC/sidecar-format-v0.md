# EnZIME Sidecar File Format — v0

**Status:** v0 draft, 2026-05-15. Authored as part of Wave 8 architect
pass; precedes implementation. Subject to revision until v1 is locked.

**File extension:** `.zsc` (ZIM sidecar — terse, distinct, three-char).

**MIME-like type:** `application/vnd.enzime.sidecar+cbor`.

## Why this spec exists

EnZIME's value proposition has two consumption-time layers riding on
top of immutable ZIMs (see project memory
`project_sidecar_annotations_and_metadata_interactivity`):

- **Layer 1 — per-user sidecar state**: annotations, highlights, voice
  notes, reading logs, bookmarks, comprehension responses. Lives in
  the reader's local SQLite (`Storage`) but must also serialize to
  exchangeable artifacts for peer sharing (per
  `project_lora_mesh_knowledge_sharing` — mesh + Wi-Fi + Bluetooth +
  QR + sneakernet transport-agnostic).
- **Layer 2 — creator-embedded metadata**: cross-references, glossary,
  comprehension prompts, audit hooks. Authored into the ZIM at create
  time via a reserved namespace; not subject to this spec (handled in
  ZIM v5 directly).

This document defines the **Layer 1 wire format** — the bytes that
travel between devices when a user shares their annotations on a ZIM
article, or when an entire annotated reading-session is exchanged
peer-to-peer.

In-database row shape (`AnnotationsStore`, `BookmarksStore`, etc. —
entities `E-STR-8..16`) is upstream of this format but not identical
to it. The wire format is more comprehensive (includes provenance,
signing, chunking) and serializes a snapshot of in-DB state plus
metadata the DB doesn't track.

## Design constraints driving the choices below

1. **Compact over slow radio** (LoRa mesh, ~kbps). CBOR over JSON: ~30-50%
   smaller for typed records, with deterministic encoding for stable
   signature hashes.
2. **Forward-compatible** schema. Older readers must gracefully ignore
   unknown fields rather than reject the artifact.
3. **Signed per-peer**, not just operator-signed. The recipient verifies
   "did this come from a peer I trust?" not just "is this well-formed?".
4. **Cryptographically bound to specific ZIM**. Sidecar references its
   target ZIM by UUID (immutable ZIM property); receiver can detect
   "this sidecar is for a ZIM I don't have" without parsing the body.
5. **Chunk-friendly**. A sidecar may exceed one LoRa packet (~256B);
   the format supports application-layer chunking with reassembly.
6. **Inspectable**. JSON debug-export must produce a human-readable
   form of the same payload (lossless round-trip CBOR ↔ JSON).
7. **Privacy-respecting**. Sidecars contain reading-habit data;
   the format permits encryption-at-rest (a future v1 concern; v0
   focuses on integrity, not confidentiality).
8. **Local-first**. The format is fully meaningful in the absence of
   any operator infrastructure. Operator-mirror-published sidecars are
   a special case where operator's key is just another trusted peer
   key with high trust mark.

## Top-level container — `Sidecar`

CBOR map (canonical encoding per RFC 8949 §4.2.1 — sorted keys, no
floats, smallest int encoding) with the following fields:

```
Sidecar = {
  schema_version: uint,        // == 0 for this spec; readers ignore
                                //   unknown future versions of UNKNOWN
                                //   payload kinds, accept known kinds
  artifact_id: bstr .size 16,   // UUIDv7 of this specific sidecar
                                //   artifact (changes per edit)
  zim_uuid: bstr .size 16,      // target ZIM's UUID (ZIM v5 header
                                //   field) — binds sidecar to ZIM
  zim_url_scope: tstr / null,   // optional URL prefix within the ZIM
                                //   ("A/Survival/Water_purification");
                                //   null = whole-ZIM-scoped
  zim_origin_url: tstr / null,  // URL where the source ZIM was
                                //   published / can be re-fetched
                                //   (Kiwix library URL, operator-
                                //   mirror URL). PRESERVES VALUE OF
                                //   ANNOTATION WHEN PACK IS NOT
                                //   LOCALLY AVAILABLE — see below.
  canonical_source_url: tstr / null,
                                //   original-web URL of the content
                                //   the ZIM article was derived from
                                //   (e.g., the actual Wikipedia URL).
                                //   Fallback deep-link target if
                                //   zim_origin_url is also unavailable
                                //   or the recipient prefers the
                                //   live source.
  created_at: uint,             // Unix epoch seconds, UTC
  author: PeerIdentity,         // who authored this sidecar
  payload: Payload,             // typed payload (see §Payload)
  refs: [* SidecarRef],         // optional refs to other sidecars
                                //   this one extends/responds to
  signature_envelope: Sig,      // see §Signature envelope
}
```

### URL provenance fields — why annotations stay useful when pack is absent

`zim_origin_url` and `canonical_source_url` are not redundant with
`zim_uuid` — they exist specifically to keep an annotation
**meaningful** in situations where the local ZIM isn't available:

- **Pack removed locally** (user pruned to free space): annotation
  list still renders, click-through opens `zim_origin_url` (Kiwix
  viewer / operator mirror) in the system browser. Annotation
  remains a useful research breadcrumb.
- **Annotation shared with peer who doesn't have the pack**: peer's
  reader displays the annotation with a "fetch source" button using
  `zim_origin_url`, OR a "view original" button using
  `canonical_source_url` (e.g., live Wikipedia).
- **Pack re-added later**: `zim_uuid` re-attaches the annotation to
  the now-present pack; URLs become secondary fallbacks but stay in
  the artifact for forwarding to other peers.
- **Pack version drifted**: if `zim_uuid` mismatches a re-fetched
  variant (different revision of the same logical ZIM), the
  `zim_origin_url` plus `zim_url_scope` together let the reader
  attempt a best-effort match by URL path within the new ZIM —
  graceful degradation rather than orphaning.

Receiver behavior priority for "open this annotation's source":

1. **Local pack matching `zim_uuid`** present → render in-app at
   `zim_url_scope`
2. **Local pack with matching `zim_origin_url` + `zim_url_scope`**
   (different revision/UUID, same content origin) → render in-app
   with a "may be a different revision" note
3. **`zim_origin_url` non-null, network available** → open in system
   browser (Kiwix viewer or operator mirror)
4. **`canonical_source_url` non-null, network available** → open in
   system browser to original web URL
5. **All of the above unavailable** → render annotation in-list as a
   research note with "(source pack not locally available)" affordance

### How the URL fields are populated — auto-default, edit-behind-explicit-action

`zim_origin_url` and `canonical_source_url` are **populated
automatically by the reader app at sidecar-creation time** from
authoritative sources only (see priority list below). They are
displayed read-only in the default annotation UI — no inline text
field, no auto-focused input. This is the path 99% of users take.

A separate "Edit provenance" button (or equivalent explicit
affordance) exposes the fields as editable when the user has a real
reason to override the auto-populated values — for example, when the
authoritative sources got it wrong, when the user knows of a better
canonical URL than the deterministic pattern produced, or when
correcting a pre-existing annotation imported from an older sidecar
without provenance. Edits are user-attributed (the
`SignatureEnvelope` re-signs with the editing user's key, and the
edit is recorded in sidecar history via the `refs` mechanism), so
mis-attribution is traceable.

While in edit mode, each URL field MUST be accompanied by a "Check
URL" button (or equivalent affordance — an external-link icon next
to the field is acceptable) that opens the current field value in a
new system-browser tab/window. This lets the user verify they're
editing toward a real, intended destination before committing the
change — visual confirmation that the URL resolves and shows what
they expected. The "Check URL" button:

- Opens the URL via the system's default browser (Tauri shell API on
  desktop; Android Intent for Chrome / default browser on Android).
- Never affects the field's current value — pure read action.
- Works on the field's CURRENT in-edit value (not the saved value),
  so the user can iterate: edit → check → adjust → check → commit.
- Is disabled / hidden when the field is empty (nothing to check).
- Disabled / shown-with-warning when offline (the click will fail to
  resolve; user warned ahead of time).

The point is: **default = automatic + read-only display + zero risk
of accidental edit during normal annotation flow**. Edit = available
but explicitly behind a deliberate UI action so the user has to opt
in to that mode of working. Preventing transcription errors in the
common case is load-bearing for trust without locking out advanced
users who legitimately need to correct provenance.

Source priority (reader walks the list at sidecar-creation; uses the
first non-null value, leaves the field null if all sources fail):

1. **ZIM-embedded metadata** (authoritative — set by the creator at
   pack-build time). ZIM v5 supports custom metadata entries in the
   `M/` namespace. The creator app (when building a ZIM) is responsible
   for emitting `M/Origin-URL` and `M/Source-URL` entries derived
   from its ingestion pipeline. The reader, on opening the ZIM,
   extracts these once and caches them in its pack-state record.
   This is the only path that's both fully accurate AND
   offline-survivable (no network call required at annotation time).
2. **Operator-mirror manifest entry** (authoritative — set by the
   operator at pack-publish time). The signed mirror manifest (per
   the dynamic-download infrastructure) carries per-pack metadata
   including the pack's publish URL and content origin. Falls back
   to this when (1) is absent because the ZIM was built without
   embedded metadata.
3. **Deterministic tool-call inference for known-origin packs**
   (constrained — only for operator-allowlisted source patterns).
   For ZIMs from well-known stable sources where the URL pattern is
   trivially derivable, the reader MAY invoke a small deterministic
   tool to compute the URL. Examples:
   - ZIM name matches `wikipedia_*` AND the article path has a clean
     title → derive `https://<lang>.wikipedia.org/wiki/<Title>`
   - ZIM name matches `gutenberg_*` AND the article path matches a
     known book ID pattern → derive
     `https://www.gutenberg.org/ebooks/<id>`
   - ZIM name matches `kiwix-library-*` → derive Kiwix viewer URL
   This is **explicit pattern matching against an operator-curated
   allowlist**, NOT LLM free-form URL generation. The allowlist is
   versioned, shipped with the app, and updatable by operator. The
   LLM is not in this path — only deterministic pattern code is.
   If online connectivity is available, the resulting URL MAY be
   probed (HEAD request) to verify it resolves; if it 404s, treat
   as null. If offline, accept the derived URL without probing.
4. **Otherwise: null** — and that is fine. The fallback chain in §URL
   provenance fields above handles null gracefully; the annotation
   remains a research note even without a click-through URL.

What the UI MUST avoid:

- **No URL fields exposed in the default annotation-creation flow.**
  The auto-populated values render read-only. Editing is available
  but only after the user clicks an explicit "Edit provenance" (or
  equivalent) affordance — never accidentally focusable, never an
  always-visible input.
- **No LLM free-form URL generation.** Even with on-device Gemma 4,
  the LLM is not asked "what's the URL for this article?" — that's a
  hallucination vector. Source path (3) is deterministic pattern
  matching against the curated allowlist only; the LLM is not in
  this path.
- **No silent network calls at annotation time** beyond the optional
  verification HEAD request in path (3). Annotation creation must
  remain fast and offline-functional; provenance lookup is a
  background concern.

The provenance travels with the sidecar even across peer-to-peer
exchange — annotations remain useful to recipients regardless of
which packs they happen to have installed, because the URL data is
authoritatively sourced rather than user-supplied.

### `artifact_id` vs `zim_uuid`

`artifact_id` identifies THIS sidecar instance — every edit produces a
new artifact_id (or the same id with incremented `revision` if the
peer is updating their own; both patterns valid).

`zim_uuid` identifies WHAT THE SIDECAR IS ABOUT — the immutable ZIM
file. Multiple peers' sidecars on the same ZIM share the same
`zim_uuid` but have different `artifact_id`s.

### `PeerIdentity`

```
PeerIdentity = {
  pubkey: bstr .size 32,        // ed25519 verifying key bytes
  handle: tstr / null,          // optional human-readable name
                                //   ("Alice", "@bob@operator")
  device: tstr / null,          // optional device label
                                //   ("Galaxy A55 sn:...")
}
```

The `pubkey` is the only identity attribute that matters
cryptographically. `handle` and `device` are display-only and
unsigned-unverified — recipients should treat them as suggestion, not
fact. Receiver's local trust DB maps `pubkey` → user-assigned trust
marks.

### `SidecarRef`

```
SidecarRef = {
  artifact_id: bstr .size 16,
  pubkey: bstr .size 32,        // author of referenced sidecar
  relation: RelationKind,
}
RelationKind = "extends" / "responds-to" / "supersedes" / "annotates"
```

Permits sidecar threads / supersession chains. Older readers ignoring
this field just see the leaf annotation.

## Payload (typed)

```
Payload = {
  kind: tstr,                   // discriminator: see below
  body: any,                    // shape determined by kind
}
```

Defined `kind` values for v0:

### `kind: "annotation-set"`

A bundle of in-document highlights + attached notes.

```
body = {
  annotations: [* Annotation],
}

Annotation = {
  id: bstr .size 16,             // local UUIDv7 (stable within the
                                  //   author's sidecar history)
  region: Region,
  body_text: tstr,                // user's note
  body_voice: VoiceClip / null,   // optional recorded audio note
  body_transcript: tstr / null,   // optional: Gemma 4 audio encoder
                                  //   transcript of body_voice
  created_at: uint,
  updated_at: uint / null,
  tags: [* tstr],
}

Region = {
  kind: "char-range" / "page" / "url" / "custom"
  // for "char-range":
  start: uint,
  end: uint,
  // for "page":
  page: uint,
  // for "url":
  url: tstr,
  // for "custom":
  selector: tstr,
}

VoiceClip = {
  codec: tstr,                   // "opus" / "pcm-s16le" / "vorbis"
  sample_rate: uint,             // Hz
  duration_ms: uint,
  audio: bstr,                   // raw codec bytes
}
```

### `kind: "bookmark-set"`

```
body = {
  bookmarks: [* Bookmark],
}
Bookmark = {
  id: bstr .size 16,
  url: tstr,
  title: tstr,
  created_at: uint,
  tags: [* tstr],
}
```

### `kind: "reading-log"`

A sequence of position events — useful for resume-where-you-left-off
and for sharing "I read this in this order" with peers.

```
body = {
  events: [* ReadingEvent],
}
ReadingEvent = {
  url: tstr,
  ts: uint,                      // Unix epoch seconds
  kind: "open" / "close" / "scroll" / "ack",
                                  // "ack" = user explicitly
                                  //   acknowledged read-required
  scroll_pct: uint / null,       // 0..100, for "scroll"
}
```

For enterprise compliance: an `ack`-kind event paired with a
`zim_url_scope` matching a creator-marked required-read section is the
auditable proof-of-read.

### `kind: "comprehension-response"`

Answers to creator-embedded comprehension prompts (Layer 2 metadata).

```
body = {
  responses: [* ComprehensionResponse],
}
ComprehensionResponse = {
  prompt_id: tstr,                // creator-assigned prompt key
  answer: tstr,                   // free-text or selected option
  ts: uint,
  correct: bool / null,           // if the prompt had a known answer
}
```

### `kind: "voice-note-collection"`

Standalone voice notes not bound to a specific text region — e.g.,
operator-recorded commentary on an entire ZIM.

```
body = {
  notes: [* VoiceClip & {
    id: bstr .size 16,
    title: tstr / null,
    created_at: uint,
    transcript: tstr / null,
  }]
}
```

### `kind: "trust-mark-update"`

Peer publishes updated trust marks for other peers — useful for
web-of-trust gossip post-grid-down.

```
body = {
  marks: [* TrustMark],
}
TrustMark = {
  target_pubkey: bstr .size 32,
  trust: "trusted" / "verified" / "rejected" / "unknown",
  scope: tstr / null,             // optional category restriction
                                  //   ("medical-info", "religious")
  expires_at: uint / null,        // null = no expiry
  reason: tstr / null,            // human-readable
}
```

### `kind: "manifest"`

Bundle metadata — a `manifest` sidecar declares "I have these other
sidecars about this ZIM, here are their artifact_ids and sizes."
Useful for mesh-discovery — a peer can advertise the manifest before
transferring full sidecars.

```
body = {
  entries: [* ManifestEntry],
}
ManifestEntry = {
  artifact_id: bstr .size 16,
  kind: tstr,                     // payload.kind of the referenced
                                  //   sidecar
  size_bytes: uint,
  sha256: bstr .size 32,          // hash of the canonical CBOR
                                  //   encoding of the referenced
                                  //   sidecar (excluding signature
                                  //   envelope)
}
```

### Unknown `kind` values

Readers MUST gracefully tolerate unknown `kind` strings. Behavior:
preserve the sidecar in local storage (for forwarding to other peers),
display a generic "(unknown payload type: X)" indicator in UI, but do
NOT attempt to render its body.

This is forward-compatibility: future versions can add new payload
kinds without breaking old readers' ability to relay them.

## Signature envelope (`Sig`)

ed25519 signature of the canonical CBOR encoding of the
`Sidecar`-minus-`signature_envelope`.

```
Sig = {
  alg: "ed25519",                 // future-proofs the format for
                                  //   eventual alg agility
  pubkey: bstr .size 32,          // signer's verifying key (must
                                  //   match author.pubkey or be a
                                  //   delegate per delegation spec
                                  //   v1 — not in v0)
  signature: bstr .size 64,       // raw ed25519 signature bytes
  signed_at: uint,                // Unix epoch seconds — distinct
                                  //   from `created_at` (signature
                                  //   may post-date authoring)
}
```

**Canonicalization**: per RFC 8949 §4.2.1 (Core Deterministic
Encoding) — sorted map keys by lexicographic byte order, smallest int
encoding, no indefinite-length items, no NaN/Inf floats. The
`signature_envelope` key is OMITTED from the input to signing; the
signer encodes the rest, hashes, signs.

**Verification**: receiver decodes the full sidecar, extracts
`signature_envelope`, removes it from the map, re-encodes
canonically, hashes, verifies signature.

If `pubkey` in `signature_envelope` differs from `author.pubkey`,
the sidecar is using a delegated-signing relationship. v0 does not
yet define delegation; v0 readers MUST reject sidecars where the
two keys differ.

## Chunking (LoRa-friendly transport framing)

When transporting a sidecar over a packet-constrained medium (LoRa
≤256B, BLE ≤512B), apply this framing AT THE TRANSPORT LAYER, not
in the sidecar itself. The sidecar is the payload; the chunks are
how it gets carried.

```
Chunk = {
  artifact_id: bstr .size 16,     // matches Sidecar.artifact_id
  chunk_index: uint,              // 0-based
  total_chunks: uint,
  payload_part: bstr,             // bytes of the CBOR-encoded
                                  //   Sidecar for this chunk
}
```

Each chunk is itself a CBOR map. Reassembly: receiver buffers chunks
by `artifact_id`, sorts by `chunk_index`, concatenates `payload_part`
in order, verifies all `total_chunks` were received, then parses the
full Sidecar.

Chunks may arrive out of order on flaky radio; receiver must tolerate
this. Loss recovery: if `total_chunks` declared but some chunks
missing after a timeout, peer can re-request specific
`(artifact_id, chunk_index)` pairs via mesh protocol (separate spec,
not v0).

Single-packet sidecars omit the framing entirely — just send the bare
sidecar CBOR. Receiver MUST be able to distinguish "bare sidecar
CBOR" from "first chunk of a chunked sidecar" — distinguished by
top-level map keys: bare sidecar has `schema_version` first; chunk
has `artifact_id` first (since canonical encoding sorts map keys, and
both maps' keys are deterministic). The receiver tries to parse as
`Sidecar` first; on failure, tries `Chunk`.

## Provenance metadata

Embedded in the Sidecar by the originating reader:

```
// extension of Sidecar map (optional fields)
provenance = {
  reader_version: tstr,           // e.g. "EnZIME 0.7.3+15"
  reader_variant: tstr / null,    // "GemmaE2bQ4" / "Qwen3_06B_Q4"
  device_class: tstr / null,      // "android-arm64" / "linux-amd64"
  network_context: tstr / null,   // "lora-mesh" / "wifi-direct" /
                                  //   "operator-mirror" / "sneakernet"
  cleanroom: bool / null,         // true if this sidecar was produced
                                  //   via clean-room research
                                  //   methodology (see
                                  //   `project_clean_room_research_methodology`)
}
```

If `cleanroom: true`, a separate attestation sidecar (kind:
`"cleanroom-attestation"`, defined in a follow-on spec) MUST also
exist with `refs: [{ relation: "annotates", artifact_id: <this one> }]`.

## File on disk

A `.zsc` file is the canonical CBOR encoding of a single Sidecar
(no chunking framing). For convenience, a `.zsc.json` debug-export
is the same payload re-encoded as JSON (with `bstr` fields
base64url-encoded). The CBOR form is authoritative; JSON is for
human inspection only.

Multiple sidecars for the same ZIM are stored in:
`<reader-data-dir>/sidecars/<zim_uuid_hex>/<artifact_id_hex>.zsc`.

The local SQLite (`AnnotationsStore`, etc.) is a derived index, not
the source of truth — losing the SQLite is recoverable by re-scanning
the sidecar files. The sidecar files are the source of truth; the
database is the cache.

## Encryption at rest (v1 concern, NOT in v0)

v0 sidecars are signed but not encrypted. A reader's local sidecar
store may contain plaintext annotations on sensitive topics
(medical, religious, political). v1 will add an optional encryption
envelope (likely XChaCha20-Poly1305 with a per-device key derived
from a user-supplied passphrase). v0 implementations MUST NOT use
the encryption envelope structure for any other purpose so that v1
can claim it.

## Versioning policy

`schema_version == 0` for this draft. v1 (next planned version) will:
- Add encryption envelope
- Add delegation in signing (`signature_envelope.pubkey` ≠ `author.pubkey`)
- Possibly add Compact Object Signing and Encryption (COSE) alignment

Readers from v0 forward MUST honor: "unknown top-level fields are
preserved on relay but ignored in display"; "unknown `kind` values
are preserved on relay, generic indicator in display"; "schema_version
> known_version produces a warning, not a hard error, unless a
`kind`-specific subfield is unparseable".

## Implementation entities

When this format is implemented (Wave 9+, post-Wave-8 compile-clean),
the following entities will be added to the entity table:

- `E-SIDE-1 Sidecar` — Rust struct mirroring the CBOR schema
- `E-SIDE-2 Payload` (enum with kind discriminator)
- `E-SIDE-3 SidecarCodec` (serialize/deserialize via `serde_cbor`)
- `E-SIDE-4 SidecarSigner` (ed25519 signing)
- `E-SIDE-5 SidecarVerifier` (signature + schema validation)
- `E-SIDE-6 SidecarStore` (filesystem layout + index)
- `E-SIDE-7 ChunkedTransport` (chunking + reassembly)
- `E-SIDE-8 TrustDb` (peer pubkey → trust mark map)

These are placeholder names; the dedicated Wave 9 architect pass
formalizes the entity table additions.

## References

- ZIM v5 specification — for `zim_uuid` semantics: `vendor/litert-lm/`
  is for LLM; ZIM spec lives in `DOCS/sdk/anzimmermanlib/zim-v5-spec-imports.md`
- RFC 8949 — CBOR canonical encoding
- ed25519 (RFC 8032) — signing
- COSE (RFC 9052) — eventual alignment for v1
- Project memory: `project_sidecar_annotations_and_metadata_interactivity.md`
- Project memory: `project_lora_mesh_knowledge_sharing.md`
- Project memory: `project_clean_room_research_methodology.md`
- Project memory: `project_first_market_is_preppers.md` — drives the
  privacy + offline-first requirements above
