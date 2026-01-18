// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

//! Download manager for ZIM files

use anyhow::Result;
use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio::io::AsyncWriteExt;

use crate::repository::ZimEntry;

/// Download status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// A download task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    /// Unique ID
    pub id: String,
    
    /// ZIM entry being downloaded
    pub zim: ZimEntry,
    
    /// Target file path
    pub target_path: PathBuf,
    
    /// Current status
    pub status: DownloadStatus,
    
    /// Bytes downloaded
    pub downloaded: u64,
    
    /// Total bytes
    pub total: u64,
    
    /// Download speed (bytes/sec)
    pub speed: u64,
    
    /// Estimated time remaining (seconds)
    pub eta: Option<u64>,
    
    /// Start time
    pub started_at: Option<DateTime<Utc>>,
    
    /// Completion time
    pub completed_at: Option<DateTime<Utc>>,
    
    /// Error message if failed
    pub error: Option<String>,
}

impl DownloadTask {
    pub fn new(zim: ZimEntry, target_dir: &PathBuf) -> Self {
        let filename = zim.url.split('/').last().unwrap_or("download.zim");
        let target_path = target_dir.join(filename);
        
        Self {
            id: uuid_simple(),
            zim: zim.clone(),
            target_path,
            status: DownloadStatus::Pending,
            downloaded: 0,
            total: zim.size,
            speed: 0,
            eta: None,
            started_at: None,
            completed_at: None,
            error: None,
        }
    }
    
    /// Get progress percentage
    pub fn progress(&self) -> f64 {
        if self.total == 0 {
            0.0
        } else {
            (self.downloaded as f64 / self.total as f64) * 100.0
        }
    }
}

/// Simple UUID generator
fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{:x}{:x}", duration.as_secs(), duration.subsec_nanos())
}

/// Download progress update
#[derive(Debug, Clone)]
pub struct ProgressUpdate {
    pub task_id: String,
    pub downloaded: u64,
    pub total: u64,
    pub speed: u64,
}

/// Download manager
pub struct DownloadManager {
    /// Active downloads
    pub tasks: Arc<RwLock<Vec<DownloadTask>>>,
    
    /// Download history
    pub history: Arc<RwLock<Vec<DownloadTask>>>,
    
    /// HTTP client
    client: reqwest::Client,
    
    /// Progress sender
    progress_tx: mpsc::Sender<ProgressUpdate>,
    
    /// Progress receiver
    progress_rx: Arc<RwLock<mpsc::Receiver<ProgressUpdate>>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        let (progress_tx, progress_rx) = mpsc::channel(100);
        
