// Row shape per E-STR-11
pub struct ChatMsg {
    pub id: u64,
    pub session: u64,
    pub role: String,
    pub content: String,
    pub zim_handle: Option<u64>,
    pub ts: i64,
}

// Trait per E-STR-9
pub trait ChatHistoryStore {
    fn append(&self, msg: ChatMsg) -> Result<u64, StorageError>;
    fn list(&self, session_id: Option<u64>, limit: u32) -> Result<Vec<ChatMsg>, StorageError>;
    fn clear(&self, session_id: Option<u64>) -> Result<u32, StorageError>;
}

// Concrete impl per E-STR-10
use super::{Storage, StorageError};

impl ChatHistoryStore for Storage {
    fn append(&self, msg: ChatMsg) -> Result<u64, StorageError> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO chat_history (session, role, content, zim_handle, ts)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (&msg.session, &msg.role, &msg.content, &msg.zim_handle, &msg.ts),
            )?;
            Ok(conn.last_insert_rowid() as u64)
        })
    }

    fn list(&self, session_id: Option<u64>, limit: u32) -> Result<Vec<ChatMsg>, StorageError> {
        self.with_conn(|conn| {
            let (query, params): (&str, Vec<&dyn rusqlite::ToSql>) = match session_id {
                Some(sid) => (
                    "SELECT id, session, role, content, zim_handle, ts
                     FROM chat_history
                     WHERE session = ?1
                     ORDER BY ts DESC
                     LIMIT ?2",
                    vec![&sid as &dyn rusqlite::ToSql, &limit as &dyn rusqlite::ToSql],
                ),
                None => (
                    "SELECT id, session, role, content, zim_handle, ts
                     FROM chat_history
                     ORDER BY ts DESC
                     LIMIT ?1",
                    vec![&limit as &dyn rusqlite::ToSql],
                ),
            };

            let mut stmt = conn.prepare(query)?;
            let rows = stmt.query_map(params.as_slice(), |row| {
                Ok(ChatMsg {
                    id: row.get(0)?,
                    session: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    zim_handle: row.get(4)?,
                    ts: row.get(5)?,
                })
            })?;

            let mut msgs = Vec::new();
            for row in rows {
                msgs.push(row?);
            }
            Ok(msgs)
        })
    }

    fn clear(&self, session_id: Option<u64>) -> Result<u32, StorageError> {
        self.with_conn(|conn| {
            let rows_affected = match session_id {
                Some(sid) => conn.execute(
                    "DELETE FROM chat_history WHERE session = ?1",
                    (&sid,),
                )?,
                None => conn.execute(
                    "DELETE FROM chat_history",
                    [],
                )?,
            };
            Ok(rows_affected as u32)
        })
    }
}
