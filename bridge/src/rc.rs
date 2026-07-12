// RevenueCat grant sender

use secrecy::ExposeSecret;
use std::error::Error;

/// Push entitlement to RevenueCat
pub struct RcGrantSender {
    pub secret: secrecy::SecretString,
    pub http: reqwest::Client,
}

impl RcGrantSender {
    /// Send grant request to RevenueCat
    pub async fn send(&self, user_id: &str, entitlement_id: &str, expiration_ms: i64) -> Result<(), Box<dyn Error + Send + Sync>> {
        let url = format!(
            "https://api.revenuecat.com/v1/subscribers/{}/entitlements/{}",
            user_id, entitlement_id
        );

        let response = self.http
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.secret.expose_secret()))
            .header("X-Platform", "android")
            .json(&serde_json::json!({ "expiration_at_ms": expiration_ms }))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let body = response.text().await?;
            Err(format!("RevenueCat grant failed: {} - {}", status, body).into())
        }
    }
}

