// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

//! Theme System for ZIM Downloader
//!
//! Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
//!
//! Provides 9 beautiful themes including Kinetic, Brutalist, Retro, Cyberpunk, and more.
//! Supports light/dark/system-auto toggling.

use ratatui::style::{Color, Modifier, Style};
use serde::{Deserialize, Serialize};

/// Version information
pub const VERSION: &str = "1.0.0";
pub const COPYRIGHT: &str = "Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.";

/// Calculate epoch-based 5-digit build number
pub fn get_build_number() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let epoch_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let epoch_minutes = epoch_secs / 60;
    format!("{:05}", epoch_minutes % 100000)
}

/// Get full version string with build number
pub fn get_version_string() -> String {
    format!("v{} (build {})", VERSION, get_build_number())
}

/// Theme mode (light/dark/system)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ThemeMode {
    Light,
    #[default]
    Dark,
    System,
}

impl ThemeMode {
    pub fn next(&self) -> Self {
        match self {
            ThemeMode::Light => ThemeMode::Dark,
            ThemeMode::Dark => ThemeMode::System,
            ThemeMode::System => ThemeMode::Light,
        }
    }
    
    pub fn as_str(&self) -> &'static str {
        match self {
            ThemeMode::Light => "Light",
            ThemeMode::Dark => "Dark",
            ThemeMode::System => "System",
        }
    }
}

/// Available themes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ThemeName {
    #[default]
    Kinetic,
    Brutalist,
    Retro,
    Neumorphism,
    Glassmorphism,
    Y2K,
    Cyberpunk,
    Minimal,
    Nordic,
}

impl ThemeName {
    pub fn all() -> &'static [ThemeName] {
        &[
            ThemeName::Kinetic,
            ThemeName::Brutalist,
            ThemeName::Retro,
            ThemeName::Neumorphism,
            ThemeName::Glassmorphism,
            ThemeName::Y2K,
            ThemeName::Cyberpunk,
            ThemeName::Minimal,
            ThemeName::Nordic,
        ]
    }
    
    pub fn next(&self) -> Self {
        let themes = Self::all();
        let idx = themes.iter().position(|t| t == self).unwrap_or(0);
        themes[(idx + 1) % themes.len()]
    }
    
    pub fn prev(&self) -> Self {
        let themes = Self::all();
        let idx = themes.iter().position(|t| t == self).unwrap_or(0);
        if idx == 0 {
            themes[themes.len() - 1]
        } else {
            themes[idx - 1]
        }
    }
    
    pub fn as_str(&self) -> &'static str {
        match self {
            ThemeName::Kinetic => "Kinetic",
            ThemeName::Brutalist => "Brutalist",
            ThemeName::Retro => "Retro",
            ThemeName::Neumorphism => "Neumorphism",
            ThemeName::Glassmorphism => "Glassmorphism",
            ThemeName::Y2K => "Y2K",
            ThemeName::Cyberpunk => "Cyberpunk",
            ThemeName::Minimal => "Minimal",
            ThemeName::Nordic => "Nordic",
        }
    }
    
    pub fn description(&self) -> &'static str {
        match self {
            ThemeName::Kinetic => "Colorful, dynamic, Gumroad-inspired design",
            ThemeName::Brutalist => "Raw, honest, monospace aesthetic",
            ThemeName::Retro => "CRT terminal vibes with scanlines",
            ThemeName::Neumorphism => "Soft shadows, extruded surfaces",
            ThemeName::Glassmorphism => "Frosted glass with depth",
            ThemeName::Y2K => "Early 2000s web maximalism",
            ThemeName::Cyberpunk => "Neon-soaked dystopian future",
            ThemeName::Minimal => "Clean Swiss design",
            ThemeName::Nordic => "Cool, calm, Scandinavian palette",
        }
    }
}

/// Theme colors and styles
#[derive(Debug, Clone)]
pub struct Theme {
    pub name: ThemeName,
    pub mode: ThemeMode,
    
    // Primary colors
    pub bg: Color,
    pub fg: Color,
    pub accent: Color,
    pub accent_secondary: Color,
    
    // Semantic colors
    pub success: Color,
    pub warning: Color,
    pub error: Color,
    pub info: Color,
    
    // UI elements
    pub border: Color,
    pub selection_bg: Color,
    pub selection_fg: Color,
    pub muted: Color,
    pub highlight: Color,
}

