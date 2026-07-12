// Update signature verifier module
// Implements ed25519 verification against operator public key

use ed25519_dalek::{Signature, VerifyingKey};
use crate::app_update::manifest::UpdateManifest;
use crate::app_update::VerifyError;

pub const UPDATE_PUBLIC_KEY: &[u8; 32] = include_bytes!("../../assets/update_public_key.bin");

pub struct UpdateSignatureVerifier {
    public_key: VerifyingKey,
}

impl UpdateSignatureVerifier {
    pub fn new() -> Result<Self, VerifyError> {
        let key = VerifyingKey::from_bytes(UPDATE_PUBLIC_KEY)
            .map_err(|_| VerifyError::MalformedManifest)?;
        Ok(Self { public_key: key })
    }

    pub fn verify(&self, body: &[u8], manifest: &UpdateManifest) -> Result<(), VerifyError> {
        let signature = Signature::from_slice(&manifest.signature)
            .map_err(|_| VerifyError::InvalidSignature)?;
        self.public_key
            .verify_strict(body, &signature)
            .map_err(|_| VerifyError::InvalidSignature)
    }
}
