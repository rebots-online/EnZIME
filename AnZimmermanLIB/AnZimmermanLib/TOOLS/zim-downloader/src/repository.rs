//! ZIM Repository management - fetching and parsing ZIM file listings

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Known public ZIM repositories
pub const REPOSITORIES: &[Repository] = &[
    Repository {
        id: "kiwix",
        name: "Kiwix Library",
        description: "Official Kiwix ZIM library with Wikipedia, Wikimedia, and other content",
        base_url: "https://download.kiwix.org/zim/",
        library_url: Some("https://library.kiwix.org/catalog/v2/entries"),
        icon: "📚",
    },
    Repository {
        id: "kiwix-other",
        name: "Kiwix Other Content",
        description: "Stack Exchange, TED Talks, and other curated content",
        base_url: "https://download.kiwix.org/zim/other/",
        library_url: None,
        icon: "📦",
    },
    Repository {
        id: "wikipedia",
        name: "Wikipedia Archives",
        description: "Complete Wikipedia dumps by language",
        base_url: "https://download.kiwix.org/zim/wikipedia/",
        library_url: None,
        icon: "🌐",
    },
    Repository {
        id: "wikimedia",
        name: "Wikimedia Projects",
        description: "Wiktionary, Wikiquote, Wikibooks, and other Wikimedia projects",
        base_url: "https://download.kiwix.org/zim/",
        library_url: None,
        icon: "📖",
    },
    Repository {
        id: "archive",
        name: "Internet Archive",
        description: "ZIM files hosted on Internet Archive",
        base_url: "https://archive.org/download/",
        library_url: None,
        icon: "🏛️",
    },
];

/// A ZIM file repository
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub base_url: &'static str,
    pub library_url: Option<&'static str>,
    pub icon: &'static str,
}

/// A ZIM file entry from a repository
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZimEntry {
    /// Unique identifier
    pub id: String,
    
    /// Display name
    pub name: String,
    
    /// Full title/description
    pub title: String,
    
    /// Language code (e.g., "en", "fr")
    pub language: String,
    
    /// Content category
    pub category: ZimCategory,
    
    /// File size in bytes
    pub size: u64,
    
    /// Download URL
    pub url: String,
    
    /// Mirror URLs
    pub mirrors: Vec<String>,
    
    /// Creation date
    pub date: Option<DateTime<Utc>>,
    
    /// SHA256 checksum
    pub sha256: Option<String>,
    
    /// Number of articles
    pub article_count: Option<u64>,
    
    /// Number of media files
    pub media_count: Option<u64>,
    
    /// Repository ID
    pub repository: String,
    
    /// Tags
    pub tags: Vec<String>,
    
    /// Flavor (mini, nopic, maxi, etc.)
    pub flavor: Option<String>,
}

/// ZIM content categories
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ZimCategory {
    Wikipedia,
    Wiktionary,
    Wikiquote,
    Wikibooks,
    Wikiversity,
    Wikivoyage,
    Wikisource,
    Wikinews,
    Wikispecies,
    StackExchange,
    TedTalks,
    Gutenberg,
    Other,
}

impl std::fmt::Display for ZimCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Wikipedia => write!(f, "Wikipedia"),
            Self::Wiktionary => write!(f, "Wiktionary"),
            Self::Wikiquote => write!(f, "Wikiquote"),
            Self::Wikibooks => write!(f, "Wikibooks"),
            Self::Wikiversity => write!(f, "Wikiversity"),
            Self::Wikivoyage => write!(f, "Wikivoyage"),
            Self::Wikisource => write!(f, "Wikisource"),
            Self::Wikinews => write!(f, "Wikinews"),
            Self::Wikispecies => write!(f, "Wikispecies"),
            Self::StackExchange => write!(f, "Stack Exchange"),
            Self::TedTalks => write!(f, "TED Talks"),
            Self::Gutenberg => write!(f, "Project Gutenberg"),
            Self::Other => write!(f, "Other"),
        }
    }
}

/// Repository client for fetching ZIM listings
pub struct RepositoryClient {
    client: reqwest::Client,
    cache: HashMap<String, Vec<ZimEntry>>,
}

impl RepositoryClient {
    pub fn new() -> Result<Self> {
        let client = reqwest::Client::builder()
            .user_agent("ZIM-Downloader/0.1.0")
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        
        Ok(Self {
            client,
            cache: HashMap::new(),
        })
    }
    
    /// Fetch ZIM list from a repository
    pub async fn fetch_zim_list(&mut self, repo_id: &str) -> Result<Vec<ZimEntry>> {
        // Check cache first
        if let Some(entries) = self.cache.get(repo_id) {
            return Ok(entries.clone());
        }
        
        let repo = REPOSITORIES.iter()
            .find(|r| r.id == repo_id)
            .ok_or_else(|| anyhow::anyhow!("Repository not found: {}", repo_id))?;
        
        let entries = if let Some(library_url) = repo.library_url {
            self.fetch_from_opds(library_url, repo_id).await?
        } else {
            self.fetch_from_directory(repo.base_url, repo_id).await?
        };
        
        self.cache.insert(repo_id.to_string(), entries.clone());
        Ok(entries)
    }
    
