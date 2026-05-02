# Endless Seven — Android

Android app for **Endless Seven**, kept separate from the TypeScript / React / Vite / Three.js web game at the repository root.

## Stack decision (choose-stack)

| Choice | Decision |
|--------|----------|
| **UI & shell** | **Kotlin** with **Jetpack Compose** and Material 3 |
| **Minimum OS** | API **26** (Android 8.0); `compileSdk` / `targetSdk` **35** |
| **3D / board** | **Current runtime:** Android `WebView` loading the existing Three.js board from packaged assets (`app/src/main/assets/web`). This gives a playable mobile build immediately while preserving visual parity with the TypeScript game. |
| **Alternatives** | Full native 3D port (Filament/SceneView/OpenGL ES), Flutter, React Native, Unity — all are Play Store–eligible, but require more rewrite effort. |

## Repository layout (repo-layout)

- **Web game:** `package.json`, `src/`, `vite.config.ts`, etc. at the **repo root** (unchanged workflow: `npm run dev`, `npm run build`).
- **Android app:** this directory **`android/`** only (Gradle `app` module). It packages the web game's build artifacts as app assets and renders them in a native `WebView`.
- **Avoid** a single long-lived git branch that tries to carry two diverging products; use **this folder split** or a **separate clone/repo** (`Endless-Seven-Android`) if you want fully independent issue tracking.

## Build and run

Requirements: **JDK 17**, **Android SDK** (Android Studio or command-line tools).

### One-command flow (recommended)

From the **repository root**:

| Goal | Command | Output |
|------|---------|--------|
| **Debug APK** (fresh web bundle + installable APK) | `npm run android:debug` | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **Release AAB** (Play Console; needs signing configured) | `npm run android:release` | `android/app/build/outputs/bundle/release/app-release.aab` |

Underlying steps (equivalent to `android:debug`):

```bat
:: from repo root, build mobile web assets
npm run build:android:web

:: then build Android debug apk
cd android
gradlew.bat assembleDebug
```

On macOS/Linux, use `./gradlew assembleDebug` after `npm run build:android:web`.

### Prerequisites (CLI / headless consistency)

Gradle must resolve an SDK directory. Prefer **`android/local.properties`** (normally **not committed**):

```properties
sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
```

Use forward slashes or escaped Windows paths per [Android docs](https://developer.android.com/studio/build#properties-files). Alternatively set **`ANDROID_HOME`** / **`ANDROID_SDK_ROOT`** to the same SDK root (Studio usually does this).

**JDK:** Set **`JAVA_HOME`** to JDK 17 and ensure `java` is on `PATH`.

**First-time SDK packages (command-line tools):** Accept licenses once, then install API **35** tooling to match `compileSdk`:

```powershell
$sdk="$env:LOCALAPPDATA\Android\Sdk"
$sm="$sdk\cmdline-tools\latest\bin\sdkmanager.bat"
$pipe = @(for ($i=0; $i -lt 200; $i++) { 'y' }) -join "`n"; $pipe | & $sm --sdk_root="$sdk" --licenses
& $sm --sdk_root="$sdk" "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

Gradle may still auto-install older build-tools (e.g. 34); that is normal.

### APK / bundle locations (verify builds)

After a successful run:

| Variant | Typical path |
|---------|----------------|
| Debug APK | `app/build/outputs/apk/debug/app-debug.apk` |
| Release **unsigned** APK | `app/build/outputs/apk/release/app-release-unsigned.apk` *(only after `assembleRelease`; no signing in `build.gradle.kts` by default)* |
| Release bundle (AAB) | `app/build/outputs/bundle/release/app-release.aab` *(after `bundleRelease`; configure signing for store uploads)* |

Open **`android/`** in Android Studio for emulators, signing, and Play uploads.

## Package ID

- `applicationId`: `com.endlessseven.app` (Android package names cannot use hyphens; aligns with the Electron `appId` style `com.endless-seven.app`.)

## Further reading

- [PLAY_STORE_CHECKLIST.md](PLAY_STORE_CHECKLIST.md) — signing, target API, policy, listing.
