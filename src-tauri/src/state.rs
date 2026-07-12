// Application global state container

use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock, OnceLock};

use anzimmermanlib::ZimReader;
use crate::storage::Storage;
use crate::billing::EntitlementController;
use crate::model_fetcher::ModelFetcher;
use crate::ai::probe::Variant;
use crate::launch::device_capability::DeviceCapability;
use crate::sidecar::store::{SidecarStore, SidecarIndex};
use crate::sidecar::sign::SidecarSigner;
use crate::sidecar::SidecarError;
use crate::sidecar::identity::IdentityKeystore;
use crate::sidecar::trust::TrustDb;
use crate::sidecar::voice_blob::VoiceClipBlobStore;
use crate::sidecar::chunk::ChunkReassembler;
use crate::paths::AppPaths;
use crate::log::EnzimeLogger;
use crate::pack_catalog::PackCatalog;
use crate::pack_catalog::manifest::{PackCatalogManifestVerifier, PACK_CATALOG_PUBLIC_KEY};
use crate::pack_catalog::mirror::MirrorPackFetcher;
use crate::app_update::AppUpdater;
use crate::window_state::WindowStateStore;
use crate::global_search::GlobalSearcher;

use crate::ai::{LlmRuntime, AudioEncoder, Tts};
use crate::model_fetcher::manifest::{MirrorManifestVerifier, MIRROR_PUBLIC_KEY};
use crate::billing::local_payload::LocalPayloadVerifier;

/// Compile-time-embedded operator public key for local entitlement payload verification.
pub const ENTITLEMENT_PUBLIC_KEY: &[u8; 32] = include_bytes!("../assets/entitlement_public_key.bin");

/// Thread-safe application global state container.
///
/// Under a single pointer, this struct manages references to all background
/// worker interfaces, cache directories, active configurations, and active database connection pools.
pub struct AppState {
    /// ZIM readers registry
    pub zim: Mutex<Vec<Box<dyn ZimReader + Send + Sync>>>,
    /// Active Gemma LLM runtime
    pub llm: Mutex<Box<dyn LlmRuntime + Send + Sync>>,
    /// Active audio encoder backend
    pub audio: Mutex<Box<dyn AudioEncoder + Send + Sync>>,
    /// Active Text-to-Speech engine
    pub tts: Mutex<Box<dyn Tts + Send + Sync>>,
    /// Storage database connection pool
    pub storage: Arc<Storage>,
    /// Entitlement check backend (INV-RC-1)
    pub entitlements: Arc<EntitlementController>,
    /// Platform-specific model weight fetcher (INV-DL-1)
    pub fetcher: Box<dyn ModelFetcher + Send + Sync>,
    /// Active model variant
    pub variant: RwLock<Variant>,
    /// Cached device capability
    pub capability: OnceLock<DeviceCapability>,
    /// Sidecar store
    pub sidecar_store: Arc<SidecarStore>,
    /// Sidecar signer
    pub sidecar_signer: Arc<SidecarSigner>,
    /// Sidecar index
    pub sidecar_index: Arc<SidecarIndex>,
    /// Trust DB
    pub trust_db: Arc<TrustDb>,
    /// Voice clip blob store
    pub voice_blobs: Arc<VoiceClipBlobStore>,
    /// Application paths
    pub paths: Arc<AppPaths>,
    /// Application logger
    pub logger: Arc<EnzimeLogger>,
    /// ZIM pack catalog
    pub pack_catalog: Arc<PackCatalog>,
    /// Application update manager
    pub app_updater: Arc<AppUpdater>,
    /// Window state persistence
    pub window_state_store: Arc<WindowStateStore>,
    /// Global search index
    pub global_searcher: Arc<GlobalSearcher>,
    /// Chunk reassembler for LoRa sidecar transport
    pub chunk_reassembler: Arc<Mutex<ChunkReassembler>>,
}

