# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Endless Seven is a client-side strategic card game built with TypeScript, React 19, Three.js (3D board), and Vite. There is no backend server or database — the entire game runs in the browser. The AI opponent logic is built in.

### Commands

Standard commands are in `package.json` scripts:

- **Dev server**: `npm run dev` (Vite on port 3000, `--host=0.0.0.0`)
- **Lint**: `npm run lint` (runs `tsc --noEmit`; note: the repo has pre-existing TS errors in test files and a few source files — these are not regressions)
- **Tests**: `npm run test` (Vitest, single run) or `npm run test:watch`
- **Build**: `npm run build` (Vite production build)

### Notes

- The `GEMINI_API_KEY` env var (via `.env.local`) is optional — the core game works without it.
- `better-sqlite3` and `express` are listed as dependencies but are not actively used at runtime; `npm install` may emit native-addon warnings for `better-sqlite3` which are safe to ignore.
- The Electron-related scripts (`electron:dev`, `electron:build`) require a display server and are not needed for web development or testing.
- Lint (`tsc --noEmit`) exits with errors (exit code 2) due to pre-existing type issues in test mocks and a few source files. This is the repo's baseline state.

### Git remotes (consolidated)

- **`main`** includes the web game and the [`android/`](android/) shell; use it as the default branch for both pushes and PRs.
- **`origin`** → [android_endless_seven](https://github.com/Jmetrics86/android_endless_seven) (primary remote for this Android-focused clone).
- **`upstream`** → [Endless-Seven](https://github.com/Jmetrics86/Endless-Seven) (original repo). Sync with `git fetch upstream` when needed.

### Android app (separate product tree)

- **Location:** [`android/`](android/) — Kotlin/Compose shell + `WebView` packaging for the Three.js board from web assets (see [`android/README.md`](android/README.md)).
- **Streamlined builds (recommended):** From repo root, use `npm run android:debug` — runs `build:android:web` then `gradlew.bat assembleDebug`. On macOS/Linux, run `npm run build:android:web` then `cd android && ./gradlew assembleDebug`.
- **Play Store bundles:** From root, `npm run android:release` runs `bundleRelease` (outputs an **AAB**, not an APK—see checklist).
- **APK artifacts (Gradle defaults):**
  - **Debug APK (installable for testing):** `android/app/build/outputs/apk/debug/app-debug.apk`
  - **Release APK (unsigned until signing is configured):** `android/app/build/outputs/apk/release/app-release-unsigned.apk` — produced by `assembleRelease`; use signing + checklist for store-ready builds.
- **Prerequisites:** JDK **17** (`JAVA_HOME`), Android SDK whose root is **`sdk.dir`** in `android/local.properties` (typically gitignored; create if Gradle reports “SDK location not found”). First-time CLI-only setups: accept licenses and install SDK components as in [`android/README.md`](android/README.md).
- **Play Store:** See [`android/PLAY_STORE_CHECKLIST.md`](android/PLAY_STORE_CHECKLIST.md).
