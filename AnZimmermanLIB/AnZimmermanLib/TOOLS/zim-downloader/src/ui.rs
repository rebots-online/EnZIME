// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

//! UI rendering and application state for TUI
//!
//! Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

use anyhow::Result;
use humansize::{format_size, BINARY};
use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{
        Block, Borders, Clear, Gauge, List, ListItem, ListState, Paragraph, Tabs, Wrap,
    },
    Frame,
};

use crate::config::Config;
use crate::download::{DownloadManager, DownloadTask, DownloadStatus};
use crate::repository::{Repository, RepositoryClient, ZimEntry, REPOSITORIES};
use crate::theme::{Theme, ThemeName, ThemeMode, get_version_string};

pub type AppResult<T> = Result<T, Box<dyn std::error::Error>>;

/// Input mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputMode {
    Normal,
    Search,
    Settings,
}

/// Active tab
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tab {
    Browse,
    Downloads,
    History,
    Settings,
}

/// Application state
pub struct App {
    pub config: Config,
    pub repositories: Vec<&'static Repository>,
    pub current_repo: Option<String>,
    pub zim_entries: Vec<ZimEntry>,
    pub filtered_entries: Vec<ZimEntry>,
    pub download_manager: DownloadManager,
    
    pub active_tab: Tab,
    pub input_mode: InputMode,
    pub search_query: String,
    
    pub list_state: ListState,
    pub download_list_state: ListState,
    pub history_list_state: ListState,
    pub settings_index: usize,
    
    pub show_help: bool,
    pub show_settings: bool,
    pub status_message: Option<String>,
    
    // Theme support
    pub theme: Theme,
    pub theme_name: ThemeName,
    pub theme_mode: ThemeMode,
}

impl App {
    pub fn new() -> Result<Self> {
        let config = Config::load()?;
        let theme_name = ThemeName::default();
        let theme_mode = ThemeMode::default();
        let theme = Theme::new(theme_name, theme_mode);
        
        Ok(Self {
            config,
            repositories: REPOSITORIES.iter().collect(),
            current_repo: None,
            zim_entries: Vec::new(),
            filtered_entries: Vec::new(),
            download_manager: DownloadManager::new(),
            
            active_tab: Tab::Browse,
            input_mode: InputMode::Normal,
            search_query: String::new(),
            
            list_state: ListState::default(),
            download_list_state: ListState::default(),
            history_list_state: ListState::default(),
            settings_index: 0,
            
            show_help: false,
            show_settings: false,
            status_message: None,
            
            theme,
            theme_name,
            theme_mode,
        })
    }
    
    /// Cycle to next theme
    pub fn next_theme(&mut self) {
        self.theme_name = self.theme_name.next();
        self.theme = Theme::new(self.theme_name, self.theme_mode);
        self.status_message = Some(format!("Theme: {} - {}", self.theme_name.as_str(), self.theme_name.description()));
    }
    
    /// Toggle theme mode (light/dark/system)
    pub fn toggle_theme_mode(&mut self) {
        self.theme_mode = self.theme_mode.next();
        self.theme = Theme::new(self.theme_name, self.theme_mode);
        self.status_message = Some(format!("Theme mode: {}", self.theme_mode.as_str()));
    }
    
    pub fn next_tab(&mut self) {
        self.active_tab = match self.active_tab {
            Tab::Browse => Tab::Downloads,
            Tab::Downloads => Tab::History,
            Tab::History => Tab::Settings,
            Tab::Settings => Tab::Browse,
        };
    }
    
    pub fn previous_tab(&mut self) {
        self.active_tab = match self.active_tab {
            Tab::Browse => Tab::Settings,
            Tab::Downloads => Tab::Browse,
            Tab::History => Tab::Downloads,
            Tab::Settings => Tab::History,
        };
    }
    
