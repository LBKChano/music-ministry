# Package 15: Account Actions and Danger Zone

## Status

Implemented locally and deployed to the linked Supabase project on 2026-08-01.

- Live delete-account: version 4, verify_jwt=true.
- No database migration was required.
- The live cleanup-constraint audit passed inside an explicit rollback
  transaction.
- TypeScript, all Edge Function Deno checks, full ESLint, all 256 automated
  tests, and Android/iOS production Metro exports pass.

The remaining release checks require real devices and disposable accounts:
password-manager fill, secure-password-change reauthentication email, sign-out
on a two-device account, and deletion for each supported account shape.

## User Experience

Profile now delegates account-wide actions to focused screens:

- Account shows the authenticated email, app version, platform build, change
  password, and a neutral current-device sign-out.
- Change Password uses current/new password autofill metadata, validates
  locally, supports Supabase secure-password-change reauthentication codes,
  and can send the established password-recovery deep link.
- Delete Account loads a non-destructive server preview, lists memberships,
  owned churches, affected church members, services, templates, and assigned
  slots, then requires typing DELETE.
- The app refreshes the preview immediately before final deletion. A failed
  preview cannot fall through to deletion.

## Account Exit Cleanup

Successful sign-out:

1. Deactivates the current physical OneSignal subscription through the
   existing Package 1 RPC and legacy membership bridge.
2. Signs out from Supabase Auth.
3. Clears the local OneSignal identity, all tracked Realtime channels, the
   account-scoped React Query cache, and persisted last-church selection.
4. Leaves every other physical device registered.

If Auth sign-out fails after device deactivation, the app restores that
physical device registration before returning the error.

Successful account deletion:

1. Uses the existing authenticated POST /functions/v1/delete-account endpoint.
2. Lets the server deactivate every account device and remove owned and joined
   church data, notification preferences, subscriptions, and tokens.
3. Clears local OneSignal, Realtime, cache, and persisted-selection state only
   after the server action succeeds.

## Released-App Compatibility

Package 15 does not rename or remove any table, column, RPC, route contract, or
Edge Function.

- A request with a true preview flag returns before the first mutation.
- A released client's bodyless authenticated POST still enters the existing
  deletion path.
- The function remains JWT protected.
- The function's cleanup remains retry-safe when an earlier attempt completed
  only part of its idempotent delete sequence.
- Package 1 device records and Package 14 notification preferences retain their
  existing cascade and explicit cleanup paths.

## Verification

Automated:

- npm run verify:package15
- npm run lint
- npx expo export --platform android
- npx expo export --platform ios
- npx supabase db query --linked --file supabase/tests/account_deletion_cleanup.sql
- Supabase database advisors
- Live function inventory confirming delete-account v4 and verify_jwt=true

Physical release matrix:

- Member-only account
- Admin-only membership
- Owner account
- Mixed owner/admin/member multi-church account
- One account on two physical devices
- Android and iOS password-manager fill
- Recent and older sessions with secure password change
- Password-reset email returning to the existing reset route

Use disposable owned churches for deletion tests because successful deletion is
permanent.
