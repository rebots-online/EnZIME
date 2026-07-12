use serde::{Deserialize, Serialize};

use crate::app_update::Version;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateManifest {
    pub version: Version,
    pub artifact_url: String,
    pub sha256: [u8; 32],
    pub size_bytes: u64,
    pub signature: Vec<u8>,
    pub release_notes_url: Option<String>,
}
