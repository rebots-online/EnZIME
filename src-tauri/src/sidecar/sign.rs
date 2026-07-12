use thiserror::Error;

use ed25519_dalek::{SigningKey, Signature, Signer};

use crate::sidecar::codec::{CodecError, SidecarCodec};
use crate::sidecar::{SignatureEnvelope, Sidecar};

/// Signing error for ed25519 operations
#[derive(Error, Debug)]
pub enum SignError {
    #[error("Codec error: {0}")]
    Codec(CodecError),

    #[error("Cryptography error: {0}")]
    Crypto(String),
}

/// Ed25519 signer for sidecar metadata
///
/// Generates deterministic signatures for sidecar artifacts using the
/// canonical CBOR encoding of the sidecar structure (excluding the
/// signature envelope itself).
pub struct SidecarSigner {
    signing_key: SigningKey,
}

impl SidecarSigner {
    /// Create a new signer from a 32-byte seed
    ///
    /// The seed must be a cryptographically secure random 32 bytes.
    pub fn from_seed(seed: &[u8; 32]) -> Self {
        Self {
            signing_key: SigningKey::from_bytes(seed),
        }
    }

    /// Sign a sidecar, attaching the signature envelope
    ///
    /// Serializes the sidecar to canonical CBOR (without any existing
    /// signature envelope), signs the bytes, and attaches a new
    /// signature envelope to the sidecar.
    pub fn sign(&self, sidecar: &mut Sidecar) -> Result<(), SignError> {
        // Clear any existing signature envelope before signing
        sidecar.signature_envelope = None;

        // Serialize to canonical CBOR for signing
        let bytes = SidecarCodec::encode_canonical_for_signing(sidecar)
            .map_err(SignError::Codec)?;

        // Sign the canonical bytes
        let signature = self
            .signing_key
            .sign(&bytes)
            .to_bytes();

        // Attach the signature envelope
        sidecar.signature_envelope = Some(SignatureEnvelope {
            alg: "ed25519".to_string(),
            pubkey: self.pubkey(),
            signature,
            signed_at: chrono::Utc::now().timestamp(),
        });

        Ok(())
    }

    /// Get the public key associated with this signer
    pub fn pubkey(&self) -> [u8; 32] {
        self.signing_key.verifying_key().to_bytes()
    }
}
