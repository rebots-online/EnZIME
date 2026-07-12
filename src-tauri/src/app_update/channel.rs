use reqwest::Client;

/// HTTP fetch channel for `update_base/manifest.json`
///
/// Concrete HTTP client for fetching update manifests from a base URL.
pub struct UpdateChannel {
    /// HTTP client for requests
    pub http: Client,
    /// Base URL for update manifest fetches
    pub base_url: &'static str,
}
