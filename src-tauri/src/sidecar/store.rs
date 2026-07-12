use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use thiserror::Error;

use crate::sidecar::codec::{CodecError, SidecarCodec};
use crate::sidecar::verify::{SidecarVerifyError, VerifiedSidecar};
use crate::sidecar::Sidecar;
use crate::storage::Storage;

/// Store error
#[derive(Error, Debug)]
pub enum StoreError {
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    #[error("codec error: {0}")]
    Codec(CodecError),

    #[error("verify error: {0}")]
    Verify(SidecarVerifyError),
}

/// Filesystem-of-truth for sidecar artifacts
#[derive(Debug, Clone)]
pub struct SidecarStore {
    pub root: PathBuf,
}

impl SidecarStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn write(&self, sidecar: &VerifiedSidecar) -> Result<PathBuf, StoreError> {
        // Encode the sidecar to CBOR
        let bytes = SidecarCodec::encode_cbor(&sidecar.inner)
            .map_err(StoreError::Codec)?;

        // Build the target path: <root>/<zim_uuid>/<artifact_id>.zsc
        let zim_dir = self.root.join(hex::encode(sidecar.inner.zim_uuid));
        let target_path = zim_dir.join(format!("{}.zsc", hex::encode(sidecar.inner.artifact_id)));

        // Ensure the ZIM directory exists
        fs::create_dir_all(&zim_dir)?;

        // Write to a temporary file first, then rename for atomicity
        let temp_path = zim_dir.join(format!("{}.zsc.tmp", hex::encode(sidecar.inner.artifact_id)));
        fs::write(&temp_path, bytes)?;

        // Atomic rename
        fs::rename(&temp_path, &target_path)?;

        Ok(target_path)
    }

    pub fn read(&self, artifact_id: [u8; 16], zim_uuid: [u8; 16]) -> Result<Sidecar, StoreError> {
        // Build the file path: <root>/<zim_uuid>/<artifact_id>.zsc
        let zim_dir = self.root.join(hex::encode(zim_uuid));
        let file_path = zim_dir.join(format!("{}.zsc", hex::encode(artifact_id)));

        // Read the file bytes
        let bytes = fs::read(&file_path)?;

        // Decode from CBOR
        let sidecar = SidecarCodec::decode_cbor(&bytes)
            .map_err(StoreError::Codec)?;

        Ok(sidecar)
    }

    pub fn list_for_zim(&self, zim_uuid: [u8; 16]) -> Result<Vec<PathBuf>, StoreError> {
        // Build the ZIM directory path
        let zim_dir = self.root.join(hex::encode(zim_uuid));

        // Ensure the directory exists
        if !zim_dir.exists() {
            return Ok(Vec::new());
        }

        // Enumerate all .zsc files in the directory
        let mut paths = Vec::new();
        for entry in fs::read_dir(&zim_dir)? {
            let entry = entry?;
            let path = entry.path();

            // Filter for .zsc files
            if path.extension().and_then(|s| s.to_str()) == Some("zsc") {
                paths.push(path);
            }
        }

        Ok(paths)
    }

    pub fn delete(&self, artifact_id: [u8; 16], zim_uuid: [u8; 16]) -> Result<(), StoreError> {
        // Build the file path: <root>/<zim_uuid>/<artifact_id>.zsc
        let zim_dir = self.root.join(hex::encode(zim_uuid));
        let file_path = zim_dir.join(format!("{}.zsc", hex::encode(artifact_id)));

        // Remove the file
        fs::remove_file(&file_path)?;

        Ok(())
    }
}

/// Index row
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SidecarMeta {
    pub artifact_id: [u8; 16],
    pub zim_uuid: [u8; 16],
    pub kind: String,
    pub signer_pubkey: [u8; 32],
    pub created_at: i64,
    pub path: PathBuf,
}

/// SQLite-indexed cache (derived from files)
#[derive(Debug, Clone)]
pub struct SidecarIndex {
    pub storage: Arc<Storage>,
}

impl SidecarIndex {
    pub fn new(storage: Arc<Storage>) -> Self {
        // I-10(b): swap DDL owner to §7.5 storage if orchestrator relocates it
        let index = Self { storage };
        index.init_table();
        index
    }