        let client = reqwest::Client::builder()
            .user_agent("ZIM-Downloader/0.1.0")
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            tasks: Arc::new(RwLock::new(Vec::new())),
            history: Arc::new(RwLock::new(Vec::new())),
            client,
            progress_tx,
            progress_rx: Arc::new(RwLock::new(progress_rx)),
        }
    }
    
    /// Add a download task
    pub async fn add_download(&self, zim: ZimEntry, target_dir: &PathBuf) -> Result<String> {
        let task = DownloadTask::new(zim, target_dir);
        let task_id = task.id.clone();
        
        let mut tasks = self.tasks.write().await;
        tasks.push(task);
        
        Ok(task_id)
    }
    
    /// Start a download
    pub async fn start_download(&self, task_id: &str) -> Result<()> {
        // Find and update task status
        {
            let mut tasks = self.tasks.write().await;
            if let Some(task) = tasks.iter_mut().find(|t| t.id == task_id) {
                task.status = DownloadStatus::Downloading;
                task.started_at = Some(Utc::now());
            } else {
                return Err(anyhow::anyhow!("Task not found: {}", task_id));
            }
        }
        
        // Get task details
        let task = {
            let tasks = self.tasks.read().await;
            tasks.iter().find(|t| t.id == task_id).cloned()
        };
        
        let task = task.ok_or_else(|| anyhow::anyhow!("Task not found"))?;
        
        // Start download in background
        let client = self.client.clone();
        let tasks = self.tasks.clone();
        let history = self.history.clone();
        let progress_tx = self.progress_tx.clone();
        let task_id = task_id.to_string();
        
        tokio::spawn(async move {
            let result = download_file(
                &client,
                &task.zim.url,
                &task.target_path,
                task.downloaded,
                &task_id,
                progress_tx,
                tasks.clone(),
            ).await;
            
            let mut tasks_guard = tasks.write().await;
            if let Some(pos) = tasks_guard.iter().position(|t| t.id == task_id) {
                let mut task = tasks_guard.remove(pos);
                
                match result {
                    Ok(_) => {
                        task.status = DownloadStatus::Completed;
                        task.completed_at = Some(Utc::now());
                        task.downloaded = task.total;
                    }
                    Err(e) => {
                        task.status = DownloadStatus::Failed;
                        task.error = Some(e.to_string());
                    }
                }
                
                // Move to history
                let mut history_guard = history.write().await;
                history_guard.push(task);
            }
        });
        
        Ok(())
    }
    
    /// Pause a download
    pub async fn pause_download(&self, task_id: &str) -> Result<()> {
        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.iter_mut().find(|t| t.id == task_id) {
            task.status = DownloadStatus::Paused;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Task not found: {}", task_id))
        }
    }
    
    /// Resume a download
    pub async fn resume_download(&self, task_id: &str) -> Result<()> {
        self.start_download(task_id).await
    }
    
    /// Cancel a download
    pub async fn cancel_download(&self, task_id: &str) -> Result<()> {
        let mut tasks = self.tasks.write().await;
        if let Some(pos) = tasks.iter().position(|t| t.id == task_id) {
            let mut task = tasks.remove(pos);
            task.status = DownloadStatus::Cancelled;
            
            // Delete partial file
            if task.target_path.exists() {
                let _ = std::fs::remove_file(&task.target_path);
            }
            
            let mut history = self.history.write().await;
            history.push(task);
            
            Ok(())
        } else {
            Err(anyhow::anyhow!("Task not found: {}", task_id))
        }
    }
    
    /// Get all active tasks
    pub async fn get_active_tasks(&self) -> Vec<DownloadTask> {
        self.tasks.read().await.clone()
    }
    
    /// Get download history
    pub async fn get_history(&self) -> Vec<DownloadTask> {
        self.history.read().await.clone()
    }
    
    /// Get task by ID
    pub async fn get_task(&self, task_id: &str) -> Option<DownloadTask> {
        let tasks = self.tasks.read().await;
        tasks.iter().find(|t| t.id == task_id).cloned()
    }
}

/// Download a file with progress reporting
async fn download_file(
    client: &reqwest::Client,
    url: &str,
    target_path: &PathBuf,
    resume_from: u64,
    task_id: &str,
    progress_tx: mpsc::Sender<ProgressUpdate>,
    tasks: Arc<RwLock<Vec<DownloadTask>>>,
) -> Result<()> {
    // Create parent directory
    if let Some(parent) = target_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    
    // Build request with resume support
    let mut request = client.get(url);
    if resume_from > 0 {
        request = request.header("Range", format!("bytes={}-", resume_from));
    }
    
    let response = request.send().await?;
    
    if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(anyhow::anyhow!("HTTP error: {}", response.status()));
    }
    
    let total_size = response.content_length().unwrap_or(0) + resume_from;
    
    // Open file for writing
    let mut file = if resume_from > 0 {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(target_path)
            .await?
    } else {
        tokio::fs::File::create(target_path).await?
    };
    
    let mut downloaded = resume_from;
    let mut stream = response.bytes_stream();
    let mut last_update = std::time::Instant::now();
    let mut bytes_since_update = 0u64;
    
    while let Some(chunk) = stream.next().await {
        // Check if download was paused/cancelled
        {
            let tasks_guard = tasks.read().await;
            if let Some(task) = tasks_guard.iter().find(|t| t.id == task_id) {
                if task.status == DownloadStatus::Paused || task.status == DownloadStatus::Cancelled {
                    return Ok(());
                }
            }
        }
        
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        
        downloaded += chunk.len() as u64;
        bytes_since_update += chunk.len() as u64;
        
        // Update progress every 100ms
        let elapsed = last_update.elapsed();
        if elapsed.as_millis() >= 100 {
            let speed = (bytes_since_update as f64 / elapsed.as_secs_f64()) as u64;
            
            // Update task
            {
                let mut tasks_guard = tasks.write().await;
                if let Some(task) = tasks_guard.iter_mut().find(|t| t.id == task_id) {
                    task.downloaded = downloaded;
                    task.total = total_size;
                    task.speed = speed;
                    task.eta = if speed > 0 {
                        Some((total_size - downloaded) / speed)
                    } else {
                        None
                    };
                }
            }
            
            // Send progress update
            let _ = progress_tx.send(ProgressUpdate {
                task_id: task_id.to_string(),
                downloaded,
                total: total_size,
                speed,
            }).await;
            
            last_update = std::time::Instant::now();
            bytes_since_update = 0;
        }
    }
    
    file.flush().await?;
    
    Ok(())
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new()
    }
}
