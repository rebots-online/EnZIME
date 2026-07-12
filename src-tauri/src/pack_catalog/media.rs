use std::path::{Path, PathBuf};
use std::fs;
use std::io;
use tauri::ipc::Channel;
use sha2::{Sha256, Digest};

use crate::pack_catalog::types::ZimPack;
use crate::pack_catalog::progress::{PackProgress, PackStage};
use crate::pack_catalog::PackError;

pub const MEDIA_SEARCH_PATHS: &[&str] = &["/media", "/mnt", "/run/media", "/storage"];

/// Physical media import fallback for ZIM packages.
#[derive(Debug, Clone)]
pub struct PackMediaImporter;

impl PackMediaImporter {
    /// Enumerate all candidate ZIM pack files on mounted external media paths.
    pub fn enumerate_candidates(&self, pack_id: &str) -> Vec<PathBuf> {
        let mut candidates = Vec::new();
        let pack_id_lower = pack_id.to_lowercase();
        let target_file_names = [
            format!("{}.zim", pack_id_lower),
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

    /// Scan MEDIA_SEARCH_PATHS for the pack ZIM file, verifying SHA-256 and copying to packs_dir.
    pub async fn scan_and_import(
        &self,
        packs_dir: &Path,
        pack: &ZimPack,
        progress_tx: Channel<PackProgress>,
    ) -> Result<PathBuf, PackError> {
        let _ = progress_tx.send(PackProgress {
            pack_id: pack.id.clone(),
            bytes_downloaded: 0,
            bytes_total: pack.size_bytes,
            stage: PackStage::Probing,
        });

        let candidates = self.enumerate_candidates(&pack.id);
        if candidates.is_empty() {
            return Err(PackError::NotFound(format!("No offline candidates found for pack {}", pack.id)));
        }

        for candidate in candidates {
            let _ = progress_tx.send(PackProgress {
                pack_id: pack.id.clone(),
                bytes_downloaded: 0,
                bytes_total: pack.size_bytes,
                stage: PackStage::Verifying,
            });

            if let Ok(hash) = self.compute_sha256(&candidate) {
                if hash == pack.sha256 || pack.sha256 == [0u8; 32] {
                    let _ = progress_tx.send(PackProgress {
                        pack_id: pack.id.clone(),
                        bytes_downloaded: 0,
                        bytes_total: pack.size_bytes,
                        stage: PackStage::Installing,
                    });

                    fs::create_dir_all(packs_dir)?;
                    let dest_path = packs_dir.join(format!("{}.zim", pack.id.to_lowercase()));
                    fs::copy(&candidate, &dest_path)?;

                    let _ = progress_tx.send(PackProgress {
                        pack_id: pack.id.clone(),
                        bytes_downloaded: pack.size_bytes,
                        bytes_total: pack.size_bytes,
                        stage: PackStage::Done,
                    });

                    return Ok(dest_path);
                }
            }
        }

        Err(PackError::Verify(format!("Failed to verify SHA-256 for any candidate files of pack {}", pack.id)))
    }

    fn compute_sha256(&self, path: &Path) -> Result<[u8; 32], io::Error> {
        let mut file = fs::File::open(path)?;
        let mut hasher = Sha256::new();
        io::copy(&mut file, &mut hasher)?;
        let hash = hasher.finalize();
        let mut result = [0u8; 32];
        result.copy_from_slice(&hash);
        Ok(result)
    }
}
