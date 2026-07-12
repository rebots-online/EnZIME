// Progress reporting for model fetchers.
//
// This module defines the progress stage enum used across all fetcher
// implementations to communicate sub-stage state to the UI.

use crate::ai::probe::Variant;
use serde::{Deserialize, Serialize};

/// Channel event reporting download progress to the UI layer.
///
/// Carries the active variant, byte progress, and current sub-stage.
/// Emitted through the `Channel<DownloadProgress>` parameter of
/// `ModelFetcher::fetch`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    /// The model variant being downloaded.
    pub variant: Variant,

    /// Bytes downloaded so far.
    pub bytes_downloaded: u64,

    /// Total bytes to download (may be zero if unknown).
    pub bytes_total: u64,

    /// Current sub-stage of the fetch operation.
    pub stage: ProgressStage,
}

/// Sub-stage of a model fetch operation.
///
/// Communicates fine-grained progress to the UI layer, allowing the
/// frontend to show contextual status messages (e.g., "Verifying..."
/// vs "Downloading...").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProgressStage {
    /// Initial state: fetching is probing for available models or
    /// checking local cache.
    Probing,

    /// Actively downloading model weights.
    Downloading,

    /// Verifying downloaded weights against checksum or signature.
    Verifying,

    /// Installing verified weights to the final location.
    Installing,

    /// Operation completed successfully.
    Done,

    /// Operation failed with an error message.
    Failed(String),
}
