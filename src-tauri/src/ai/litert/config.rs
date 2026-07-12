//! LiteRT-LM model configuration.

/// Load-time parameters for the LLM backend.
pub struct ModelConfig {
    pub max_tokens: u32,
    pub temperature: f32,
    pub top_k: u32,
    pub top_p: f32,
    pub kv_cache_mb: u32,
}
