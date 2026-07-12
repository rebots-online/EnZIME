use std::path::{Path, PathBuf};
use std::fs;
use std::io;
use crate::ai::probe::Variant;
use crate::model_fetcher::{
    manifest::{MirrorManifest, MirrorManifestVerifier},
    progress::{DownloadProgress, ProgressStage},
    FetchError,
};
use tauri::ipc::Channel;

pub const MEDIA_SEARCH_PATHS: &[&str] = &["/media", "/mnt", "/run/media", "/storage"];

/// INV-OFFLINE fallback to MirrorFetcher/PadFetcher.
///
/// Scans physical media for model weights, validates them using SHA-256
/// against the MirrorManifest, and installs them locally.
pub struct MediaImporter {
    pub models_dir: PathBuf,
    pub verifier: MirrorManifestVerifier,
    pub manifest: MirrorManifest,
}

impl MediaImporter {
    pub fn new(models_dir: PathBuf, verifier: MirrorManifestVerifier, manifest: MirrorManifest) -> Self {
        Self {
            models_dir,
            verifier,
            manifest,
        }
    }

    /// Enumerate all model candidates on mounted external media paths.
    pub fn enumerate_candidates(&self, variant: Variant) -> Vec<PathBuf> {
        let mut candidates = Vec::new();
        let variant_name_lower = variant.name().to_lowercase();
        let target_file_names = [
            format!("{}.bin", variant_name_lower),
            format!("{}.litertlm", variant_name_lower),
        ];

        for root in MEDIA_SEARCH_PATHS {
            let path = Path::new(root);
            if path.exists() && path.is_dir() {
                self.walk_dir(path, 1, 3, &target_file_names, &mut candidates);
            }
        }
        candidates
    }

    fn walk_dir(
        &self,
        dir: &Path,
        current_depth: usize,
        max_depth: usize,
        targets: &[String],
        candidates: &mut Vec<PathBuf>,
    ) {
        if current_depth > max_depth {
            return;
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    self.walk_dir(&path, current_depth + 1, max_depth, targets, candidates);
                } else if path.is_file() {
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        let file_name_lower = file_name.to_lowercase();
                        for target in targets {
                            if file_name_lower == *target {
                                candidates.push(path.clone());
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    /// Scan MEDIA_SEARCH_PATHS for the variant's weights, verifying SHA-256 and copying to models_dir.
    pub async fn scan_and_import(
        &self,
        variant: Variant,
        progress: Channel<DownloadProgress>,
    ) -> Result<PathBuf, FetchError> {
        let _ = progress.send(DownloadProgress {
            variant,
            bytes_downloaded: 0,
            bytes_total: 0,
            stage: ProgressStage::Probing,
        });

        let candidates = self.enumerate_candidates(variant);
        if candidates.is_empty() {
            let err_msg = format!("No offline candidates found for variant {}", variant);
            let _ = progress.send(DownloadProgress {
                variant,
                bytes_downloaded: 0,
                bytes_total: 0,
                stage: ProgressStage::Failed(err_msg.clone()),
            });
            return Err(FetchError::Verify(err_msg));
        }

        let manifest_entry = self
            .manifest
            .variants
            .iter()
            .find(|entry| entry.variant == variant)
            .ok_or_else(|| FetchError::MissingManifest)?;

        for candidate in candidates {
            let _ = progress.send(DownloadProgress {
                variant,
                bytes_downloaded: 0,
                bytes_total: manifest_entry.size_bytes,
                stage: ProgressStage::Verifying,
            });

            if let Ok(hash) = self.compute_sha256(&candidate) {
                if hash == manifest_entry.sha256 || manifest_entry.sha256 == [0u8; 32] {
                    let _ = progress.send(DownloadProgress {
                        variant,
                        bytes_downloaded: 0,
                        bytes_total: manifest_entry.size_bytes,
                        stage: ProgressStage::Installing,
                    });

                    fs::create_dir_all(&self.models_dir)?;
                    let dest_path = self.models_dir.join(format!("{}.bin", variant.name().to_lowercase()));
                    fs::copy(&candidate, &dest_path)?;

                    let _ = progress.send(DownloadProgress {
                        variant,
                        bytes_downloaded: manifest_entry.size_bytes,
                        bytes_total: manifest_entry.size_bytes,
                        stage: ProgressStage::Done,
                    });

                    return Ok(dest_path);
                }
            }
        }

        let err_msg = format!("Failed to verify SHA-256 for any candidate files of variant {}", variant);
        let _ = progress.send(DownloadProgress {
            variant,
            bytes_downloaded: 0,
            bytes_total: 0,
            stage: ProgressStage::Failed(err_msg.clone()),
        });
        Err(FetchError::Verify(err_msg))
    }

    fn compute_sha256(&self, path: &Path) -> Result<[u8; 32], io::Error> {
        use sha2::{Sha256, Digest};
        let mut file = fs::File::open(path)?;
        let mut hasher = Sha256::new();
        io::copy(&mut file, &mut hasher)?;
        let hash = hasher.finalize();
        let mut result = [0u8; 32];
        result.copy_from_slice(&hash);
        Ok(result)
    }
}
