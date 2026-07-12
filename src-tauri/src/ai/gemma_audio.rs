//! Gemma 4 E2B native audio encoder (STT via LiteRT-LM).

use crate::ai::{audio, AiError, AudioEncoder};
use std::sync::Arc;

use super::litert::ffi::{
    litert_lm_engine_create_session, litert_lm_responses_delete,
    litert_lm_responses_get_response_text_at, litert_lm_session_config_create,
    litert_lm_session_delete, LiteRtLmEngine, LiteRtLmInputData, LiteRtLmInputDataType,
    LiteRtLmResponses, LiteRtLmSessionConfig,
};
use super::litert::LiteRtLlm;

/// Gemma 4 E2B native audio encoder.
///
/// Wraps a LiteRT-LM backend to perform speech-to-text using Gemma's
/// built-in audio encoder.
pub struct GemmaAudioEncoder {
    backend: Arc<LiteRtLlm>,
}

impl GemmaAudioEncoder {
    /// Create a new Gemma audio encoder backed by the given LiteRT-LM runtime.
    pub fn new(backend: Arc<LiteRtLlm>) -> Self {
        Self { backend }
    }
}

impl AudioEncoder for GemmaAudioEncoder {
    fn transcribe(&self, samples: &[i16], sample_rate: u32) -> Result<String, AiError> {
        // Check if backend is loaded
        let backend_ctx = self.backend.ctx();
        if backend_ctx.is_null() {
            return Err(AiError::NotLoaded);
        }

        // Resample to 16 kHz mono (Gemma 4 E2B's required audio input format)
        let resampled = audio::resample(samples, sample_rate, 16000);

        // Create a session on the backend
        let session_config = unsafe { litert_lm_session_config_create() };
        if session_config.is_null() {
            return Err(AiError::Backend("Failed to create session config".to_string()));
        }

        let session = unsafe { litert_lm_engine_create_session(backend_ctx, session_config) };
        unsafe { litert_lm_session_delete(session_config as *mut LiteRtLmSessionConfig) };

        if session.is_null() {
            return Err(AiError::Backend("Failed to create session".to_string()));
        }

        // Build [Audio, AudioEnd] LiteRtLmInputData array from the PCM bytes
        let audio_data = resampled.as_ptr() as *const std::os::raw::c_void;
        let audio_size = resampled.len() * std::mem::size_of::<i16>();

        let inputs = [
            LiteRtLmInputData {
                type_: LiteRtLmInputDataType::Audio,
                data: audio_data,
                size: audio_size,
            },
            LiteRtLmInputData {
                type_: LiteRtLmInputDataType::AudioEnd,
                data: std::ptr::null(),
                size: 0,
            },
        ];

        // Call litert_lm_session_generate_content
        let responses =
            unsafe { litert_lm_session_generate_content(session, inputs.as_ptr(), 2) };

        if responses.is_null() {
            unsafe { litert_lm_session_delete(session) };
            return Err(AiError::Backend("Failed to generate content".to_string()));
        }

        // Extract the response text (the transcription)
        let text_ptr = unsafe { litert_lm_responses_get_response_text_at(responses, 0) };

        let result = if text_ptr.is_null() {
            Err(AiError::Backend("Failed to get response text".to_string()))
        } else {
            unsafe {
                let c_str = std::ffi::CStr::from_ptr(text_ptr);
                c_str.to_str()
                    .map(|s| s.to_string())
                    .map_err(|e| AiError::Backend(format!("Invalid UTF-8: {}", e)))
            }
        };

        // Clean up
        unsafe {
            litert_lm_responses_delete(responses);
            litert_lm_session_delete(session);
        }

        result
    }
}
