use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::storage::{Storage, SettingsStore, StorageError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
    pub fullscreen: bool,
}

pub struct WindowStateStore {
    pub storage: Arc<Storage>,
}

impl WindowStateStore {
    pub fn save(&self, state: &WindowState) -> Result<(), StorageError> {
        let json = serde_json::to_string(state)
            .map_err(|e| StorageError::Schema(e.to_string()))?;
        self.storage.set(crate::storage::setting_key::UI_WINDOW_GEOMETRY, &json)
    }

    pub fn restore(&self) -> Result<WindowState, StorageError> {
        self.storage.get(crate::storage::setting_key::UI_WINDOW_GEOMETRY)?
            .as_deref()
            .map(|json| serde_json::from_str(json)
                .map_err(|e| StorageError::Schema(e.to_string())))
            .unwrap_or_else(|| Ok(WindowState {
                x: 0,
                y: 0,
                width: 1280,
                height: 720,
                maximized: false,
                fullscreen: false,
            }))
    }
}
