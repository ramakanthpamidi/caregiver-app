# Pre-Release Review & Fix Log — 2026-09-18

Reference notes for the next update cycle. Covers the Play Store
pre-release review of the working-tree diff on `main`, the fixes applied,
the merge with `origin/main`, and what is still open.

Commits: `ba1896e` (fixes) → `e188f93` (merge with origin/main), pushed to
`origin/main`.

## Fixed in this pass

| Area | File | What changed |
|---|---|---|
| BLE permissions (Android 12+) | `modules/icomon-scale/android/.../IcomonScaleModule.kt` | Added a `BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN` runtime-permission check before touching the native SDK, plus `SecurityException` guards around `addDevice()`/`scanDevice()`. Previously the always-on device monitor could drive this native module before `AddDeviceModal` ever requested permissions, risking an uncaught crash. |
| BMI data integrity | `src/features/home/screens/HomeScreen.tsx` | BMI no longer silently assumes a fabricated 160cm height when a profile has none recorded. It now falls back to the scale's own onboard BMI estimate, or omits BMI entirely — this value used to be persisted to Trends history and could trigger a false (or mask a real) BMI alert. |
| Cross-profile data leak | `src/features/devices/lib/liveReadings.ts`, `HomeScreen.tsx` | Added `clearLiveReadingsForDevices()`. "Clear readings" actions on Home now only clear the active profile's own devices instead of the global `readingsByDevice` store shared by every patient profile. |
| Wrong-device attribution | `HomeScreen.tsx` | Thermometer card no longer shows one device's name next to a different, specifically-paired thermometer's reading/status when 2+ thermometers are registered (fallback only applies when exactly one thermometer is registered). |
| Stale UI | `HomeScreen.tsx` | `clearWeightMeasurement()` now also resets `bodyComposition`, so body-fat/muscle/water chips don't linger after a weight clear. |
| Broken alert UI | `src/features/alerts/components/AlertListItem.tsx` | `splitReading()` now parses the new `"BMI 24.3 • 68.5 kg"` format; previously it fell into the generic digit-first branch and rendered unparsed/garbled. |
| Network abuse | `src/features/devices/components/AddDeviceModal.tsx` | Yuwell model-catalog lookup was re-firing on every BLE advertisement (allowDuplicates scan) for a device once resolved, hammering the endpoint. Now resolved at most once per scan per device name. |
| False positive matching | `AddDeviceModal.tsx` | ICOMON `isIcomonDevice()`'s `MY_SCALE` name regex anchored to word boundaries so it can't match as a substring of an unrelated device name. |
| Connect race | `src/shared/lib/ailinkScale.ts`, `src/shared/lib/icomonScale.ts` | Connect watchdog now stops the native session before releasing its in-flight guard, so a slow connect can't race a second concurrent `native.start()` call from the next scan retry. |
| Falsy-zero edge case | `src/shared/lib/healthThresholds.ts` | `formatReadingText`'s `bmi` case now uses a finite/positive check on `kg` instead of a falsy check, consistent with the `temp` case. |
| Secrets hygiene | `.env`, `.gitignore` | `.env` untracked from git (it had been committed despite `.gitignore` excluding it in the same commit); file stays on disk for local dev. |
| Hardcoded debug endpoint | `src/shared/config/api.ts`, `src/core/navigation/MainAppShell.tsx` | `origin/main` had independently hardcoded `API_BASE_URL = 'http://157.85.102.79:8085'`. Per explicit instruction, kept the `__DEV__`-aware config (dev → local Laravel, release → `https://bpscaregiver.com` always). Found and fixed a second hardcoded reference to the same debug IP in `MainAppShell.tsx`'s `APP_UPDATE_ENDPOINT`, now routed through the shared `apiUrl()` helper. Verified via repo-wide grep: no remaining reference to `157.85.102.79` anywhere in source. |
| iOS ATS | `app.json` | Dropped `NSAllowsArbitraryLoads` (blanket ATS disable); kept `NSAllowsLocalNetworking`, which is all the LAN-IP dev workflow needs now that production always uses HTTPS. |
| Redundant plugin | `app.json`, `plugins/withCleartextTraffic.js` (deleted) | Removed the custom cleartext-traffic config plugin — it duplicated the existing `android.usesCleartextTraffic: true` flag. |