#[cfg(feature = "play")]
impl AppState {
    /// Build `AppState` for Play Store flavor.
    ///
    /// Wires `PadFetcher` for model weight delivery through Google Play
    /// Asset Delivery.
    ///
    /// # Errors
    ///
    /// Returns `AppError` if any subsystem initialization fails.
    pub fn build_for_play() -> Result<Self, crate::error::AppError> {
        let paths = Arc::new(AppPaths::resolve()?);
        let storage = Arc::new(Storage::open(&paths.data_dir.join("enzime.db"))?);

        let logger = Arc::new(EnzimeLogger::init(&paths)?);

        storage.run_migrations()?;

        let local_verifier = LocalPayloadVerifier {
            public_key: ed25519_dalek::VerifyingKey::from_bytes(ENTITLEMENT_PUBLIC_KEY)
                .map_err(|e| crate::error::AppError::Entitlement(crate::billing::EntitlementError::Backend(e.to_string())))?,
        };
        let entitlements = Arc::new(EntitlementController::new(
            crate::billing::BillingMode::Subscription,
            storage.clone(),
            local_verifier,
        ));

        let fetcher: Box<dyn ModelFetcher + Send + Sync> =
            Box::new(crate::model_fetcher::pad::PadFetcher::new(paths.models_dir.clone()));

        let sidecar_store = Arc::new(SidecarStore::new(paths.sidecars_dir.clone()));
        let sidecar_index = Arc::new(SidecarIndex::new(storage.clone()));

        let sidecar_signer = Arc::new(IdentityKeystore::load_or_create(paths.identity_dir.clone()).map_err(SidecarError::Identity)?);
        let trust_db = Arc::new(TrustDb::new(storage.clone()));
        let voice_blobs = Arc::new(VoiceClipBlobStore { root: paths.voice_blobs_dir.clone() });

        let pack_verifier = PackCatalogManifestVerifier::new(PACK_CATALOG_PUBLIC_KEY)
            .map_err(|e| crate::error::AppError::Fetch(crate::pack_catalog::PackError::Verify(e.to_string())))?;
        let pack_catalog = Arc::new(PackCatalog {
            http: reqwest::Client::new(),
            catalog_url: crate::pack_catalog::PACK_CATALOG_URL.to_string(),
            packs_dir: paths.packs_dir.clone(),
            storage: storage.clone(),
            bundled: crate::pack_catalog::BundledCatalog,
            local: crate::pack_catalog::LocalCatalogLoader,
            media: crate::pack_catalog::PackMediaImporter,
            lan: crate::pack_catalog::LanPeerPackFetcher,
            mirror: MirrorPackFetcher::new(reqwest::Client::new(), paths.packs_dir.clone()),
            verifier: pack_verifier,
        });

        let update_verifier = crate::app_update::UpdateSignatureVerifier::new()
            .map_err(|e| crate::error::AppError::Update(crate::app_update::UpdateError::Verify(e)))?;

        let app_updater = Arc::new(AppUpdater {
            channel: crate::app_update::UpdateChannel {
                http: reqwest::Client::new(),
                base_url: "https://enzime.org/updates",
            },
            verifier: update_verifier,
            current_version: <crate::app_update::Version as std::str::FromStr>::from_str(env!("CARGO_PKG_VERSION")).unwrap_or_else(|_| crate::app_update::Version::new(0, 1, 0)),
        });

        let window_state_store = Arc::new(WindowStateStore { storage: storage.clone() });
        let global_searcher = Arc::new(GlobalSearcher { catalog: pack_catalog.clone() });
        let chunk_reassembler = Arc::new(Mutex::new(ChunkReassembler::new()));

        Ok(Self {
            zim: Mutex::new(Vec::new()),
            llm: Mutex::new(Box::new(crate::ai::null::NullLlm) as Box<dyn LlmRuntime + Send + Sync>),
            audio: Mutex::new(Box::new(crate::ai::null::NullAudioEncoder) as Box<dyn AudioEncoder + Send + Sync>),
            tts: Mutex::new(Box::new(crate::ai::null::NullTts) as Box<dyn Tts + Send + Sync>),
            storage,
            entitlements,
            fetcher,
            variant: RwLock::new(Variant::GemmaE2bQ4),
            capability: OnceLock::new(),
            sidecar_store,
            sidecar_signer,
            sidecar_index,
            trust_db,
            voice_blobs,
            paths,
            logger,
            pack_catalog,
            app_updater,
            window_state_store,
            global_searcher,
            chunk_reassembler,
        })
    }
}