impl Theme {
    pub fn new(name: ThemeName, mode: ThemeMode) -> Self {
        let is_dark = match mode {
            ThemeMode::Dark => true,
            ThemeMode::Light => false,
            ThemeMode::System => true, // Default to dark for terminal
        };
        
        match name {
            ThemeName::Kinetic => Self::kinetic(is_dark),
            ThemeName::Brutalist => Self::brutalist(is_dark),
            ThemeName::Retro => Self::retro(is_dark),
            ThemeName::Neumorphism => Self::neumorphism(is_dark),
            ThemeName::Glassmorphism => Self::glassmorphism(is_dark),
            ThemeName::Y2K => Self::y2k(is_dark),
            ThemeName::Cyberpunk => Self::cyberpunk(is_dark),
            ThemeName::Minimal => Self::minimal(is_dark),
            ThemeName::Nordic => Self::nordic(is_dark),
        }
    }
    
    fn kinetic(is_dark: bool) -> Self {
        if is_dark {
            Self {
                name: ThemeName::Kinetic,
                mode: ThemeMode::Dark,
                bg: Color::Rgb(26, 26, 46),
                fg: Color::Rgb(255, 255, 255),
                accent: Color::Rgb(255, 107, 107),
                accent_secondary: Color::Rgb(78, 205, 196),
                success: Color::Rgb(46, 213, 115),
                warning: Color::Rgb(255, 193, 7),
                error: Color::Rgb(255, 71, 87),
                info: Color::Rgb(116, 185, 255),
                border: Color::Rgb(58, 58, 82),
                selection_bg: Color::Rgb(255, 107, 107),
                selection_fg: Color::Rgb(255, 255, 255),
                muted: Color::Rgb(128, 128, 160),
                highlight: Color::Rgb(255, 234, 167),
            }
        } else {
            Self {
                name: ThemeName::Kinetic,
                mode: ThemeMode::Light,
                bg: Color::Rgb(255, 255, 255),
                fg: Color::Rgb(26, 26, 46),
                accent: Color::Rgb(255, 71, 87),
                accent_secondary: Color::Rgb(0, 184, 169),
                success: Color::Rgb(0, 168, 107),
                warning: Color::Rgb(255, 152, 0),
                error: Color::Rgb(220, 53, 69),
                info: Color::Rgb(0, 123, 255),
                border: Color::Rgb(200, 200, 220),
                selection_bg: Color::Rgb(255, 71, 87),
                selection_fg: Color::Rgb(255, 255, 255),
                muted: Color::Rgb(120, 120, 140),
                highlight: Color::Rgb(255, 193, 7),
            }
        }
    }
    
    fn brutalist(is_dark: bool) -> Self {
        if is_dark {
            Self {
                name: ThemeName::Brutalist,
                mode: ThemeMode::Dark,
                bg: Color::Black,
                fg: Color::White,
                accent: Color::White,
                accent_secondary: Color::Gray,
                success: Color::Green,
                warning: Color::Yellow,
                error: Color::Red,
                info: Color::Cyan,
                border: Color::White,
                selection_bg: Color::White,
                selection_fg: Color::Black,
                muted: Color::DarkGray,
                highlight: Color::Yellow,
            }
        } else {
            Self {
                name: ThemeName::Brutalist,
                mode: ThemeMode::Light,
                bg: Color::White,
                fg: Color::Black,
                accent: Color::Black,
                accent_secondary: Color::DarkGray,
                success: Color::Rgb(0, 128, 0),
                warning: Color::Rgb(204, 153, 0),
                error: Color::Rgb(204, 0, 0),
                info: Color::Rgb(0, 102, 153),
                border: Color::Black,
                selection_bg: Color::Black,
                selection_fg: Color::White,
                muted: Color::Gray,
                highlight: Color::Rgb(204, 153, 0),
            }
        }
    }
    
    fn retro(is_dark: bool) -> Self {
        Self {
            name: ThemeName::Retro,
            mode: if is_dark { ThemeMode::Dark } else { ThemeMode::Light },
            bg: Color::Rgb(0, 40, 0),
            fg: Color::Rgb(0, 255, 0),
            accent: Color::Rgb(0, 255, 0),
            accent_secondary: Color::Rgb(0, 180, 0),
            success: Color::Rgb(0, 255, 0),
            warning: Color::Rgb(255, 255, 0),
            error: Color::Rgb(255, 0, 0),
            info: Color::Rgb(0, 200, 255),
            border: Color::Rgb(0, 180, 0),
            selection_bg: Color::Rgb(0, 180, 0),
            selection_fg: Color::Black,
            muted: Color::Rgb(0, 100, 0),
            highlight: Color::Rgb(255, 255, 0),
        }
    }
    
