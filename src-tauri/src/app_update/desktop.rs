use crate::app_update::{UpdateError, UpdateManifest};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;

/// Platform-specific update application for desktop (Linux AppImage / Windows MSI)
///
/// E-UPD-8: apply_desktop at app_update/desktop.rs:6
/// Downloads the update artifact, verifies SHA-256 and size, then performs
/// platform-specific installation (Linux AppImage swap / Windows MSI installer).
pub fn apply_desktop(_updater: &crate::app_update::AppUpdater, manifest: &UpdateManifest) -> Result<(), UpdateError> {
    // Download the artifact to a temporary location
    let temp_path = download_artifact(&manifest.artifact_url)?;

    // Verify SHA-256 hash matches the signed manifest
    verify_sha256(&temp_path, &manifest.sha256)?;

    // Verify file size matches the signed manifest (defense-in-depth)
    verify_size(&temp_path, manifest.size_bytes)?;

    // Perform platform-specific installation
    #[cfg(target_os = "linux")]
    {
        install_appimage(&temp_path)?;
    }

    #[cfg(target_os = "windows")]
    {
        install_msi(&temp_path)?;
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        return Err(UpdateError::NotImplementedOnPlatform);
    }

    Ok(())
}

/// Download the update artifact to a temporary file
fn download_artifact(url: &str) -> Result<PathBuf, UpdateError> {
    let response = reqwest::blocking::get(url)
        .map_err(|e| UpdateError::Network(format!("Failed to download artifact: {}", e)))?;

    if !response.status().is_success() {
        return Err(UpdateError::Network(format!(
            "Failed to download artifact: HTTP {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .map_err(|e| UpdateError::Network(format!("Failed to read response body: {}", e)))?;

    // Create a temporary file to store the downloaded artifact
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join(format!("enzime-update-{}", std::process::id()));

    let mut file = File::create(&temp_path)
        .map_err(|e| UpdateError::Storage(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to create temp file: {}", e))))?;

    file.write_all(&bytes)
        .map_err(|e| UpdateError::Storage(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to write temp file: {}", e))))?;

    Ok(temp_path)
}

/// Verify the downloaded file's SHA-256 hash matches the expected value
fn verify_sha256(path: &PathBuf, expected_sha256: &[u8; 32]) -> Result<(), UpdateError> {
    let contents = std::fs::read(path)
        .map_err(|e| UpdateError::Storage(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to read artifact for hash verification: {}", e))))?;

    let mut hasher = Sha256::new();
    hasher.update(&contents);
    let result = hasher.finalize();

    if result.as_slice() != expected_sha256.as_slice() {
        return Err(UpdateError::Verify(super::VerifyError::InvalidSignature));
    }

    Ok(())
}

/// Verify the downloaded file's size matches the expected value (defense-in-depth)
fn verify_size(path: &PathBuf, expected_size: u64) -> Result<(), UpdateError> {
    let metadata = std::fs::metadata(path)
        .map_err(|e| UpdateError::Storage(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to read artifact metadata: {}", e))))?;

    let actual_size = metadata.len();

    if actual_size != expected_size {
        return Err(UpdateError::Network(format!(
            "Size mismatch: expected {} bytes, got {} bytes",
            expected_size, actual_size
        )));
    }

    Ok(())
}

/// Install Linux AppImage update (atomic replace + re-exec)
#[cfg(target_os = "linux")]
fn install_appimage(_artifact_path: &PathBuf) -> Result<(), UpdateError> {
    // TODO: Implement AppImage atomic swap and re-exec
    // This requires:
    // 1. Identify current AppImage path (from /proc/self/exe or env)
    // 2. Move new AppImage to a staging location
    // 3. Atomic replace (rename over)
    // 4. Re-execute with same arguments
    // I-10(b): swap when E-UPD-8 AppImage swap wiring lands
    Err(UpdateError::NotImplementedOnPlatform)
}

/// Install Windows MSI update (spawn installer + exit)
#[cfg(target_os = "windows")]
fn install_msi(_artifact_path: &PathBuf) -> Result<(), UpdateError> {
    // TODO: Implement MSI installer spawn and clean exit
    // This requires:
    // 1. Spawn MSI installer with /passive or /quiet flags
    // 2. Exit current process (installer will handle restart)
    // I-10(b): swap when E-UPD-8 MSI installer wiring lands
    Err(UpdateError::NotImplementedOnPlatform)
}
