use serde::{Deserialize, Serialize};
use thiserror::Error;
use ed25519_dalek::{VerifyingKey, Signature, Verifier};

use crate::ai::probe::Variant;

/// Compile-time-embedded operator public key for manifest verification.
pub const MIRROR_PUBLIC_KEY: &[u8; 32] = include_bytes!("../../assets/mirror_public_key.bin");

/// Verification error for manifest signatures.
#[derive(Debug, Error)]
pub enum VerifyError {
    #[error("invalid public key format")]
    BadKey,

    #[error("signature verification failed")]
    BadSignature,

    #[error("invalid manifest JSON")]
    BadJson,
}

/// Per-variant row in the mirror manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub variant: Variant,
    pub mirror_url: String,
    pub sha256: [u8; 32],
    pub size_bytes: u64,
    pub upstream_url_of_record: String,
}

/// Operator-signed catalog of available model variants.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MirrorManifest {
    pub schema_version: u8,
    pub generated_at: i64,
    pub variants: Vec<ManifestEntry>,
    pub signature: Vec<u8>,
}

/// ed25519 verifier for mirror manifest signatures.
pub struct MirrorManifestVerifier {
    public_key: VerifyingKey,
}

impl MirrorManifestVerifier {
    /// Create a verifier from a 32-byte public key.
    pub fn new(key_bytes: &[u8; 32]) -> Result<Self, VerifyError> {
        let public_key = VerifyingKey::from_bytes(key_bytes).map_err(|_| VerifyError::BadKey)?;
        Ok(Self { public_key })
    }

    /// Verify the signature on a mirror manifest.
    pub fn verify(&self, body: &[u8], manifest: &MirrorManifest) -> Result<(), VerifyError> {
        let signature = Signature::from_slice(&manifest.signature)
            .map_err(|_| VerifyError::BadSignature)?;
        self.public_key.verify(body, &signature)
            .map_err(|_| VerifyError::BadSignature)
    }
}

/// Compile-time-embedded default mirror manifest asset.
pub const BUNDLED_MIRROR_MANIFEST_BYTES: &[u8] =
    include_bytes!("../../assets/default-mirror-manifest.json");

/// Bundled mirror manifest loader.
pub struct BundledMirrorManifest;

impl BundledMirrorManifest {
    /// Load and verify the bundled mirror manifest.
    ///
    /// Parses the embedded manifest bytes and verifies the signature against
    /// `MIRROR_PUBLIC_KEY`. Returns the manifest iff the signature is valid.
    /// A tampered or unsigned bundled asset yields `Err(BadSignature)`.
    pub fn load(verifier: &MirrorManifestVerifier) -> Result<MirrorManifest, VerifyError> {
        // Parse the JSON bytes into a MirrorManifest
        let manifest: MirrorManifest =
            serde_json::from_slice(BUNDLED_MIRROR_MANIFEST_BYTES).map_err(|_| VerifyError::BadJson)?;

        // Verify the signature against the public key
        verifier.verify(BUNDLED_MIRROR_MANIFEST_BYTES, &manifest)?;

        Ok(manifest)
    }
}