    pub fn next_item(&mut self) {
        let len = match self.active_tab {
            Tab::Browse => self.filtered_entries.len(),
            Tab::Downloads => 0, // TODO: get active downloads
            Tab::History => 0,   // TODO: get history
            Tab::Settings => 5,  // Number of settings
        };
        
        if len == 0 {
            return;
        }
        
        let state = match self.active_tab {
            Tab::Browse => &mut self.list_state,
            Tab::Downloads => &mut self.download_list_state,
            Tab::History => &mut self.history_list_state,
            Tab::Settings => {
                self.settings_index = (self.settings_index + 1) % len;
                return;
            }
        };
        
        let i = match state.selected() {
            Some(i) => (i + 1) % len,
            None => 0,
        };
        state.select(Some(i));
    }
    
    pub fn previous_item(&mut self) {
        let len = match self.active_tab {
            Tab::Browse => self.filtered_entries.len(),
            Tab::Downloads => 0,
            Tab::History => 0,
            Tab::Settings => 5,
        };
        
        if len == 0 {
            return;
        }
        
        let state = match self.active_tab {
            Tab::Browse => &mut self.list_state,
            Tab::Downloads => &mut self.download_list_state,
            Tab::History => &mut self.history_list_state,
            Tab::Settings => {
                self.settings_index = if self.settings_index == 0 {
                    len - 1
                } else {
                    self.settings_index - 1
                };
                return;
            }
        };
        
        let i = match state.selected() {
            Some(i) => {
                if i == 0 { len - 1 } else { i - 1 }
            }
            None => 0,
        };
        state.select(Some(i));
    }
    
    pub async fn fetch_repositories(&mut self) {
        self.repositories = REPOSITORIES.iter().collect();
    }
    
    pub async fn fetch_zim_list(&mut self) {
        if let Some(repo_id) = &self.current_repo {
            let mut client = RepositoryClient::new().unwrap();
            if let Ok(entries) = client.fetch_zim_list(repo_id).await {
                self.zim_entries = entries.clone();
                self.filtered_entries = entries;
                self.list_state.select(Some(0));
            }
        }
    }
    
    pub async fn select_item(&mut self) {
        match self.active_tab {
            Tab::Browse => {
                // Select repository or ZIM entry
                if let Some(i) = self.list_state.selected() {
                    if i < self.repositories.len() && self.zim_entries.is_empty() {
                        // Select repository
                        self.current_repo = Some(self.repositories[i].id.to_string());
                        self.fetch_zim_list().await;
                    }
                }
            }
            _ => {}
        }
    }
    
    pub async fn search(&mut self) {
        if self.search_query.is_empty() {
            self.filtered_entries = self.zim_entries.clone();
        } else {
            let query = self.search_query.to_lowercase();
            self.filtered_entries = self.zim_entries.iter()
                .filter(|e| {
                    e.name.to_lowercase().contains(&query) ||
                    e.title.to_lowercase().contains(&query) ||
                    e.language.to_lowercase().contains(&query)
                })
                .cloned()
                .collect();
        }
        self.list_state.select(Some(0));
    }
    
    pub async fn start_download(&mut self) {
        if let Some(i) = self.list_state.selected() {
            if i < self.filtered_entries.len() {
                let zim = self.filtered_entries[i].clone();
                match self.download_manager.add_download(zim.clone(), &self.config.download_dir).await {
                    Ok(task_id) => {
                        let _ = self.download_manager.start_download(&task_id).await;
                        self.status_message = Some(format!("Started download: {}", zim.name));
                    }
                    Err(e) => {
                        self.status_message = Some(format!("Error: {}", e));
                    }
                }
            }
        }
    }
    
    pub async fn pause_download(&mut self) {
        // TODO: Pause selected download
    }
    
    pub async fn resume_download(&mut self) {
        // TODO: Resume selected download
    }
    
    pub async fn cancel_download(&mut self) {
        // TODO: Cancel selected download
    }
    
    pub async fn update_downloads(&mut self) {
        // Download progress is updated automatically in the download manager
    }
    
    pub fn next_setting(&mut self) {
        self.settings_index = (self.settings_index + 1) % 5;
    }
    
