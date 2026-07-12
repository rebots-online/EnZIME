use ed25519_dalek::{Signature, Verifier};
use thiserror::Error;

use crate::sidecar::codec::{CodecError, SidecarCodec};
use crate::sidecar::Sidecar;
use crate::sidecar::trust::{TrustDb, TrustLevel};

/// Verify error
#[derive(Error, Debug)]
pub enum SidecarVerifyError {
    #[error("codec error: {0}")]
    Codec(CodecError),

    #[error("bad signature")]
    BadSignature,

    #[error("missing signature")]
    MissingSignature,

    #[error("unsupported algorithm: {0}")]
    UnsupportedAlg(String),

    #[error("delegation not supported")]
    DelegationNotSupported,

    #[error("schema version: {0}")]
    SchemaVersion(u8),

    #[error("author key mismatch")]
    AuthorKeyMismatch,

    #[error("trust rejected")]
    TrustRejected,
}

/// Signature + schema verification for sidecar artifacts
///
/// Verifies ed25519 signatures on sidecar metadata and validates
/// schema version compliance.
pub struct SidecarVerifier;

impl SidecarVerifier {
    /// Expected schema version for sidecar artifacts
    const EXPECTED_SCHEMA_VERSION: u8 = 1;

    /// Verify a sidecar's signature and schema
    ///
    /// Returns a `VerifiedSidecar` wrapper if the signature is valid
    /// and the schema version is supported.
    pub fn verify(sidecar: &Sidecar) -> Result<VerifiedSidecar, SidecarVerifyError> {
        // Check schema version
        if sidecar.schema_version != Self::EXPECTED_SCHEMA_VERSION {
            return Err(SidecarVerifyError::SchemaVersion(sidecar.schema_version));
        }

        // Extract signature envelope
        let envelope = sidecar
            .signature_envelope
            .as_ref()
            .ok_or(SidecarVerifyError::MissingSignature)?;

        // Check algorithm
        if envelope.alg != "ed25519" {
            return Err(SidecarVerifyError::UnsupportedAlg(envelope.alg.clone()));
        }

        // Check author pubkey matches signature pubkey
        if sidecar.author.pubkey != envelope.pubkey {
            return Err(SidecarVerifyError::AuthorKeyMismatch);
        }

        // Clone sidecar and clear signature envelope for canonical encoding
        let mut sidecar_for_signing = sidecar.clone();
        sidecar_for_signing.signature_envelope = None;

        // Get canonical bytes
        let bytes = SidecarCodec::encode_canonical_for_signing(&sidecar_for_signing)
            .map_err(SidecarVerifyError::Codec)?;

        // Verify signature
        let pubkey = ed25519_dalek::VerifyingKey::from_bytes(&envelope.pubkey)
            .map_err(|e| SidecarVerifyError::BadSignature)?;
        let signature = Signature::from_bytes(&envelope.signature);

        pubkey
            .verify(&bytes, &signature)
            .map_err(|_| SidecarVerifyError::BadSignature)?;

        Ok(VerifiedSidecar {
            inner: sidecar.clone(),
            signer_pubkey: envelope.pubkey,
        })
    }

    /// Verify a sidecar's signature and check peer-trust status
    ///
    /// Returns a `TrustedSidecar` if the signature is valid and the
    /// peer's trust level is not `Rejected`.
    pub fn verify_with_trust(
        sidecar: &Sidecar,
        trust_db: &TrustDb,
    ) -> Result<TrustedSidecar, SidecarVerifyError> {
        // First verify signature
        let verified = Self::verify(sidecar)?;

        // Check trust level
        let trust_level = trust_db
            .get(&verified.signer_pubkey)
            .map_err(|e| SidecarVerifyError::TrustRejected)?
            .unwrap_or(TrustLevel::Unknown);

        // Reject if trust level is Rejected
        if trust_level == TrustLevel::Rejected {
            return Err(SidecarVerifyError::TrustRejected);
        }

        Ok(TrustedSidecar {
            inner: verified,
            trust_level,
        })
    }
}

/// Signature-passes wrapper (newtype)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiedSidecar {
    /// The verified sidecar
    pub inner: Sidecar,
    /// Signer's Ed25519 public key
    pub signer_pubkey: [u8; 32],
}

/// Sig + peer-trust both pass
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrustedSidecar {
    /// The verified sidecar with peer trust
    pub inner: VerifiedSidecar,
    /// Trust level assigned
    pub trust_level: TrustLevel,
}
