use std::path::PathBuf;
use std::io;
use serde::{Deserialize, Serialize};
use tracing_appender::non_blocking;
use tracing_appender::rolling;
use thiserror::Error;
use crate::paths::AppPaths;

/// Logger init failure
#[derive(Debug, Error)]
pub enum LogError {
    #[error("IO error: {0}")]
    Io(io::Error),
    #[error("Subscriber error: {0}")]
    Subscriber(String),
}

/// Structured logger setup (tracing + tracing-subscriber)
pub struct EnzimeLogger {
    _guard: non_blocking::WorkerGuard,
}

impl EnzimeLogger {
    pub fn init(paths: &AppPaths, level: LogLevel) -> Result<Self, LogError> {
        let file_appender = rolling::daily(paths.logs_dir.clone(), "enzime.log");
        let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

        let file_layer = tracing_subscriber::fmt::layer()
            .with_writer(non_blocking)
            .with_filter(level.to_level_filter());

        let stderr_layer = tracing_subscriber::fmt::layer()
            .with_writer(std::io::stderr)
            .with_filter(level.to_level_filter());

        tracing_subscriber::registry()
            .with(file_layer)
            .with(stderr_layer)
            .try_init()
            .map_err(|e| LogError::Subscriber(e.to_string()))?;

        Ok(Self { _guard: guard })
    }
}

/// Compile-time and runtime log level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    fn to_level_filter(self) -> tracing::level_filters::LevelFilter {
        match self {
            LogLevel::Trace => tracing::level_filters::LevelFilter::TRACE,
            LogLevel::Debug => tracing::level_filters::LevelFilter::DEBUG,
            LogLevel::Info => tracing::level_filters::LevelFilter::INFO,
            LogLevel::Warn => tracing::level_filters::LevelFilter::WARN,
            LogLevel::Error => tracing::level_filters::LevelFilter::ERROR,
        }
    }
}
