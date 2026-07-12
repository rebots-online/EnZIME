// Per-language ranking knobs (BM25-style)
use serde::{Deserialize, Serialize};

/// BM25-style ranking configuration for global search results.
/// Fields follow standard BM25 parameterization:
/// - k1: Term saturation parameter (1.0-2.0 typical)
/// - b: Length normalization penalty (0.0-1.0)
/// - title_boost: Multiplier for title field matches
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct RankingConfig {
    /// Term saturation parameter; controls how quickly additional term occurrences diminish in value.
    /// Higher values = slower saturation (more weight to repeated terms).
    pub k1: f32,

    /// Length normalization penalty; 0.0 = ignore document length, 1.0 = full normalization.
    pub b: f32,

    /// Score multiplier for matches in article titles vs. article body.
    pub title_boost: f32,
}

impl Default for RankingConfig {
    fn default() -> Self {
        Self {
            k1: 1.2,
            b: 0.75,
            title_boost: 2.0,
        }
    }
}
