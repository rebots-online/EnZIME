// Copyright (c) 2026 EnZIME Suite. All rights reserved.

use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tauri::ipc::Channel;
use tokio::fs::{self, File};
use tokio::io::{AsyncWriteExt, BufWriter};

use crate::pack_catalog::{PackError, PackProgress, PackStage, ZimPack};

/// Resumable HTTPS fetcher for pack ZIM files from the mirror server.
///
/// Downloads pack `.zim` files from the signed `download_url`,
/// verifies against `ZimPack.sha256`, and stores them locally.
/// This is the third tier consulted by `install`, reached only
/// after media and LAN both fail.
pub struct MirrorPackFetcher {
    /// HTTP client for HTTPS downloads.
    pub http: reqwest::Client,

    /// Directory where downloaded pack ZIM files are stored.
    pub packs_dir: PathBuf,
}

impl MirrorPackFetcher {
    /// Create a new mirror pack fetcher.
    pub fn new(http: reqwest::Client, packs_dir: PathBuf) -> Self {
        Self { http, packs_dir }
    }

    /// Get the final path for a given pack ID.
    fn pack_path(&self, pack_id: &str) -> PathBuf {
        self.packs_dir.join(format!("{}.zim", pack_id))
    }

    /// Get the partial download path for a given pack ID.
    fn partial_path(&self, pack_id: &str) -> PathBuf {
        self.packs_dir.join(format!("{}.partial", pack_id))
    }

    /// Fetch a pack ZIM file from the mirror server.
    ///
    /// Downloads the pack file, verifies it against the catalog entry's sha256,
    /// and stores it in the packs directory. Emits progress events through
    /// the channel. Resumes interrupted downloads when the server supports Range.
    pub async fn fetch(
        &self,
        pack: &ZimPack,
        progress: Channel<PackProgress>,
    ) -> Result<PathBuf, PackError> {
        let pack_id = &pack.id;
        let partial_path = self.partial_path(pack_id);
        let final_path = self.pack_path(pack_id);

        // Check for existing partial and get its length for Range resume
        let start_byte = if partial_path.exists() {
            let metadata = fs::metadata(&partial_path)
                .await
                .map_err(|e| PackError::Storage(e))?;
            metadata.len()
        } else {
            0
        };

        // Emit initial progress
        progress
            .send(PackProgress {
                pack_id: pack_id.clone(),
                bytes_downloaded: start_byte,
                bytes_total: pack.size_bytes,
                stage: if start_byte > 0 {
                    PackStage::Downloading
                } else {
                    PackStage::Probing
                },
            })
            .map_err(|e| PackError::Network(format!("progress send failed: {}", e)))?;

        // Build HTTP request with Range header for resume
        let url = &pack.download_url;
        let mut request = self.http.get(url);
        if start_byte > 0 {
            request = request.header("Range", format!("bytes={}-", start_byte));
        }

        let response = request
            .send()
            .await
            .map_err(|e| PackError::Network(format!("request failed: {}", e)))?;

        // Validate status code: 200 (new download) or 206 (resume)
        let status = response.status();
        if !status.is_success() || (start_byte > 0 && status.as_u16() != 206) {
            return Err(PackError::Network(format!(
                "unexpected status: {}",
                status
            )));
        }

        // Open partial file for appending (create if not exists)
        let file = File::options()
            .create(true)
            .append(true)
            .open(&partial_path)
            .await
            .map_err(|e| PackError::Storage(e))?;

        let mut writer = BufWriter::new(file);
        let mut downloaded = start_byte;

        // Stream response body, emitting progress per chunk
        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result
                .map_err(|e| PackError::Network(format!("stream error: {}", e)))?;

            writer
                .write_all(&chunk)
                .await
                .map_err(|e| PackError::Storage(e))?;

            downloaded += chunk.len() as u64;

            progress
                .send(PackProgress {
                    pack_id: pack_id.clone(),
                    bytes_downloaded: downloaded,
                    bytes_total: pack.size_bytes,
                    stage: PackStage::Downloading,
                })
                .map_err(|e| PackError::Network(format!("progress send failed: {}", e)))?;
        }

        // Flush and fsync to ensure data is written to disk
        writer
            .flush()
            .await
            .map_err(|e| PackError::Storage(e))?;
        writer
            .into_inner()
            .sync_all()
            .await
            .map_err(|e| PackError::Storage(e))?;

        // Emit verifying stage
        progress
            .send(PackProgress {
                pack_id: pack_id.clone(),
                bytes_downloaded: downloaded,
                bytes_total: pack.size_bytes,
                stage: PackStage::Verifying,
            })
            .map_err(|e| PackError::Network(format!("progress send failed: {}", e)))?;

        // Compute sha256 of downloaded file
        let partial_bytes = fs::read(&partial_path)
            .await
            .map_err(|e| PackError::Storage(e))?;
        let computed_hash: [u8; 32] = Sha256::digest(&partial_bytes).into();

        if computed_hash != pack.sha256 {
            // Mismatch: remove partial and return error
            fs::remove_file(&partial_path)
                .await
                .map_err(|e| PackError::Storage(e))?;
            return Err(PackError::Verify("sha256 mismatch".to_string()));
        }

        // Match: atomic rename to final path
        fs::rename(&partial_path, &final_path)
            .await
            .map_err(|e| PackError::Storage(e))?;

        // Emit done stage
        progress
            .send(PackProgress {
                pack_id: pack_id.clone(),
                bytes_downloaded: downloaded,
                bytes_total: pack.size_bytes,
                stage: PackStage::Done,
            })
            .map_err(|e| PackError::Network(format!("progress send failed: {}", e)))?;

        Ok(final_path)
    }
}
