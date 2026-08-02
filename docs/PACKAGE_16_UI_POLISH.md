# Package 16: Cross-App UI Polish and Consistency

## Scope

Package 16 is a client-only release. It does not add a Supabase migration or
change an RPC, Edge Function, notification sender, persisted key, or released
route. The Schedule tab is unchanged.

## Implemented

- Android and iOS tab layouts now use one `AppTabs` contract.
- Tab presses use tab navigation instead of stacking duplicate routes.
- The Church tab is shown only for a ready admin membership. A completed switch
  to a member church redirects an unauthorized Church route to Schedule.
- Bottom-tab labels, touch targets, selected state, hints, and reduced-motion
  behavior are explicit.
- Profile church switching moved from the overview to `/profile-churches` while
  preserving `ChurchSwitcher` as the behavior owner.
- Profile and Church focused editors share one responsive header primitive.
- The shared admin form modal has a reachable close action, Android back and
  accessibility escape handling, keyboard dismissal, a bounded scrollable
  body, and stable actions.
- Onboarding keeps the released workflow but separates returning-user and
  church-access choices more clearly.
- Profile, onboarding, refresh errors, and no-membership recovery use shared
  inline or full-screen feedback primitives.
- User-facing error surfaces replace messages containing common Supabase, RPC,
  OneSignal, JWT, PostgreSQL-code, or UUID details with a safe recovery message.

Church destination state and mutations intentionally remain owned by the
existing Church route. The shared overview, focused header, and modal provide
the consistent editor shell without moving RPC payloads, compatibility
fallbacks, drafts, or Realtime behavior during a visual-only release.

## Automated Verification

Run:

```sh
node --experimental-strip-types --test tests/package16-behavior.test.mjs tests/package16-contracts.test.mjs
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
node --experimental-strip-types --test tests/*.test.mjs
deno check supabase/functions/send-service-reminders/index.ts supabase/functions/send-fill-in-notifications/index.ts supabase/functions/send-service-comment-notifications/index.ts supabase/functions/send-fill-in-accepted-notification/index.ts supabase/functions/delete-account/index.ts
EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform android
EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform ios
```

The Package 16 suite covers tab selection, admin-tab visibility, member-route
recovery, shared headers, focused church switching, modal accessibility,
feedback sanitization, route preservation, the unchanged backend boundary, and
the explicit Schedule-tab exclusion.

On 2026-08-01, TypeScript, Edge Function Deno checks, full ESLint, all 267
automated tests, `git diff --check`, and Android/iOS production Metro exports
passed.

## Physical Release Matrix

Complete these checks before publishing the new app build:

- [ ] Small Android phone: two-tab member account and three-tab admin account.
- [ ] Large Android phone or tablet: Larger Text, display scaling, keyboard,
  TalkBack, Voice Access, and Android back from each changed modal/editor.
- [ ] Older supported iPhone: two-tab and three-tab navigation, keyboard,
  VoiceOver, Larger Text, Reduce Motion, and swipe-back behavior.
- [ ] Current large iPhone or iPad: landscape, safe areas, focused editor return,
  and modal action visibility.
- [ ] Switch admin church to member church while Church is selected; verify the
  Church tab disappears and Schedule becomes active.
- [ ] Switch member church to admin church; verify the Church tab appears only
  after the new membership is ready.
- [ ] Verify one church, many churches, failed/offline switch, removed
  membership, and Join Another Church.
- [ ] Verify Sign In, Join, Create, email verification, password reset, pending
  intent recovery, duplicate-submit protection, and post-onboarding routing.
- [ ] Verify Profile identity, availability, scheduling, notification, account,
  password, sign-out, deletion preview, and deletion return navigation.
- [ ] Verify every Church destination, form close action, unsaved draft, save
  feedback, keyboard dismissal, and scroll position.
- [ ] Confirm Schedule cards, songs, comments, fill-ins, notification bell, and
  assignment workflows match the previous build.

## Rollback

Rollback is the previous client build. No database rollback or Supabase change
is required.
