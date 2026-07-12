use jni::errors::Error as JniError;
use jni::JNIEnv;
use std::path::Path;

// I-10(b): Import type placeholder - swap when ImportError lands (E-TYME-?? or similar)
// Per architecture §5.5, the import closure invokes sidecar_import logic.
// For now, use String as the error type until ImportError is defined.
type ImportError = String;

/// Android share intent handler for receiving `.zsc` files.
/// Registers JNI handler to process incoming share intents and invoke sidecar_import.
pub struct AndroidShareIntent;

impl AndroidShareIntent {
    /// Register JNI handler for Android share intent processing.
    ///
    /// Receives `.zsc` files via Android share intent and invokes the registered import closure.
    /// Non-`.zsc` payloads are ignored.
    ///
    /// # Arguments
    /// * `env` - JNI environment pointer
    /// * `import` - Closure to invoke with the temp file path of received `.zsc` files
    ///
    /// # Returns
    /// `Ok(())` if registration succeeds, `Err(JniError)` on JNI failure
    pub fn register_handler(
        &self,
        _env: &JNIEnv,
        _import: impl Fn(&Path) -> Result<(), ImportError> + Send + 'static,
    ) -> Result<(), JniError> {
        // TODO: Register JNI native method to handle ACTION_SEND intents
        // The native method should:
        // 1. Extract the file path from the intent's Intent.EXTRA_STREAM
        // 2. Convert to Path
        // 3. Check extension is ".zsc"
        // 4. If yes, invoke the import closure with the path
        // 5. If no, return early (ignore non-.zsc payloads)
        // For now, return Ok(()) as registration placeholder
        Ok(())
    }
}
