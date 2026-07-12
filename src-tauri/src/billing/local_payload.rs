use super::mode::BillingMode;
use super::EntitlementError;
use ed25519_dalek::{Verifier, VerifyingKey};
use sha2::Digest;

/// Signed local entitlement payload.
/// Represents a cryptographically signed entitlement claim that can be verified offline.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct LocalPayload {
    /// Billing tier/mode for this entitlement.
    pub tier: BillingMode,
    /// Unix timestamp when this entitlement expires.
    pub expires: i64,
    /// ed25519 signature over (tier + expires).
    pub signature: Vec<u8>,
    /// SHA-256 hash of the serialized payload for integrity.
    pub payload_hash: [u8; 32],
}

impl LocalPayload {
    /// Returns the deterministic canonical signing input.
    /// Produces: [BillingMode discriminant byte] ‖ expires.to_be_bytes()
    /// This is the canonical input the operator signs and the verifier recomputes.
    pub fn signing_input(&self) -> Vec<u8> {
        // Get discriminant byte for BillingMode
        let discriminant = match self.tier {
            BillingMode::Perpetual => 0u8,
            BillingMode::Subscription => 1u8,
            BillingMode::CustomArtifact => 2u8,
        };

        // Concatenate discriminant byte + expires (i64 as big-endian bytes)
        let mut input = Vec::with_capacity(1 + 8);
        input.push(discriminant);
        input.extend_from_slice(&self.expires.to_be_bytes());
        input
    }
}


// Line 50 target for E-ENT-7

/// ed25519 verifier for local payload signatures.
/// Verifies signed entitlement claims against the embedded public key.
#[derive(Debug, Clone)]
pub struct LocalPayloadVerifier {
    /// ed25519 public key used to verify payload signatures.
    pub public_key: VerifyingKey,
}

impl LocalPayloadVerifier {
    /// Verify a local payload signature and integrity.
    /// Returns Ok(()) if all checks pass, Err(EntitlementError::NotEntitled) otherwise.
    pub fn verify(&self, payload: &LocalPayload, now_unix: i64) -> Result<(), EntitlementError> {
        // 1. Check expiration - reject if current time is past expiry
        if now_unix > payload.expires {
            return Err(EntitlementError::NotEntitled);
        }

        // 2. Verify payload_hash matches SHA-256 of the serialized blob
        let serialized = serde_json::to_vec(payload)
            .map_err(|_| EntitlementError::NotEntitled)?;
        let computed_hash = sha2::Sha256::digest(&serialized);
        if computed_hash.as_slice() != &payload.payload_hash[..] {
            return Err(EntitlementError::NotEntitled);
        }

        // 3. Verify ed25519 signature over the canonical signing input
        let signing_input = payload.signing_input();
        let signature = ed25519_dalek::Signature::from_bytes(&payload.signature)
            .map_err(|_| EntitlementError::NotEntitled)?;
        self.public_key
            .verify(&signing_input, &signature)
            .map_err(|_| EntitlementError::NotEntitled)?;

        Ok(())
    }
}
