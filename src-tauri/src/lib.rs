//! EnZIME Tauri application library
//!
//! E-BLD-38: Tauri 2 entry-point library; exposes `pub fn run()` which
//! `main.rs` calls. Wires `AppState::build_for_<flavor>` per cargo feature,
//! registers Tauri command handlers, installs panic handler (E-PANIC-1)
//! and logger (E-LOG-1), runs the Tauri builder.

use std::sync::Arc;

mod ai;
mod app_update;
mod billing;
mod commands;
mod error;
mod global_search;
mod launch;
mod log;
mod model_fetcher;
mod pack_catalog;
mod panic;
mod paths;
#[cfg(target_os = "android")]
mod platform_android;
mod sidecar;
mod state;
mod storage;
mod window_state;

use state::AppState;
use paths::AppPaths;
use error::AppError;

/// E-BLD-38: Tauri 2 entry point.
///
/// Wires `AppState::build_for_<flavor>` per cargo feature, registers Tauri
/// command handlers, installs panic handler (E-PANIC-1) and logger (E-LOG-1),
/// runs the Tauri builder. Process exits via Tauri builder.
pub fn run() {
    // Resolve application paths
    let paths = AppPaths::resolve().expect("failed to resolve app paths");

    // Install panic handler (E-PANIC-1)
    panic::install_panic_handler(&paths);

    // Initialize logger (E-LOG-1)
    let _logger = log::EnzimeLogger::init(&paths).expect("failed to initialize logger");

    // Build AppState for the active flavor
    let app_state = build_state_for_flavor().expect("failed to build app state");

    // Build and run Tauri app
    tauri::Builder::default()
        .manage(app_state)
        // ZIM commands (E-CMD-1 through E-CMD-7)
        .invoke_handler(tauri::generate_handler![
            commands::enzime_version,
            commands::zim_open,
            commands::zim_get_article,
            commands::zim_list_articles,
            commands::zim_metadata,
            commands::zim_close,
            commands::zim_search,
            // AI commands (E-CMD-8 through E-CMD-12)
            commands::ai_chat,
            commands::ai_chat_stream,
            commands::ai_voice_chat,
            commands::ai_load_model,
            commands::ai_unload_model,
            // Annotation commands (E-CMD-13 through E-CMD-17)
            commands::annotations_list,
            commands::annotations_create,
            commands::annotations_delete,
            commands::annotations_export,
            commands::annotations_import,
            // Bookmark commands (E-CMD-18, E-CMD-19)
            commands::bookmarks_list,
            commands::bookmarks_toggle,
            // Chat history commands (E-CMD-20 through E-CMD-22)
            commands::chat_history_list,
            commands::chat_history_append,
            commands::chat_history_clear,
            // Settings commands (E-CMD-23, E-CMD-24)
            commands::settings_get,
            commands::settings_set,
            // Entitlement commands (E-CMD-25 through E-CMD-27)
            commands::entitlement_check,
            commands::billing_open_paywall,
            commands::billing_restore_purchases,
            // Device/variant commands (E-CMD-28 through E-CMD-31)
            commands::device_probe,
            commands::variant_current,
            commands::variant_override,
            commands::model_fetch,
            commands::model_present,
            commands::model_import_from_media,
            // Sidecar commands (E-CMD-33 through E-CMD-41)
            commands::sidecar_create,
            commands::sidecar_export,
            commands::sidecar_export_json,
            commands::sidecar_import,
            commands::sidecar_list,
            commands::sidecar_delete,
            commands::trust_get,
            commands::trust_set,
            commands::trust_list,
            // LoRa commands (E-CMD-42)
            commands::chunk_ingest,
            // Pack catalog commands (E-CMD-43 through E-CMD-45)
            commands::pack_catalog_list,
            commands::pack_install,
            commands::pack_uninstall,
            // Global search (E-CMD-46)
            commands::pack_search_global,
            // App update commands (E-CMD-47, E-CMD-48)
            commands::app_update_check,
            commands::app_update_apply,
            // Window state commands (E-CMD-49, E-CMD-50)
            commands::window_state_save,
            commands::window_state_restore,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Build `AppState` for the active cargo feature flavor.
///
/// cfg-gated flavor selection: exactly one of `play`, `sideload`,
/// or `desktop` must be enabled at compile time.
#[cfg(feature = "play")]
fn build_state_for_flavor() -> Result<AppState, AppError> {
    AppState::build_for_play()
}

#[cfg(all(feature = "sideload", not(feature = "play")))]
fn build_state_for_flavor() -> Result<AppState, AppError> {
    AppState::build_for_sideload()
}

#[cfg(all(feature = "desktop", not(feature = "sideload"), not(feature = "play")))]
fn build_state_for_flavor() -> Result<AppState, AppError> {
    AppState::build_for_desktop()
}
