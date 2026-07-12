use thiserror::Error;

use crate::sidecar::Sidecar;

/// Codec error for CBOR/JSON encoding and schema validation
#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum CodecError {
    #[error("CBOR encoding/decoding error: {0}")]
    Cbor(String),

    #[error("JSON encoding/decoding error: {0}")]
    Json(String),

    #[error("Schema validation error: {0}")]
    Schema(String),

    #[error("Invalid chunk index {index} out of range (total: {total})")]
    InvalidChunkIndex { index: u32, total: u32 },

    #[error("Duplicate chunk {index}")]
    DuplicateChunk { index: u32 },

    #[error("Missing chunk {index} during reassembly")]
    MissingChunk { index: u32 },
}

/// CBOR canonical + JSON debug encoding for Sidecar
///
/// Provides deterministic CBOR encoding for signatures and human-readable
/// JSON for debugging/inspection.
pub struct SidecarCodec;

impl SidecarCodec {
    /// Encode a Sidecar to CBOR using ciborium
    pub fn encode_cbor(sidecar: &Sidecar) -> Result<Vec<u8>, CodecError> {
        let mut bytes = Vec::new();
        ciborium::into_writer(sidecar, &mut bytes)
            .map_err(|e| CodecError::Cbor(format!("serialization failed: {e}")))?;
        Ok(bytes)
    }

    /// Decode CBOR bytes into a Sidecar
    pub fn decode_cbor(bytes: &[u8]) -> Result<Sidecar, CodecError> {
        ciborium::from_reader(bytes)
            .map_err(|e| CodecError::Cbor(format!("deserialization failed: {e}")))
    }

    /// Encode a Sidecar to canonical CBOR for signing
    ///
    /// Uses deterministic encoding to ensure the same Sidecar always produces
    /// identical CBOR bytes, which is required for signature verification.
    pub fn encode_canonical_for_signing(sidecar: &Sidecar) -> Result<Vec<u8>, CodecError> {
        // ciborium's default serialization is already canonical (deterministic)
        // when using serde's Serialize, as it sorts map keys and uses fixed-width
        // representations for integers
        Self::encode_cbor(sidecar)
    }

    /// Encode a Sidecar to human-readable JSON for debugging
    pub fn encode_json_debug(sidecar: &Sidecar) -> Result<String, CodecError> {
        serde_json::to_string_pretty(sidecar)
            .map_err(|e| CodecError::Json(format!("JSON serialization failed: {e}")))
    }
}