    pub fn previous_setting(&mut self) {
        self.settings_index = if self.settings_index == 0 { 4 } else { self.settings_index - 1 };
    }
    
    pub fn edit_setting(&mut self, _c: char) {
        // TODO: Edit current setting
    }
    
    pub fn backspace_setting(&mut self) {
        // TODO: Remove character from setting
    }
    
    pub fn save_settings(&mut self) {
        let _ = self.config.save();
        self.status_message = Some("Settings saved!".to_string());
    }
}

/// Draw the main UI
pub fn draw(f: &mut Frame, app: &mut App) {
    let size = f.area();
    
    // Main layout
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // Header
            Constraint::Min(0),     // Content
            Constraint::Length(3),  // Footer
        ])
        .split(size);
    
    draw_header(f, app, chunks[0]);
    draw_content(f, app, chunks[1]);
    draw_footer(f, app, chunks[2]);
    
    // Draw help popup if active
    if app.show_help {
        draw_help_popup(f, app, size);
    }
    
    // Draw settings popup if active
    if app.show_settings {
        draw_settings_popup(f, app, size);
    }
}

fn draw_header(f: &mut Frame, app: &App, area: Rect) {
    let titles = vec!["📚 Browse", "⬇️ Downloads", "📜 History", "⚙️ Settings"];
    let tabs = Tabs::new(titles)
        .block(Block::default()
            .borders(Borders::ALL)
            .title(" ZIM Downloader ")
            .border_style(Style::default().fg(app.theme.border)))
        .select(match app.active_tab {
            Tab::Browse => 0,
            Tab::Downloads => 1,
            Tab::History => 2,
            Tab::Settings => 3,
        })
        .style(Style::default().fg(app.theme.fg).bg(app.theme.bg))
        .highlight_style(Style::default().fg(app.theme.accent).add_modifier(Modifier::BOLD));
    
    f.render_widget(tabs, area);
}

fn draw_content(f: &mut Frame, app: &mut App, area: Rect) {
    match app.active_tab {
        Tab::Browse => draw_browse_tab(f, app, area),
        Tab::Downloads => draw_downloads_tab(f, app, area),
        Tab::History => draw_history_tab(f, app, area),
        Tab::Settings => draw_settings_tab(f, app, area),
    }
}

fn draw_browse_tab(f: &mut Frame, app: &mut App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(30), Constraint::Percentage(70)])
        .split(area);
    
    // Repository list
    let repo_items: Vec<ListItem> = app.repositories.iter()
        .map(|r| {
            ListItem::new(format!("{} {}", r.icon, r.name))
                .style(Style::default().fg(app.theme.fg))
        })
        .collect();
    
    let repos = List::new(repo_items)
        .block(Block::default()
            .borders(Borders::ALL)
            .title(" Repositories ")
            .border_style(Style::default().fg(app.theme.border))
            .style(Style::default().bg(app.theme.bg)))
        .highlight_style(Style::default().bg(app.theme.selection_bg).fg(app.theme.selection_fg).add_modifier(Modifier::BOLD))
        .highlight_symbol("▶ ");
    
    f.render_widget(repos, chunks[0]);
    
    // ZIM file list
    let zim_items: Vec<ListItem> = app.filtered_entries.iter()
        .map(|z| {
            let size_str = format_size(z.size, BINARY);
            let line = Line::from(vec![
                Span::styled(&z.name, Style::default().fg(app.theme.accent)),
                Span::raw(" "),
                Span::styled(format!("[{}]", z.language.to_uppercase()), Style::default().fg(app.theme.warning)),
                Span::raw(" "),
                Span::styled(size_str, Style::default().fg(app.theme.success)),
            ]);
            ListItem::new(line)
        })
        .collect();
    
    let title = if app.search_query.is_empty() {
        " ZIM Files ".to_string()
    } else {
        format!(" ZIM Files (search: {}) ", app.search_query)
    };
    
    let zims = List::new(zim_items)
        .block(Block::default()
            .borders(Borders::ALL)
            .title(title)
            .border_style(Style::default().fg(app.theme.border))
            .style(Style::default().bg(app.theme.bg)))
        .highlight_style(Style::default().bg(app.theme.selection_bg).fg(app.theme.selection_fg).add_modifier(Modifier::BOLD))
        .highlight_symbol("▶ ");
    
    f.render_stateful_widget(zims, chunks[1], &mut app.list_state);
}

