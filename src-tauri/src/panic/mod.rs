use crate::paths::AppPaths;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::panic::set_hook;
use std::panic::PanicHookInfo;

// I-10 (b): swap when ai/probe.rs Variant lands (W3-E-AI-19)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Variant {
    Qwen3_06B_Q4,
    GemmaE2bQ4,
}

/// Crash report shape (serialized as JSON in crash log)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrashReport {
    pub ts: i64,
    pub panic_msg: String,
    pub backtrace: String,
    pub version: &'static str,
    pub variant: Option<Variant>,
}

/// Custom panic hook writing crash report to `<logs_dir>/crash-<ts>.log`
pub fn install_panic_handler(paths: &AppPaths) {
    let logs_dir = paths.logs_dir.clone();
    set_hook(Box::new(move |info: &PanicHookInfo| {
        let ts = chrono::Utc::now().timestamp();
        let panic_msg = info.to_string();
        let backtrace = std::backtrace::Backtrace::force_capture().to_string();
        let version = env!("CARGO_PKG_VERSION");

        let report = CrashReport {
            ts,
            panic_msg,
            backtrace,
            version,
            variant: None, // I-10 (b): swap when ai/probe.rs Variant lands (W3-E-AI-19)
        };

        let crash_path = logs_dir.join(format!("crash-{}.log", ts));
        if let Ok(mut file) = File::create(&crash_path) {
            let _ = writeln!(file, "{}", serde_json::to_string_pretty(&report).unwrap_or_else(|_| "Failed to serialize crash report".to_string()));
        }
        eprintln!("Panic! Crash report written to: {}", crash_path.display());
    }));
}
