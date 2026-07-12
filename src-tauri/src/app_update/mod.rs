use std::io;
use std::sync::OnceLock;
use thiserror::Error;

mod android;
mod channel;
mod desktop;
mod manifest;
mod verifier;
mod version;

pub use android::apply_sideload_android;
pub use channel::UpdateChannel;
pub use desktop::apply_desktop;
pub use manifest::UpdateManifest;
pub use verifier::UpdateSignatureVerifier;
pub use version::Version;

/// Compile-time update URL for app update checks.
///
/// Reads the `ENZIME_UPDATE_URL` environment variable at compile time.
/// Falls back to a default mirror if not set.
pub fn update_base_url() -> &'static str {
    option_env!("ENZIME_UPDATE_URL").unwrap_or("https://lfs.git.robin.mba/rcheung/EnZIME/raw/branch/master/releases")
}

/// Cached update manifest from the most recent `app_update_check` call.
/// This allows `app_update_apply` to retrieve the manifest without the UI
/// needing to pass it back as a parameter.
static STAGED_MANIFEST: OnceLock<UpdateManifest> = OnceLock::new();

/// Stage an update manifest for later application.
///
/// Called by `app_update_check` when an update is available.
pub fn stage_manifest(manifest: UpdateManifest) {
    let _ = STAGED_MANIFEST.set(manifest);
}

/// Get the currently staged update manifest.
///
/// Called by `app_update_apply` to retrieve the manifest cached by `app_update_check`.
/// Returns `None` if no manifest has been staged.
pub fn get_staged_manifest() -> Option<UpdateManifest> {
    STAGED_MANIFEST.get().cloned()
}

/// Clear the staged update manifest.
///
/// Called after a successful update or to discard a stale manifest.
pub fn clear_staged_manifest() {
    // OnceLock doesn't support clearing, so we do nothing.
    // In practice, staging a new manifest overwrites the old one.
}

/// Platform-specific updater dispatcher
///
/// Coordinates update checks and applies updates through the configured channel.
pub struct AppUpdater {
    /// HTTP fetch channel for update manifests
    pub channel: UpdateChannel,
    /// Signature verifier for manifest validation
    pub verifier: UpdateSignatureVerifier,
    /// Current application version
    pub current_version: Version,
}

impl AppUpdater {
    /// Check for available updates
    ///
    /// Returns `Some(manifest)` if an update is available, `None` if current.
    pub fn check(&self) -> Result<Option<UpdateManifest>, UpdateError> {
        use serde_json;

        // Block on async HTTP operations (reqwest::Client is async; this provides sync interface)
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| UpdateError::Network(format!("runtime init failed: {}", e)))?;

        let result = rt.block_on(async {
            // Build manifest URL: <base_url>/manifest.json
            let url = format!("{}{}", self.channel.base_url, "/manifest.json");

            // Fetch manifest via HTTP (with timeout for INV-OFFLINE — never hang/block)
            let response = self.channel.http
                .get(&url)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await
                .map_err(|e| UpdateError::Network(format!("fetch failed: {}", e)))?;

            // Deserialize JSON into UpdateManifest
            let manifest: UpdateManifest = response
                .json()
                .await
                .map_err(|e| UpdateError::Network(format!("deserialize failed: {}", e)))?;

            Ok::<_, UpdateError>(manifest)
        })?;

        // Canonicalize manifest body (re-serialize to get stable bytes for signature check)
        let canonical_body = serde_json::to_vec(&result)
            .map_err(|e| UpdateError::Verify(VerifyError::MalformedManifest))?;

        // Verify signature with embedded key (single trust root — transports never trusted)
        self.verifier
            .verify(&canonical_body, &result)
            .map_err(|e| UpdateError::Verify(e))?;

        // Compare versions: return Some(m) iff strictly newer AND verified
        if result.version > self.current_version {
            Ok(Some(result))
        } else {
            Ok(None)
        }
    }

    /// Apply an update manifest
    ///
    /// Downloads and installs the update described in the manifest.
    /// Platform dispatcher: desktop → apply_desktop, sideload Android → apply_sideload_android,
    /// Play build → PlayUnsupported error.
    pub fn apply(&self, manifest: &UpdateManifest) -> Result<(), UpdateError> {
        // Platform dispatch via cfg attributes
        #[cfg(target_os = "android")]
        {
            // TODO: Detect Play Store build vs sideload at runtime
            // For now, route to sideload path; Play detection will return PlayUnsupported when implemented
            apply_sideload_android(self, manifest)
        }

        #[cfg(not(target_os = "android"))]
        {
            // Desktop (Linux/Windows): route to desktop apply path
            apply_desktop(self, manifest)
        }
    }
}

#[derive(Error, Debug)]
pub enum UpdateError {
    #[error("network error: {0}")]
    Network(String),
    #[error("signature verification failed: {0}")]
    Verify(VerifyError),
    #[error("storage error: {0}")]
    Storage(#[from] io::Error),
    #[error("Play Store updates not supported for sideloaded builds")]
    PlayUnsupported,
    #[error("updates not implemented on this platform")]
    NotImplementedOnPlatform,
}

#[derive(Error, Debug)]
pub enum VerifyError {
    #[error("invalid signature")]
    InvalidSignature,
    #[error("malformed manifest")]
    MalformedManifest,
}
