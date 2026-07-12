use std::path::Path;
use crate::pack_catalog::types::ZimPack;
use crate::pack_catalog::manifest::{PackCatalogSignedManifest, PackCatalogManifestVerifier};

/// User-pointed local catalog loading and verification.
#[derive(Debug, Clone)]
pub struct LocalCatalogLoader;

impl LocalCatalogLoader {
    /// Load and verify signed pack manifest in the packs directory.
    pub fn load(&self, packs_dir: &Path, verifier: &PackCatalogManifestVerifier) -> Vec<ZimPack> {
        let manifest_path = packs_dir.join("catalog.json");
        if manifest_path.exists() {
            if let Ok(content) = std::fs::read(&manifest_path) {
                if let Ok(manifest) = serde_json::from_slice::<PackCatalogSignedManifest>(&content) {
                    if verifier.verify(&content, &manifest).is_ok() {
                        return manifest.packs;
                    }
                }
            }
        }
        Vec::new()
    }
}
