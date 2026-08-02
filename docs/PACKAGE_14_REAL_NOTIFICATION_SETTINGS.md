# Package 14: Real Notification Settings

## What Shipped

- Profile now opens one focused notification screen for the selected church.
- Device permission and church delivery choices are separate and accurately
  labeled.
- Members can control service reminders, fill-in requests, accepted fill-in
  updates, and song updates.
- Every switch saves immediately through one account/church/member-keyed React
  Query source. Failed saves restore the previous setting and expose Retry.
- The former App Updates, Promotions, and generic OneSignal tag controls are no
  longer displayed.

## Compatibility Contract

- A membership with no preference row has every category enabled. Released
  clients therefore receive the same push notifications as before.
- The migration is additive. It does not remove or alter a released table,
  column, RPC, Edge Function URL, cron request, OneSignal event type, payload
  field, or per-device subscription contract.
- Opt-outs suppress push delivery only. The intended event remains in
  `member_notifications`, so the notification bell and admin audit behavior
  remain complete.
- An opted-out service reminder also records its existing `sent_reminders` key,
  preventing Supabase Cron from retrying it every minute.
- Account deletion was deployed before preference rows could be created and
  now removes rows both for owned churches and deleted memberships. Its
  missing-table fallback kept the released delete flow safe during rollout.

## Live Supabase Rollout

Applied migrations:

1. `20260801223829_add_member_notification_preferences`
2. `20260801225216_index_member_notification_preference_membership`

Active Edge Functions after deployment:

- `send-service-reminders` v50, `verify_jwt=false` for the existing cron
- `send-fill-in-notifications` v41, `verify_jwt=true`
- `send-service-comment-notifications` v7, `verify_jwt=true`
- `send-fill-in-accepted-notification` v7, `verify_jwt=true`
- `delete-account` v3, `verify_jwt=true`

Live rollback verification confirmed missing-row defaults, authenticated
updates, RLS, table grants, RPC grants, and zero retained test rows. The
deployed reminder diagnostic also confirmed the OneSignal REST key is
configured.

The post-migration security advisor reports no Package 14 finding. The
performance advisor reports only the expected informational `unused_index`
notices for indexes created during this rollout; the composite foreign-key
coverage warning was fixed by the second migration. See the
[Supabase database linter reference](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Verification

- TypeScript passes.
- Deno checks all notification and delete-account Edge Functions.
- Full ESLint passes.
- All 243 automated tests pass, including 14 Package 14 behavior and contract
  tests.
- Android and iOS production Metro exports pass.

## Physical Release Checks

1. Use a released build with no preference row and confirm all four existing
   push categories still deliver.
2. Disable one category on a new build and confirm only its push is suppressed
   while the bell still records the event.
3. Repeat with one account on two devices; each enabled device should receive
   one push and neither should receive duplicates.
4. Switch between two churches and confirm each membership retains independent
   delivery choices.
5. Test permission granted, fresh prompt, denied/Open Settings, and web states.
6. Delete a member-only, owner, and mixed multi-church account and confirm no
   preference rows remain.
