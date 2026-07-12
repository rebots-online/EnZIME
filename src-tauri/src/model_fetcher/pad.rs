// Play Asset Delivery fetcher for Android.
//
// This module provides the `PadFetcher` implementation for downloading model
// weights through Google Play Asset Delivery on Android platforms.

use crate::ai::probe::Variant;
use crate::model_fetcher::progress::{DownloadProgress, ProgressStage};
use crate::model_fetcher::ModelFetcher;
use std::path::PathBuf;

// JNI types for Android Play Asset Delivery
#[cfg(all(feature = "play", target_os = "android"))]
use jni::{JavaVM, objects::GlobalRef};

// I-10 (b): AssetPackState to be replaced when Android Play Asset Delivery FFI is implemented
/// Placeholder for Android Play Asset Delivery state callbacks.
///
/// Represents the various states of an asset pack download from Play Asset
/// Delivery. This is a stub pending FFI integration with the Android Play
/// Core library.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AssetPackState {
    /// Asset pack is being downloaded.
    Downloading,

    /// Asset pack download is pending (waiting for WiFi or other conditions).
    Pending,

    /// Asset pack download failed.
    Failed(String),

    /// Asset pack is being transferred to local storage.
    Transferring,

    /// Asset pack download completed successfully.
    Completed,

    /// Asset pack download was cancelled.
    Cancelled,
}

/// Adapter from `AssetPackState` callbacks → progress channel.
///
/// Bridges Android Play Asset Delivery state callbacks to the unified
/// `DownloadProgress` channel used by all fetcher implementations.
pub struct PadProgressBridge {
    _private: (),
}

impl PadProgressBridge {
    /// Create a new bridge instance.
    pub fn new() -> Self {
        Self { _private: () }
    }

    /// Forward an `AssetPackState` callback to the progress channel.
    ///
    /// Converts Play Asset Delivery state events into `DownloadProgress`
    /// messages suitable for UI consumption.
    pub fn forward(
        &self,
        state: AssetPackState,
        channel: &crate::model_fetcher::Channel<DownloadProgress>,
        variant: Variant,
    ) {
        let progress = match state {
            AssetPackState::Downloading => DownloadProgress {
                variant,
                bytes_downloaded: 0,
                bytes_total: 0,
                stage: ProgressStage::Downloading,
            },
            AssetPackState::Pending => DownloadProgress {
                variant,
                bytes_downloaded: 0,
                bytes_total: 0,
                stage: ProgressStage::Probing,
            },
            AssetPackState::Failed(err) => DownloadProgress {
                variant,
                bytes_downloaded: 0,
                bytes_total: 0,
                stage: ProgressStage::Failed(err),
            },
            AssetPackState::Transferring => DownloadProgress {
                variant,
                bytes_downloaded: 0,
                bytes_total: 0,
                stage: ProgressStage::Installing,
            },
            AssetPackState::Completed => DownloadProgress {
                variant,
                bytes_downloaded: 0,
                bytes_total: 0,
                stage: ProgressStage::Done,
            },
            AssetPackState::Cancelled => DownloadProgress {
                variant,
                bytes_downloaded: 0,
                bytes_total: 0,
                stage: ProgressStage::Failed("Download cancelled".to_string()),
            },
        };

        // Send progress to the channel consumer
        let _ = channel.send(progress);
    }
}

impl Default for PadProgressBridge {
    fn default() -> Self {
        Self::new()
    }
}

/// Play Asset Delivery fetcher for Android.
///
/// Downloads model weights through Google Play Asset Delivery using JNI
/// to access the Android Play Asset Delivery manager API.
#[cfg(all(feature = "play", target_os = "android"))]
pub struct PadFetcher {
    /// Directory where downloaded model weights are stored.
    pub models_dir: PathBuf,

    /// JNI JavaVM instance for Android runtime interaction.
    pub jvm: JavaVM,

    /// JNI reference to the Android AssetPackManager.
    pub asset_pack_manager: GlobalRef,
}

