//! LiteRT-LM-backed LLM runtime.

use crate::ai::{AiError, LlmRuntime};
use std::path::Path;

pub mod config;
pub mod ffi;

pub use config::ModelConfig;
pub use ffi::{
    LiteRtLmEngine, LiteRtLmEngineSettings, LiteRtLmInputData, LiteRtLmInputDataType,
    LiteRtLmResponses, LiteRtLmSamplerParams, LiteRtLmSamplerType, LiteRtLmSession,
    LiteRtLmSessionConfig,
};

/// Event types for streaming generation.
pub enum StreamEvent {
    Chunk(String),
    Final,
    Err(String),
}

/// Bridge context for streaming callbacks passed to C FFI.
/// Contains the sender end of a channel; the receiver stays on the
/// spawning thread to drive the non-`Send` user callback.
pub struct StreamContext {
    pub tx: std::sync::mpsc::Sender<StreamEvent>,
}

// SAFETY: mpsc::Sender<StreamEvent> is Send; StreamContext has no interior mutability
unsafe impl Send for StreamContext {}

/// LiteRT-LM-backed LLM runtime.
pub struct LiteRtLlm {
    // Opaque pointer to LiteRT engine (FFI)
    ctx: *mut LiteRtLmEngine,
    config: ModelConfig,
}

// SAFETY: LiteRtLmEngine is an opaque FFI type with no internal Rust mutability
unsafe impl Send for LiteRtLlm {}

impl LlmRuntime for LiteRtLlm {
    fn load(&mut self, path: &Path) -> Result<(), AiError> {
        // Idempotent: if already loaded, return Ok
        if !self.ctx.is_null() {
            return Ok(());
        }

        // Convert path to CString for C FFI
        let path_c = std::ffi::CString::new(path.to_str().ok_or_else(|| {
            AiError::Backend(format!("Invalid UTF-8 in path: {:?}", path))
        })?)
        .map_err(|e| AiError::Backend(format!("Failed to create CString: {}", e)))?;

        // Create engine settings: model path from param, device backend
        let settings = unsafe {
            litert_lm_engine_settings_create(
                path_c.as_ptr(),
                b"device\0".as_ptr() as *const i8,  // backend_str: device
                std::ptr::null(),                    // vision_backend_str: null
                std::ptr::null(),                    // audio_backend_str: null
            )
        };

        if settings.is_null() {
            return Err(AiError::Backend(
                "Failed to create engine settings".to_string(),
            ));
        }

        // Set max_num_tokens from config (this bounds the total token window)
        unsafe {
            litert_lm_engine_settings_set_max_num_tokens(settings, self.config.max_tokens as i32);
        }

        // Create the engine from settings
        let engine = unsafe { litert_lm_engine_create(settings) };

        // Clean up settings
        unsafe {
            litert_lm_engine_settings_delete(settings);
        }

        if engine.is_null() {
            return Err(AiError::Backend(
                "Failed to create LiteRT-LM engine".to_string(),
            ));
        }

        self.ctx = engine;
        Ok(())
    }

    fn generate(&self, prompt: &str, system_prompt: Option<&str>) -> Result<String, AiError> {
        if self.ctx.is_null() {
            return Err(AiError::NotLoaded);
        }

        // Create session config
        let session_config = unsafe { litert_lm_session_config_create() };
        if session_config.is_null() {
            return Err(AiError::Backend(
                "Failed to create session config".to_string(),
            ));
        }

        // Build sampler params from ModelConfig
        let sampler_type = if self.config.top_k > 0 {
            LiteRtLmSamplerType::TopK
        } else if self.config.top_p < 1.0 {
            LiteRtLmSamplerType::TopP
        } else {
            LiteRtLmSamplerType::Greedy
        };

        let sampler_params = LiteRtLmSamplerParams {
            type_: sampler_type,
            top_k: self.config.top_k as i32,
            top_p: self.config.top_p,
            temperature: self.config.temperature,
            seed: -1, // Non-deterministic by default
        };

        unsafe {
            litert_lm_session_config_set_sampler_params(session_config, &sampler_params);
            litert_lm_session_config_set_max_output_tokens(
                session_config,
                self.config.max_tokens as i32,
            );
        }

        // Create session from engine
        let session = unsafe { litert_lm_engine_create_session(self.ctx, session_config) };

        unsafe {
            litert_lm_session_config_delete(session_config);
        }

        if session.is_null() {
            return Err(AiError::Backend(
                "Failed to create LiteRT-LM session".to_string(),
            ));
        }

        // Build input: prepend system prompt if present, then user prompt
        let full_text = if let Some(sys) = system_prompt {
            format!("{}\n\n{}", sys, prompt)
        } else {
            prompt.to_string()
        };

        let text_c = std::ffi::CString::new(full_text)
            .map_err(|e| AiError::Backend(format!("Failed to create CString: {}", e)))?;

        let input_data = LiteRtLmInputData {
            type_: LiteRtLmInputDataType::Text,
            data: text_c.as_ptr() as *const std::ffi::c_void,
            size: 0, // Text input doesn't use size
        };

        // Generate content
        let responses = unsafe {
            litert_lm_session_generate_content(session, &input_data, 1)
        };

        if responses.is_null() {
            unsafe {
                litert_lm_session_delete(session);
            }
            return Err(AiError::Backend(
                "Failed to generate content".to_string(),
            ));
        }

        // Extract response text (index 0)
        let response_text_ptr = unsafe {
            litert_lm_responses_get_response_text_at(responses, 0)
        };

        let result = if response_text_ptr.is_null() {
            Err(AiError::Backend("Null response text".to_string()))
        } else {
            let c_str = unsafe { std::ffi::CStr::from_ptr(response_text_ptr) };
            c_str.to_str()
                .map(|s| s.to_string())
                .map_err(|e| AiError::Backend(format!("Failed to convert response: {}", e)))
        };

        // Clean up
        unsafe {
            litert_lm_responses_delete(responses);
            litert_lm_session_delete(session);
        }

        result
    }