fn draw_downloads_tab(f: &mut Frame, app: &mut App, area: Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .title(" Active Downloads ")
        .border_style(Style::default().fg(app.theme.border))
        .style(Style::default().bg(app.theme.bg));
    
    // Get active downloads
    let rt = tokio::runtime::Handle::try_current();
    let tasks: Vec<DownloadTask> = if let Ok(handle) = rt {
        handle.block_on(async {
            app.download_manager.get_active_tasks().await
        })
    } else {
        Vec::new()
    };
    
    if tasks.is_empty() {
        let text = Paragraph::new("No active downloads.\n\nPress 'd' on a ZIM file in Browse tab to start a download.")
            .block(block)
            .style(Style::default().fg(app.theme.muted))
            .alignment(Alignment::Center);
        f.render_widget(text, area);
    } else {
        let items: Vec<ListItem> = tasks.iter()
            .map(|t| {
                let progress = t.progress();
                let speed = format_size(t.speed, BINARY);
                let downloaded = format_size(t.downloaded, BINARY);
                let total = format_size(t.total, BINARY);
                
                let status_color = match t.status {
                    DownloadStatus::Downloading => app.theme.success,
                    DownloadStatus::Paused => app.theme.warning,
                    DownloadStatus::Failed => app.theme.error,
                    _ => app.theme.fg,
                };
                
                let line = Line::from(vec![
                    Span::styled(
                        format!("{:?}", t.status),
                        Style::default().fg(status_color)
                    ),
                    Span::raw(" "),
                    Span::styled(&t.zim.name, Style::default().fg(app.theme.accent)),
                    Span::styled(format!(" {}/{} ({:.1}%) {}/s", downloaded, total, progress, speed), Style::default().fg(app.theme.info)),
                ]);
                ListItem::new(line)
            })
            .collect();
        
        let list = List::new(items)
            .block(block)
            .highlight_style(Style::default().bg(app.theme.selection_bg).fg(app.theme.selection_fg));
        
        f.render_stateful_widget(list, area, &mut app.download_list_state);
    }
}

fn draw_history_tab(f: &mut Frame, app: &mut App, area: Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .title(" Download History ")
        .border_style(Style::default().fg(app.theme.border))
        .style(Style::default().bg(app.theme.bg));
    
    let text = Paragraph::new("Download history will appear here.")
        .block(block)
        .style(Style::default().fg(app.theme.muted))
        .alignment(Alignment::Center);
    
    f.render_widget(text, area);
}

fn draw_settings_tab(f: &mut Frame, app: &mut App, area: Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .title(" Settings ")
        .border_style(Style::default().fg(app.theme.border))
        .style(Style::default().bg(app.theme.bg));
    
    let settings = vec![
        format!("Download Directory: {}", app.config.download_dir.display()),
        format!("Max Concurrent Downloads: {}", app.config.max_concurrent_downloads),
        format!("Enable Resume: {}", app.config.enable_resume),
        format!("Verify Checksums: {}", app.config.verify_checksums),
        format!("Speed Limit: {} (0 = unlimited)", app.config.speed_limit),
        format!("Theme: {} (press 't' to change)", app.theme_name.as_str()),
        format!("Mode: {} (press 'm' to toggle)", app.theme_mode.as_str()),
    ];
    
    let items: Vec<ListItem> = settings.iter()
        .enumerate()
        .map(|(i, s)| {
            let style = if i == app.settings_index {
                Style::default().fg(app.theme.accent).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(app.theme.fg)
            };
            ListItem::new(Span::styled(s.clone(), style))
        })
        .collect();
    
    let list = List::new(items).block(block);
    f.render_widget(list, area);
}

