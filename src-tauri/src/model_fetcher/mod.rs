use std::io;
use thiserror::Error;

pub mod manifest;
pub mod media;
pub mod mirror;
pub mod null;
pub mod pad;
pub mod progress;

pub use progress::{DownloadProgress, ProgressStage};

// I-10 (b): async_trait dependency to be added to Cargo.toml
use crate::ai::probe::Variant;

/// Fetcher error
#[derive(Debug, Error)]
pub enum FetchError {
    #[error("network error: {0}")]
    Network(String),

    #[error("verification error: {0}")]
    Verify(String),

    #[error("storage error: {0}")]
    Storage(#[from] io::Error),

    #[error("PAD device unavailable")]
    PadUnavailable,

    #[error("missing manifest")]
    MissingManifest,
}

/// Channel sender type for download progress events.
pub type Channel<T> = tauri::ipc::Channel<T>;

/// Trait abstracting model weight fetch operations.
///
/// Implemented by concrete fetchers for different sources:
/// - `NullFetcher`: assumes weights already on disk
/// - `MirrorFetcher`: HTTPS downloads from mirror
/// - `PadFetcher`: Play Asset Delivery on Android
#[async_trait::async_trait]
pub trait ModelFetcher {
    /// Fetch model weights for the given variant.
    ///
    /// Emits progress events through the channel. Returns the path to
    /// the downloaded weights on success.
    async fn fetch(
        &self,
        variant: Variant,
        progress: Channel<DownloadProgress>,
    ) -> Result<std::path::PathBuf, FetchError>;

    /// Check if weights for the given variant are already present locally.
    fn is_present(&self, variant: Variant) -> bool;
}
