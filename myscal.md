# MY_SCALE (ICOMON) weight not showing on Home — debug log

## Symptom
Home screen weight card stopped receiving live data from the "MY_SCALE" scale.
Had worked previously; broke after recent BLE monitoring refactor work.

## Investigation

1. Reviewed uncommitted diff (`git diff --stat`) — large refactor touching
   `bleLiveMonitor.ts`, `ailinkScale.ts`, `BleMonitoringHost.tsx`, and new
   files `icomonScale.ts` / `useIcomonScaleMonitor.ts`. The refactor moved the
   AILink/ICOMON scale adapters from doing their own BLE scan to piggybacking
   on `bleLiveMonitor`'s single scan (`notifyAilinkDeviceSeen` /
   `notifyIcomonDeviceSeen`), to avoid a second concurrent `ble-plx` scan
   killing the Yuwell device discovery.
2. User confirmed the physical scale's BLE name is **`MY_SCALE`** and pointed
   at the reference vendor SDK (`ICDeviceManager` / ICOMON "Fitday" app),
   confirming the hardware speaks the ICOMON protocol.
3. Compared against `AddDeviceModal.tsx`: it already detects ICOMON scales
   correctly at pairing time (via the ICOMON BLE service UUID
   `0000ffb0-...`) and saves `platform: 'ICOMON'` on the device record.

## Root causes found

1. **Routing bug** — `BleMonitoringHost.tsx` classified scales into the
   AILink vs. ICOMON monitor purely by matching `"icomon"`/`"welland"` in the
   BLE name text (`isIcomonBrandText`). `"MY_SCALE"` contains neither, so it
   fell through to the **AILink** adapter — the wrong native protocol for
   this hardware — even though the device record already had
   `platform: 'ICOMON'` from pairing. The same bug existed independently in
   `useIcomonScaleMonitor.ts`'s internal `isScaleDevice` filter, which would
   have re-excluded the device even after a routing fix.
2. **Missing name pattern** — `MY_SCALE` is ICOMON's generic factory-default
   advertising name (not user-customized), but neither
   `icomonScale.ts`'s `ICOMON_NAME_PATTERN` nor `AddDeviceModal.tsx`'s
   `isIcomonDevice()` recognized it as text, only via service UUID (which
   isn't always present in the BLE advertisement packet ble-plx receives at
   scan time).
3. **Stale native build** — the real blocker, found via live `adb logcat`
   diagnostics. Even after the routing fix, the ICOMON native module
   (`modules/icomon-scale/android/.../IcomonScaleModule.kt`) never emitted a
   single event to JS — not even the synchronous `connecting` event fired at
   the top of `start()`. By contrast the AILink native module did emit an
   event (`'note', 'Bluetooth service ready'`), proving the JS↔native bridge
   itself was fine. Since `/android` isn't checked into git and wasn't
   present on disk, and `icomon-scale` is a brand-new native module, the APK
   installed on the test device was built from older/incomplete native
   source — Metro's JS hot-reload doesn't touch compiled Kotlin code, so all
   the JS-side fixes were live but the native module underneath was stale.

## Fixes applied

- `src/features/devices/components/BleMonitoringHost.tsx` — classify scales
  by `device.platform` first (`'icomon'` / `'ailink'`), falling back to the
  old name-text heuristic only when `platform` is unset (older device
  records).
- `src/features/devices/lib/useIcomonScaleMonitor.ts` — same platform-first
  logic in its internal `isScaleDevice` filter.
- `src/features/devices/lib/useAilinkScaleMonitor.ts` — explicitly excludes
  any device recorded with `platform: 'icomon'`, defense-in-depth.
- `src/shared/lib/icomonScale.ts` — `ICOMON_NAME_PATTERN` now also matches
  `my_scale` / `my scale` / `my-scale` / `myscale`.
- `src/features/devices/components/AddDeviceModal.tsx` — `isIcomonDevice()`
  now also recognizes the `MY_SCALE` name directly, not just the service
  UUID, so pairing reliably records `platform: 'ICOMON'` even when the scan
  result doesn't carry the UUID.
- Native rebuild via `eas build` + reinstall — picked up the current
  `IcomonScaleModule.kt` / `AilinkScaleModule.kt` source, which is what
  actually fixed live event delivery.

## Verification

Used `adb logcat` (filtered to `ReactNativeJS`, `IcomonScale`, `AilinkScale`,
`AndroidRuntime:E`) across several capture windows while the user
force-stopped/relaunched the app and stepped on the scale:

- Confirmed classification: `MY_SCALE` → `as: 'icomon'`.
- Confirmed `startIcomonMonitoring, watching for: [F02C59C7B887, ...]`.
- Confirmed repeated `target scale seen advertising, connecting: F0:2C:59:C7:B8:87`
  on every advertisement.
