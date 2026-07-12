use crate::pack_catalog::types::ZimPack;
use crate::pack_catalog::manifest::PackCatalogSignedManifest;

/// Compile-time bundled catalog loading.
#[derive(Debug, Clone)]
pub struct BundledCatalog;

impl BundledCatalog {
    pub fn new() -> Self {
        Self
    }

    /// Load packs from compile-time default-pack-catalog.json.
    pub fn load(&self) -> Vec<ZimPack> {
        let json_str = include_str!("../../assets/default-pack-catalog.json");
        if let Ok(manifest) = serde_json::from_str::<PackCatalogSignedManifest>(json_str) {
            manifest.packs
        } else {
            Vec::new()
        }
    }
}
