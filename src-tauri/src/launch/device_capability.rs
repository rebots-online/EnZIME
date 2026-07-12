// Device capability probing and reporting.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Probe failure when device capability detection cannot complete.
#[derive(Debug, Error)]
pub enum ProbeError {
    /// System information query failed.
    #[error("sysinfo probe failed: {0}")]
    Sysinfo(String),

    /// Platform detection failed.
    #[error("platform probe failed: {0}")]
    Platform(String),
}

/// Probed device facts for model variant selection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCapability {
    /// Total RAM in bytes.
    pub ram_total_bytes: u64,

    /// Available RAM in bytes.
    pub ram_available_bytes: u64,

    /// Free storage space in bytes.
    pub storage_free_bytes: u64,

    /// Whether Google Play Services are available (Android-specific).
    pub has_play_services: bool,
}

/// Probe runner; conservative fallback never panics.
pub struct DeviceProbe;

impl DeviceProbe {
    /// Probe the device for capability information.
    ///
    /// Returns a conservative `DeviceCapability` estimate on success,
    /// or a `ProbeError` if detection fails. Never panics.
    pub fn probe() -> Result<DeviceCapability, ProbeError> {
        // Conservative defaults for offline-first operation.
        // TODO: E-MOD-2 implement actual sysinfo and platform probing.
        Ok(DeviceCapability {
            ram_total_bytes: 4 * 1024 * 1024 * 1024, // 4 GB conservative default
            ram_available_bytes: 2 * 1024 * 1024 * 1024,
            storage_free_bytes: 8 * 1024 * 1024 * 1024, // 8 GB
            has_play_services: false,
        })
    }
}
