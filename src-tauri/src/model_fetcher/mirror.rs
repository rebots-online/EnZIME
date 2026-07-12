use std::path::PathBuf;
use sha2::{Digest, Sha256};
use tokio::fs::{self, File};
use tokio::io::{AsyncWriteExt, BufWriter};

use crate::ai::probe::Variant;
use crate::model_fetcher::{
    manifest::{ManifestEntry, MirrorManifest, MirrorManifestVerifier},
    progress::{DownloadProgress, ProgressStage},
    Channel, FetchError, ModelFetcher,
};

/// Compile-time mirror URL for model weight downloads.
///
/// Reads the `ENZIME_MIRROR_URL` environment variable at compile time.
/// Falls back to a default mirror if not set.
pub fn mirror_base_url() -> &'static str {
    option_env!("ENZIME_MIRROR_URL").unwrap_or("https://lfs.git.robin.mba/rcheung/EnZIME/raw/branch/master/models")
}

/// reqwest-based HTTPS fetcher for sideload + desktop.
///
/// Downloads model weights from the mirror server, verifies against
/// the signed manifest, and stores them locally.
pub struct MirrorFetcher {
    /// HTTP client for HTTPS downloads.
    pub http: reqwest::Client,

    /// Manifest verifier for checking signatures.
    pub verifier: MirrorManifestVerifier,

    /// Signed manifest containing variant entries.
    pub manifest: MirrorManifest,

    /// Directory where downloaded models are stored.
    pub models_dir: PathBuf,
}

impl MirrorFetcher {
    /// Create a new mirror fetcher.
    pub fn new(
        http: reqwest::Client,
        verifier: MirrorManifestVerifier,
        manifest: MirrorManifest,
        models_dir: PathBuf,
    ) -> Self {
        Self {
            http,
            verifier,
            manifest,
            models_dir,
        }
    }

    /// Get the expected path for a given variant.
    fn variant_path(&self, variant: Variant) -> PathBuf {
        self.models_dir.join(format!("{}.bin", variant.name().to_lowercase()))
    }

    /// Get the partial download path for a given variant.
    fn partial_path(&self, variant: Variant) -> PathBuf {
        self.models_dir.join(format!("{}.partial", variant.name().to_lowercase()))
    }

    /// Resolve the manifest entry for a given variant.
    fn entry_for_variant(&self, variant: Variant) -> Result<ManifestEntry, FetchError> {
        self.manifest
            .variants
            .iter()
            .find(|e| e.variant == variant)
            .cloned()
            .ok_or_else(|| FetchError::MissingManifest)
    }
}

#[async_trait::async_trait]
impl ModelFetcher for MirrorFetcher {
    /// Fetch model weights from the mirror server.
    ///
    /// Downloads the model file, verifies it against the manifest signature,
    /// and stores it in the models directory. Emits progress events through
    /// the channel.
    async fn fetch(
        &self,
        variant: Variant,
        progress: Channel<DownloadProgress>,
    ) -> Result<PathBuf, FetchError> {
        let entry = self.entry_for_variant(variant)?;

        let partial_path = self.partial_path(variant);
        let final_path = self.variant_path(variant);

        // Check for existing partial and get its length for Range resume
        let start_byte = if partial_path.exists() {
            let metadata = fs::metadata(&partial_path).await?;
            metadata.len()
        } else {
            0
        };

        // Emit initial progress
        progress
            .send(DownloadProgress {
                variant,
                bytes_downloaded: start_byte,
                bytes_total: entry.size_bytes,
                stage: if start_byte > 0 {
                    ProgressStage::Downloading
                } else {
                    ProgressStage::Probing
                },
            })
            .map_err(|e| FetchError::Network(format!("progress send failed: {}", e)))?;

        // Build HTTP request with Range header for resume
        let url = &entry.mirror_url;
        let mut request = self.http.get(url);
        if start_byte > 0 {
            request = request.header("Range", format!("bytes={}-", start_byte));
        }

        let response = request
            .send()
            .await
            .map_err(|e| FetchError::Network(format!("request failed: {}", e)))?;

        // Validate status code: 200 (new download) or 206 (resume)
        let status = response.status();
        if !status.is_success() || (start_byte > 0 && status.as_u16() != 206) {
            return Err(FetchError::Network(format!(
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
            .map_err(|e| FetchError::Storage(e.into()))?;

        let mut writer = BufWriter::new(file);
        let mut downloaded = start_byte;

        // Stream response body, emitting progress per chunk
        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result
                .map_err(|e| FetchError::Network(format!("stream error: {}", e)))?;

            writer
                .write_all(&chunk)
                .await
                .map_err(|e| FetchError::Storage(e.into()))?;

            downloaded += chunk.len() as u64;

            progress
                .send(DownloadProgress {
                    variant,
                    bytes_downloaded: downloaded,
                    bytes_total: entry.size_bytes,
                    stage: ProgressStage::Downloading,
                })
                .map_err(|e| FetchError::Network(format!("progress send failed: {}", e)))?;
        }

        // Flush and fsync to ensure data is written to disk
        writer
            .flush()
            .await
            .map_err(|e| FetchError::Storage(e.into()))?;
        writer
            .into_inner()
            .sync_all()
            .await
            .map_err(|e| FetchError::Storage(e.into()))?;

        // Emit verifying stage
        progress
            .send(DownloadProgress {
                variant,
                bytes_downloaded: downloaded,
                bytes_total: entry.size_bytes,
                stage: ProgressStage::Verifying,
            })
            .map_err(|e| FetchError::Network(format!("progress send failed: {}", e)))?;

        // Compute sha256 of downloaded file
        let partial_bytes = fs::read(&partial_path)
            .await
            .map_err(|e| FetchError::Storage(e))?;
        let computed_hash: [u8; 32] = Sha256::digest(&partial_bytes).into();

        if computed_hash != entry.sha256 {
            // Mismatch: remove partial and return error
            fs::remove_file(&partial_path)
                .await
                .map_err(|e| FetchError::Storage(e))?;
            return Err(FetchError::Verify(
                "sha256 mismatch".to_string(),
            ));
        }

        // Match: atomic rename to final path
        fs::rename(&partial_path, &final_path)
            .await
            .map_err(|e| FetchError::Storage(e))?;

        // Emit done stage
        progress
            .send(DownloadProgress {
                variant,
                bytes_downloaded: downloaded,
                bytes_total: entry.size_bytes,
                stage: ProgressStage::Done,
            })
            .map_err(|e| FetchError::Network(format!("progress send failed: {}", e)))?;

        Ok(final_path)
    }

    /// Check if the model file exists for the given variant.
    fn is_present(&self, variant: Variant) -> bool {
        self.variant_path(variant).exists()
    }
}
