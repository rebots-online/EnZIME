use uuid::Uuid;

/// Single bookmark row
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Bookmark {
    pub id: u64,
    pub zim_uuid: Uuid,
    pub url: String,
    pub title: String,
    pub created_at: i64,
}

/// Bookmark storage trait
pub trait BookmarksStore {
    /// Toggle bookmark existence (add if absent, remove if present)
    fn toggle(&self, zim_uuid: Uuid, url: String, title: String) -> Result<bool, crate::storage::StorageError>;

    /// List bookmarks, optionally filtered by ZIM UUID
    fn list(&self, zim_uuid: Option<Uuid>) -> Result<Vec<Bookmark>, crate::storage::StorageError>;
}

// Concrete impl per E-STR-17
use super::{Storage, StorageError};

impl BookmarksStore for Storage {
    fn toggle(&self, zim_uuid: Uuid, url: String, title: String) -> Result<bool, StorageError> {
        self.with_conn(|conn| {
            // Check if bookmark exists
            let exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM bookmarks WHERE zim_uuid = ?1 AND url = ?2)",
                (&zim_uuid, &url),
                |row| row.get(0),
            )?;

            if exists {
                // Remove bookmark
                conn.execute(
                    "DELETE FROM bookmarks WHERE zim_uuid = ?1 AND url = ?2",
                    (&zim_uuid, &url),
                )?;
                Ok(false)
            } else {
                // Add bookmark
                conn.execute(
                    "INSERT INTO bookmarks (zim_uuid, url, title, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    (&zim_uuid, &url, &title, chrono::Utc::now().timestamp()),
                )?;
                Ok(true)
            }
        })
    }

    fn list(&self, zim_uuid: Option<Uuid>) -> Result<Vec<Bookmark>, StorageError> {
        self.with_conn(|conn| {
            let (query, params): (&str, Vec<&dyn rusqlite::ToSql>) = match zim_uuid {
                Some(uuid) => (
                    "SELECT id, zim_uuid, url, title, created_at
                     FROM bookmarks
                     WHERE zim_uuid = ?1
                     ORDER BY created_at DESC",
                    vec![&uuid as &dyn rusqlite::ToSql],
                ),
                None => (
                    "SELECT id, zim_uuid, url, title, created_at
                     FROM bookmarks
                     ORDER BY created_at DESC",
                    vec![],
                ),
            };

            let mut stmt = conn.prepare(query)?;
            let rows = stmt.query_map(params.as_slice(), |row| {
                Ok(Bookmark {
                    id: row.get(0)?,
                    zim_uuid: row.get(1)?,
                    url: row.get(2)?,
                    title: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?;

            let mut bookmarks = Vec::new();
            for row in rows {
                bookmarks.push(row?);
            }
            Ok(bookmarks)
        })
    }
}
