//! EntitlementSyncBridge binary entry point
//!
//! Per §7.6 row E-ENT-18: Tokio entrypoint, systemd-friendly
//!
//! Serves:
//! - POST /webhook — webhook intake from direct processors (Stripe/BTCPay/Play)
//! - GET /metrics — Prometheus metrics endpoint

use axum::{routing::{get, post}, Router};
use axum::extract::State;
use hmac::HmacValidator;
use ledger::IdempotentLedger;
use rc::RcGrantSender;
use health::BridgeMetrics;
use secrecy::SecretString;
use std::net::SocketAddr;
use std::sync::Arc;
use std::process;
use tracing::info;
use std::sync::atomic::Ordering;

mod webhook;
mod hmac;
mod ledger;
mod rc;
mod health;

use webhook::webhook_intake;

/// Shared application state wired into axum Router
///
/// Per E-ENT-23: struct { hmac: Arc<HmacValidator>, ledger: Arc<IdempotentLedger>,
///                   grant: Arc<RcGrantSender>, metrics: Arc<BridgeMetrics> }
#[derive(Clone)]
pub struct AppState {
    pub hmac: Arc<HmacValidator>,
    pub ledger: Arc<IdempotentLedger>,
    pub grant: Arc<RcGrantSender>,
    pub metrics: Arc<BridgeMetrics>,
}

/// Prometheus /metrics endpoint handler
///
/// Serves metrics text format using the AppState's BridgeMetrics.
async fn serve_metrics(State(state): State<AppState>) -> impl axum::response::IntoResponse {
    let metrics = &state.metrics;

    // Read all counters atomically
    let webhook_received = metrics.webhook_received.load(Ordering::Relaxed);
    let webhook_valid = metrics.webhook_valid.load(Ordering::Relaxed);
    let webhook_duplicate = metrics.webhook_duplicate.load(Ordering::Relaxed);
    let rc_grant_success = metrics.rc_grant_success.load(Ordering::Relaxed);
    let rc_grant_failure = metrics.rc_grant_failure.load(Ordering::Relaxed);

    // Prometheus text format exposition (version 0.0.4)
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

    (
        [(http::header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        exposition
    )
}

#[tokio::main]
async fn main() {
    // Initialize tracing for systemd journal integration
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "entitlement_sync_bridge=info,tower_http=debug".into()),
        )
        .init();

    // Read required secrets; exit non-zero if absent
    let rc_secret = std::env::var("BRIDGE_RC_SECRET")
        .unwrap_or_else(|_| {
            eprintln!("Error: BRIDGE_RC_SECRET environment variable is required");
            process::exit(1);
        });
    let hmac_secret = std::env::var("BRIDGE_HMAC_SECRET")
        .unwrap_or_else(|_| {
            eprintln!("Error: BRIDGE_HMAC_SECRET environment variable is required");
            process::exit(1);
        });

    // Initialize SQLite ledger database
    let db_path = std::env::var("BRIDGE_DB_PATH")
        .unwrap_or_else(|_| "./bridge_ledger.db".to_string());
    let db_pool = sqlx::SqlitePool::connect(&format!("sqlite:{}", db_path))
        .await
        .expect("failed to connect to SQLite database");

    // Build AppState collaborators from env
    let hmac = Arc::new(HmacValidator::new(SecretString::from(hmac_secret)));
    let ledger = Arc::new(IdempotentLedger::new(Arc::new(db_pool)));
    let grant = Arc::new(RcGrantSender {
        secret: SecretString::from(rc_secret),
        http: reqwest::Client::new(),
    });
    let metrics = Arc::new(BridgeMetrics::new());

    // Initialize ledger schema
    ledger.init()
        .await
        .expect("failed to initialize ledger schema");

    let app_state = AppState {
        hmac,
        ledger,
        grant,
        metrics,
    };

    // Build the application router with AppState
    let app = Router::new()
        .route("/webhook", post(webhook_intake))
        .route("/metrics", get(serve_metrics))
        .with_state(app_state.clone());

    // Default bind address: high, non-patterned port per I-16
    let addr: SocketAddr = match std::env::var("BRIDGE_BIND_ADDR") {
        Ok(addr_str) => addr_str.parse().expect("invalid BRIDGE_BIND_ADDR"),
        Err(_) => "[::]:47921".parse().unwrap(),
    };

    info!("EntitlementSyncBridge listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind to address");

    axum::serve(listener, app)
        .await
        .expect("server failed");
}
