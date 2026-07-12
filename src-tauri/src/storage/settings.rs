use crate::storage::StorageError;

/// KV trait over the settings table
pub trait SettingsStore {
    /// Get a setting value by key
    fn get(&self, key: &str) -> Result<Option<String>, StorageError>;

    /// Set a setting value by key
    fn set(&self, key: &str, value: &str) -> Result<(), StorageError>;
}

// Concrete impl per E-STR-20
use super::Storage;

impl SettingsStore for Storage {
    fn get(&self, key: &str) -> Result<Option<String>, StorageError> {
        self.with_conn(|conn| {
            let result: Option<String> = conn
                .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
                    row.get(0)
                })
                .ok();
            Ok(result)
        })
    }

    fn set(&self, key: &str, value: &str) -> Result<(), StorageError> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                [key, value],
            )?;
            Ok(())
        })
    }
}

/// Canonical setting-key namespace per E-STR-21.
/// Every typed setting is a compile-time `&'static str` const so call-sites cannot drift on spelling.
pub mod setting_key {
    pub const AI_VARIANT_OVERRIDE: &str = "ai.variant_override";
    pub const AI_ACTIVE_MODEL_PATH: &str = "ai.active_model_path";
    pub const AI_SAMPLER: &str = "ai.sampler";
    pub const AI_TEMPERATURE: &str = "ai.temperature";
    pub const UI_THEME: &str = "ui.theme";
    pub const UI_FONT_SCALE: &str = "ui.font_scale";
    pub const UI_WINDOW_GEOMETRY: &str = "ui.window_geometry";
    pub const UI_LAST_OPEN_ZIM: &str = "ui.last_open_zim";
    pub const PACK_CATALOG_URL: &str = "pack.catalog_url";
    pub const PACK_AUTO_UPDATE: &str = "pack.auto_update";
    pub const UPDATE_CHANNEL: &str = "update.channel";
    pub const UPDATE_CHECK_ON_RESUME: &str = "update.check_on_resume";
    pub const SIDECAR_AUTO_EXPORT: &str = "sidecar.auto_export";
    pub const SIDECAR_DEFAULT_TRUST: &str = "sidecar.default_trust";
    /// Always returns `false` in v1.0 per INV-OFFLINE; key exists for forward-compatibility only.
    pub const TELEMETRY_OPTED_IN: &str = "telemetry.opted_in";
}
