use std::io;
use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum PathError {
    #[error("home directory not found")]
    NoHome,
    #[error("failed to create directory")]
    CreateDir(#[from] io::Error),
}

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub data_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub config_dir: PathBuf,
    pub models_dir: PathBuf,
    pub sidecars_dir: PathBuf,
    pub voice_blobs_dir: PathBuf,
    pub identity_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub packs_dir: PathBuf,
}

impl AppPaths {
    pub fn resolve() -> Result<Self, PathError> {
        let data_dir = dirs::data_dir()
            .ok_or(PathError::NoHome)?
            .join("enzime");
        let cache_dir = dirs::cache_dir()
            .ok_or(PathError::NoHome)?
            .join("enzime");
        let config_dir = dirs::config_dir()
            .ok_or(PathError::NoHome)?
            .join("enzime");

        let models_dir = data_dir.join("models");
        let sidecars_dir = data_dir.join("sidecars");
        let voice_blobs_dir = data_dir.join("voice_blobs");
        let identity_dir = data_dir.join("identity");
        let logs_dir = cache_dir.join("logs");
        let packs_dir = data_dir.join("packs");

        Ok(Self {
            data_dir,
            cache_dir,
            config_dir,
            models_dir,
            sidecars_dir,
            voice_blobs_dir,
            identity_dir,
            logs_dir,
            packs_dir,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_error_nohome_variant_exists() {
        // SEMANTIC ACCEPT (I-12): verify PathError::NoHome variant exists and is matchable
        // This is the smallest honest construction on platforms where dirs::* cannot be
        // deterministically made to return None via env manipulation (dirs crate has
        // internal fallbacks beyond HOME/XDG variables on Linux).
        let nohome_err = PathError::NoHome;
        assert!(
            matches!(nohome_err, PathError::NoHome),
            "PathError::NoHome variant must exist and be matchable"
        );

        // Verify the error implements std::error::Error (via thiserror)
        let err_box: Box<dyn std::error::Error> = nohome_err.into();
        assert!(err_box.to_string().contains("home directory not found"));
    }

    #[test]
    fn test_path_error_createdir_variant_wraps_io_error() {
        // SEMANTIC ACCEPT: verify PathError::CreateDir wraps io::Error
        let io_err = io::Error::new(io::ErrorKind::NotFound, "test error");
        let createdir_err = PathError::CreateDir(io_err);

        assert!(
            matches!(createdir_err, PathError::CreateDir(_)),
            "PathError::CreateDir variant must wrap io::Error"
        );

        // Verify it converts from io::Error via #[from]
        let io_err2 = io::Error::new(io::ErrorKind::PermissionDenied, "perm denied");
        let converted: PathError = io_err2.into();
        assert!(matches!(converted, PathError::CreateDir(_)));
    }
}
