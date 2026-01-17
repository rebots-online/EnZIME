//! Tauri command handlers

use tauri::State;
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::config::Config;
use crate::repository::{Repository, ZimEntry, REPOSITORIES};
use crate::download::DownloadTask;

/// Repository info for frontend
#[derive(Debug, Serialize)]
pub struct RepositoryInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
}

/// Get list of available repositories
#[tauri::command]
pub async fn get_repositories() -> Vec<RepositoryInfo> {
    REPOSITORIES.iter().map(|r| RepositoryInfo {
        id: r.id.to_string(),
        name: r.name.to_string(),
        description: r.description.to_string(),
        icon: r.icon.to_string(),
    }).collect()
}

/// Fetch ZIM file list from a repository
#[tauri::command]
pub async fn fetch_zim_list(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<Vec<ZimEntry>, String> {
    let mut repo = state.repository.write().await;
    repo.fetch_zim_list(&repo_id)
        .await
        .map_err(|e| e.to_string())
}

/// Search ZIM files
#[tauri::command]
pub async fn search_zim(
    state: State<'_, AppState>,
    repo_id: String,
    query: String,
) -> Result<Vec<ZimEntry>, String> {
    let mut repo = state.repository.write().await;
    let entries = repo.fetch_zim_list(&repo_id)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(repo.search(&query, &entries))
}

/// Start a download
#[tauri::command]
pub async fn start_download(
    state: State<'_, AppState>,
    zim: ZimEntry,
) -> Result<String, String> {
    let config = state.config.read().await;
    let task_id = state.downloads
        .add_download(zim, &config.download_dir)
        .await
        .map_err(|e| e.to_string())?;
    
    state.downloads
        .start_download(&task_id)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(task_id)
}

/// Pause a download
#[tauri::command]
pub async fn pause_download(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<(), String> {
    state.downloads
        .pause_download(&task_id)
        .await
        .map_err(|e| e.to_string())
}

/// Resume a download
#[tauri::command]
pub async fn resume_download(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<(), String> {
    state.downloads
        .resume_download(&task_id)
        .await
        .map_err(|e| e.to_string())
}

/// Cancel a download
#[tauri::command]
pub async fn cancel_download(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<(), String> {
    state.downloads
        .cancel_download(&task_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get download progress
#[tauri::command]
pub async fn get_download_progress(
    state: State<'_, AppState>,
) -> Vec<DownloadTask> {
    state.downloads.get_active_tasks().await
}

/// Get current configuration
#[tauri::command]
pub async fn get_config(
    state: State<'_, AppState>,
) -> Config {
    state.config.read().await.clone()
}

/// Update configuration
#[tauri::command]
pub async fn set_config(
    state: State<'_, AppState>,
    config: Config,
) -> Result<(), String> {
    let mut current = state.config.write().await;
    *current = config;
    current.save().map_err(|e| e.to_string())?;
    current.ensure_download_dir().map_err(|e| e.to_string())?;
    Ok(())
}

/// Get download history
#[tauri::command]
pub async fn get_download_history(
    state: State<'_, AppState>,
) -> Vec<DownloadTask> {
    state.downloads.get_history().await
}