    /// Initialize the sidecar_index table idempotently
    fn init_table(&self) {
        let _ = self.storage.with_conn(|conn| {
            conn.execute(
                "CREATE TABLE IF NOT EXISTS sidecar_index (
                    artifact_id BLOB NOT NULL,
                    zim_uuid BLOB NOT NULL,
                    kind TEXT NOT NULL,
                    signer_pubkey BLOB NOT NULL,
                    created_at INTEGER NOT NULL,
                    path TEXT NOT NULL,
                    PRIMARY KEY (artifact_id, zim_uuid)
                )",
                [],
            )?;
            // Create index for URL-based lookups
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sidecar_zim_uuid ON sidecar_index(zim_uuid)",
                [],
            )?;
            Ok::<_, rusqlite::Error>(())
        });
    }

    pub fn rebuild_from_files(&self, store: &SidecarStore) -> Result<u32, StoreError> {
        // Clear existing index
        self.storage.with_conn(|conn| {
            conn.execute("DELETE FROM sidecar_index", [])?;
            Ok::<_, rusqlite::Error>(())
        })?;

        let mut count = 0u32;

        // Scan the store directory for sidecar files
        let entries = fs::read_dir(&store.root)?;
        for entry in entries {
            let entry = entry?;
            let zim_dir = entry.path();

            // Skip non-directories
            if !zim_dir.is_dir() {
                continue;
            }

            // Enumerate .zsc files in each ZIM directory
            let scf_entries = fs::read_dir(&zim_dir)?;
            for scf_entry in scf_entries {
                let scf_entry = scf_entry?;
                let path = scf_entry.path();

                // Skip directories and non-.zsc files
                if path.is_dir() || path.extension().and_then(|s| s.to_str()) != Some("zsc") {
                    continue;
                }

                // Read and decode the sidecar file
                let bytes = fs::read(&path)?;
                let sidecar = SidecarCodec::decode_cbor(&bytes)
                    .map_err(StoreError::Codec)?;

                // Extract metadata
                let artifact_id = sidecar.artifact_id;
                let zim_uuid = sidecar.zim_uuid;
                let kind = payload_kind(&sidecar.payload);
                let signer_pubkey = sidecar.signature_envelope
                    .as_ref()
                    .map(|env| env.pubkey)
                    .unwrap_or(sidecar.author.pubkey);
                let created_at = sidecar.created_at;
                let path_str = path.to_string_lossy().to_string();

                // Upsert into the index
                self.storage.with_conn(|conn| {
                    conn.execute(
                        "INSERT OR REPLACE INTO sidecar_index
                         (artifact_id, zim_uuid, kind, signer_pubkey, created_at, path)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        [
                            &artifact_id.as_slice(),
                            &zim_uuid.as_slice(),
                            &kind.as_str(),
                            &signer_pubkey.as_slice(),
                            &created_at,
                            &path_str.as_str(),
                        ],
                    )?;
                    Ok::<_, rusqlite::Error>(())
                })?;

                count += 1;
            }
        }

        Ok(count)
    }

    pub fn find_for_url(&self, zim_uuid: [u8; 16], url: &str) -> Result<Vec<SidecarMeta>, StoreError> {
        let metas = self.storage.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT artifact_id, zim_uuid, kind, signer_pubkey, created_at, path
                 FROM sidecar_index
                 WHERE zim_uuid = ?1"
            )?;

            let rows = stmt.query_map([zim_uuid.as_slice()], |row| {
                Ok(SidecarMeta {
                    artifact_id: row.get::<_, [u8; 16]>(0)?,
                    zim_uuid: row.get::<_, [u8; 16]>(1)?,
                    kind: row.get(2)?,
                    signer_pubkey: row.get::<_, [u8; 32]>(3)?,
                    created_at: row.get(4)?,
                    path: PathBuf::from(row.get::<_, String>(5)?),
                })
            })?;

            let mut results = Vec::new();
            for row in rows {
                let meta = row?;
                // Filter by URL prefix if provided
                if url.is_empty() || meta.path.to_string_lossy().contains(url) {
                    results.push(meta);
                }
            }
            Ok::<_, rusqlite::Error>(results)
        })?;

        Ok(metas)
    }
}

/// Extract a kind string from a Payload
fn payload_kind(payload: &crate::sidecar::Payload) -> String {
    use crate::sidecar::Payload;
    match payload {
        Payload::AnnotationSet(_) => "annotation_set".to_string(),
        Payload::BookmarkSet(_) => "bookmark_set".to_string(),
        Payload::ReadingLog(_) => "reading_log".to_string(),
        Payload::ComprehensionResponse(_) => "comprehension_response".to_string(),
        Payload::VoiceNoteCollection(_) => "voice_note_collection".to_string(),
        Payload::TrustMarkUpdate(_) => "trust_mark_update".to_string(),
        Payload::Manifest(_) => "manifest".to_string(),
        Payload::Unknown { kind, .. } => kind.clone(),
    }
}
