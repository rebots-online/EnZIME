//! EntitlementSyncBridge — Production HTTP webhook intake from direct processors → RevenueCat
//!
//! This is a separate binary crate in the EnZIME workspace, responsible for:
//! - Webhook intake from Stripe/BTCPay/Play Billing
//! - HMAC signature validation
//! - Idempotent deduplication via SQLite ledger
//! - Entitlement grant pushes to RevenueCat

pub mod webhook;
pub mod hmac;
pub mod ledger;
pub mod rc;
pub mod health;
