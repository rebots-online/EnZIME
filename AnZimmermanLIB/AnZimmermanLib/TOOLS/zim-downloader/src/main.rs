//! ZIM Downloader - A TUI application for downloading ZIM files
//!
//! Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
//! 
//! This application provides a terminal-based interface for browsing and downloading
//! ZIM files from public repositories like Kiwix.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod config;
mod repository;
mod download;
mod tui;
mod ui;
mod theme;

use anyhow::Result;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn main() -> Result<()> {
    // Display copyright and version on startup
    println!();
    println!("╔════════════════════════════════════════════════════════════╗");
    println!("║           ZIM Downloader {}              ║", theme::get_version_string());
    println!("║                                                            ║");
    println!("║  {}  ║", theme::COPYRIGHT);
    println!("╚════════════════════════════════════════════════════════════╝");
    println!();

    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Check if running in TUI mode or Tauri mode
    let args: Vec<String> = std::env::args().collect();
    
    if args.contains(&"--tui".to_string()) || args.contains(&"-t".to_string()) {
        // Run TUI mode
        tui::run_tui()
    } else if args.contains(&"--version".to_string()) || args.contains(&"-V".to_string()) {
        // Already displayed above
        Ok(())
    } else {
        // Run Tauri application (headless with tray)
        run_tauri()
    }
}

fn run_tauri() -> Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            app::commands::get_repositories,
            app::commands::fetch_zim_list,
            app::commands::search_zim,
            app::commands::start_download,
            app::commands::pause_download,
            app::commands::resume_download,
            app::commands::cancel_download,
            app::commands::get_download_progress,
            app::commands::get_config,
            app::commands::set_config,
            app::commands::get_download_history,
        ])
        .setup(|app| {
            // Initialize app state
            app::init_app_state(app)?;
            
            tracing::info!("ZIM Downloader started");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    
    Ok(())
}
