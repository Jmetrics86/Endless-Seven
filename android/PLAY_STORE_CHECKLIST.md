# Google Play — release checklist

Use this when preparing a **signed Android App Bundle (AAB)** for [Google Play Console](https://play.google.com/console/).

## 1. App signing

- [ ] Create or use an **upload key**; enable **Play App Signing** in Play Console (recommended).
- [ ] Store keystore passwords and aliases in a secrets manager — **never** commit `*.jks` / `*.keystore` with passwords in git.
- [ ] Configure `signingConfigs` in `app/build.gradle.kts` for `release` (local `keystore.properties` or CI secrets).

## 2. Target API and SDK

- [ ] Confirm **`targetSdk`** meets [Play’s target API level requirements](https://developer.android.com/google/play/requirements/target-sdk) (raise as Google updates policy).
- [ ] Test on a **physical device** and representative **API levels** (min 26 for this project).

## 3. Build variant

- [ ] Build and package web game assets before Android release builds: `npm run build:android:web`.
- [ ] Produce **release** AAB: `gradlew bundleRelease` (or Android Studio **Build > Generate Signed Bundle**).
- [ ] Optionally enable **R8/minify** and upload **mapping file** for native/Java crashes once the app grows.

## 4. Privacy, data safety, and policies

- [ ] Complete the Play Console **Data safety** form (even if “no data collected” — declare accurately).
- [ ] If you add analytics, ads, or account systems, add a **privacy policy URL** where required.
- [ ] Review [Developer Program Policies](https://play.google.com/about/developer-content-policy/) for gambling/restricted content if applicable.

## 5. Store listing

- [ ] **App name**, short/full descriptions, screenshots (phone, optional tablet), feature graphic.
- [ ] **Content rating** questionnaire.
- [ ] **Countries** and pricing (free/paid).

## 6. Quality

- [ ] **Internal / closed testing** track before production.
- [ ] Verify **edge-to-edge**, notch, and **touch targets** on small and large phones.

## 7. Ongoing

- [ ] Monitor **vitals** (ANRs, crashes) and **user feedback** after launch.

This checklist is project documentation only; Play requirements change — verify against current Google Play Console guidance before each release.