    fn generate_stream(
        &self,
        prompt: &str,
        system_prompt: Option<&str>,
        callback: &dyn FnMut(&str),
    ) -> Result<(), AiError> {
        if self.ctx.is_null() {
            return Err(AiError::NotLoaded);
        }

        // Create session config (same as generate)
        let session_config = unsafe { litert_lm_session_config_create() };
        if session_config.is_null() {
            return Err(AiError::Backend(
                "Failed to create session config".to_string(),
            ));
        }

        let sampler_type = if self.config.top_k > 0 {
            LiteRtLmSamplerType::TopK
        } else if self.config.top_p < 1.0 {
            LiteRtLmSamplerType::TopP
        } else {
            LiteRtLmSamplerType::Greedy
        };

        let sampler_params = LiteRtLmSamplerParams {
            type_: sampler_type,
            top_k: self.config.top_k as i32,
            top_p: self.config.top_p,
            temperature: self.config.temperature,
            seed: -1,
        };

        unsafe {
            litert_lm_session_config_set_sampler_params(session_config, &sampler_params);
            litert_lm_session_config_set_max_output_tokens(
                session_config,
                self.config.max_tokens as i32,
            );
        }

        let session = unsafe { litert_lm_engine_create_session(self.ctx, session_config) };
        unsafe {
            litert_lm_session_config_delete(session_config);
        }

        if session.is_null() {
            return Err(AiError::Backend(
                "Failed to create LiteRT-LM session".to_string(),
            ));
        }

        // Build full prompt (same as generate)
        let full_text = if let Some(sys) = system_prompt {
            format!("{}\n\n{}", sys, prompt)
        } else {
            prompt.to_string()
        };

        let text_c = std::ffi::CString::new(full_text)
            .map_err(|e| AiError::Backend(format!("Failed to create CString: {}", e)))?;

        let input_data = LiteRtLmInputData {
            type_: LiteRtLmInputDataType::Text,
            data: text_c.as_ptr() as *const std::ffi::c_void,
            size: 0,
        };

        // Set up channel: StreamContext is Send, carries sender to C callback
        let (tx, rx) = std::sync::mpsc::channel();
        let stream_ctx = Box::new(StreamContext { tx });

        // Stream generation with callback trampoline
        let result = unsafe {
            litert_lm_session_generate_content_stream(
                session,
                &input_data,
                1,
                Some(litert_stream_trampoline),
                Box::into_raw(stream_ctx) as *mut std::ffi::c_void,
            )
        };

        // Clean up session
        unsafe {
            litert_lm_session_delete(session);
        }

        if result != 0 {
            return Err(AiError::Backend(
                format!("Stream generation failed with code {}", result)
            ));
        }

        // Drive user callback from channel on this thread
        let mut final_result = Ok(());
        for event in rx {
            match event {
                StreamEvent::Chunk(chunk) => callback(&chunk),
                StreamEvent::Final => break,
                StreamEvent::Err(msg) => {
                    final_result = Err(AiError::Backend(msg));
                    break;
                }
            }
        }

        final_result
    }
}

impl LiteRtLlm {
    /// Create a new LiteRT-LM runtime with the given configuration.
    pub fn new(config: ModelConfig) -> Self {
        Self {
            ctx: std::ptr::null_mut(),
            config,
        }
    }

    /// Check if the backend is loaded (engine is non-null).
    pub fn is_loaded(&self) -> bool {
        !self.ctx.is_null()
    }

    /// Get the underlying engine context.
    /// Returns null pointer if not loaded.
    pub fn ctx(&self) -> *mut LiteRtLmEngine {
        self.ctx
    }
}

/// Trampoline callback for LiteRT streaming generation.
///
/// SAFETY: `callback_data` must point to a live `StreamContext` for the duration
/// of the stream. This is guaranteed by the caller: `StreamContext` is boxed and
/// converted to a raw pointer, then passed as `callback_data`. LiteRT invokes this
/// from its decode thread, and we only drop the `StreamContext` after the final event.
#[no_mangle]
extern "C" fn litert_stream_trampoline(
    callback_data: *mut std::ffi::c_void,
    chunk: *const std::os::raw::c_char,
    is_final: bool,
    err: *const std::os::raw::c_char,
) {
    // Recover StreamContext from raw pointer
    let stream_ctx = unsafe {
        // SAFETY: callback_data is guaranteed to point to a live StreamContext
        Box::from_raw(callback_data as *mut StreamContext)
    };

    // Prioritize error: if err is non-null, send error event and stop
    if !err.is_null() {
        let error_msg = unsafe {
            std::ffi::CStr::from_ptr(err)
                .to_string_lossy()
                .into_owned()
        };
        let _ = stream_ctx.tx.send(StreamEvent::Err(error_msg));
        // Drop StreamContext (ends the channel)
        return;
    }

    // Send chunk if non-null
    if !chunk.is_null() {
        let chunk_str = unsafe {
            std::ffi::CStr::from_ptr(chunk)
                .to_string_lossy()
                .into_owned()
        };
        if !chunk_str.is_empty() {
            let _ = stream_ctx.tx.send(StreamEvent::Chunk(chunk_str));
        }
    }

    if is_final {
        let _ = stream_ctx.tx.send(StreamEvent::Final);
        // Drop StreamContext after final (closes the channel)
    } else {
        // Re-box StreamContext so it lives for the next callback
        Box::leak(stream_ctx);
    }
}
