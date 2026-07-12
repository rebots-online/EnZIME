//! Webhook intake handlers for direct processor webhooks

use axum::{extract::{Request, State}, response::Response};
use std::sync::Arc;
use sqlx::{Sqlite, Pool};

// I-10(b): Typed sentinel for AppState — swap when E-ENT-23 (AppState) lands
// Per §7.6 row E-ENT-23: struct { hmac: Arc<HmacValidator>, ledger: Arc<IdempotentLedger>, grant: Arc<RcGrantSender>, metrics: Arc<BridgeMetrics> }
#[allow(dead_code)]
struct AppState {
    hmac: Arc<crate::hmac::HmacValidator>,
    ledger: Arc<crate::ledger::IdempotentLedger>,
    grant: Arc<crate::rc::RcGrantSender>,
    metrics: Arc<crate::health::BridgeMetrics>,
}

/// HTTP POST handler for webhook intake from direct processors (Stripe/BTCPay/Play)
///
/// Per §7.6 row E-ENT-13: async fn(Request, State<AppState>) -> Response
pub async fn webhook_intake(
    req: Request,
    State(state): State<Arc<AppState>>,
) -> Response {
    use axum::body::Body;

    // 1. Increment received counter
    state.metrics.webhook_received.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    // 2. Extract raw body and signature header
    let (parts, body) = req.into_parts();
    let signature_header = match parts.headers.get("X-Signature") {
        Some(sig) => match sig.to_str() {
            Ok(s) => s.to_string(),
            Err(_) => {
                return Response::builder()
                    .status(401)
                    .body("Invalid signature header".into())
                    .unwrap();
            }
        },
        None => {
            return Response::builder()
                .status(401)
                .body("Missing signature header".into())
                .unwrap();
        }
    };

    // Read body bytes
    let body_bytes = match axum::body::to_bytes(body, 10 * 1024 * 1024).await {
        Ok(bytes) => bytes,
        Err(_) => {
            return Response::builder()
                .status(400)
                .body("Failed to read body".into())
                .unwrap();
        }
    };

    // 3. Validate HMAC signature
    if !state.hmac.validate(&body_bytes, &signature_header) {
        // HMAC fail: 401, no ledger write, no grant, received++ but not valid++
        return Response::builder()
            .status(401)
            .body("Invalid signature".into())
            .unwrap();
    }

    // 4. Increment valid counter
    state.metrics.webhook_valid.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    // 5. Parse event ID from body (placeholder: use SHA-256 hash as webhook_id)
    // In production, this would extract event_id from the event payload
    use sha2::{Digest, Sha256};
    let webhook_id = hex::encode(Sha256::digest(&body_bytes));

    // 6. Check if event was already processed (check only, no insert)
    // Ledger write must happen AFTER successful grant, so failed grants remain retriable
    let already_seen = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM webhook_ledger WHERE webhook_id = ?1"
    )
    .bind(&webhook_id)
    .fetch_one(&*state.ledger.db)
    .await
    .unwrap_or(0) > 0;

    if already_seen {
        // Duplicate event: 200, no grant, duplicate++
        state.metrics.webhook_duplicate.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        return Response::builder()
            .status(200)
            .body("Event already processed (idempotent)".into())
            .unwrap();
    }

    // 7. Parse event and extract RC grant parameters (placeholder implementation)
    // In production, this would parse Stripe/BTCPay/Play event JSON
    // For now, use placeholder values
    let user_id = "placeholder_user_id";
    let entitlement_id = "placeholder_entitlement_id";
    let expiration_ms = 0i64;

    // 8. Attempt RC grant
    match state.grant.send(user_id, entitlement_id, expiration_ms).await {
        Ok(_) => {
            // 9. Grant succeeded - NOW write to ledger (only after success)
            // This ensures failed grants remain retriable
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;

            if let Err(_) = sqlx::query(
                "INSERT INTO webhook_ledger (webhook_id, processed_at) VALUES (?1, ?2)"
            )
            .bind(&webhook_id)
            .bind(now)
            .execute(&*state.ledger.db)
            .await {
                return Response::builder()
                    .status(500)
                    .body("Ledger write failed".into())
                    .unwrap();
            }

            state.metrics.rc_grant_success.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            Response::builder()
                .status(200)
                .body("Event processed successfully".into())
                .unwrap()
        }
        Err(_) => {
            // 10. Grant failed - do NOT write to ledger (remains retriable)
            state.metrics.rc_grant_failure.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            Response::builder()
                .status(502)
                .body("Failed to grant entitlement".into())
                .unwrap()
        }
    }
}
