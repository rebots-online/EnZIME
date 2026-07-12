//! Idempotent webhook deduplication ledger
//!
//! Per §7.6 row E-ENT-15: Dedup webhooks using SQLite

use sqlx::{Pool, Sqlite};
use std::sync::Arc;

/// Idempotent ledger for webhook deduplication
///
/// Per §7.6 row E-ENT-15: struct { db: Arc<sqlx::SqlitePool> }
/// impl seen(&self, &str) -> Result<bool,_>
///
/// Tracks processed webhook IDs to prevent duplicate processing.
pub struct IdempotentLedger {
    /// SQLite connection pool for ledger storage
    db: Arc<Pool<Sqlite>>,
}

impl IdempotentLedger {
    /// Create a new IdempotentLedger with the given database pool
    pub fn new(db: Arc<Pool<Sqlite>>) -> Self {
        Self { db }
    }

    /// Initialize the ledger table schema
    ///
    /// Creates the `webhook_ledger` table if it doesn't exist.
    pub async fn init(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS webhook_ledger (
                webhook_id TEXT PRIMARY KEY,
                processed_at INTEGER NOT NULL
            )
            "#,
        )
        .execute(&*self.db)
        .await?;
        Ok(())
    }

    /// Check if a webhook ID has been seen before, and record it if new
    ///
    /// Per §7.6 row E-ENT-15: seen(&self, &str) -> Result<bool,_>
    ///
    /// # Arguments
    /// * `webhook_id` - Unique identifier for the webhook (e.g., from event ID)
    ///
    /// # Returns
    /// * `Ok(true)` - Webhook was already processed (duplicate)
    /// * `Ok(false)` - First time seeing this webhook (new)
    /// * `Err(_)` - Database error
      pub async fn seen(&self, webhook_id: &str) -> Result<bool, sqlx::Error> {
        // Try to insert the webhook ID; if it exists, we've seen it before
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let insert_result = sqlx::query(
            r#"
            INSERT INTO webhook_ledger (webhook_id, processed_at)
            VALUES (?1, ?2)
            "#,
        )
        .bind(webhook_id)
        .bind(now)
        .execute(&*self.db)
        .await;

        match insert_result {
            Ok(_) => Ok(false), // Successfully inserted: first time seeing this ID
            Err(sqlx::Error::Database(err)) if err.is_unique_violation() => Ok(true), // Already exists: duplicate
            Err(e) => Err(e),   // Propagate other errors
        }
    }
}
