use thiserror::Error;

pub use crate::ai::AiError;
pub use anzimmermanlib::ZimError;
pub use crate::storage::StorageError;
pub use crate::billing::EntitlementError;
pub use crate::model_fetcher::FetchError;
pub use crate::sidecar::SidecarError;
pub use crate::app_update::UpdateError;
pub use crate::paths::PathError;
pub use crate::log::LogError;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("AI error: {0}")]
    Ai(#[from] AiError),

    #[error("ZIM error: {0}")]
    Zim(#[from] ZimError),

    #[error("Storage error: {0}")]
    Storage(#[from] StorageError),

    #[error("Entitlement error: {0}")]
    Entitlement(#[from] EntitlementError),

    #[error("Fetch error: {0}")]
    Fetch(#[from] FetchError),

    #[error("Sidecar error: {0}")]
    Sidecar(#[from] SidecarError),

    #[error("Update error: {0}")]
    Update(#[from] UpdateError),

    #[error("Path error: {0}")]
    Path(#[from] PathError),

    #[error("Log error: {0}")]
    Log(#[from] LogError),
}
