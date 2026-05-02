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

Requirements: **JDK 17**, **Android SDK** (via Android Studio).

```bat
:: from repo root, build mobile web assets
npm run build:android:web

:: then build Android debug apk
cd android
gradlew.bat assembleDebug
```

Or from repo root in one step:

```bat
npm run android:debug
```

Release **AAB** for Play Console:

```bat
:: ensure latest web assets are packaged first
npm run build:android:web

cd android
gradlew.bat bundleRelease
```

Or from repo root in one step:

```bat
npm run android:release
```

Open **`android/`** in Android Studio for emulators, signing, and Play uploads.

## Package ID

- `applicationId`: `com.endlessseven.app` (Android package names cannot use hyphens; aligns with the Electron `appId` style `com.endless-seven.app`.)

## Further reading

- [PLAY_STORE_CHECKLIST.md](PLAY_STORE_CHECKLIST.md) — signing, target API, policy, listing.
