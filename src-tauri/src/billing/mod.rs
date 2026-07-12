// Billing module for EnZIME entitlement system

pub mod local_payload;
pub mod mode;
pub mod paywall;
pub mod restore;
pub mod revenuecat;

pub use mode::BillingMode;

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use thiserror::Error;
use crate::storage::{Storage, SettingsStore};
use crate::storage::setting_key;
use self::local_payload::{LocalPayload, LocalPayloadVerifier};
use self::revenuecat::RevenueCatClient;

/// Billing error types for entitlement operations
#[derive(Error, Debug)]
pub enum EntitlementError {
    #[error("network error: {0}")]
    Network(String),

    #[error("not entitled")]
    NotEntitled,

    #[error("backend error: {0}")]
    Backend(String),
}

/// Single gate truth for feature entitlement checks
pub struct EntitlementController {
    /// Billing mode for this entitlement controller
    pub mode: BillingMode,
    /// Storage backend
    storage: Arc<Storage>,
    /// RevenueCat HTTP client
    pub rc: Arc<RevenueCatClient>,
    /// Local payload verifier
    pub local: Arc<LocalPayloadVerifier>,
    /// Entitlement cache: entitlement name -> is_entitled
    pub cache: RwLock<HashMap<String, bool>>,
}

impl EntitlementController {
    /// Create a new entitlement controller.
    ///
    /// I-10(b): swap when LocalPayloadVerifier wiring lands — add a builder or take Arc<LocalPayloadVerifier> parameter
    pub fn new(mode: BillingMode, storage: Arc<Storage>, local: LocalPayloadVerifier) -> Self {
        Self {
            mode,
            storage,
            rc: Arc::new(RevenueCatClient::new()),
            local: Arc::new(local),
            cache: RwLock::new(HashMap::new()),
        }
    }

    /// Check if the current user is entitled to a given feature.
    /// E-ENT-2: Offline-first sync entitlement check.
    /// Returns cached verdict on hit; on miss, retrieves stored LocalPayload from storage,
    /// verifies it offline, caches and returns the result. Returns Ok(false) if no payload
    /// exists (never blocks or errors the core flow per INV-OFFLINE).
    pub fn is_entitled(&self, entitlement: &str) -> Result<bool, EntitlementError> {
        // Check cache first - return cached bool on hit
        if let Ok(cache) = self.cache.read() {
            if let Some(&cached) = cache.get(entitlement) {
                return Ok(cached);
            }
        }

        // Cache miss: retrieve stored LocalPayload from storage settings
        let now = chrono::Utc::now().timestamp();
        let is_entitled = match self.retrieve_and_verify_payload(now) {
            Ok(true) => true,
            Ok(false) | Err(_) => false, // Verification failures or no payload = not entitled
        };

        // Cache the verdict before returning
        if let Ok(mut cache) = self.cache.write() {
            cache.insert(entitlement.to_string(), is_entitled);
        }

        Ok(is_entitled)
    }

    /// Helper: Retrieve stored LocalPayload from storage and verify it offline.
    /// Returns Ok(true) if payload exists and verification passes, Ok(false) otherwise.
    /// Never errors the core flow - all errors resolve to Ok(false) per INV-OFFLINE.
    fn retrieve_and_verify_payload(&self, now_unix: i64) -> Result<bool, EntitlementError> {
        // Try to retrieve stored LocalPayload from storage settings
        let payload_json = match self.storage.get(setting_key::BILLING_LOCAL_PAYLOAD) {
            Ok(Some(json)) => json,
            Ok(None) => return Ok(false), // No payload stored = not entitled (not an error)
            Err(_) => return Ok(false), // Storage error = not entitled (INV-OFFLINE: never block)
        };

        // Deserialize the LocalPayload
        let payload: LocalPayload = match serde_json::from_str(&payload_json) {
            Ok(p) => p,
            Err(_) => return Ok(false), // Deserialization error = not entitled
        };

        // Verify the payload offline using the embedded verifier
        match self.local.verify(&payload, now_unix) {
            Ok(()) => Ok(true), // Verification passed = entitled
            Err(EntitlementError::NotEntitled) => Ok(false), // Verification failed = not entitled
            Err(_) => Ok(false), // Other errors = not entitled (INV-OFFLINE)
        }
    }

    /// Pull latest entitlement state from RevenueCat.
    /// E-ENT-3
    pub async fn refresh(&self) -> Result<(), EntitlementError> {
        // I-10(b): swap when Storage::get_app_user_id() lands - retrieve persisted user ID
        // For now, use a placeholder constant
        let app_user_id = "placeholder_user_id";

        // Pull latest subscriber state from RC for the persisted app_user_id
        let active_entitlements = match self.rc.fetch_subscriber(app_user_id).await {
            Ok(entitlements) => entitlements,
            Err(EntitlementError::Network(e)) => {
                // On network error return Err(Network) but leave the existing cache intact (no wipe)
                return Err(EntitlementError::Network(e));
            }
            Err(e) => return Err(e),
        };

        // Overwrite the cache with RC's verdict
        let mut cache = self.cache.write()
            .map_err(|e| EntitlementError::Backend(format!("cache lock poisoned: {}", e)))?;

        // Clear existing cache and update with fresh state
        cache.clear();
        for entitlement_id in active_entitlements {
            cache.insert(entitlement_id, true);
        }

        // I-10(b): swap when LocalPayload signing lands (E-ENT-6, E-ENT-22)
        // When active entitlement is confirmed, re-write a fresh signed LocalPayload
        // For now, this step is deferred until the signing infrastructure is available

        Ok(())
    }
}
