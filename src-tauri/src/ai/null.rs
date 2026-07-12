use crate::ai::{AiError, AudioEncoder, LlmRuntime, Tts};
use std::path::Path;

/// Empty-state LLM runtime (returns `NotLoaded` for all operations).
///
/// This is the production implementation for v1.0 startup state,
/// before any model is loaded.
pub struct NullLlm;

impl LlmRuntime for NullLlm {
    fn load(&mut self, _path: &Path) -> Result<(), AiError> {
        Err(AiError::NotLoaded)
    }

    fn generate(&self, _prompt: &str, _system_prompt: Option<&str>) -> Result<String, AiError> {
        Err(AiError::NotLoaded)
    }

    fn generate_stream(
        &self,
        _prompt: &str,
        _system_prompt: Option<&str>,
        _callback: &dyn FnMut(&str),
    ) -> Result<(), AiError> {
        Err(AiError::NotLoaded)
    }
}

/// Empty-state audio encoder (returns `NotLoaded` for all operations).
///
/// This is the production implementation for v1.0 startup state,
/// before any audio encoder is loaded.
pub struct NullAudioEncoder;

impl AudioEncoder for NullAudioEncoder {
    fn transcribe(&self, _samples: &[i16], _sample_rate: u32) -> Result<String, AiError> {
        Err(AiError::NotLoaded)
    }
}

/// Empty-state TTS (returns `NotLoaded` for all operations).
///
/// This is the production implementation for v1.0 startup state,
/// before any TTS is loaded. No TTS UI surfaces exist in v1.0.
pub struct NullTts;

impl Tts for NullTts {
    fn speak(&self, _text: &str) -> Result<Vec<i16>, AiError> {
        Err(AiError::NotLoaded)
    }
}
