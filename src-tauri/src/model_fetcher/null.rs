use std::path::PathBuf;

use crate::ai::probe::Variant;
use crate::model_fetcher::{DownloadProgress, FetchError, ModelFetcher};

/// Null fetcher that assumes model weights are already on disk.
///
/// Used for the "preloaded or already-downloaded" runtime state where
/// models are bundled with the application or have been previously
/// downloaded and verified.
pub struct NullFetcher {
    /// Directory containing model weight files.
    pub models_dir: PathBuf,
}

impl NullFetcher {
    /// Create a new null fetcher with the given models directory.
    pub fn new(models_dir: PathBuf) -> Self {
        Self { models_dir }
    }

    /// Get the expected path for a given variant.
    fn variant_path(&self, variant: Variant) -> PathBuf {
        self.models_dir.join(format!("{}.bin", variant.name().to_lowercase()))
    }
}

#[async_trait::async_trait]
impl ModelFetcher for NullFetcher {
    /// Return the path to the model if it exists on disk.
    ///
    /// Emits a single `Done` progress event and returns the path.
    /// Returns an error if the model file is not found.
    async fn fetch(
        &self,
        variant: Variant,
        _progress: crate::model_fetcher::Channel<DownloadProgress>,
    ) -> Result<PathBuf, FetchError> {
        let path = self.variant_path(variant);

        if path.exists() {
            Ok(path)
        } else {
            Err(FetchError::Storage(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("model not found: {}", path.display()),
            )))
        }
    }

    /// Check if the model file exists for the given variant.
    fn is_present(&self, variant: Variant) -> bool {
        self.variant_path(variant).exists()
    }
}
