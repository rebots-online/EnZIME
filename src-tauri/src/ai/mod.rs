use thiserror::Error;
use std::path::Path;

#[derive(Debug, Error)]
pub enum AiError {
    #[error("AI backend not loaded")]
    NotLoaded,
    #[error("AI backend error: {0}")]
    Backend(String),
    #[error("Operation cancelled")]
    Cancelled,
}

/// LLM runtime trait for text generation backends
pub trait LlmRuntime {
    /// Load model weights from the given path
    fn load(&mut self, path: &Path) -> Result<(), AiError>;

    /// Generate text completion for the given prompt
    fn generate(&self, prompt: &str, system_prompt: Option<&str>) -> Result<String, AiError>;

    /// Generate text with streaming callback for each token/chunk
    fn generate_stream(
        &self,
        prompt: &str,
        system_prompt: Option<&str>,
        callback: &dyn FnMut(&str),
    ) -> Result<(), AiError>;
}

/// Audio encoder trait for speech-to-text backends
pub trait AudioEncoder {
    /// Transcribe audio samples to text
    fn transcribe(&self, samples: &[i16], sample_rate: u32) -> Result<String, AiError>;
}

/// Text-to-speech trait for audio synthesis backends
pub trait Tts {
    /// Synthesize speech from text, returning raw audio samples
    fn speak(&self, text: &str) -> Result<Vec<i16>, AiError>;
}

pub mod audio;
pub mod context;
pub mod gemma_audio;
pub mod litert;
pub mod null;
pub mod probe;

