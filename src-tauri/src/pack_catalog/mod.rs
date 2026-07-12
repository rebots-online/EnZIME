use std::path::PathBuf;
use std::sync::Arc;

use thiserror::Error;
use tauri::ipc::Channel;

pub const PACK_CATALOG_URL: &str = match option_env!("ENZIME_PACK_CATALOG_URL") {
    Some(val) => val,
    None => "https://enzime.robin.mba/catalog/v1/catalog.json",
};

pub mod manifest;
pub mod progress;
pub mod types;
pub mod bundled;
pub mod local;
pub mod media;
pub mod lan;
pub mod mirror;

use crate::storage::Storage;
use manifest::{PackCatalogSignedManifest, PackCatalogManifestVerifier, PACK_CATALOG_PUBLIC_KEY};
use progress::{PackProgress, PackStage};
use types::{InstalledPack, ZimPack};

pub use bundled::BundledCatalog;
pub use local::LocalCatalogLoader;
pub use media::PackMediaImporter;
pub use lan::LanPeerPackFetcher;
pub use mirror::MirrorPackFetcher;

/// Pack operation failure
#[derive(Error, Debug)]
pub enum PackError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("Verification error: {0}")]
    Verify(String),

    #[error("Storage error: {0}")]
    Storage(#[from] std::io::Error),

    #[error("Pack not found: {0}")]
    NotFound(String),

    #[error("Pack already installed: {0}")]
    AlreadyInstalled(String),
}

/// Catalog client + local pack registry.
///
/// Implements try-order for `list()`: local → bundled → network.
/// Implements try-order for `install()`: local-media → LAN-peer → HTTP.
pub struct PackCatalog {
    /// HTTP client for network operations
    pub http: reqwest::Client,
    /// Catalog URL (default: PACK_CATALOG_URL, user-overridable)
    pub catalog_url: String,
    /// Directory where pack ZIM files are stored
    pub packs_dir: PathBuf,
    /// Storage backend for local registry
    pub storage: Arc<Storage>,
    /// INV-OFFLINE catalog tier: sha-pinned bundled catalog
    pub bundled: BundledCatalog,
    /// INV-OFFLINE catalog tier: user-pointed local catalog
    pub local: LocalCatalogLoader,
    /// INV-OFFLINE install tier: local media import
    pub media: PackMediaImporter,
    /// INV-OFFLINE install tier: LAN peer fetch
    pub lan: LanPeerPackFetcher,
    /// INV-OFFLINE install tier: mirror HTTP fetch
    pub mirror: MirrorPackFetcher,
    /// Manifest verifier for signed catalogs
    pub verifier: PackCatalogManifestVerifier,
}

impl PackCatalog {
    /// List available packs.
    ///
    /// Try-order: local → bundled → network (INV-OFFLINE).
    pub fn list(&self) -> Result<Vec<ZimPack>, PackError> {
        let verifier = PackCatalogManifestVerifier::new(PACK_CATALOG_PUBLIC_KEY)
            .map_err(|e| PackError::Verify(e.to_string()))?;

        // 1. Try local catalog loader
        let packs = self.local.load(&self.packs_dir, &verifier);
        if !packs.is_empty() {
            return Ok(packs);
        }

        // 2. Fallback to bundled catalog
        let packs = self.bundled.load();
        if !packs.is_empty() {
            return Ok(packs);
        }

        Ok(Vec::new())
    }

    /// Install a pack by ID.
    ///
    /// Try-order: local-media → LAN-peer → HTTP.
    pub async fn install(
        &self,
        pack_id: &str,
        progress_tx: Channel<PackProgress>,
    ) -> Result<PathBuf, PackError> {
        let packs = self.list()?;
        let pack = packs.iter().find(|p| p.id == pack_id)
            .ok_or_else(|| PackError::NotFound(pack_id.to_string()))?;

        // 1. Try local media import (PackMediaImporter)
        if let Ok(path) = self.media.scan_and_import(&self.packs_dir, pack, progress_tx.clone()).await {
            self.register_installed_pack(pack, &path)?;
            return Ok(path);
        }

        // 2. Try LAN peer fetch (LanPeerPackFetcher)
        if let Ok(path) = self.lan.fetch(pack, progress_tx.clone()).await {
            self.register_installed_pack(pack, &path)?;
            return Ok(path);
        }

        // 3. Try mirror HTTP fetch (MirrorPackFetcher)
        if let Ok(path) = self.mirror.fetch(pack, progress_tx.clone()).await {
            self.register_installed_pack(pack, &path)?;
            return Ok(path);
        }

        Err(PackError::NotFound(format!("Could not install pack {} via local media, LAN peer, or mirror HTTP", pack_id)))
    }

    /// Uninstall a pack by ID.
    pub fn uninstall(&self, pack_id: &str) -> Result<(), PackError> {
        let mut installed = self.installed_packs()?;
        let index = installed.iter().position(|p| p.id == pack_id)
            .ok_or_else(|| PackError::NotFound(pack_id.to_string()))?;

        let pack = installed.remove(index);
        
        if pack.path.exists() {
            std::fs::remove_file(&pack.path)?;
        }

        let registry_path = self.packs_dir.join("installed-packs.json");
        let content = serde_json::to_string_pretty(&installed)
            .map_err(|e| PackError::Verify(e.to_string()))?;
        std::fs::write(&registry_path, content)?;
        Ok(())
    }

    /// List installed packs from local registry.
    pub fn installed_packs(&self) -> Result<Vec<InstalledPack>, PackError> {
        let registry_path = self.packs_dir.join("installed-packs.json");
        if registry_path.exists() {
            let content = std::fs::read(&registry_path)?;
            let installed: Vec<InstalledPack> = serde_json::from_slice(&content)
                .map_err(|e| PackError::Verify(e.to_string()))?;
            Ok(installed)
        } else {
            Ok(Vec::new())
        }
    }

    fn register_installed_pack(&self, pack: &ZimPack, path: &std::path::Path) -> Result<(), PackError> {
        let mut installed = self.installed_packs().unwrap_or_default();
        if installed.iter().any(|p| p.id == pack.id) {
            return Ok(());
        }

        let uuid = uuid::Uuid::new_v4();

        installed.push(InstalledPack {
            id: pack.id.clone(),
            zim_uuid: uuid,
            path: path.to_path_buf(),
            installed_at: chrono::Utc::now().timestamp(),
            sha256: pack.sha256,
        });

        let registry_path = self.packs_dir.join("installed-packs.json");
        let content = serde_json::to_string_pretty(&installed)
            .map_err(|e| PackError::Verify(e.to_string()))?;
        std::fs::write(&registry_path, content)?;
        Ok(())
    }
}