## Still open — needs a human decision before the next release

These were deliberately **not** changed because guessing wrong has real
consequences (orphaned Play Store listing, builds going to the wrong EAS
account) and the correct answer depends on information only the project
owner has.

1. **Android `package` vs iOS `bundleIdentifier` mismatch.**
   - `app.json` → `expo.android.package`: `com.vajraevcharger.wellscreen`
   - `app.json` → `expo.ios.bundleIdentifier`: `com.caregiverbp.swell-screen`
   - These use two different naming schemes and don't match each other or
     the app name ("Well Screen"). Also note the app's `android.package`
     has changed at least three times across recent history
     (`com.venkatar.caregiverapp` → `com.vajraevcharger.wellscreen`).
   - **Action needed:** confirm whether any prior package name was ever
     published to Google Play / the App Store. Changing the Android
     `package` after a real Play Console listing exists creates a brand-new
     listing with no update path for existing installs — this is
     effectively irreversible once published.

2. **EAS `projectId` / `owner` ambiguity.**
   - Local branch (currently committed): `projectId: 1fcc3057-7a6a-4348-9092-982764ff7be0`, no `owner` field.
   - `origin/main`'s older commit (`bebce30`) had: `projectId: 0f759dd6-0e23-4e47-b30d-9299569d7878`, `owner: "vajraevcharger"`.
   - The merge kept the local branch's value since it's what current work
     was built against.
   - **Action needed:** before the next `eas build` / `eas submit`, confirm
     `1fcc3057-...` is the correct, currently-active EAS project for this
     app. If not, update `app.json`'s `extra.eas.projectId` (and re-add
     `owner` if the EAS CLI session needs it to disambiguate accounts).

## Lower-priority items noted but not acted on

Surfaced by the review's finder agents; kept for awareness, not blocking:

- `src/features/trends/lib/weightBmi.ts` vs `src/features/home/screens/HomeScreen.tsx`: `evaluateBmi`/`evaluateBmiStatus` are duplicated (near-identical WHO-classification logic in two files). Candidate for consolidation into `healthThresholds.ts` alongside the other vital-threshold evaluators.
- `src/features/devices/components/ScanDeviceCard.tsx`'s `getIconForDevice` still has its own parallel keyword/regex device-type matching instead of using the shared `classifyVitalDeviceKind` from `src/features/devices/lib/deviceKind.ts`. `DeviceScreen.tsx` and `HomeScreen.tsx` were migrated; this one was missed.
- `src/shared/lib/ailinkScale.ts` and `src/shared/lib/icomonScale.ts` contain a near-line-for-line duplicated "piggyback scan-handoff" state machine (`monitorMacSet`/`connectInFlight`/`connectWatchdog`/etc.). A shared helper would prevent the two from silently drifting (they already differ slightly).
- `src/features/devices/lib/bleLiveMonitor.ts`'s scan callback directly imports and calls `notifyAilinkDeviceSeen`/`notifyIcomonDeviceSeen` for every scanned advertisement, coupling the generic BLE monitor to specific vendor SDKs. Adding a third scale vendor means editing this file again; a pub/sub scan-result bus would decouple it.
- `components/DeviceScreen.js` (a legacy, currently-unreferenced file distinct from `src/features/devices/screens/DeviceScreen.tsx`) still calls `router.replace('/patient/vitals/...')` and `/patient/review`, routes deleted in this diff. Dead code today (no import path reaches it), but a landmine if anyone re-imports it by the name collision.
- Android adaptive icon: the new `icon.png` wordmark spans ~86% of the 512×512 canvas edge-to-edge, with `monochromeImage` removed. Adaptive icons guarantee only the inner ~66% "safe zone" is visible under circular/squircle launcher masks — worth a visual check on-device before submission, and the Android 13+ themed-icon feature is currently lost without `monochromeImage`.
