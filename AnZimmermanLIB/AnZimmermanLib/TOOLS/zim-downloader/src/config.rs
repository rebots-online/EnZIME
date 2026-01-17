//! Configuration management for ZIM Downloader

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Directory to store downloaded ZIM files
    pub download_dir: PathBuf,
    
    /// Maximum concurrent downloads
    pub max_concurrent_downloads: usize,
    
    /// Enable download resume capability
    pub enable_resume: bool,
    
    /// Verify checksums after download
    pub verify_checksums: bool,
    
    /// Preferred repositories (in order of preference)
    pub preferred_repositories: Vec<String>,
    
    /// Auto-update repository list on startup
    pub auto_update_repos: bool,
    
    /// Theme (dark/light)
    pub theme: Theme,
    
    /// Show file sizes in human-readable format
    pub human_readable_sizes: bool,
    
    /// Download speed limit in bytes/sec (0 = unlimited)
    pub speed_limit: u64,
    
    /// Proxy configuration
    pub proxy: Option<ProxyConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub url: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    Dark,
    Light,
}

impl Default for Config {
    fn default() -> Self {
        let download_dir = dirs::download_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ZIM");
        
        Self {
            download_dir,
            max_concurrent_downloads: 2,
            enable_resume: true,
            verify_checksums: true,
            preferred_repositories: vec![
                "kiwix".to_string(),
                "archive".to_string(),
            ],
            auto_update_repos: true,
            theme: Theme::Dark,
            human_readable_sizes: true,
            speed_limit: 0,
            proxy: None,
        }
    }
}

impl Config {
    /// Load configuration from file
    pub fn load() -> Result<Self> {
        let config_path = Self::config_path()?;
        
        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            let config: Config = toml::from_str(&content)?;
            Ok(config)
        } else {
            let config = Config::default();
            config.save()?;
            Ok(config)
        }
    }
    
    /// Save configuration to file
    pub fn save(&self) -> Result<()> {
        let config_path = Self::config_path()?;
        
        // Create parent directories
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let content = toml::to_string_pretty(self)?;
        std::fs::write(&config_path, content)?;
        
        Ok(())
    }
    
    /// Get configuration file path
    pub fn config_path() -> Result<PathBuf> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?;
        
        Ok(config_dir.join("zim-downloader").join("config.toml"))
    }
    
    /// Ensure download directory exists
    pub fn ensure_download_dir(&self) -> Result<()> {
        std::fs::create_dir_all(&self.download_dir)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert!(config.enable_resume);
        assert_eq!(config.max_concurrent_downloads, 2);
    }
}
