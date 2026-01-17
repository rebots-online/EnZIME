//! Application state and Tauri commands

pub mod commands;

use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::Manager;
use anyhow::Result;

use crate::config::Config;
use crate::repository::RepositoryClient;
use crate::download::DownloadManager;

/// Application state shared across commands
pub struct AppState {
    pub config: Arc<RwLock<Config>>,
    pub repository: Arc<RwLock<RepositoryClient>>,
    pub downloads: Arc<DownloadManager>,
}

impl AppState {
    pub fn new() -> Result<Self> {
        let config = Config::load()?;
        config.ensure_download_dir()?;
        
        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            repository: Arc::new(RwLock::new(RepositoryClient::new()?)),
            downloads: Arc::new(DownloadManager::new()),
        })
    }
}

/// Initialize application state
pub fn init_app_state(app: &tauri::App) -> Result<()> {
    let state = AppState::new()?;
    app.manage(state);
    Ok(())
}