- Found the missing piece: no native `onScaleEvent` ever reached JS — traced
  to the stale native build (see root cause 3 above).
- Also identified (informationally) that the vendor "Fitday" app holding an
  active BLE connection to the scale would block our app from connecting —
  advised closing it before testing, since most BLE scales only accept one
  active connection at a time.

After the `eas build` reinstall, user confirmed: **"now working good"**.

All temporary diagnostic `console.log` lines (`[SCALE_MON]`, `[ICOMON]`,
`[AILINK]`) added during this session were removed once the fix was
verified; only the logic fixes listed above remain.

## Regression #2: broke again after a plain JS reload

User reported "after changes again not working" after doing nothing but a
JS reload (no rebuild, no app restart, no scale/phone changes) following the
log-cleanup edits above.

### Investigation

- Re-verified `tsc --noEmit` was clean on all touched files — the
  log-cleanup edits hadn't broken anything.
- Re-added the same diagnostic logging temporarily (JS-only, no rebuild
  needed) and re-captured `adb logcat`.
- Confirmed classification was still correct (`MY_SCALE` → `icomon`,
  `icomonDevices: 1`) and `startIcomonMonitoring`/`notifyIcomonDeviceSeen`
  ("target scale seen, connecting") were firing repeatedly on every
  advertisement — but once again **zero native events** reached JS, and zero
  native `IcomonScale` Android log lines fired at all. Identical symptom to
  root cause 3 above, but this time on a build that had already been proven
  to work once (right after the `eas build` install).

### Root cause

`IcomonScaleModule.kt`'s own comments already flagged this risk:
`ICDeviceManager.shared()` is a **process-wide singleton that outlives the
JS bridge**. A plain JS reload destroys the Expo `Module` instance and
creates a fresh one, but the singleton itself survives with whatever state
the *previous* instance left it in.

`removeKnownDevice()` was fire-and-forget: it called `removeDevice()` and,
without waiting for that removal to actually complete, immediately called
`connectTo()` → `addDevice()` again for the same MAC. After a JS reload this
races the singleton's internal state — the re-add can land while the
previous remove is still in flight — and leaves it silently stuck: no more
`connected`/`error`/`weight` events ever fire again for that session.

A full app force-stop + relaunch (not just JS reload) resets the native
singleton cleanly, which is why the very first post-`eas-build` test worked
and a subsequent plain reload broke it.

### Fix applied

`modules/icomon-scale/android/.../IcomonScaleModule.kt`:

- `removeKnownDevice()` now takes a callback and **waits for the SDK's
  `removeDevice` callback** before proceeding, instead of firing the
  re-add immediately. A 2s watchdog (`mainHandler.postDelayed`) guards
  against the callback never arriving, so it can't hang forever.
- The `start()` AsyncFunction's `begin` Runnable now calls
  `removeKnownDevice { ... connectTo(mac) ... }` instead of calling
  `removeKnownDevice()` and `connectTo()` back-to-back unsequenced.
- `stop()`'s call site updated to `removeKnownDevice {}`.

This requires another `eas build` + reinstall to take effect (native/Kotlin
change — JS reload doesn't touch it). Until that build is installed, the
workaround is: **fully force-stop and relaunch the app** rather than relying
on a JS-only reload, whenever the ICOMON scale needs to reconnect.

### Verification (post force-relaunch, pre-native-fix build)

Force-stopping and relaunching the app (new PID confirmed in logcat) reset
the native singleton and the full pipeline worked end-to-end:

```
weight events streaming in (77.8kg .. 80.1kg while stepping on/adjusting)
  -> ICMeasureStepAdcStart (impedance measurement begins)
  -> ICMeasureStepMeasureOver, stabilized=true
  -> 'bodyfat' event: weightKg 79.1, bmi 28, bodyFatPct 40, musclePct 55.9,
     waterPct 43.9, proteinPct 12, visceralFat 14, bmr 1393, bodyAge 52
  -> [AlertStorage] Added alert: 'Good BMI Reading'
```

Confirms the complete chain — native ICOMON SDK → `IcomonScaleModule.kt` →
JS `icomonScale.ts` adapter → `HomeScreen.tsx` weight/BMI card → Alerts
pipeline — works correctly once the native singleton is in a clean state.

### Still open

The native reload-race fix (`removeKnownDevice` awaiting completion) has
**not yet been verified by an `eas build`** — it's a code fix applied based
on the diagnosed race condition, reasoned from the module's own comments and
the log evidence, but not yet round-tripped through a real device test.
Next step: run `eas build`, install, and confirm the scale survives a plain
JS reload (not just a full app restart) without going silent.
