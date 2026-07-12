use std::path::{Path, PathBuf};
use std::sync::Mutex;
use thiserror::Error;

pub mod annotations;
pub mod bookmarks;
pub mod chat;
pub mod migrations;
pub mod settings;

pub use settings::{SettingsStore, setting_key};
pub use annotations::{AnnotationsStore, Annotation, Region};
pub use bookmarks::{BookmarksStore, Bookmark};
pub use chat::{ChatHistoryStore, ChatMsg};

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("SQLite error: {0}")]
    Sql(#[from] rusqlite::Error),
    #[error("Migration error: {0}")]
    Migration(String),
    #[error("Schema error: {0}")]
    Schema(String),
    #[error("Mutex poisoned")]
    Poisoned,
}

pub struct Storage {
    pub db: Mutex<rusqlite::Connection>,
    pub path: PathBuf,
}

impl std::fmt::Debug for Storage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Storage")
            .field("path", &self.path)
            .finish()
    }
}

impl Storage {
    pub fn open(path: &Path) -> Result<Self, StorageError> {
        let mut db = rusqlite::Connection::open(path)?;
        db.pragma_update(None, "journal_mode", "WAL")?;
        db.pragma_update(None, "foreign_keys", "ON")?;
        db.pragma_update(None, "synchronous", "NORMAL")?;
        Ok(Self {
            db: Mutex::new(db),
            path: path.to_path_buf(),
        })
    }

    pub fn with_conn<R, F: FnOnce(&rusqlite::Connection) -> Result<R, StorageError>>(
        &self,
        f: F,
    ) -> Result<R, StorageError> {
        let conn = self.db.lock().map_err(|_| StorageError::Poisoned)?;
        f(&conn)
    }

    pub fn run_migrations(&self) -> Result<(), StorageError> {
        self.with_conn(|conn| {
            migrations::MigrationRunner.apply_pending(conn, migrations::MIGRATIONS)?;
            Ok(())
        })
    }
}