#[cfg(all(feature = "play", target_os = "android"))]
impl PadFetcher {
    /// Create a new PAD fetcher.
    pub fn new(models_dir: PathBuf, jvm: JavaVM, asset_pack_manager: GlobalRef) -> Self {
        Self {
            models_dir,
            jvm,
            asset_pack_manager,
        }
    }

    /// Get the expected path for a given variant's downloaded weights.
    fn variant_path(&self, variant: Variant) -> PathBuf {
        self.models_dir.join(format!("{}.bin", variant.name().to_lowercase()))
    }
}

#[cfg(all(feature = "play", target_os = "android"))]
#[async_trait::async_trait]
impl ModelFetcher for PadFetcher {
    /// Fetch model weights through Play Asset Delivery.
    ///
    /// JNI sequence:
    /// 1. Map variant to asset-pack name
    /// 2. Register AssetPackStateUpdateListener callback
    /// 3. Call the manager's fetch method with pack name
    /// 4. Listener converts AssetPackState → DownloadProgress via PadProgressBridge
    /// 5. On COMPLETED: getPackLocation.assetsPath() → copy → verify → atomic rename → emit Done
    /// 6. On FAILED/CANCELED → return Err
    /// 7. Unregister and release listener
    async fn fetch(
        &self,
        variant: Variant,
        progress: crate::model_fetcher::Channel<DownloadProgress>,
    ) -> Result<PathBuf, crate::model_fetcher::FetchError> {
        // Step 1: Map variant to asset-pack name
        let pack_name = match variant {
            Variant::GemmaE2bQ4 => "gemma_4_e2b_q4",
            Variant::Qwen3_06B_Q4 => "qwen3_06b_q4",
        };

        // Step 2: Register listener (JNI bridge setup)
        let bridge = PadProgressBridge::new();

        // I-10(b): JNI listener registration to be completed when Android JNI bridge is configured
        // The listener callback will invoke:
        //   bridge.forward(AssetPackState::from_jni(state), &progress, variant)

        // Step 3: JNI call to fetch the asset pack
        // I-10(b): JNI fetch call to be completed when Android JNI bridge is configured

        // Step 4-7: Listener handles state transitions, completion, cleanup
        // On COMPLETED: getPackLocation(packName).assetsPath() → copy to .partial → sha256 verify → atomic rename to .bin
        // On FAILED/CANCELED: return Err(Network(...)|PadUnavailable)
        // Cleanup: unregister listener, release GlobalRef

        let path = self.variant_path(variant);

        // I-10(b): Full JNI sequence implementation pending Android Play Asset Delivery FFI configuration
        // This struct now has real JNI types (JavaVM, GlobalRef) instead of () placeholders
        let _ = (pack_name, bridge);

        Err(crate::model_fetcher::FetchError::PadUnavailable)
    }

    /// Check if weights for the given variant are already present locally.
    fn is_present(&self, variant: Variant) -> bool {
        self.variant_path(variant).exists()
    }
}

/// Stub Play Asset Delivery fetcher for non-Android targets.
#[cfg(all(feature = "play", not(target_os = "android")))]
pub struct PadFetcher {
    pub models_dir: std::path::PathBuf,
    pub jvm: (),
    pub asset_pack_manager: (),
}

#[cfg(all(feature = "play", not(target_os = "android")))]
impl PadFetcher {
    pub fn new(models_dir: std::path::PathBuf) -> Self {
        Self {
            models_dir,
            jvm: (),
            asset_pack_manager: (),
        }
    }

    fn variant_path(&self, variant: Variant) -> std::path::PathBuf {
        self.models_dir.join(format!("{}.bin", variant.name().to_lowercase()))
    }
}

#[cfg(all(feature = "play", not(target_os = "android")))]
#[async_trait::async_trait]
impl ModelFetcher for PadFetcher {
    async fn fetch(
        &self,
        variant: Variant,
        progress: crate::model_fetcher::Channel<DownloadProgress>,
    ) -> Result<std::path::PathBuf, crate::model_fetcher::FetchError> {
        let _ = progress;
        Err(crate::model_fetcher::FetchError::PadUnavailable)
    }

    fn is_present(&self, variant: Variant) -> bool {
        self.variant_path(variant).exists()
    }
}
