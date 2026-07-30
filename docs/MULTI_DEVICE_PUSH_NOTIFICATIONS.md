# Multi-Device Push Notifications

The same church member can receive one logical notification on every physical
Android or iOS device where that member is currently signed in.

## Compatibility

- The public `claim_onesignal_subscription(uuid, text)` RPC signature and return
  type are unchanged.
- Existing app builds continue calling the same RPC and `OneSignal.login` flow.
- The `member_notifications.event_key` column is nullable, so older Edge
  Functions and app builds can keep inserting and reading notification rows
  without providing it.
- No existing table, column, RLS policy, function argument, or client payload was
  removed.
- Each installed device must open the app while signed in at least once after
  deployment so its current OneSignal subscription is claimed without evicting
  subscriptions saved by other devices.

## Delivery Rules

1. A OneSignal subscription ID represents one physical push subscription.
2. `subscription_id` stays globally unique, so one device cannot belong to two
   member accounts at the same time.
3. One member can own multiple unique subscription rows.
4. Every sender deduplicates subscription IDs before calling OneSignal.
5. A member with saved subscriptions is targeted only through those subscription
   IDs. The external ID fallback is used only when that member has no saved row,
   so the same device is never targeted by both methods.
6. Stable OneSignal idempotency keys prevent retries of the same logical event
   from creating another push.
7. Notification history is unique by `(member_id, event_key)`, producing one bell
   item per member event rather than one item per device.
8. Partial OneSignal validation errors no longer make a successful delivery look
   like a total failure. Invalid IDs are removed while healthy devices are not
   retried.

## Covered Notifications

- Service reminders
- Fill-in requests
- Accepted fill-in notices
- Service song/comment notifications

## Sign-Out and Account Switching

Package 4 clients read the physical device subscription ID before calling
`OneSignal.logout`. They deactivate that one account-device record and delete
only the matching legacy `(member_id, subscription_id)` row. Other signed-in
devices remain active. Registration and deactivation for the same subscription
are serialized so an in-flight registration cannot complete after sign-out and
silently reactivate the device.

When a physical device signs into another account, the account registration RPC
reassigns its globally unique subscription to the authenticated account. The
unchanged legacy claim RPC then moves the member-scoped compatibility row to the
selected membership. Delivery resolves all active account devices plus
unbridged legacy subscriptions and deduplicates the final subscription IDs.

Older app versions remain usable. They continue using the unchanged
`OneSignal.login(member_id)` and `claim_onesignal_subscription(uuid, text)`
contracts. The database triggers mirror their legacy claims and deletes into
the account-device registry, and the external-ID fallback remains available
when no saved subscription can be resolved.

## Production Deployment

Deployed on 2026-07-26:

- Migration `20260726223652_enable_multi_device_push_notifications`
- `send-service-reminders` version 48, `verify_jwt=false`
- `send-fill-in-notifications` version 39, `verify_jwt=true`
- `send-fill-in-accepted-notification` version 5, `verify_jwt=true`
- `send-service-comment-notifications` version 5, `verify_jwt=true`

The additive account-device extension was deployed with Package 1 on
2026-07-29. Package 4 itself is client-only and requires no additional Supabase
migration or Edge Function deployment.

The live rollback test confirmed:

- two device rows remain saved for one member;
- claiming the same physical subscription from another account moves it instead
  of duplicating it;
- duplicate history writes for one member event produce one row;
- no test data remained after the transaction rollback.

## Verification

- TypeScript: pass
- All five Edge Function Deno checks: pass
- Notification/admin regression tests: 11/11 pass
- ESLint: zero errors and zero warnings
- Live reminder diagnostic: OneSignal configured; no secret value or key
  metadata is returned
- Android production export: pass
- iOS production export: pass
- Deployed reminder diagnostic: OneSignal configured
- Supabase security/performance advisors: no new findings

## Physical Two-Device Test

1. Sign the same member account into Device A and Device B.
2. Open the app on both devices and wait for Schedules to load.
3. Confirm production contains two different subscription IDs for that member.
4. Trigger one fill-in request. Each device should receive it exactly once, and
   the bell should show one history item.
5. Accept the request from a different member. Both requester devices should
   receive one accepted notice.
6. Add songs and notify that member. Both devices should receive one push.
7. Create a due service reminder test. Both devices should receive one push, with
   no repeat on the next cron runs.
8. Sign out on Device A and repeat a notification. Only Device B should receive
   it.
9. Sign Device A into another member account and confirm it receives only the new
   account's notifications.
