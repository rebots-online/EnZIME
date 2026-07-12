use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;

use crate::storage::{Storage, StorageError};
use crate::sidecar::payload::TrustMarkUpdateBody;

/// Trust DB error
#[derive(Debug, Error)]
pub enum TrustError {
    #[error("Storage error: {0}")]
    Storage(#[from] StorageError),
}

/// Trust enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrustLevel {
    Trusted,
    Verified,
    Rejected,
    Unknown,
}

/// Local peer-trust registry
pub struct TrustDb {
    storage: Arc<Storage>,
}

impl TrustDb {
    /// Create a new trust database
    pub fn new(storage: Arc<Storage>) -> Self {
        Self { storage }
    }

    /// Get trust level for a public key
    pub fn get(&self, pubkey: &[u8; 32]) -> Result<Option<TrustLevel>, TrustError> {
        self.storage.with_conn(|conn| {
            let mut stmt = conn.prepare_cached(
                "SELECT level FROM trust WHERE pubkey = ? AND (expires_at IS NULL OR expires_at > strftime('%s', 'now')) LIMIT 1"
            )?;

            let mut rows = stmt.query(rusqlite::params![pubkey.as_slice()])?;

            if let Some(row) = rows.next()? {
                let level: String = row.get(0)?;
                let level_enum = match level.as_str() {
                    "Trusted" => TrustLevel::Trusted,
                    "Verified" => TrustLevel::Verified,
                    "Rejected" => TrustLevel::Rejected,
                    "Unknown" => TrustLevel::Unknown,
                    _ => return Err(StorageError::Sql(rusqlite::Error::InvalidColumnType(0, "invalid trust level".into(), rusqlite::types::Type::Text))),
                };
                Ok(Some(level_enum))
            } else {
                Ok(None)
            }
        }).map_err(TrustError::Storage)
    }

    /// Set trust level for a public key
    pub fn set(
        &self,
        pubkey: [u8; 32],
        level: TrustLevel,
        scope: Option<&str>,
        expires_at: Option<i64>,
        reason: Option<&str>,
    ) -> Result<(), TrustError> {
        let level_str = match level {
            TrustLevel::Trusted => "Trusted",
            TrustLevel::Verified => "Verified",
            TrustLevel::Rejected => "Rejected",
            TrustLevel::Unknown => "Unknown",
        };

        self.storage.with_conn(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO trust (pubkey, level, scope, expires_at, reason, source)
                 VALUES (?, ?, ?, ?, ?, 'Manual')",
                rusqlite::params![pubkey.as_slice(), level_str, scope, expires_at, reason],
            )?;
            Ok(())
        }).map_err(TrustError::Storage)
    }

    /// List all trust entries
    pub fn list(&self) -> Result<Vec<TrustEntry>, TrustError> {
        self.storage.with_conn(|conn| {
            let mut stmt = conn.prepare_cached(
                "SELECT pubkey, level, scope, expires_at, reason, source FROM trust"
            )?;

            let rows = stmt.query_map([], |row| {
                let level_str: String = row.get(1)?;
                let level = match level_str.as_str() {
                    "Trusted" => TrustLevel::Trusted,
                    "Verified" => TrustLevel::Verified,
                    "Rejected" => TrustLevel::Rejected,
                    "Unknown" => TrustLevel::Unknown,
                    _ => return Err(rusqlite::Error::InvalidColumnType(1, "invalid trust level".into(), rusqlite::types::Type::Text)),
                };

                let source_str: String = row.get(5)?;
                let source = match source_str.as_str() {
                    "Manual" => TrustSource::Manual,
                    "Operator" => TrustSource::Operator,
                    _ => {
                        if let Some(hex) = source_str.strip_prefix("Gossip:") {
                            let mut bytes = [0u8; 32];
                            hex::decode_to_slice(hex, &mut bytes).map_err(|_| {
                                rusqlite::Error::InvalidColumnType(5, "invalid gossip pubkey".into(), rusqlite::types::Type::Text)
                            })?;
                            TrustSource::Gossip { from_pubkey: bytes }
                        } else {
                            return Err(rusqlite::Error::InvalidColumnType(5, "invalid trust source".into(), rusqlite::types::Type::Text));
                        }
                    }
                };

                let pubkey_vec: Vec<u8> = row.get(0)?;
                let pubkey: [u8; 32] = pubkey_vec.try_into().map_err(|_| {
                    rusqlite::Error::InvalidColumnType(0, "pubkey not 32 bytes".into(), rusqlite::types::Type::Blob)
                })?;

                Ok(TrustEntry {
                    pubkey,
                    level,
                    scope: row.get(2)?,
                    expires_at: row.get(3)?,
                    reason: row.get(4)?,
                    source,
                })
            })?;

            let mut entries = Vec::new();
            for row in rows {
                entries.push(row?);
            }
            Ok(entries)
        }).map_err(TrustError::Storage)
    }

    /// Apply a gossip trust update
    pub fn apply_gossip(&self, update: &TrustMarkUpdateBody, from_pubkey: [u8; 32]) -> Result<u32, TrustError> {
        self.storage.with_conn(|conn| {
            let mut applied = 0;
            for entry in &update.marks {
                let level_str = match entry.level {
                    crate::sidecar::payload::TrustLevel::Trusted => "Trusted",
                    crate::sidecar::payload::TrustLevel::Verified => "Verified",
                    crate::sidecar::payload::TrustLevel::Rejected => "Rejected",
                    crate::sidecar::payload::TrustLevel::Unknown => "Unknown",
                };
                let source = format!("Gossip:{}", hex::encode(from_pubkey));

                conn.execute(
                    "INSERT INTO trust (pubkey, level, scope, expires_at, reason, source)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT(pubkey) DO UPDATE SET
                     level = excluded.level,
                     scope = excluded.scope,
                     expires_at = excluded.expires_at,
                     reason = excluded.reason,
                     source = excluded.source",
                    rusqlite::params![
                        entry.pubkey.as_slice(),
                        level_str,
                        entry.scope.as_deref(),
                        entry.expires_at,
                        entry.reason.as_deref(),
                        source,
                    ],
                )?;
                applied += 1;
            }
            Ok(applied)
        }).map_err(TrustError::Storage)
    }
}

/// Source of a trust entry
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrustSource {
    /// Manually set by local user
    Manual,
    /// Received via gossip from another peer
    Gossip { from_pubkey: [u8; 32] },
    /// Set by operator (e.g. bundled blocklist)
    Operator,
}

/// Trust DB row
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrustEntry {
    /// Public key this entry refers to
    pub pubkey: [u8; 32],
    /// Trust level assigned
    pub level: TrustLevel,
    /// Optional scope (e.g. channel, content type)
    pub scope: Option<String>,
    /// Optional expiration timestamp (Unix seconds)
    pub expires_at: Option<i64>,
    /// Optional human-readable reason
    pub reason: Option<String>,
    /// Source of this trust entry
    pub source: TrustSource,
}
