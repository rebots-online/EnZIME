// src-tauri/src/pack_catalog/types.rs
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

/// Catalog entry representing a ZIM pack available for download.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZimPack {
    pub id: String,
    pub title: String,
    pub description: String,
    pub language: String,
    pub size_bytes: u64,
    pub sha256: [u8; 32],
    pub download_url: String,
    pub license: String,
    pub upstream_url: String,
}

/// Local registry row representing an installed ZIM pack.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledPack {
    pub id: String,
    pub zim_uuid: Uuid,
    pub path: PathBuf,
    pub installed_at: i64,
    pub sha256: [u8; 32],
}
