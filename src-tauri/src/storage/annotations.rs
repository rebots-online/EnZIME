use uuid::Uuid;

/// Annotations storage trait
pub trait AnnotationsStore {
    /// Create a new annotation
    fn create(&self, zim_uuid: Uuid, url: String, region: Region, body: String) -> Result<u64, crate::storage::StorageError>;

    /// List annotations, optionally filtered by ZIM UUID
    fn list(&self, zim_uuid: Option<Uuid>) -> Result<Vec<Annotation>, crate::storage::StorageError>;

    /// Delete an annotation by ID
    fn delete(&self, id: u64) -> Result<(), crate::storage::StorageError>;

    /// Export annotations as JSON string
    fn export(&self, zim_uuid: Option<Uuid>) -> Result<String, crate::storage::StorageError>;

    /// Import annotations from JSON string
    fn import(&self, json: &str) -> Result<usize, crate::storage::StorageError>;
}

/// Single annotation row
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Annotation {
    pub id: u64,
    pub zim_uuid: Uuid,
    pub url: String,
    pub region: Region,
    pub body: String,
    pub created_at: i64,
}

// Region selector for annotation targeting
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Region {
    /// Character range within a document
    Char { start: u32, end: u32 },
    /// Entire page/document
    Page,
    /// Custom region identifier
    Custom(String),
}

// Concrete impl per E-STR-13
use super::{Storage, StorageError};

impl AnnotationsStore for Storage {
    fn create(&self, zim_uuid: Uuid, url: String, region: Region, body: String) -> Result<u64, StorageError> {
        self.with_conn(|conn| {
            let region_json = serde_json::to_string(&region).map_err(|e| StorageError::Schema(e.to_string()))?;
            conn.execute(
                "INSERT INTO annotations (zim_uuid, url, region, body, created_at)
                 VALUES (?1, ?2, ?3, ?4, (SELECT unixepoch() * 1000))",
                (&zim_uuid, &url, &region_json, &body),
            )?;
            Ok(conn.last_insert_rowid() as u64)
        })
    }

    fn list(&self, zim_uuid: Option<Uuid>) -> Result<Vec<Annotation>, StorageError> {
        self.with_conn(|conn| {
            let (query, params): (&str, Vec<&dyn rusqlite::ToSql>) = match zim_uuid {
                Some(uuid) => (
                    "SELECT id, zim_uuid, url, region, body, created_at
                     FROM annotations
                     WHERE zim_uuid = ?1
                     ORDER BY created_at DESC",
                    vec![&uuid as &dyn rusqlite::ToSql],
                ),
                None => (
                    "SELECT id, zim_uuid, url, region, body, created_at
                     FROM annotations
                     ORDER BY created_at DESC",
                    vec![],
                ),
            };

            let mut stmt = conn.prepare(query)?;
            let rows = stmt.query_map(params.as_slice(), |row| {
                let region_json: String = row.get(3)?;
                let region = serde_json::from_str(&region_json)
                    .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
                Ok(Annotation {
                    id: row.get(0)?,
                    zim_uuid: row.get(1)?,
                    url: row.get(2)?,
                    region,
                    body: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?;

            let mut annotations = Vec::new();
            for row in rows {
                annotations.push(row?);
            }
            Ok(annotations)
        })
    }

    fn delete(&self, id: u64) -> Result<(), StorageError> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM annotations WHERE id = ?1", [&id])?;
            Ok(())
        })
    }

    fn export(&self, zim_uuid: Option<Uuid>) -> Result<String, StorageError> {
        let annotations = self.list(zim_uuid)?;
        serde_json::to_string(&annotations)
            .map_err(|e| StorageError::Schema(e.to_string()))
    }

    fn import(&self, json: &str) -> Result<usize, StorageError> {
        let annotations: Vec<Annotation> = serde_json::from_str(json)
            .map_err(|e| StorageError::Schema(e.to_string()))?;

        self.with_conn(|conn| {
            let tx = conn.unchecked_transaction()?;
            let mut count = 0;

            for ann in annotations {
                let region_json = serde_json::to_string(&ann.region)
                    .map_err(|e| StorageError::Schema(e.to_string()))?;
                tx.execute(
                    "INSERT INTO annotations (id, zim_uuid, url, region, body, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                     ON CONFLICT(id) DO UPDATE SET
                        zim_uuid=excluded.zim_uuid,
                        url=excluded.url,
                        region=excluded.region,
                        body=excluded.body",
                    (&ann.id, &ann.zim_uuid, &ann.url, &region_json, &ann.body, &ann.created_at),
                )?;
                count += 1;
            }

            tx.commit()?;
            Ok(count)
        })
    }
}