fn draw_footer(f: &mut Frame, app: &App, area: Rect) {
    let help = match app.input_mode {
        InputMode::Normal => {
            "q: Quit | Tab: Switch | ↑↓: Nav | d: Download | /: Search | t: Theme | m: Mode | ?: Help"
        }
        InputMode::Search => {
            "Enter: Search | Esc: Cancel"
        }
        InputMode::Settings => {
            "Enter: Save | Esc: Cancel | ↑↓: Navigate"
        }
    };
    
    // Build footer with version on the right (per global_rules.md)
    let version_str = get_version_string();
    let theme_info = format!("[{}/{}]", app.theme_name.as_str(), app.theme_mode.as_str());
    
    let left_text = if let Some(ref msg) = app.status_message {
        format!("{} | {}", msg, help)
    } else {
        help.to_string()
    };
    
    // Split footer into left (help) and right (version/theme)
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Min(0), Constraint::Length(35)])
        .split(area);
    
    let left_paragraph = Paragraph::new(left_text)
        .block(Block::default().borders(Borders::ALL))
        .style(Style::default().fg(app.theme.muted));
    
    let right_text = format!("{} {}", theme_info, version_str);
    let right_paragraph = Paragraph::new(right_text)
        .block(Block::default().borders(Borders::ALL))
        .style(Style::default().fg(app.theme.accent))
        .alignment(Alignment::Right);
    
    f.render_widget(left_paragraph, chunks[0]);
    f.render_widget(right_paragraph, chunks[1]);
}

fn draw_help_popup(f: &mut Frame, app: &App, area: Rect) {
    let popup_area = centered_rect(60, 70, area);
    
    f.render_widget(Clear, popup_area);
    
    let help_text = r#"
    ZIM Downloader - Keyboard Shortcuts
    ═══════════════════════════════════
    
    Navigation:
      Tab         Switch between tabs
      ↑/k         Move up
      ↓/j         Move down
      Enter       Select item
    
    Actions:
      d           Download selected ZIM
      p           Pause download
      r           Resume download
      c           Cancel download
      /           Search
      s           Settings
    
    Theming:
      t           Cycle through themes
      m           Toggle light/dark/system mode
    
    General:
      ?/F1        Toggle this help
      Esc         Close popup
      q           Quit application
    
    Press any key to close this help
    "#;
    
    let paragraph = Paragraph::new(help_text)
        .block(Block::default()
            .borders(Borders::ALL)
            .title(" Help ")
            .border_style(Style::default().fg(app.theme.accent)))
        .style(Style::default().fg(app.theme.fg).bg(app.theme.bg))
        .alignment(Alignment::Left);
    
    f.render_widget(paragraph, popup_area);
}

fn draw_settings_popup(f: &mut Frame, app: &App, area: Rect) {
    let popup_area = centered_rect(50, 50, area);
    
    f.render_widget(Clear, popup_area);
    
    let text = format!(
        "Download Directory:\n{}\n\nMax Downloads: {}\nResume: {}\nVerify: {}\n\nTheme: {} ({})\nDescription: {}",
        app.config.download_dir.display(),
        app.config.max_concurrent_downloads,
        app.config.enable_resume,
        app.config.verify_checksums,
        app.theme_name.as_str(),
        app.theme_mode.as_str(),
        app.theme_name.description()
    );
    
    let paragraph = Paragraph::new(text)
        .block(Block::default()
            .borders(Borders::ALL)
            .title(" Settings ")
            .border_style(Style::default().fg(app.theme.accent)))
        .style(Style::default().fg(app.theme.fg).bg(app.theme.bg))
        .wrap(Wrap { trim: true });
    
    f.render_widget(paragraph, popup_area);
}

/// Create a centered rectangle
fn centered_rect(percent_x: u16, percent_y: u16, area: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(area);
    
    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}
