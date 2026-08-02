# Package 19: One-Time Fill-In Escalations

## Behavior

- Every new pending fill-in request is queued automatically for three hours
  after its existing `created_at` value. Released clients do not send new fields
  and need no app update.
- The first successful five-minute cron run after eligibility sends one reminder
  to enabled same-role members and church admins. The requester is excluded.
- The notification retains `type: fill_in_request`, `fillInRequestId`,
  `serviceId`, and `roleName`, so released notification navigation remains valid.
- The existing `fill_in_requests` preference controls both the initial request
  and this reminder. Every active subscription for the account is targeted once.

## Delivery Safety

- `private.fill_in_escalation_deliveries` isolates queue state from released app
  table and Realtime contracts.
- `claim_due_fill_in_escalations` uses `FOR UPDATE SKIP LOCKED` and a two-minute
  lease. Network or history-write failures release the row for retry.
- `recheck_fill_in_escalation` runs immediately before recipient resolution and
  rejects filled, cancelled, deleted, past, manually reassigned, or role-changed
  requests.
- `fill_in_request_reminder:<request-id>` is used for both OneSignal idempotency
  and the unique member notification event key. Replays cannot create a second
  device push or notification-center row.
- The public RPC wrappers are revoked from `PUBLIC`, `anon`, and
  `authenticated`; only `service_role` can execute them.
- The JWT-disabled cron endpoint requires
  `x-music-ministry-cron-secret`. Its generated value remains in Supabase Vault
  and is read by the cron SQL at run time.

## Live Rollout

- Queue migration recorded live as `20260802013910_add_fill_in_escalation_queue`.
- Edge Function `send-fill-in-escalations` deployed as active version 2 with
  `verify_jwt = false` and custom Vault authentication.
- Cron migration recorded live as
  `20260802014444_schedule_fill_in_escalations`.
- Cron job `send-fill-in-escalations-every-five-minutes` is active on
  `*/5 * * * *`.
- The first scheduled run succeeded and its Edge Function response was HTTP 200.

Do not use `supabase db push` to reconcile this project's historical migration
drift. Apply future migrations through the same reviewed migration workflow.

## Verification

- Deno checks cover all Edge Functions.
- Package 19 behavior and contract tests cover normalized role selection,
  requester exclusion, admin inclusion, legacy roles, custom endpoint auth,
  deterministic event keys, and released-client compatibility.
- `supabase/tests/fill_in_escalation_queue.sql` passes against the live schema in
  a rollback transaction for 2h59/3h timing, overlapping claims, failure retry,
  final relevance checks, terminal skip states, and successful replay.
- Supabase advisors report no Package 19 findings. Existing project-wide advisor
  notices remain outside this package.

## Rollback

Unschedule `send-fill-in-escalations-every-five-minutes` first. The Edge Function,
private queue, trigger, and service-only RPCs can remain unused without affecting
released builds. Do not remove the trigger or queue while cron may still run.

## Remaining Release Gate

Use a temporary future service and a controlled pending request on physical iOS
and Android devices. Confirm one reminder per registered device after three
hours, no Android duplicate, correct notification navigation, and no reminder
after acceptance or cancellation. Remove the fixture afterward.
