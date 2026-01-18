// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::{SystemTime, UNIX_EPOCH};

/// Get the epoch-based build number (last 5 digits of epoch minutes)
fn get_build_number() -> u64 {
    let start = SystemTime::now();
    let since_epoch = start
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards");
    let epoch_minutes = since_epoch.as_secs() / 60;
    epoch_minutes % 100000
}

/// Get version string with build number
#[tauri::command]
fn get_version() -> String {
    let build = get_build_number();
    format!("v0.1.0.{:05}", build)
}

/// Get copyright notice
#[tauri::command]
fn get_copyright() -> String {
    "Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.".to_string()
}

/// Get application info for About dialog
#[tauri::command]
fn get_app_info() -> serde_json::Value {
    let build = get_build_number();
    serde_json::json!({
        "name": "EnZIM",
        "version": format!("v0.1.0.{:05}", build),
        "description": "Offline ZIM Reader & Knowledge Explorer",
        "copyright": "Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.",
        "license": "All rights reserved"
    })
}

fn main() {
    // Print startup banner
    let build = get_build_number();
    println!("EnZIM v0.1.0.{:05} - Offline ZIM Reader & Knowledge Explorer", build);
    println!("Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.");
    println!();
    println!("Please wait... Initializing...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_version,
            get_copyright,
            get_app_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
