// Sidecar payload types — typed bodies for Payload enum

use serde::{Deserialize, Serialize};

/// Typed payload discriminator (CBOR-tagged)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Payload {
    /// Annotation set payload
    AnnotationSet(AnnotationSetBody),
    /// Bookmark set payload
    BookmarkSet(BookmarkSetBody),
    /// Reading log payload
    ReadingLog(ReadingLogBody),
    /// Comprehension response payload
    ComprehensionResponse(ComprehensionResponseBody),
    /// Voice-note collection payload
    VoiceNoteCollection(VoiceNoteCollectionBody),
    /// Trust-mark update payload
    TrustMarkUpdate(TrustMarkUpdateBody),
    /// Sidecar-of-sidecars manifest
    Manifest(ManifestBody),
    /// Unknown/future payload kind
    Unknown { kind: String, body: serde_cbor::Value },
}

/// Bookmark set payload — user's saved reading locations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BookmarkSetBody {
    /// Collection of bookmarks
    pub bookmarks: Vec<Bookmark>,
}

/// Single bookmark — a saved reading location
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Bookmark {
    /// Local UUIDv7 (stable within author's sidecar history)
    pub id: [u8; 16],
    /// Region in the document this bookmark targets
    pub region: Region,
    /// Optional user-defined title
    pub title: Option<String>,
    /// Optional user note
    pub note: Option<String>,
    /// Unix epoch seconds, UTC
    pub created_at: u64,
    /// Unix epoch seconds, UTC (null if never updated)
    pub updated_at: Option<u64>,
    /// User-defined tags
    pub tags: Vec<String>,
}

/// Single manifest entry — reference to another sidecar
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManifestEntry {
    /// Artifact ID of the referenced sidecar
    pub artifact_id: [u8; 16],
    /// Payload kind of the referenced sidecar
    pub kind: String,
    /// Size in bytes of the referenced sidecar
    pub size_bytes: u64,
    /// SHA-256 hash of the canonical CBOR encoding (excluding signature envelope)
    pub sha256: [u8; 32],
}

/// Sidecar-of-sidecars manifest — declares "I have these other sidecars"
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManifestBody {
    /// Collection of manifest entries
    pub entries: Vec<ManifestEntry>,
}

/// Annotation payload — bundle of in-document highlights + notes
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AnnotationSetBody {
    /// Collection of annotations
    pub annotations: Vec<Annotation>,
}

/// Single annotation — highlight + attached note
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Annotation {
    /// Local UUIDv7 (stable within author's sidecar history)
    pub id: [u8; 16],
    /// Region in the document this annotation targets
    pub region: Region,
    /// User's text note
    pub body_text: String,
    /// Optional recorded audio note
    pub body_voice: Option<VoiceClip>,
    /// Optional transcript of body_voice (Gemma 4 audio encoder)
    pub body_transcript: Option<String>,
    /// Unix epoch seconds, UTC
    pub created_at: u64,
    /// Unix epoch seconds, UTC (null if never updated)
    pub updated_at: Option<u64>,
    /// User-defined tags
    pub tags: Vec<String>,
}

/// Region selector — where in the document the annotation applies
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Region {
    /// Region kind discriminator
    pub kind: RegionKind,
}

/// Region kind variants
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RegionKind {
    /// Character range within text content
    CharRange { start: u64, end: u64 },
    /// Page number (for paginated content)
    Page { page: u64 },
    /// URL reference
    Url { url: String },
    /// Custom selector
    Custom { selector: String },
}

/// Voice clip — recorded audio note
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VoiceClip {
    /// Audio codec (e.g., "opus", "pcm-s16le", "vorbis")
    pub codec: String,
    /// Sample rate in Hz
    pub sample_rate: u64,
    /// Duration in milliseconds
    pub duration_ms: u64,
    /// Raw codec bytes
    pub audio: Vec<u8>,
}

/// Reading log payload — chronological record of reading sessions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReadingLogBody {
    /// Collection of reading events
    pub events: Vec<ReadingEvent>,
}

/// Single reading event — a discrete reading session or action
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReadingEvent {
    /// Local UUIDv7 (stable within author's sidecar history)
    pub id: [u8; 16],
    /// Event kind discriminator
    pub kind: ReadingEventKind,
    /// Unix epoch seconds, UTC
    pub timestamp: u64,
    /// Optional context data (page, position, duration, etc.)
    pub context: Option<serde_cbor::Value>,
}

/// Reading event kind variants
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ReadingEventKind {
    /// Started reading a document
    SessionStart,
    /// Stopped reading a document
    SessionEnd,
    /// Bookmarked a location
    Bookmark,
    /// Highlighted text
    Highlight,
    /// Added a note
    Note,
    /// Reached a page/position
    Progress,
}

/// Comprehension response payload — answers to creator-embedded prompts
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ComprehensionResponseBody {
    /// Collection of responses to comprehension prompts
    pub responses: Vec<ComprehensionResponse>,
}

/// Single comprehension response — answer to a creator-embedded prompt
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ComprehensionResponse {
    /// Creator-assigned prompt key
    pub prompt_id: String,
    /// Free-text or selected option
    pub answer: String,
    /// Unix epoch seconds, UTC
    pub ts: u64,
    /// True if the prompt had a known answer and this response matches it
    pub correct: Option<bool>,
}

/// Voice-note collection — references to blob-stored audio notes
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VoiceNoteCollectionBody {
    /// Collection of voice note references
    pub notes: Vec<VoiceNoteRef>,
}

/// Reference to a blob-stored voice note
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VoiceNoteRef {
    /// Local UUIDv7 (stable within author's sidecar history)
    pub id: [u8; 16],
    /// Blob storage reference/key
    pub blob_ref: String,
    /// Unix epoch seconds, UTC
    pub created_at: u64,
}

/// Trust level — peer trust classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TrustLevel {
    /// Fully trusted peer
    Trusted,
    /// Verified but not fully trusted
    Verified,
    /// Explicitly rejected peer
    Rejected,
    /// Unknown/unclassified peer
    Unknown,
}

/// Trust mark — gossip about a peer's trustworthiness
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TrustMark {
    /// Public key of the peer being marked
    pub pubkey: [u8; 32],
    /// Assigned trust level
    pub level: TrustLevel,
    /// Optional scope (e.g., specific artifact or domain)
    pub scope: Option<String>,
    /// Optional expiration (Unix epoch seconds, UTC)
    pub expires_at: Option<i64>,
    /// Optional reason/explanation
    pub reason: Option<String>,
}

/// Trust-mark update payload — gossip bundle of trust marks
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TrustMarkUpdateBody {
    /// Collection of trust marks
    pub marks: Vec<TrustMark>,
}