    fn neumorphism(is_dark: bool) -> Self {
        if is_dark {
            Self {
                name: ThemeName::Neumorphism,
                mode: ThemeMode::Dark,
                bg: Color::Rgb(44, 44, 60),
                fg: Color::Rgb(220, 220, 230),
                accent: Color::Rgb(100, 120, 255),
                accent_secondary: Color::Rgb(140, 160, 255),
                success: Color::Rgb(100, 200, 100),
                warning: Color::Rgb(255, 200, 100),
                error: Color::Rgb(255, 100, 100),
                info: Color::Rgb(100, 180, 255),
                border: Color::Rgb(60, 60, 80),
                selection_bg: Color::Rgb(60, 60, 80),
                selection_fg: Color::Rgb(140, 160, 255),
                muted: Color::Rgb(100, 100, 120),
                highlight: Color::Rgb(140, 160, 255),
            }
        } else {
            Self {
                name: ThemeName::Neumorphism,
                mode: ThemeMode::Light,
                bg: Color::Rgb(230, 230, 240),
                fg: Color::Rgb(60, 60, 80),
                accent: Color::Rgb(80, 100, 220),
                accent_secondary: Color::Rgb(120, 140, 255),
                success: Color::Rgb(60, 160, 60),
                warning: Color::Rgb(220, 160, 60),
                error: Color::Rgb(220, 60, 60),
                info: Color::Rgb(60, 140, 220),
                border: Color::Rgb(200, 200, 210),
                selection_bg: Color::Rgb(200, 200, 210),
                selection_fg: Color::Rgb(80, 100, 220),
                muted: Color::Rgb(140, 140, 160),
                highlight: Color::Rgb(120, 140, 255),
            }
        }
    }
    
    fn glassmorphism(is_dark: bool) -> Self {
        Self {
            name: ThemeName::Glassmorphism,
            mode: if is_dark { ThemeMode::Dark } else { ThemeMode::Light },
            bg: Color::Rgb(30, 30, 50),
            fg: Color::Rgb(255, 255, 255),
            accent: Color::Rgb(138, 180, 248),
            accent_secondary: Color::Rgb(180, 130, 255),
            success: Color::Rgb(100, 220, 150),
            warning: Color::Rgb(255, 200, 100),
            error: Color::Rgb(255, 100, 130),
            info: Color::Rgb(100, 180, 255),
            border: Color::Rgb(80, 80, 120),
            selection_bg: Color::Rgb(80, 80, 120),
            selection_fg: Color::Rgb(255, 255, 255),
            muted: Color::Rgb(120, 120, 160),
            highlight: Color::Rgb(180, 130, 255),
        }
    }
    
    fn y2k(is_dark: bool) -> Self {
        Self {
            name: ThemeName::Y2K,
            mode: if is_dark { ThemeMode::Dark } else { ThemeMode::Light },
            bg: Color::Rgb(0, 0, 128),
            fg: Color::Rgb(255, 255, 255),
            accent: Color::Rgb(255, 0, 255),
            accent_secondary: Color::Rgb(0, 255, 255),
            success: Color::Rgb(0, 255, 0),
            warning: Color::Rgb(255, 255, 0),
            error: Color::Rgb(255, 0, 0),
            info: Color::Rgb(0, 255, 255),
            border: Color::Rgb(192, 192, 192),
            selection_bg: Color::Rgb(0, 0, 180),
            selection_fg: Color::Rgb(255, 255, 0),
            muted: Color::Rgb(128, 128, 192),
            highlight: Color::Rgb(255, 255, 0),
        }
    }
    
    fn cyberpunk(is_dark: bool) -> Self {
        Self {
            name: ThemeName::Cyberpunk,
            mode: if is_dark { ThemeMode::Dark } else { ThemeMode::Light },
            bg: Color::Rgb(13, 2, 33),
            fg: Color::Rgb(255, 255, 255),
            accent: Color::Rgb(255, 0, 128),
            accent_secondary: Color::Rgb(0, 255, 255),
            success: Color::Rgb(0, 255, 136),
            warning: Color::Rgb(255, 255, 0),
            error: Color::Rgb(255, 0, 64),
            info: Color::Rgb(0, 200, 255),
            border: Color::Rgb(255, 0, 128),
            selection_bg: Color::Rgb(255, 0, 128),
            selection_fg: Color::Rgb(255, 255, 255),
            muted: Color::Rgb(128, 0, 128),
            highlight: Color::Rgb(0, 255, 255),
        }
    }
    
