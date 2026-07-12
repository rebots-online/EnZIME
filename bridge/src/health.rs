//! Prometheus /metrics endpoint for health monitoring

use axum::{
    extract::State,
    response::{IntoResponse, Response},
};
use http::{header, StatusCode};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

// I-10(b): Typed sentinel for AppState (E-ENT-23) - swap when AppState lands in main.rs
/// Shared application state wired into axum Router
/// Per E-ENT-23: struct { hmac: Arc<HmacValidator>, ledger: Arc<IdempotentLedger>,
///                   grant: Arc<RcGrantSender>, metrics: Arc<BridgeMetrics> }
#[derive(Clone)]
struct AppState {
    metrics: Arc<BridgeMetrics>,
}

/// Bridge metrics counters backing the `/metrics` endpoint
///
/// Per §7.6 row E-ENT-24: struct with five lock-free counters for
/// webhook and RevenueCat grant metrics.
pub struct BridgeMetrics {
    /// Total webhooks received (via POST /webhook)
    pub webhook_received: std::sync::atomic::AtomicU64,
    /// Webhooks with valid HMAC signatures
    pub webhook_valid: std::sync::atomic::AtomicU64,
    /// Duplicate webhook events (already-processed event_id)
    pub webhook_duplicate: std::sync::atomic::AtomicU64,
    /// RevenueCat grants successfully delivered
    pub rc_grant_success: std::sync::atomic::AtomicU64,
    /// RevenueCat grants that failed to deliver
    pub rc_grant_failure: std::sync::atomic::AtomicU64,
}

impl BridgeMetrics {
    /// Create a new BridgeMetrics with zero-initialized counters
    pub fn new() -> Self {
        Self {
            webhook_received: AtomicU64::new(0),
            webhook_valid: AtomicU64::new(0),
            webhook_duplicate: AtomicU64::new(0),
            rc_grant_success: AtomicU64::new(0),
            rc_grant_failure: AtomicU64::new(0),
        }
    }
}

/// Prometheus `/metrics` endpoint handler
///
/// Per §7.6 row E-ENT-17: struct; impl serve_metrics() -> impl Reply
pub struct HealthMetrics;

impl HealthMetrics {
    /// Serve Prometheus metrics at `/metrics`
    ///
    /// Returns Prometheus text format exposition with counters and build info.
    /// Per E-ENT-17: hand-rolled exposition, no prometheus crate.
    pub async fn serve_metrics(State(state): State<AppState>) -> impl IntoResponse {
        let metrics = &state.metrics;

        // Read all counters atomically
        let webhook_received = metrics.webhook_received.load(Ordering::Relaxed);
        let webhook_valid = metrics.webhook_valid.load(Ordering::Relaxed);
        let webhook_duplicate = metrics.webhook_duplicate.load(Ordering::Relaxed);
        let rc_grant_success = metrics.rc_grant_success.load(Ordering::Relaxed);
        let rc_grant_failure = metrics.rc_grant_failure.load(Ordering::Relaxed);

        // Prometheus text format exposition (version 0.0.4)
        // https://prometheus.io/docs/instrumenting/exposition_formats/
        let exposition = format!(
            "# HELP bridge_webhook_received_total Total webhooks received\n\
             # TYPE bridge_webhook_received_total counter\n\
             bridge_webhook_received_total {}\n\
             \n\
             # HELP bridge_webhook_valid_total Webhooks with valid HMAC signatures\n\
             # TYPE bridge_webhook_valid_total counter\n\
             bridge_webhook_valid_total {}\n\
             \n\
             # HELP bridge_webhook_duplicate_total Duplicate webhook events (already-processed event_id)\n\
             # TYPE bridge_webhook_duplicate_total counter\n\
             bridge_webhook_duplicate_total {}\n\
             \n\
             # HELP bridge_rc_grant_success_total RevenueCat grants successfully delivered\n\
             # TYPE bridge_rc_grant_success_total counter\n\
             bridge_rc_grant_success_total {}\n\
             \n\
             # HELP bridge_rc_grant_failure_total RevenueCat grants that failed to deliver\n\
             # TYPE bridge_rc_grant_failure_total counter\n\
             bridge_rc_grant_failure_total {}\n\
             \n\
             # HELP bridge_build_info Build metadata for the entitlement sync bridge\n\
             # TYPE bridge_build_info gauge\n\
             bridge_build_info{{version=\"1.0.0\"}} 1\n",
            webhook_received,
            webhook_valid,
            webhook_duplicate,
            rc_grant_success,
            rc_grant_failure
        );

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/plain; version=0.0.4")
            .body(exposition)
            .expect("failed to build response")
    }
}
