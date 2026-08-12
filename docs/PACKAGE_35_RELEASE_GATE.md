# Package 35 Integrated Release Gate

Date: 2026-08-12

Package 35 verifies Packages 30 through 34 together. It adds no runtime feature,
database migration, Edge Function, route, persisted setting, or released-client
contract.

## Automated Gate

Run from the repository root:

```sh
npm run verify:package35
git diff --check
EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir /tmp/music-ministry-package35-web
EXPO_NO_TELEMETRY=1 npx expo export --platform android --output-dir /tmp/music-ministry-package35-android
EXPO_NO_TELEMETRY=1 npx expo export --platform ios --output-dir /tmp/music-ministry-package35-ios
```

The Package 35 contract suite confirms that the shared Android/iOS Schedule
screen contains the Package 30-34 header, compact setup, truthful range,
pagination, and modal contracts. It also protects admin-only schedule changes,
song ownership, church-session switching, notification Realtime handling, iOS
widget synchronization, native identifiers, Android API 36, and both iOS app
groups.

Result on 2026-08-12: TypeScript passed, all six Edge Function Deno checks
passed, full ESLint passed, all 496 tests passed, `git diff --check` passed, and
clean web, Android, and iOS production exports completed successfully.

## Live Supabase Audit

The linked `Music Ministry` project (`cvgdxmmtrukahyvkgazj`) was inspected
read-only on 2026-08-12:

- Zero public tables were found without RLS.
- All 11 RPC names recorded by `docs/compatibility-baseline.json` exist.
- Thirteen public app tables are included in `supabase_realtime`.
- `send-service-reminders-every-minute` is active on `* * * * *`.
- `send-fill-in-escalations-every-five-minutes` is active on `*/5 * * * *`.
- The reminder diagnostic reports OneSignal configured.
- The JWT-protected `delete-account` endpoint rejects an anonymous request with
  HTTP 401.
- The latest additive role-symbol and notification-retention migrations are
  recorded live, and all six app Edge Functions are active with their expected
  JWT settings.

Packages 30-35 have no backend migration to deploy. Historical local/remote
migration-version differences remain documented; do not repair or rewrite that
history as part of this gate.

## Existing Backend Backlog

These findings predate Packages 30-35 and are not regressions from this release:

- Supabase lint reports unused parameters in the development helper functions
  `read_project_file_lines` and `write_file`.
- The legacy SQL `public.delete_account()` body references a removed
  `member_unavailability.user_id` column. Current and compatibility-floor
  clients call the protected `delete-account` Edge Function instead.
- Security advisor warnings remain for mutable `search_path` on legacy helper
  functions, `pg_net` in `public`, and leaked-password protection being off.
- Performance advisor warnings remain for multiple permissive policies on
  several core tables.
- Old development helper Edge Functions remain deployed outside the current app
  contract and should receive a separate ownership/security cleanup.

These should be handled as a dedicated additive compatibility package, not
mixed into a client-only release gate.

## Responsive Browser Matrix

The signed-out onboarding and create-church paths were checked at 320x568,
375x667, 390x844, 430x932, 1024x1366, and 740x320. No horizontal overflow or
clipped actions were found. Narrow portrait and landscape correctly use one
inner scroll owner, and the create-church form scrolls in both directions with
its final action reachable.

Authenticated Schedule, Church, Profile, modal, notification, and widget visual
checks require a test account plus native capabilities and cannot be certified
from the signed-out web session.

## Physical Release Matrix

Before store submission, record a pass/fail result for each row. Do not treat
an unavailable device as a pass.

| Target | Normal text | Larger Text/display scale | Keyboard/modals | Notifications/widget | Status |
| --- | --- | --- | --- | --- | --- |
| Narrow Android phone | Required | Required | Required | Push required | Pending physical device |
| Current iPhone | Required | Required | Required | Push + both widgets | Pending physical device |
| Older supported iPhone | Required | Required | Required | Push + both widgets | Pending physical device |
| Large phone | Required | Required | Required | Push required | Pending physical device |
| Tablet/iPad | Required | Required | Required | iPad widget if offered | Pending physical device |

Also verify VoiceOver/TalkBack order, Reduced Motion, safe-area clearance,
short and long church names, returning-admin setup, pull-to-refresh, offline
cache, account/church switching, Realtime convergence, load-more stability, all
representative modal families, admin permissions, and member-owned song edits.

The candidate is locally buildable after the automated gate passes. Final store
release approval remains conditional on the physical and released-build smoke
matrix above.
