# Package 21: iOS Schedule Widgets

## What ships

Package 21 adds one iOS WidgetKit extension with two independent static widget
kinds:

- **Next Church Service** shows the next service for the selected church.
- **My Next Assignment** shows the next service where the signed-in member has
  an assignment, including that member's role names.

Users can add either widget or both. Small and medium families are supported on
iOS 16 and later. Tapping either widget opens Music Ministry, whose existing
startup coordinator sends a ready account to the Schedule tab.

## Compatibility boundary

This package is additive and iOS-only. It changes no Supabase table, RLS policy,
RPC, Edge Function, notification payload, route, persisted app key, or Android
configuration. Released versions continue to use their existing signed app and
OneSignal extension entitlements.

The main app receives a second App Group,
`group.com.lbkchano.musicministry.widgets`, alongside the existing OneSignal
group. The new extension receives only the widget group. It has the unique bundle
identifier `com.lbkchano.musicministry.ScheduleWidgets` and cannot interfere
with `com.lbkchano.musicministry.onesignalnse`.

## Data flow and privacy

The authenticated app derives two bounded, sorted projections from the current
Schedule query cache and writes one versioned JSON value to shared UserDefaults.
The extension never contacts Supabase and never owns an auth session.

The snapshot contains only the church display name, service display fields,
personal role display names, a generated timestamp, and a non-reversible scope
fingerprint. It excludes auth tokens, emails, invitation codes, OneSignal IDs,
and raw account/church/member IDs. Writes are scope-guarded so an old account or
church response cannot replace the current snapshot.

The app recomputes the snapshot when schedule data changes and on foreground.
Sign-out, account deletion, account switching, and no-membership states clear
private content immediately and reload both widget timelines. Timelines advance
at timed service starts; an untimed same-day service remains visible through the
end of that local day. Snapshots older than 24 hours show a refresh state.

## Apple credential gate

Before the first preview or production build containing Package 21:

1. Register or refresh the App ID for
   `com.lbkchano.musicministry.ScheduleWidgets` in the same Apple team.
2. Enable the App Groups capability for the main App ID and widget App ID.
3. Assign `group.com.lbkchano.musicministry.widgets` to both App IDs.
4. Keep `group.com.lbkchano.musicministry.onesignal` assigned to the main app and
   OneSignal Notification Service Extension exactly as before.
5. Regenerate EAS provisioning profiles for the main app and both extensions.
6. Create a preview build and verify both widgets on a physical iOS device.
7. Regression-test OneSignal delivery before producing the App Store build.

## Physical-device release checklist

- Add both widget kinds simultaneously in small and medium sizes.
- Verify their first services differ when the member is not assigned to the
  church's next service.
- Test service edits/deletes, reassignment, fill-in acceptance, pull-to-refresh,
  foreground refresh, church/account switching, sign-out, and account deletion.
- Verify stale/offline, no-service, no-assignment, long church name, Larger Text,
  privacy redaction, and deep-link behavior.
- Verify an existing OneSignal push still arrives and opens correctly.

Rollback requires only a new iOS build without the widget target. No database,
Supabase, Android, or OneSignal rollback is necessary.
