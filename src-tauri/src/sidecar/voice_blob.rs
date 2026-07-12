use sha2::{Digest, Sha256};
use std::fs;
use std::io;
use std::path::PathBuf;

/// Filesystem blob store for voice notes referenced by `VoiceNoteCollectionBody`.
/// Content-addressed by sha256.
pub struct VoiceClipBlobStore {
    pub root: PathBuf,
}

impl VoiceClipBlobStore {
    /// Write a blob and return its sha256 hash.
    pub fn write(&self, data: &[u8]) -> Result<[u8; 32], io::Error> {
        let hash = Sha256::digest(data);
        let hash_array: [u8; 32] = hash.into();

        let hex_name = hex::encode(&hash_array);
        let mut path = self.root.clone();
        path.push(&hex_name[..2]);
        path.push(&hex_name[2..]);

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&path, data)?;

        Ok(hash_array)
    }

    /// Read a blob by its sha256 hash.
    pub fn read(&self, hash: [u8; 32]) -> Result<Vec<u8>, io::Error> {
        let hex_name = hex::encode(hash);
        let mut path = self.root.clone();
        path.push(&hex_name[..2]);
        path.push(&hex_name[2..]);

        fs::read(&path)
    }

    /// Delete a blob by its sha256 hash.
    pub fn delete(&self, hash: [u8; 32]) -> Result<(), io::Error> {
        let hex_name = hex::encode(hash);
        let mut path = self.root.clone();
        path.push(&hex_name[..2]);
        path.push(&hex_name[2..]);

        fs::remove_file(&path)
    }
}
