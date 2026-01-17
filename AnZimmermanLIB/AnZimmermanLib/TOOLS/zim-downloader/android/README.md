# ZIM Downloader - Android Build

## Overview

The Android version of ZIM Downloader uses Tauri's mobile support (Tauri v2) with Capacitor as a fallback option.

## Prerequisites

- Android Studio with SDK 24+ (Android 7.0+)
- JDK 17+
- Rust with Android targets:
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android
  ```
- Android NDK (install via Android Studio SDK Manager)

## Setup

1. Install Tauri CLI with Android support:
   ```bash
   cargo install tauri-cli --version "^2.0.0"
   ```

2. Initialize Android project:
   ```bash
   cargo tauri android init
   ```

3. Configure signing (for release builds):
   - Create a keystore:
     ```bash
     keytool -genkey -v -keystore zim-downloader.keystore -alias zim-downloader -keyalg RSA -keysize 2048 -validity 10000
     ```
   - Set environment variables or create `src-tauri/gen/android/keystore.properties`:
     ```properties
     storePassword=your_password
     keyPassword=your_key_password
     keyAlias=zim-downloader
     storeFile=/path/to/zim-downloader.keystore
     ```

## Building

### Debug Build
```bash
cargo tauri android build --debug
```

### Release Build
```bash
cargo tauri android build --release
```

### Output Locations
- Debug APK: `src-tauri/gen/android/app/build/outputs/apk/debug/`
- Release APK/AAB: `src-tauri/gen/android/app/build/outputs/apk/release/`

## Features on Android

- Full ZIM browsing and downloading
- Offline support with local storage
- Voice annotations (using device microphone)
- Ink annotations (touch-based drawing)
- Background downloads with notifications
- System tray/notification support

## Limitations

- File system access is limited to app-specific directories
- Some desktop-specific features may not be available
- WebView rendering may differ from desktop browsers

## Testing

Use Android Studio's emulator or a physical device:
```bash
cargo tauri android dev
```

## Copyright

Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
