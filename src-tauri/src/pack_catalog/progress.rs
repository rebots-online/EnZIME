// Copyright (c) 2026 EnZIME Suite. All rights reserved.

use serde::{Deserialize, Serialize};

/// Channel event for pack installation progress.
///
/// Emitted during pack download/install to report progress to the UI.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PackProgress {
    /// Unique identifier of the pack being installed
    pub pack_id: String,
    /// Number of bytes downloaded so far
    pub bytes_downloaded: u64,
    /// Total size in bytes of the pack file
    pub bytes_total: u64,
    /// Current installation stage
    pub stage: PackStage,
}

/// Pack installation progress stages.
///
/// Tracks the lifecycle of a pack installation from initial probe
/// through completion or failure.

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub enum PackStage {
    /// Initial stage: probing pack metadata and dependencies
    Probing,
    /// Downloading pack ZIM file
    Downloading,
    /// Verifying downloaded file integrity
    Verifying,
    /// Installing pack to local storage
    Installing,
    /// Indexing pack content for search
    Indexing,
    /// Installation completed successfully
    Done,
    /// Installation failed with error message
    Failed(String),
}
