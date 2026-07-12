// Android foreground service for long-running operations
// Prevents OS from killing the process during model_fetch, pack_install

use jni::JNIEnv;
use jni::errors::Result as JniResult;
use jni::objects::{JObject, JValue, JClass};
use jni::sys::{jint, jboolean};

pub struct AndroidForegroundService {
    notification_id: u32,
    active: bool,
}

impl AndroidForegroundService {
    pub fn new() -> Self {
        Self {
            notification_id: 1,
            active: false,
        }
    }

    /// Start foreground service with notification text
    /// JNI: context.startForegroundService(Intent(FgService)) + service.startForeground(notification_id, Notification)
    pub fn start(&mut self, env: &JNIEnv, notification_text: &str) -> JniResult<()> {
        // Get the current Android context
        let ctx = env.call_method(
            env.get_static_field(
                "android/os/Build$VERSION",
                "SDK_INT",
                "I",
            )?.l()?,
            "getApplicationContext",
            "()Landroid/content/Context;",
            &[],
        )?.l()?;

        // Create an Intent for the foreground service
        let intent_class = env.find_class("android/content/Intent")?;
        let intent = env.new_object(
            "android/content/Intent",
            "(Landroid/content/Context;Ljava/lang/Class;)V",
            &[
                JValue::Object(&ctx),
                JValue::Object(&JObject::from(env.find_class("mba/robin/enzime/EnZIMEForegroundService")?)),
            ],
        )?;

        // Start the foreground service
        env.call_method(
            ctx,
            "startForegroundService",
            "(Landroid/content/Intent;)Landroid/content/ComponentName;",
            &[JValue::Object(&intent)],
        )?;

        // Now call startForeground on the service itself
        // This creates an ongoing notification with the supplied text
        let notification_channel_id = env.new_string("enzime_foreground")?;
        let notification_title = env.new_string("EnZIME")?;
        let notification_text_jstring = env.new_string(notification_text)?;

        // Create Notification object using builder
        let notification_builder_class = env.find_class("android/app/Notification$Builder")?;
        let notification_builder = env.new_object(
            "android/app/Notification$Builder",
            "(Landroid/content/Context;Ljava/lang/CharSequence;)V",
            &[
                JValue::Object(&ctx),
                JValue::Object(&notification_channel_id),
            ],
        )?;

        // Set notification content
        env.call_method(
            notification_builder,
            "setContentTitle",
            "(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;",
            &[JValue::Object(&notification_title)],
        )?;

        env.call_method(
            notification_builder,
            "setContentText",
            "(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;",
            &[JValue::Object(&notification_text_jstring)],
        )?;

        env.call_method(
            notification_builder,
            "setOngoing",
            "(Z)Landroid/app/Notification$Builder;",
            &[JValue::Bool(true as jboolean)],
        )?;

        // Build the notification
        let notification = env.call_method(
            notification_builder,
            "build",
            "()Landroid/app/Notification;",
            &[],
        )?.l()?;

        // Get the service instance and call startForeground
        let service_class = env.find_class("mba/robin/enzime/EnZIMEForegroundService")?;
        env.call_static_method(
            service_class,
            "startForeground",
            "(ILandroid/app/Notification;)V",
            &[
                JValue::Int(self.notification_id as jint),
                JValue::Object(&notification),
            ],
        )?;

        self.active = true;
        Ok(())
    }

    /// Stop foreground service
    /// JNI: service.stopForeground(STOP_FOREGROUND_REMOVE) + service.stopSelf()
    pub fn stop(&mut self, env: &JNIEnv) -> JniResult<()> {
        let service_class = env.find_class("mba/robin/enzime/EnZIMEForegroundService")?;

        // Stop foreground and remove notification
        // STOP_FOREGROUND_REMOVE = 2
        env.call_static_method(
            service_class,
            "stopForeground",
            "(I)V",
            &[JValue::Int(2 jint)],
        )?;

        // Stop the service itself
        env.call_static_method(
            service_class,
            "stopSelf",
            "()V",
            &[],
        )?;

        self.active = false;
        Ok(())
    }

    pub fn is_active(&self) -> bool {
        self.active
    }
}

impl Default for AndroidForegroundService {
    fn default() -> Self {
        Self::new()
    }
}