#[cfg(feature = "sideload")]
impl AppState {
    /// Build `AppState` for sideload flavor.
    ///
    /// Wires `MirrorFetcher` for model weight delivery through HTTPS downloads
    /// from the mirror server.
    ///
    /// # Errors
    ///
    /// Returns `AppError` if any subsystem initialization fails.
    pub fn build_for_sideload() -> Result<Self, crate::error::AppError> {
        let paths = Arc::new(AppPaths::resolve()?);
        let storage = Arc::new(Storage::open(&paths.data_dir.join("enzime.db"))?);

        let logger = Arc::new(EnzimeLogger::init(&paths)?);

        storage.run_migrations()?;

        let local_verifier = LocalPayloadVerifier {
            public_key: ed25519_dalek::VerifyingKey::from_bytes(ENTITLEMENT_PUBLIC_KEY)
                .map_err(|e| crate::error::AppError::Entitlement(crate::billing::EntitlementError::Backend(e.to_string())))?,
        };
        let entitlements = Arc::new(EntitlementController::new(
            crate::billing::BillingMode::CustomArtifact,
            storage.clone(),
            local_verifier,
        ));

        let verifier = MirrorManifestVerifier::new(MIRROR_PUBLIC_KEY)
            .map_err(|e| crate::error::AppError::Fetch(crate::model_fetcher::FetchError::Verify(e.to_string())))?;

        let fetcher: Box<dyn ModelFetcher + Send + Sync> =
            Box::new(crate::model_fetcher::mirror::MirrorFetcher::new(
                reqwest::Client::new(),
                verifier,
                paths.models_dir.clone(),
            ));

        let sidecar_store = Arc::new(SidecarStore::new(paths.sidecars_dir.clone()));
        let sidecar_index = Arc::new(SidecarIndex::new(storage.clone()));

        let sidecar_signer = Arc::new(IdentityKeystore::load_or_create(paths.identity_dir.clone()).map_err(SidecarError::Identity)?);
        let trust_db = Arc::new(TrustDb::new(storage.clone()));
        let voice_blobs = Arc::new(VoiceClipBlobStore { root: paths.voice_blobs_dir.clone() });

        let pack_verifier = PackCatalogManifestVerifier::new(PACK_CATALOG_PUBLIC_KEY)
            .map_err(|e| crate::error::AppError::Fetch(crate::pack_catalog::PackError::Verify(e.to_string())))?;
        let pack_catalog = Arc::new(PackCatalog {
            http: reqwest::Client::new(),
            catalog_url: crate::pack_catalog::PACK_CATALOG_URL.to_string(),
            packs_dir: paths.packs_dir.clone(),
            storage: storage.clone(),
            bundled: crate::pack_catalog::BundledCatalog,
            local: crate::pack_catalog::LocalCatalogLoader,
            media: crate::pack_catalog::PackMediaImporter,
            lan: crate::pack_catalog::LanPeerPackFetcher,
            mirror: MirrorPackFetcher::new(reqwest::Client::new(), paths.packs_dir.clone()),
            verifier: pack_verifier,
        });

        let update_verifier = crate::app_update::UpdateSignatureVerifier::new()
            .map_err(|e| crate::error::AppError::Update(crate::app_update::UpdateError::Verify(e)))?;

        let app_updater = Arc::new(AppUpdater {
            channel: crate::app_update::UpdateChannel {
                http: reqwest::Client::new(),
                base_url: "https://enzime.org/updates",
            },
            verifier: update_verifier,
            current_version: <crate::app_update::Version as std::str::FromStr>::from_str(env!("CARGO_PKG_VERSION")).unwrap_or_else(|_| crate::app_update::Version::new(0, 1, 0)),
        });

        let window_state_store = Arc::new(WindowStateStore { storage: storage.clone() });
        let global_searcher = Arc::new(GlobalSearcher { catalog: pack_catalog.clone() });
        let chunk_reassembler = Arc::new(Mutex::new(ChunkReassembler::new()));

        Ok(Self {
            zim: Mutex::new(Vec::new()),
            llm: Mutex::new(Box::new(crate::ai::null::NullLlm) as Box<dyn LlmRuntime + Send + Sync>),
            audio: Mutex::new(Box::new(crate::ai::null::NullAudioEncoder) as Box<dyn AudioEncoder + Send + Sync>),
            tts: Mutex::new(Box::new(crate::ai::null::NullTts) as Box<dyn Tts + Send + Sync>),
            storage,
            entitlements,
            fetcher,
            variant: RwLock::new(Variant::GemmaE2bQ4),
            capability: OnceLock::new(),
            sidecar_store,
            sidecar_signer,
            sidecar_index,
            trust_db,
            voice_blobs,
            paths,
            logger,
            pack_catalog,
            app_updater,
            window_state_store,
            global_searcher,
            chunk_reassembler,
        })
    }
}

