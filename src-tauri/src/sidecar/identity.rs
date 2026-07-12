use std::io::Write;
use std::path::PathBuf;

use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use thiserror::Error;

use crate::sidecar::sign::SidecarSigner;

#[derive(Debug, Error)]
pub enum IdentityError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Crypto error: {0}")]
    Crypto(String),
}

/// Per-installation ed25519 keypair storage
///
/// Manages the persistent signing key for sidecar identity. The key is
/// stored on disk at `<data_dir>/identity/signing-key.bin` with 0600
/// permissions (owner-read/write only).
pub struct IdentityKeystore {
    /// Path to the signing key file
    path: PathBuf,
}

impl IdentityKeystore {
    /// Load an existing key or create a new one
    ///
    /// If the key file exists, loads the 32-byte seed and returns a
    /// `SidecarSigner`. If not, generates a new random seed, saves it
    /// to disk with 0600 permissions, and returns the signer.
    ///
    /// # Arguments
    /// * `dir` - Directory containing `signing-key.bin`
    pub fn load_or_create(dir: PathBuf) -> Result<SidecarSigner, IdentityError> {
        let path = dir.join("signing-key.bin");

        if path.exists() {
            // Load existing key
            let seed = std::fs::read(&path)?;
            if seed.len() != 32 {
                return Err(IdentityError::Crypto(
                    "Invalid key length: expected 32 bytes".to_string(),
                ));
            }
            let mut seed_array = [0u8; 32];
            seed_array.copy_from_slice(&seed);
            Ok(SidecarSigner::from_seed(&seed_array))
        } else {
            // Create new key
            let seed: [u8; 32] = SigningKey::generate(&mut OsRng).to_bytes();
            {
                let mut file = std::fs::File::create(&path)?;
                // Set 0600 permissions (owner read/write only)
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perm = file.metadata()?.permissions();
                    perm.set_mode(0o600);
                    file.set_permissions(perm)?;
                }
                file.write_all(&seed)?;
                file.sync_all()?;
            }
            Ok(SidecarSigner::from_seed(&seed))
        }
    }
}
