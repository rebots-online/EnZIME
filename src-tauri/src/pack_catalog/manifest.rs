use serde::{Deserialize, Serialize};
use ed25519_dalek::{VerifyingKey, Signature, Verifier};
use thiserror::Error;

use super::types::ZimPack;

pub const PACK_CATALOG_PUBLIC_KEY: &[u8; 32] = include_bytes!("../../assets/pack_catalog_public_key.bin");

#[derive(Debug, Error)]
pub enum VerifyError {
    #[error("invalid public key format")]
    BadKey,

    #[error("signature verification failed")]
    BadSignature,

    #[error("invalid manifest JSON")]
    BadJson,
}

/// Operator-signed catalog manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackCatalogSignedManifest {
    pub schema_version: u8,
    pub generated_at: i64,
    pub packs: Vec<ZimPack>,
    pub signature: Vec<u8>,
}

/// ed25519 verifier for pack catalog manifest signatures.
pub struct PackCatalogManifestVerifier {
    public_key: VerifyingKey,
}

impl PackCatalogManifestVerifier {
    /// Create a verifier from a 32-byte public key.
    pub fn new(key_bytes: &[u8; 32]) -> Result<Self, VerifyError> {
        let public_key = VerifyingKey::from_bytes(key_bytes).map_err(|_| VerifyError::BadKey)?;
        Ok(Self { public_key })
    }

    /// Verify the signature on a pack catalog manifest.
    pub fn verify(&self, body: &[u8], manifest: &PackCatalogSignedManifest) -> Result<(), VerifyError> {
        let signature = Signature::from_slice(&manifest.signature)
            .map_err(|_| VerifyError::BadSignature)?;
        self.public_key.verify(body, &signature)
            .map_err(|_| VerifyError::BadSignature)
    }
}