#[cfg(feature = "desktop")]
impl AppState {
    /// Build `AppState` for desktop flavor.
    ///
    /// Wires `MirrorFetcher` for model weight delivery through HTTPS downloads
    /// from the mirror server.
    ///
    /// # Errors
    ///
    /// Returns `AppError` if any subsystem initialization fails.
    pub fn build_for_desktop() -> Result<Self, crate::error::AppError> {
        let paths = Arc::new(AppPaths::resolve()?);
        let storage = Arc::new(Storage::open(&paths.data_dir.join("enzime.db"))?);

        let logger = Arc::new(EnzimeLogger::init(&paths)?);

        storage.run_migrations()?;

        let local_verifier = LocalPayloadVerifier {
            public_key: ed25519_dalek::VerifyingKey::from_bytes(ENTITLEMENT_PUBLIC_KEY)
                .map_err(|e| crate::error::AppError::Entitlement(crate::billing::EntitlementError::Backend(e.to_string())))?,
        };
        let entitlements = Arc::new(EntitlementController::new(
            crate::billing::BillingMode::Perpetual,
            storage.clone(),
            local_verifier,
        ));

        let verifier = MirrorManifestVerifier::new(MIRROR_PUBLIC_KEY)
            .map_err(|e| crate::error::AppError::Fetch(crate::model_fetcher::FetchError::Verify(e.to_string())))?;

        let fetcher: Box<dyn ModelFetcher + Send + Sync> =
            Box::new(crate::model_fetcher::mirror::MirrorFetcher::new(
                reqwest::Client::new(),
                verifier,
                paths.models_dir.clone(),
            ));

        let sidecar_store = Arc::new(SidecarStore::new(paths.sidecars_dir.clone()));
        let sidecar_index = Arc::new(SidecarIndex::new(storage.clone()));

        let sidecar_signer = Arc::new(IdentityKeystore::load_or_create(paths.identity_dir.clone()).map_err(SidecarError::Identity)?);
        let trust_db = Arc::new(TrustDb::new(storage.clone()));
        let voice_blobs = Arc::new(VoiceClipBlobStore { root: paths.voice_blobs_dir.clone() });

        let pack_verifier = PackCatalogManifestVerifier::new(PACK_CATALOG_PUBLIC_KEY)
            .map_err(|e| crate::error::AppError::Fetch(crate::pack_catalog::PackError::Verify(e.to_string())))?;
        let pack_catalog = Arc::new(PackCatalog {
            http: reqwest::Client::new(),
            catalog_url: crate::pack_catalog::PACK_CATALOG_URL.to_string(),
            packs_dir: paths.packs_dir.clone(),
            storage: storage.clone(),
            bundled: crate::pack_catalog::BundledCatalog,
            local: crate::pack_catalog::LocalCatalogLoader,
            media: crate::pack_catalog::PackMediaImporter,
            lan: crate::pack_catalog::LanPeerPackFetcher,
            mirror: MirrorPackFetcher::new(reqwest::Client::new(), paths.packs_dir.clone()),
            verifier: pack_verifier,
        });

        let update_verifier = crate::app_update::UpdateSignatureVerifier::new()
            .map_err(|e| crate::error::AppError::Update(crate::app_update::UpdateError::Verify(e)))?;

        let app_updater = Arc::new(AppUpdater {
            channel: crate::app_update::UpdateChannel {
                http: reqwest::Client::new(),
                base_url: "https://enzime.org/updates",
            },
            verifier: update_verifier,
            current_version: <crate::app_update::Version as std::str::FromStr>::from_str(env!("CARGO_PKG_VERSION")).unwrap_or_else(|_| crate::app_update::Version::new(0, 1, 0)),
        });

        let window_state_store = Arc::new(WindowStateStore { storage: storage.clone() });
        let global_searcher = Arc::new(GlobalSearcher { catalog: pack_catalog.clone() });
        let chunk_reassembler = Arc::new(Mutex::new(ChunkReassembler::new()));

        Ok(Self {
            zim: Mutex::new(Vec::new()),
            llm: Mutex::new(Box::new(crate::ai::null::NullLlm) as Box<dyn LlmRuntime + Send + Sync>),
            audio: Mutex::new(Box::new(crate::ai::null::NullAudioEncoder) as Box<dyn AudioEncoder + Send + Sync>),
            tts: Mutex::new(Box::new(crate::ai::null::NullTts) as Box<dyn Tts + Send + Sync>),
            storage,
            entitlements,
            fetcher,
            variant: RwLock::new(Variant::GemmaE2bQ4),
            capability: OnceLock::new(),
            sidecar_store,
            sidecar_signer,
            sidecar_index,
            trust_db,
            voice_blobs,
            paths,
            logger,
            pack_catalog,
            app_updater,
            window_state_store,
            global_searcher,
            chunk_reassembler,
        })
    }
}

impl AppState {
    /// Register an opened ZIM file and return its handle.
    ///
    /// The handle is a stable index into the ZIM registry for the lifetime
    /// of the application session.
    pub fn push_zim(&self, zim: Box<dyn ZimReader + Send + Sync>) -> u64 {
        let mut registry = self.zim.lock().unwrap();
        let handle = registry.len() as u64;
        registry.push(zim);
        handle
    }

    /// Replace the LLM runtime at runtime.
    ///
    /// Swaps out the current Gemma 4 e2b implementation for a new one.
    pub fn swap_llm(&self, llm: Box<dyn LlmRuntime + Send + Sync>) {
        let mut runtime = self.llm.lock().unwrap();
        *runtime = llm;
    }

    /// Read the currently-active build variant.
    ///
    /// Returns a clone of the active `Variant` (play, sideload, or desktop).
    pub fn current_variant(&self) -> Variant {
        self.variant.read().unwrap().clone()
    }
}
