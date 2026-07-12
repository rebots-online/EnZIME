// RevenueCat HTTP client wrapper
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use super::EntitlementError;

/// RevenueCat subscriber API response
#[derive(Deserialize)]
struct SubscriberResponse {
    subscriber: SubscriberData,
}

/// Subscriber data from RevenueCat
#[derive(Deserialize)]
struct SubscriberData {
    entitlements: HashMap<String, EntitlementData>,
}

/// Individual entitlement data
#[derive(Deserialize)]
struct EntitlementData {
    expires_date: Option<String>,
}

/// RevenueCat SDK wrapper (HTTP)
///
/// Lightweight HTTP client for RevenueCat API interactions.
pub struct RevenueCatClient {
    /// RevenueCat API key
    pub api_key: String,
    /// HTTP client for API requests
    pub http: Client,
}

impl RevenueCatClient {
    /// Create a new RevenueCat client
    ///
    /// Reads the RC SDK key from `ENZIME_RC_API_KEY` environment variable.
    /// Offline-tolerant: network failures map to `EntitlementError::Network`, never panics.
    pub fn new() -> Self {
        let api_key = std::env::var("ENZIME_RC_API_KEY")
            .expect("ENZIME_RC_API_KEY must be set");
        Self {
            api_key,
            http: Client::new(),
        }
    }

    /// Fetch subscriber entitlements from RevenueCat
    ///
    /// Makes a GET request to `/v1/subscribers/{app_user_id}` and returns the set of
    /// active (non-expired) entitlement IDs. Expired entitlements are filtered out.
    pub async fn fetch_subscriber(&self, app_user_id: &str) -> Result<Vec<String>, EntitlementError> {
        let url = format!(
            "https://api.revenuecat.com/v1/subscribers/{}",
            app_user_id
        );

        let response = self.http
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| EntitlementError::Network(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(EntitlementError::Backend(format!(
                "RevenueCat API returned {}: {}",
                response.status(),
                response.status().canonical_reason().unwrap_or("Unknown")
            )));
        }

        let sub_response: SubscriberResponse = response
            .json()
            .await
            .map_err(|e| EntitlementError::Backend(format!("Failed to parse response: {}", e)))?;

        let now = Utc::now();
        let active_entitlements: Vec<String> = sub_response
            .subscriber
            .entitlements
            .into_iter()
            .filter(|(_, entitlement)| {
                // Filter out expired entitlements
                if let Some(expires_str) = &entitlement.expires_date {
                    // Parse the expires_date and check if it's in the future
                    match DateTime::parse_from_rfc3339(expires_str) {
                        Ok(expires_dt) => {
                            let expires_utc = expires_dt.with_timezone(&Utc);
                            expires_utc > now
                        }
                        Err(_) => {
                            // If we can't parse the date, consider it expired (fail closed)
                            false
                        }
                    }
                } else {
                    // No expires_date means it doesn't expire (lifetime entitlement)
                    true
                }
            })
            .map(|(id, _)| id)
            .collect();

        Ok(active_entitlements)
    }

    /// Check if a user has a specific entitlement
    ///
    /// Makes a GET request to the RevenueCat API to check entitlement status.
    ///
    /// # Arguments
    /// * `app_user_id` - The user's unique ID in RevenueCat
    /// * `entitlement` - The entitlement identifier to check
    ///
    /// # Returns
    /// * `Ok(true)` - Entitlement is active
    /// * `Ok(false)` - Entitlement not found or expired
    /// * `Err(EntitlementError::Network)` - Connection failure
    /// * `Err(EntitlementError::Backend)` - Backend error (non-2xx response)
    pub async fn check_entitlement(
        &self,
        app_user_id: &str,
        entitlement: &str,
    ) -> Result<bool, EntitlementError> {
        let url = format!(
            "https://api.revenuecat.com/v1/subscribers/{}/entitlements/{}",
            app_user_id, entitlement
        );

        let response = match self
            .http
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("X-Platform", platform_str())
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                return Err(EntitlementError::Network(format!(
                    "connection failed: {}",
                    e
                )))
            }
        };

        let status = response.status();

        if !status.is_success() {
            return Err(EntitlementError::Backend(format!(
                "unexpected status: {}",
                status
            )));
        }

        let response_text = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                return Err(EntitlementError::Network(format!(
                    "failed to read response: {}",
                    e
                )))
            }
        };

        let subscriber_response: SubscriberResponse = match serde_json::from_str(&response_text) {
            Ok(data) => data,
            Err(e) => {
                return Err(EntitlementError::Backend(format!(
                    "failed to parse response: {}",
                    e
                )))
            }
        };

        let is_active = subscriber_response
            .subscriber
            .entitlements
            .get(entitlement)
            .map(|ent| {
                // Check if entitlement is active (not expired)
                if let Some(expires_date) = &ent.expires_date {
                    // Parse the date and check if it's in the future
                    match DateTime::parse_from_rfc3339(expires_date) {
                        Ok(expires) => expires > DateTime::from(Utc::now()),
                        Err(_) => false,
                    }
                } else {
                    // No expiry date means it's a perpetual entitlement
                    true
                }
            })
            .unwrap_or(false);

        Ok(is_active)
    }
}

/// Platform identifier for RevenueCat API
fn platform_str() -> &'static str {
    if cfg!(target_os = "android") {
        "android"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "web"
    }
}