    fn minimal(is_dark: bool) -> Self {
        if is_dark {
            Self {
                name: ThemeName::Minimal,
                mode: ThemeMode::Dark,
                bg: Color::Rgb(24, 24, 24),
                fg: Color::Rgb(240, 240, 240),
                accent: Color::Rgb(100, 100, 100),
                accent_secondary: Color::Rgb(160, 160, 160),
                success: Color::Rgb(100, 180, 100),
                warning: Color::Rgb(220, 180, 80),
                error: Color::Rgb(220, 80, 80),
                info: Color::Rgb(80, 160, 220),
                border: Color::Rgb(60, 60, 60),
                selection_bg: Color::Rgb(60, 60, 60),
                selection_fg: Color::Rgb(255, 255, 255),
                muted: Color::Rgb(100, 100, 100),
                highlight: Color::Rgb(160, 160, 160),
            }
        } else {
            Self {
                name: ThemeName::Minimal,
                mode: ThemeMode::Light,
                bg: Color::Rgb(250, 250, 250),
                fg: Color::Rgb(30, 30, 30),
                accent: Color::Rgb(100, 100, 100),
                accent_secondary: Color::Rgb(60, 60, 60),
                success: Color::Rgb(40, 120, 40),
                warning: Color::Rgb(180, 140, 40),
                error: Color::Rgb(180, 40, 40),
                info: Color::Rgb(40, 100, 180),
                border: Color::Rgb(200, 200, 200),
                selection_bg: Color::Rgb(220, 220, 220),
                selection_fg: Color::Rgb(30, 30, 30),
                muted: Color::Rgb(140, 140, 140),
                highlight: Color::Rgb(60, 60, 60),
            }
        }
    }
    
    fn nordic(is_dark: bool) -> Self {
        if is_dark {
            Self {
                name: ThemeName::Nordic,
                mode: ThemeMode::Dark,
                bg: Color::Rgb(46, 52, 64),
                fg: Color::Rgb(236, 239, 244),
                accent: Color::Rgb(136, 192, 208),
                accent_secondary: Color::Rgb(129, 161, 193),
                success: Color::Rgb(163, 190, 140),
                warning: Color::Rgb(235, 203, 139),
                error: Color::Rgb(191, 97, 106),
                info: Color::Rgb(94, 129, 172),
                border: Color::Rgb(67, 76, 94),
                selection_bg: Color::Rgb(67, 76, 94),
                selection_fg: Color::Rgb(236, 239, 244),
                muted: Color::Rgb(76, 86, 106),
                highlight: Color::Rgb(180, 142, 173),
            }
        } else {
            Self {
                name: ThemeName::Nordic,
                mode: ThemeMode::Light,
                bg: Color::Rgb(236, 239, 244),
                fg: Color::Rgb(46, 52, 64),
                accent: Color::Rgb(94, 129, 172),
                accent_secondary: Color::Rgb(129, 161, 193),
                success: Color::Rgb(143, 170, 120),
                warning: Color::Rgb(215, 153, 33),
                error: Color::Rgb(191, 97, 106),
                info: Color::Rgb(94, 129, 172),
                border: Color::Rgb(216, 222, 233),
                selection_bg: Color::Rgb(216, 222, 233),
                selection_fg: Color::Rgb(46, 52, 64),
                muted: Color::Rgb(76, 86, 106),
                highlight: Color::Rgb(180, 142, 173),
            }
        }
    }
    
    // Style helpers
    pub fn style_normal(&self) -> Style {
        Style::default().fg(self.fg).bg(self.bg)
    }
    
    pub fn style_accent(&self) -> Style {
        Style::default().fg(self.accent)
    }
    
    pub fn style_muted(&self) -> Style {
        Style::default().fg(self.muted)
    }
    
    pub fn style_highlight(&self) -> Style {
        Style::default().fg(self.highlight).add_modifier(Modifier::BOLD)
    }
    
    pub fn style_selection(&self) -> Style {
        Style::default().fg(self.selection_fg).bg(self.selection_bg)
    }
    
    pub fn style_success(&self) -> Style {
        Style::default().fg(self.success)
    }
    
    pub fn style_warning(&self) -> Style {
        Style::default().fg(self.warning)
    }
    
    pub fn style_error(&self) -> Style {
        Style::default().fg(self.error)
    }
    
    pub fn style_info(&self) -> Style {
        Style::default().fg(self.info)
    }
    
    pub fn style_border(&self) -> Style {
        Style::default().fg(self.border)
    }
}

impl Default for Theme {
    fn default() -> Self {
        Self::new(ThemeName::default(), ThemeMode::default())
    }
}
