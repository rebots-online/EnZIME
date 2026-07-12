// Sidecar subsystem — CBOR-based artifact metadata

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::sidecar::codec::CodecError;
use crate::sidecar::identity::IdentityError;
use crate::sidecar::payload::Payload;
use crate::sidecar::sign::SignError;
use crate::sidecar::store::StoreError;
use crate::sidecar::trust::TrustError;
use crate::sidecar::verify::SidecarVerifyError;

/// Top-level sidecar container (CBOR spec)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Sidecar {
    /// CBOR schema version
    pub schema_version: u8,
    /// Unique artifact identifier (UUIDv7)
    pub artifact_id: [u8; 16],
    /// ZIM file UUID this sidecar attaches to
    pub zim_uuid: [u8; 16],
    /// URL scope within ZIM (optional)
    pub zim_url_scope: Option<String>,
    /// Creation timestamp (Unix epoch seconds, UTC)
    pub created_at: i64,
    /// Author identity
    pub author: PeerIdentity,
    /// Typed payload
    pub payload: Payload,
    /// References to other sidecars
    pub refs: Vec<SidecarRef>,
    /// Optional signature envelope
    pub signature_envelope: Option<SignatureEnvelope>,
    /// Optional provenance data
    pub provenance: Option<Provenance>,
}

/// Signer/author identity
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PeerIdentity {
    /// Ed25519 public key
    pub pubkey: [u8; 32],
    /// Human-readable handle (optional)
    pub handle: Option<String>,
    /// Device identifier (optional)
    pub device: Option<String>,
}

/// Reference to other sidecars
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SidecarRef {
    /// Artifact identifier being referenced
    pub artifact_id: [u8; 16],
    /// Public key of the referenced sidecar's author
    pub pubkey: [u8; 32],
    /// Relationship kind
    pub relation: RelationKind,
}

/// Relationship kind for sidecar references
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RelationKind {
    /// Extends the referenced sidecar
    Extends,
    /// Responds to the referenced sidecar
    RespondsTo,
    /// Supersedes the referenced sidecar
    Supersedes,
    /// Annotates the referenced sidecar
    Annotates,
}

/// Reader self-disclosure
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Provenance {
    /// Reader version string
    pub reader_version: String,
    /// Reader variant (optional)
    pub reader_variant: Option<String>,
    /// Device class (optional)
    pub device_class: Option<String>,
    /// Network context (optional)
    pub network_context: Option<String>,
    /// Cleanroom flag (optional)
    pub cleanroom: Option<bool>,
}

/// Ed25519 signature envelope
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SignatureEnvelope {
    /// Algorithm identifier (e.g., "ed25519")
    pub alg: String,
    /// Ed25519 public key
    pub pubkey: [u8; 32],
    /// Ed25519 signature
    #[serde(with = "big_array_64")]
    pub signature: [u8; 64],
    /// Unix timestamp when signed
    pub signed_at: i64,
}

mod big_array_64 {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S>(array: &[u8; 64], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        array.as_slice().serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<[u8; 64], D::Error>
    where
        D: Deserializer<'de>,
    {
        let vec = Vec::<u8>::deserialize(deserializer)?;
        if vec.len() == 64 {
            let mut array = [0u8; 64];
            array.copy_from_slice(&vec);
            Ok(array)
        } else {
            Err(serde::de::Error::custom(format!(
                "expected array of size 64, got {}",
                vec.len()
            )))
        }
    }
}

/// Umbrella error for the sidecar subsystem
#[derive(Debug, Error)]
pub enum SidecarError {
    /// Codec error (CBOR encoding/decoding)
    #[error("codec error: {0}")]
    Codec(#[from] CodecError),
    /// Signing error
    #[error("signing error: {0}")]
    Sign(#[from] SignError),
    /// Verification error
    #[error("verification error: {0}")]
    Verify(#[from] SidecarVerifyError),
    /// Storage error
    #[error("storage error: {0}")]
    Store(#[from] StoreError),
    /// Trust evaluation error
    #[error("trust error: {0}")]
    Trust(#[from] TrustError),
    /// Identity error
    #[error("identity error: {0}")]
    Identity(#[from] IdentityError),
}

pub mod chunk;
pub mod codec;
pub mod identity;
pub mod payload;
pub mod sign;
pub mod store;
pub mod trust;
pub mod verify;
pub mod voice_blob;

pub use store::{SidecarStore, SidecarIndex, SidecarMeta};
pub use sign::SidecarSigner;
pub use trust::{TrustDb, TrustLevel, TrustEntry};
pub use voice_blob::VoiceClipBlobStore;
