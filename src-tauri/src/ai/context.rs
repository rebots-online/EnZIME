/// KV cache wrapper for LLM context tracking
pub struct ContextWindow {
    /// Token IDs currently in the context window
    pub tokens: Vec<u32>,
    /// Maximum capacity of the context window in tokens
    pub max: u32,
}
