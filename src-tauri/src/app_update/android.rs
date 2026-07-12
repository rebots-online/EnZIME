use crate::app_update::{UpdateError, UpdateManifest};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{self, Read, Write};
use std::path::PathBuf;

/// Platform-specific update application for Android sideload (APK download + install intent)
///
/// E-UPD-9: apply_sideload_android at app_update/android.rs:10
#[cfg(target_os = "android")]
pub fn apply_sideload_android(updater: &crate::app_update::AppUpdater, manifest: &UpdateManifest) -> Result<(), UpdateError> {
    use ndk_context::android_context;

    // Step 1: Download APK to a temporary staging location
    let apk_path = download_apk(&manifest.artifact_url)?;

    // Step 2: Verify SHA-256 hash and size
    verify_apk(&apk_path, manifest)?;

    // Step 3: Fire ACTION_INSTALL_PACKAGE intent via JNI
    let ctx = android_context();
    let vm = unsafe { ctx.vm().cast() };
    let activity = unsafe { ctx.activity().cast() };

    fire_install_intent(vm, activity, &apk_path)?;

    Ok(())
}

/// Download APK from artifact_url to a staged location
fn download_apk(artifact_url: &str) -> Result<PathBuf, UpdateError> {
    let response = reqwest::blocking::get(artifact_url)
        .map_err(|e| UpdateError::Network(format!("Failed to fetch APK: {}", e)))?;

    if !response.status().is_success() {
        return Err(UpdateError::Network(format!(
            "APK download failed with status: {}",
            response.status()
        )));
    }

    let apk_data = response.bytes()
        .map_err(|e| UpdateError::Network(format!("Failed to read APK body: {}", e)))?;

    // Stage to a temporary file
    let staging_dir = std::env::temp_dir().join("enzime_updates");
    std::fs::create_dir_all(&staging_dir)
        .map_err(UpdateError::Storage)?;

    let apk_path = staging_dir.join("update.apk");
    let mut file = File::create(&apk_path)
        .map_err(UpdateError::Storage)?;

    file.write_all(&apk_data)
        .map_err(UpdateError::Storage)?;

    Ok(apk_path)
}

/// Verify APK SHA-256 hash and size against manifest
fn verify_apk(apk_path: &PathBuf, manifest: &UpdateManifest) -> Result<(), UpdateError> {
    // Verify size
    let metadata = std::fs::metadata(apk_path)
        .map_err(UpdateError::Storage)?;
    let actual_size = metadata.len();

    if actual_size != manifest.size_bytes {
        return Err(UpdateError::Verify(crate::app_update::VerifyError::InvalidSignature));
    }

    // Verify SHA-256 hash
    let mut file = File::open(apk_path)
        .map_err(UpdateError::Storage)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let n = file.read(&mut buffer)
            .map_err(UpdateError::Storage)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    let actual_hash: [u8; 32] = hasher.finalize().into();
    if actual_hash != manifest.sha256 {
        return Err(UpdateError::Verify(crate::app_update::VerifyError::InvalidSignature));
    }

    Ok(())
}

/// Fire ACTION_INSTALL_PACKAGE intent via JNI to invoke system installer
#[cfg(target_os = "android")]
fn fire_install_intent(
    vm: jni::JavaVM,
    activity: *mut jni::sys::_jobject,
    apk_path: &PathBuf,
) -> Result<(), UpdateError> {
    use jni::objects::{JClass, JObject, JString, JValue};
    use jni::sys::{jint, jobject};
    use jni::JNIEnv;

    // Convert path to URI string (file:// scheme)
    let apk_uri = format!("file://{}", apk_path.display());

    let mut env = vm.attach_current_thread()
        .map_err(|e| UpdateError::Network(format!("JNI attach failed: {}", e)))?;

    // Create Intent with ACTION_INSTALL_PACKAGE
    let intent_class = env.find_class("android/content/Intent")
        .map_err(|e| UpdateError::Network(format!("Failed to find Intent class: {}", e)))?;

    let action_install = env.get_static_field(
        &intent_class,
        "ACTION_INSTALL_PACKAGE",
        "Ljava/lang/String;",
    ).map_err(|e| UpdateError::Network(format!("Failed to get ACTION_INSTALL_PACKAGE: {}", e)))?;

    let action_install_str: JString = unsafe { JString::from(action_install.l()?.into()) };

    // Construct new Intent(String action, Uri uri)
    let uri_class = env.find_class("android/net/Uri")
        .map_err(|e| UpdateError::Network(format!("Failed to find Uri class: {}", e)))?;

    let apk_uri_jstring = env.new_string(&apk_uri)
        .map_err(|e| UpdateError::Network(format!("Failed to create URI string: {}", e)))?;

    let apk_uri = env.call_static_method(
        &uri_class,
        "parse",
        "(Ljava/lang/String;)Landroid/net/Uri;",
        &[JValue::Object(&apk_uri_jstring.into())],
    ).map_err(|e| UpdateError::Network(format!("Failed to parse URI: {}", e)))?.l()?;

    // Create Intent
    let intent = env.new_object(
        &intent_class,
        "(Ljava/lang/String;Landroid/net/Uri;)V",
        &[
            JValue::Object(&JObject::from(action_install_str)),
            JValue::Object(&JObject::from(apk_uri)),
        ],
    ).map_err(|e| UpdateError::Network(format!("Failed to create Intent: {}", e)))?;

    // Set FLAG_ACTIVITY_NEW_TASK
    let flag_new_task: jint = 0x10000000;
    env.call_method(
        &intent,
        "addFlags",
        "(I)Landroid/content/Intent;",
        &[JValue::Int(flag_new_task)],
    ).map_err(|e| UpdateError::Network(format!("Failed to add flags: {}", e)))?;

    // Get Context wrapper and start the intent
    let activity_obj = unsafe { JObject::from(activity) };
    env.call_method(
        &activity_obj,
        "startActivity",
        "(Landroid/content/Intent;)V",
        &[JValue::Object(&JObject::from(intent))],
    ).map_err(|e| UpdateError::Network(format!("Failed to startActivity: {}", e)))?;

    Ok(())
}

/// Non-Android stub (should never be reached due to cfg guard)
#[cfg(not(target_os = "android"))]
pub fn apply_sideload_android(_updater: &crate::app_update::AppUpdater, _manifest: &UpdateManifest) -> Result<(), UpdateError> {
    Err(UpdateError::NotImplementedOnPlatform)
}
