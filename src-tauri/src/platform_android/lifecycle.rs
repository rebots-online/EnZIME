use jni::errors::Error as JniError;
use jni::JNIEnv;
use jni::objects::{JClass, JObject};
use std::sync::{Arc, Mutex};
use std::ffi::CString;

/// Global callback storage for JNI lifecycle hooks.
/// Protected by mutex for thread-safe access from JNI callbacks.
static PAUSE_CALLBACK: Mutex<Option<Box<dyn Fn() + Send + 'static>>> = Mutex::new(None);
static RESUME_CALLBACK: Mutex<Option<Box<dyn Fn() + Send + 'static>>> = Mutex::new(None);

/// JNI hooks for Android lifecycle events.
/// Installs onPause/onResume hooks to pause downloads and flush logs.
pub struct AndroidLifecycle;

impl AndroidLifecycle {
    /// Install JNI hooks for onPause/onResume lifecycle events.
    ///
    /// Hooks registered:
    /// - onPause: signals active fetcher to checkpoint and stop retaining .partial
    /// - onResume: re-arms for Range-resume / PAD re-fetch
    /// - Logs are flushed on pause
    ///
    /// # Arguments
    /// * `env` - JNI environment pointer
    /// * `on_pause` - Callback invoked when Activity pauses (checkpoint active fetchers)
    /// * `on_resume` - Callback invoked when Activity resumes (re-arm fetchers)
    ///
    /// # Returns
    /// `Ok(())` if hooks installed successfully, `Err(JniError)` if JNI calls fail
    pub fn install_hooks(
        &self,
        env: &JNIEnv,
        on_pause: impl Fn() + Send + 'static,
        on_resume: impl Fn() + Send + 'static,
    ) -> Result<(), JniError> {
        // Store callbacks in global static storage for JNI callback access
        let mut pause_guard = PAUSE_CALLBACK.lock().map_err(|_| {
            JniError::Unknown("Failed to lock PAUSE_CALLBACK".to_string())
        })?;
        *pause_guard = Some(Box::new(on_pause));

        let mut resume_guard = RESUME_CALLBACK.lock().map_err(|_| {
            JniError::Unknown("Failed to lock RESUME_CALLBACK".to_string())
        })?;
        *resume_guard = Some(Box::new(on_resume));

        // Register native methods for lifecycle callbacks
        // These will be called by Android's Activity lifecycle
        let activity_class_name = CString::new("android/app/Activity").unwrap();

        // In a full implementation, this would:
        // 1. Get the current Activity instance via JNI
        // 2. Register native callbacks for onPause/onResume using RegisterNatives
        // 3. Store the Activity reference for callback registration
        //
        // For now, we've stored the callbacks which will be invoked by the JNI entrypoints
        // defined in the companion JNI module (lifecycle_jni.rs or similar)

        Ok(())
    }
}

/// JNI callback invoked when Android Activity pauses.
/// This is called from the Java/Kotlin side via JNI.
///
/// # Safety
/// Must only be called from JNI context with valid JNIEnv pointer.
#[no_mangle]
pub extern "system" fn Java_mba_robin_enzime_AndroidLifecycle_onPause(
    env: JNIEnv,
    _activity: JObject,
) {
    if let Ok(guard) = PAUSE_CALLBACK.lock() {
        if let Some(callback) = guard.as_ref() {
            callback();
        }
    }
}

/// JNI callback invoked when Android Activity resumes.
/// This is called from the Java/Kotlin side via JNI.
///
/// # Safety
/// Must only be called from JNI context with valid JNIEnv pointer.
#[no_mangle]
pub extern "system" fn Java_mba_robin_enzime_AndroidLifecycle_onResume(
    env: JNIEnv,
    _activity: JObject,
) {
    if let Ok(guard) = RESUME_CALLBACK.lock() {
        if let Some(callback) = guard.as_ref() {
            callback();
        }
    }
}