    /// Fetch from OPDS catalog (Kiwix library)
    async fn fetch_from_opds(&self, url: &str, repo_id: &str) -> Result<Vec<ZimEntry>> {
        let response = self.client.get(url)
            .header("Accept", "application/json")
            .send()
            .await?;
        
        let entries = if response.status().is_success() {
            self.parse_opds_response(&response.text().await?, repo_id)?
        } else {
            // Fallback to sample data for demo
            self.get_sample_entries(repo_id)
        };
        
        Ok(entries)
    }
    
    /// Parse OPDS JSON response
    fn parse_opds_response(&self, _json: &str, repo_id: &str) -> Result<Vec<ZimEntry>> {
        // In production, parse actual OPDS feed
        // For now, return sample data
        Ok(self.get_sample_entries(repo_id))
    }
    
    /// Fetch from directory listing
    async fn fetch_from_directory(&self, _url: &str, repo_id: &str) -> Result<Vec<ZimEntry>> {
        // In production, parse HTML directory listing
        // For now, return sample data
        Ok(self.get_sample_entries(repo_id))
    }
    
    /// Get sample ZIM entries for demonstration
    fn get_sample_entries(&self, repo_id: &str) -> Vec<ZimEntry> {
        vec![
            ZimEntry {
                id: "wikipedia_en_all_maxi".to_string(),
                name: "Wikipedia (English) - Complete".to_string(),
                title: "English Wikipedia with all articles and images".to_string(),
                language: "en".to_string(),
                category: ZimCategory::Wikipedia,
                size: 95_000_000_000, // ~95 GB
                url: "https://download.kiwix.org/zim/wikipedia/wikipedia_en_all_maxi_2024-01.zim".to_string(),
                mirrors: vec![],
                date: Some(Utc::now()),
                sha256: Some("abc123...".to_string()),
                article_count: Some(6_700_000),
                media_count: Some(15_000_000),
                repository: repo_id.to_string(),
                tags: vec!["wikipedia".to_string(), "english".to_string(), "complete".to_string()],
                flavor: Some("maxi".to_string()),
            },
            ZimEntry {
                id: "wikipedia_en_all_nopic".to_string(),
                name: "Wikipedia (English) - No Pictures".to_string(),
                title: "English Wikipedia without images".to_string(),
                language: "en".to_string(),
                category: ZimCategory::Wikipedia,
                size: 12_000_000_000, // ~12 GB
                url: "https://download.kiwix.org/zim/wikipedia/wikipedia_en_all_nopic_2024-01.zim".to_string(),
                mirrors: vec![],
                date: Some(Utc::now()),
                sha256: Some("def456...".to_string()),
                article_count: Some(6_700_000),
                media_count: Some(0),
                repository: repo_id.to_string(),
                tags: vec!["wikipedia".to_string(), "english".to_string(), "nopic".to_string()],
                flavor: Some("nopic".to_string()),
            },
            ZimEntry {
                id: "wikipedia_en_top_mini".to_string(),
                name: "Wikipedia (English) - Top 100k Articles".to_string(),
                title: "Most popular 100,000 English Wikipedia articles".to_string(),
                language: "en".to_string(),
                category: ZimCategory::Wikipedia,
                size: 2_000_000_000, // ~2 GB
                url: "https://download.kiwix.org/zim/wikipedia/wikipedia_en_top_mini_2024-01.zim".to_string(),
                mirrors: vec![],
                date: Some(Utc::now()),
                sha256: Some("ghi789...".to_string()),
                article_count: Some(100_000),
                media_count: Some(50_000),
                repository: repo_id.to_string(),
                tags: vec!["wikipedia".to_string(), "english".to_string(), "mini".to_string()],
                flavor: Some("mini".to_string()),
            },
            ZimEntry {
                id: "wikipedia_fr_all_maxi".to_string(),
                name: "Wikipedia (French) - Complete".to_string(),
                title: "French Wikipedia with all articles and images".to_string(),
                language: "fr".to_string(),
                category: ZimCategory::Wikipedia,
                size: 38_000_000_000, // ~38 GB
                url: "https://download.kiwix.org/zim/wikipedia/wikipedia_fr_all_maxi_2024-01.zim".to_string(),
                mirrors: vec![],
                date: Some(Utc::now()),
                sha256: Some("jkl012...".to_string()),
                article_count: Some(2_500_000),
                media_count: Some(8_000_000),
                repository: repo_id.to_string(),
                tags: vec!["wikipedia".to_string(), "french".to_string(), "complete".to_string()],
                flavor: Some("maxi".to_string()),
            },
            ZimEntry {
                id: "wikipedia_de_all_maxi".to_string(),
                name: "Wikipedia (German) - Complete".to_string(),
                title: "German Wikipedia with all articles and images".to_string(),
                language: "de".to_string(),
                category: ZimCategory::Wikipedia,
                size: 42_000_000_000, // ~42 GB
                url: "https://download.kiwix.org/zim/wikipedia/wikipedia_de_all_maxi_2024-01.zim".to_string(),
                mirrors: vec![],
                date: Some(Utc::now()),
                sha256: Some("mno345...".to_string()),
                article_count: Some(2_800_000),
                media_count: Some(9_000_000),
                repository: repo_id.to_string(),
                tags: vec!["wikipedia".to_string(), "german".to_string(), "complete".to_string()],
                flavor: Some("maxi".to_string()),
            },
            ZimEntry {
                id: "wiktionary_en_all".to_string(),
                name: "Wiktionary (English)".to_string(),
                title: "English Wiktionary - Complete dictionary".to_string(),
                language: "en".to_string(),
                category: ZimCategory::Wiktionary,
                size: 5_500_000_000, // ~5.5 GB
                url: "https://download.kiwix.org/zim/wiktionary/wiktionary_en_all_2024-01.zim".to_string(),
                mirrors: vec![],
                date: Some(Utc::now()),
                sha256: Some("pqr678...".to_string()),
                article_count: Some(8_000_000),
                media_count: Some(100_000),
                repository: repo_id.to_string(),
                tags: vec!["wiktionary".to_string(), "english".to_string(), "dictionary".to_string()],
                flavor: None,
            },
            ZimEntry {
                id: "stackexchange_all".to_string(),
                name: "Stack Exchange - All Sites".to_string(),
                title: "Complete Stack Exchange network archive".to_string(),
                language: "en".to_string(),
                category: ZimCategory::StackExchange,
                size: 85_000_000_000, // ~85 GB
                url: "https://download.kiwix.org/zim/other/stackexchange_all_2024-01.zim".to_string(),
                mirrors: vec![],
                date: Some(Utc::now()),
                sha256: Some("stu901...".to_string()),
                article_count: Some(50_000_000),
                media_count: Some(1_000_000),
                repository: repo_id.to_string(),
                tags: vec!["stackexchange".to_string(), "qa".to_string(), "programming".to_string()],
                flavor: None,
            },
            ZimEntry {
                id: "ted_talks_en".to_string(),
                name: "TED Talks (English)".to_string(),
                title: "TED Talks with English subtitles".to_string(),
                language: "en".to_string(),
                category: ZimCategory::TedTalks,
                size: 25_000_000_000, // ~25 GB
                url: "https://download.kiwix.org/zim/other/ted_en_2024-01.zim".to_string(),
                mirrors: vec![],
                date: Some(Utc::now()),
                sha256: Some("vwx234...".to_string()),
                article_count: Some(5_000),
                media_count: Some(5_000),
                repository: repo_id.to_string(),
                tags: vec!["ted".to_string(), "video".to_string(), "educational".to_string()],
                flavor: None,
            },
            ZimEntry {
                id: "gutenberg_en_all".to_string(),
                name: "Project Gutenberg (English)".to_string(),
                title: "Free eBooks from Project Gutenberg".to_string(),
                language: "en".to_string(),
                category: ZimCategory::Gutenberg,
                size: 3_000_000_000, // ~3 GB
                url: "https://download.kiwix.org/zim/other/gutenberg_en_all_2024-01.zim".to_string(),
                mirrors: vec![],
                date: Some(Utc::now()),
                sha256: Some("yza567...".to_string()),
                article_count: Some(70_000),
                media_count: Some(0),
                repository: repo_id.to_string(),
                tags: vec!["gutenberg".to_string(), "books".to_string(), "ebooks".to_string()],
                flavor: None,
            },
        ]
    }
    
    /// Search ZIM entries
    pub fn search(&self, query: &str, entries: &[ZimEntry]) -> Vec<ZimEntry> {
        let query_lower = query.to_lowercase();
        
        entries.iter()
            .filter(|e| {
                e.name.to_lowercase().contains(&query_lower) ||
                e.title.to_lowercase().contains(&query_lower) ||
                e.language.to_lowercase().contains(&query_lower) ||
                e.tags.iter().any(|t| t.to_lowercase().contains(&query_lower))
            })
            .cloned()
            .collect()
    }
    
    /// Filter entries by category
    pub fn filter_by_category(&self, category: &ZimCategory, entries: &[ZimEntry]) -> Vec<ZimEntry> {
        entries.iter()
            .filter(|e| &e.category == category)
            .cloned()
            .collect()
    }
    
    /// Filter entries by language
    pub fn filter_by_language(&self, language: &str, entries: &[ZimEntry]) -> Vec<ZimEntry> {
        entries.iter()
            .filter(|e| e.language == language)
            .cloned()
            .collect()
    }
}

impl Default for RepositoryClient {
    fn default() -> Self {
        Self::new().expect("Failed to create repository client")
    }
}
