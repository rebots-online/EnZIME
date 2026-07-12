//! HMAC signature validation for webhooks
//!
//! Per §7.6 row E-ENT-14: Webhook signature check using SHA-256 HMAC

use hmac::{Hmac, Mac};
use secrecy::{ExposeSecret, SecretString};
use sha2::Sha256;
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

/// Webhook signature validator
///
/// Per §7.6 row E-ENT-14: struct { secret: SecretString };
/// impl validate(&self, &[u8], &str) -> bool
pub struct HmacValidator {
    /// HMAC secret key for webhook signature verification
    secret: SecretString,
}

impl HmacValidator {
    /// Create a new HmacValidator with the given secret
    pub fn new(secret: SecretString) -> Self {
        Self { secret }
    }

    /// Validate webhook signature
    ///
    /// Per §7.6 row E-ENT-14: validate(&self, &[u8], &str) -> bool
    ///
    /// # Arguments
    /// * `body` - Request body bytes to compute HMAC over
    /// * `signature_header` - Signature from webhook header (hex-encoded)
    ///
    /// # Returns
    /// `true` if signature matches, `false` otherwise
    pub fn validate(&self, body: &[u8], signature_header: &str) -> bool {
        let mut mac = match HmacSha256::new_from_slice(self.secret.expose_secret().as_bytes()) {
            Ok(m) => m,
            Err(_) => return false,
        };

        mac.update(body);
        let expected_bytes = mac.finalize().into_bytes();
        let expected_hex = hex::encode(expected_bytes);

        // Constant-time comparison to prevent timing attacks (no length-mismatch leak)
        expected_hex.as_bytes().ct_eq(signature_header.as_bytes()).into()
    }
}
