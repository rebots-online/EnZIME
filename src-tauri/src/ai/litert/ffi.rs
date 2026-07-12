//! FFI bindings to the vendored LiteRT-LM C library.
//!
//! This module declares the `extern "C"` functions and `#[repr(C)]` types
//! that correspond to the C API in `vendor/litert-lm/c/engine.h`.

use std::os::raw::{c_char, c_int, c_void};
use std::ffi::{c_float, CStr};

use super::{StreamContext, StreamEvent};

// Opaque FFI types - layout-compatible with the C API
#[repr(C)]
pub struct LiteRtLmEngine {
    _private: [u8; 0],
}

#[repr(C)]
pub struct LiteRtLmSession {
    _private: [u8; 0],
}

#[repr(C)]
pub struct LiteRtLmResponses {
    _private: [u8; 0],
}

#[repr(C)]
pub struct LiteRtLmEngineSettings {
    _private: [u8; 0],
}

#[repr(C)]
pub struct LiteRtLmSessionConfig {
    _private: [u8; 0],
}

#[repr(C)]
pub struct LiteRtLmTokenizeResult {
    _private: [u8; 0],
}

#[repr(C)]
pub struct LiteRtLmDetokenizeResult {
    _private: [u8; 0],
}

// Enums - must match C enum layout exactly
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LiteRtLmInputDataType {
    Text = 0,
    Image = 1,
    ImageEnd = 2,
    Audio = 3,
    AudioEnd = 4,
}

#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LiteRtLmSamplerType {
    Unspecified = 0,
    TopK = 1,
    TopP = 2,
    Greedy = 3,
}

