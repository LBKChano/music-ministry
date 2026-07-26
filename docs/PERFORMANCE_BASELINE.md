# Performance Baseline

This baseline is the reference for the performance roadmap in `TODO.md`. Repeat
the same sequence after each performance package and compare the generated JSON
reports.

## Compatibility

- Measurement is enabled only when the app is a development build, `__DEV__` is
  true, and `EXPO_PUBLIC_PERFORMANCE_BASELINE=1`.
- Normal development runs, EAS release builds, TestFlight, Play Store builds, and
  already-installed app versions do not use the recorder.
- The recorder wraps only this app's Supabase client. It does not change request
  behavior, retry behavior, returned data, Realtime subscriptions, or cache state.
- Endpoint query values, request bodies, authentication headers, tokens, names,
  and emails are never recorded.
- Step 1 requires no Supabase migration. No database schema or production data is
  changed by the measurement code.

## Reference Dataset

Privacy-safe production snapshot recorded on 2026-07-26:

| Item | Count |
| --- | ---: |
| Members | 17 |
| Admin accounts | 1 |
| Roles | 3 |
| Recurring service templates | 3 |
| Services | 82 |
| Upcoming services | 25 |
| Assignments | 172 |
| Service songs/comments | 8 |
| Fill-in requests | 59 |
| Unavailable dates | 53 |

The service history covers 2026-03-07 through 2026-09-30. This is large enough
to exercise multiple months, roles, assignments, comments, fill-ins, and blocked
dates without creating synthetic production records.

## Start A Run

Use a native development client. One Metro server can measure an Android and iOS
device at the same time:

```bash
pnpm baseline
```

To open one platform directly:

```bash
pnpm baseline:android
pnpm baseline:ios
```

Sign in first if the development client has no saved session. Then reload the
JavaScript bundle once so authentication setup is not mixed into the six tab
measurements.

## Six-Visit Sequence

Perform the sequence without pulling to refresh:

1. Open **Schedules** and wait until its data is visible for five seconds.
2. Open **Church** and wait five seconds.
3. Open **Profile** and wait until unavailable dates are visible.
4. Return to **Schedules** and wait five seconds.
5. Return to **Church** and wait five seconds.
6. Return to **Profile** and wait five seconds.
7. Send the app to the background.

Each tab change writes a `[PerfBaseline] Visit complete` record. Backgrounding
the app writes one consolidated `[PerfBaseline:Report]` JSON object containing:

- first versus return visit;
- sanitized Supabase request count and endpoint breakdown;
- failed request count;
- time from tab focus until all required screen data is ready;
- screen render/commit count;
- dataset counts observed by the screen;
- startup requests that occurred before a tab was focused.

“Ready” is finalized after the screen's required state is present and its
Supabase HTTP traffic has been quiet for 250 ms. The same threshold is used for
every run.

The same report can be printed from the JavaScript debugger:

```js
globalThis.musicMinistryPerformanceBaseline?.printReport()
```

## Two-Device Admin Run

1. Connect two native development clients to the same `pnpm baseline` server.
2. Sign the same admin account into both devices and select the same church.
3. Complete the six-visit sequence on Device A, then Device B.
4. With Schedules open on both, add one temporary song entry on Device A without
   sending a notification.
5. Record whether Device B updates, how long it takes, and whether either device
   logs duplicate Realtime updates or extra full schedule requests.
6. Delete the temporary song and confirm it disappears on both devices.
7. Background both apps to print their reports.

The report includes platform/device labels. Keep Android and iOS reports separate
when comparing results because native rendering costs differ.

## Captured Results

Physical-device capture is pending. This workspace does not currently have an iOS
Simulator toolchain or Android `adb`, so load and render timings cannot be
truthfully generated here.

Paste each complete `[PerfBaseline:Report]` below before starting roadmap package
2. Keep at least one Android report, one iOS report, and the two-device result.

### Android

Pending physical-device run.

### iOS

Pending physical-device run.

### Two Admin Devices

Pending physical-device run.

Record:

- Device A to Device B update latency:
- Duplicate Realtime events observed:
- Full schedule refetches caused by one temporary song insert:
- Full schedule refetches caused by its delete:
- Any stale or missing data:
