/// Single migration step
pub struct Migration {
    pub version: u32,
    pub name: &'static str,
    pub sql: &'static str,
}

/// Static ordered list of migrations
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "create_settings",
        sql: "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    },
    Migration {
        version: 2,
        name: "create_chat_history",
        sql: "CREATE TABLE chat_history (id INTEGER PRIMARY KEY AUTOINCREMENT, session INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, zim_handle INTEGER, ts INTEGER NOT NULL);",
    },
    Migration {
        version: 3,
        name: "create_bookmarks",
        sql: "CREATE TABLE bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, zim_uuid BLOB NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL);",
    },
    Migration {
        version: 4,
        name: "create_annotations",
        sql: "CREATE TABLE annotations (id INTEGER PRIMARY KEY AUTOINCREMENT, zim_uuid BLOB NOT NULL, url TEXT NOT NULL, region TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL);",
    },
];

/// Schema versioning + ordered migration execution
pub struct MigrationRunner;

impl MigrationRunner {
    /// Get current schema version from PRAGMA user_version
    pub fn current_version(&self, conn: &rusqlite::Connection) -> Result<u32, rusqlite::Error> {
        conn.query_row("PRAGMA user_version", [], |row| row.get(0))
    }

    /// Apply all pending migrations in order
    pub fn apply_pending(
        &self,
        conn: &rusqlite::Connection,
        migrations: &[Migration],
    ) -> Result<u32, rusqlite::Error> {
        let current = self.current_version(conn)?;

        for migration in migrations {
            if migration.version > current {
                conn.execute_batch(migration.sql)?;
                conn.pragma_update(None, "user_version", migration.version)?;
            }
        }

        self.current_version(conn)
    }
}