// Structs - must be layout-compatible with C
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct LiteRtLmSamplerParams {
    pub type_: LiteRtLmSamplerType,
    pub top_k: i32,
    pub top_p: c_float,
    pub temperature: c_float,
    pub seed: i32,
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct LiteRtLmInputData {
    pub type_: LiteRtLmInputDataType,
    pub data: *const c_void,
    pub size: usize,
}

// Stream callback type
pub type LiteRtLmStreamCallback = extern "C" fn(*mut c_void, *const c_char, bool, *const c_char);

// Engine settings functions
extern "C" {
    /// Creates LiteRT LM Engine Settings.
    pub fn litert_lm_engine_settings_create(
        model_path: *const c_char,
        backend_str: *const c_char,
        vision_backend_str: *const c_char,
        audio_backend_str: *const c_char,
    ) -> *mut LiteRtLmEngineSettings;

    /// Destroys LiteRT LM Engine Settings.
    pub fn litert_lm_engine_settings_delete(settings: *mut LiteRtLmEngineSettings);

    /// Sets the maximum number of tokens for the engine.
    pub fn litert_lm_engine_settings_set_max_num_tokens(
        settings: *mut LiteRtLmEngineSettings,
        max_num_tokens: c_int,
    );
}

// Engine functions
extern "C" {
    /// Creates a LiteRT LM Engine from the given settings.
    pub fn litert_lm_engine_create(settings: *const LiteRtLmEngineSettings) -> *mut LiteRtLmEngine;

    /// Destroys a LiteRT LM Engine.
    pub fn litert_lm_engine_delete(engine: *mut LiteRtLmEngine);

    /// Creates a LiteRT LM Session.
    pub fn litert_lm_engine_create_session(
        engine: *mut LiteRtLmEngine,
        config: *mut LiteRtLmSessionConfig,
    ) -> *mut LiteRtLmSession;

    /// Tokenizes text using the engine's tokenizer.
    pub fn litert_lm_engine_tokenize(
        engine: *mut LiteRtLmEngine,
        text: *const c_char,
    ) -> *mut LiteRtLmTokenizeResult;

    /// Detokenizes token ids using the engine's tokenizer.
    pub fn litert_lm_engine_detokenize(
        engine: *mut LiteRtLmEngine,
        tokens: *const c_int,
        num_tokens: usize,
    ) -> *mut LiteRtLmDetokenizeResult;
}

// Session config functions
extern "C" {
    /// Creates a LiteRT LM Session Config.
    pub fn litert_lm_session_config_create() -> *mut LiteRtLmSessionConfig;

    /// Sets the sampler parameters for this session config.
    pub fn litert_lm_session_config_set_sampler_params(
        config: *mut LiteRtLmSessionConfig,
        sampler_params: *const LiteRtLmSamplerParams,
    );

    /// Sets the maximum number of output tokens per decode step.
    pub fn litert_lm_session_config_set_max_output_tokens(
        config: *mut LiteRtLmSessionConfig,
        max_output_tokens: c_int,
    );

    /// Destroys a LiteRT LM Session Config.
    pub fn litert_lm_session_config_delete(config: *mut LiteRtLmSessionConfig);
}

// Session functions
extern "C" {
    /// Generates content from the input prompt.
    pub fn litert_lm_session_generate_content(
        session: *mut LiteRtLmSession,
        inputs: *const LiteRtLmInputData,
        num_inputs: usize,
    ) -> *mut LiteRtLmResponses;

    /// Generates content and streams the response via callback.
    pub fn litert_lm_session_generate_content_stream(
        session: *mut LiteRtLmSession,
        inputs: *const LiteRtLmInputData,
        num_inputs: usize,
        callback: LiteRtLmStreamCallback,
        callback_data: *mut c_void,
    ) -> c_int;

    /// Cancels the current processing in the session.
    pub fn litert_lm_session_cancel_process(session: *mut LiteRtLmSession);

    /// Destroys a LiteRT LM Session.
    pub fn litert_lm_session_delete(session: *mut LiteRtLmSession);
}

// Responses functions
extern "C" {
    /// Returns the response text at a given index.
    pub fn litert_lm_responses_get_response_text_at(
        responses: *const LiteRtLmResponses,
        index: c_int,
    ) -> *const c_char;

    /// Destroys a LiteRT LM Responses object.
    pub fn litert_lm_responses_delete(responses: *mut LiteRtLmResponses);

    /// Returns the number of response candidates.
    pub fn litert_lm_responses_get_num_candidates(responses: *const LiteRtLmResponses) -> c_int;
}

// Tokenize result functions
extern "C" {
    /// Destroys a LiteRT LM Tokenize Result.
    pub fn litert_lm_tokenize_result_delete(result: *mut LiteRtLmTokenizeResult);

    /// Returns the token ids from a tokenize result.
    pub fn litert_lm_tokenize_result_get_tokens(result: *const LiteRtLmTokenizeResult) -> *const c_int;

    /// Returns the number of token ids from a tokenize result.
    pub fn litert_lm_tokenize_result_get_num_tokens(result: *const LiteRtLmTokenizeResult) -> usize;
}

// Detokenize result functions
extern "C" {
    /// Destroys a LiteRT LM Detokenize Result.
    pub fn litert_lm_detokenize_result_delete(result: *mut LiteRtLmDetokenizeResult);

    /// Returns the string from a detokenize result.
    pub fn litert_lm_detokenize_result_get_string(result: *const LiteRtLmDetokenizeResult) -> *const c_char;
}

// ============================================================================
// Stream callback trampoline
// ============================================================================

/// Trampoline function invoked by LiteRT-LM's background decode thread.
/// Recovers the `StreamContext` from `callback_data`, converts the chunk
/// from C string to Rust `String`, and forwards a `StreamEvent` through
/// the channel's sender.
///
/// # Safety
///
/// - `callback_data` must point to a live `StreamContext` for the entire
///   duration of the stream (from the first chunk until `is_final=true`).
/// - `chunk` is guaranteed by LiteRT-LM to be a valid null-terminated
///   C string when `error_msg` is null.
/// - This function allocates only the chunk `String`; all other data
///   is stack-allocated.
///
/// # Parameters
///
/// - `data`: Opaque pointer to `StreamContext` (boxed by caller).
/// - `chunk`: C string pointer to the decoded text chunk, or null if
///   `error_msg` is non-null.
/// - `is_final`: If `true`, this is the final callback for the stream.
/// - `err`: C string pointer to an error message, or null on success.
#[no_mangle]
pub extern "C" fn litert_stream_trampoline(
    data: *mut c_void,
    chunk: *const c_char,
    is_final: bool,
    err: *const c_char,
) {
    // SAFETY: The caller (generate_stream in LiteRtLlm) guarantees that
    // `data` points to a live boxed StreamContext for the stream lifetime.
    let ctx = unsafe { &*(data as *const StreamContext) };

    // Determine which event to send based on callback state
    let event = if !err.is_null() {
        // Error case: convert error_msg to String
        // SAFETY: LiteRT-LM guarantees non-null `error_msg` points to a
        // valid null-terminated C string.
        let err_msg = unsafe { CStr::from_ptr(err) };
        StreamEvent::Err(err_msg.to_string_lossy().into_owned())
    } else if is_final {
        StreamEvent::Final
    } else {
        // Normal chunk: convert C string to Rust String
        // SAFETY: LiteRT-LM guarantees non-null `chunk` points to a valid
        // null-terminated C string when `error_msg` is null.
        let chunk_str = unsafe { CStr::from_ptr(chunk) };
        StreamEvent::Chunk(chunk_str.to_string_lossy().into_owned())
    };

    // Forward the event through the channel (ignore send errors — receiver
    // may have been dropped due to cancellation)
    let _ = ctx.tx.send(event);
}
