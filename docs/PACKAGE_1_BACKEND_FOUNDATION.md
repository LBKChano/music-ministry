# Package 1 Backend Foundation

Prepared: 2026-07-29
Deployed: 2026-07-29

Package 1 is an additive backend package for multi-church account membership
and account-scoped notification devices. It does not change app screens or
switch released clients to the new RPCs.

## Production Preflight

The live project was queried using aggregate-only checks:

| Check | Result |
| --- | ---: |
| Churches | 7 |
| Memberships | 30 |
| Linked memberships | 30 |
| Unclaimed memberships | 0 |
| Duplicate non-null `(church_id, member_id)` groups | 0 |
| Missing owner memberships | 0 |
| Owner memberships without `is_admin` | 0 |
| OneSignal subscription rows | 26 |
| Distinct OneSignal subscription IDs | 26 |

No production row was inserted, updated, or deleted during the preflight.

## Additive Contract

Migration:

`supabase/migrations/20260729182446_add_multi_church_account_device_foundation.sql`

It adds:

- A partial unique index enforcing one linked membership per account/church
  while keeping `member_id = null` invitations valid.
- Safe owner-membership backfill and owner-membership protection.
- Idempotent `create_church_with_owner_membership`.
- Idempotent `join_church_by_invitation`, including invited-row claim.
- `account_notification_devices`, with RLS and account-scoped reads.
- Account-device register/deactivate RPCs.
- A service-role-only notification recipient resolver.
- Triggers that mirror legacy OneSignal claims/deletes into device state.
- A membership-removal bridge that keeps the account device active when the
  same account still belongs to another church.
- Account-aware recipient resolution in every notification-sending Edge
  Function, while retaining their existing URLs, request bodies, event keys,
  and OneSignal fallback behavior.
- Account-device cleanup in the existing `delete-account` Edge Function.

The migration does not drop or rename a released table, column, public RPC,
policy, Edge Function, or legacy OneSignal path.

## Safety Behavior

- Duplicate linked memberships, ambiguous owner invitations, owner rows without
  Auth email, and owner-email conflicts stop the migration with a clear error.
  The migration never chooses a duplicate row to delete.
- Create requests use `(account_id, request_id)` idempotency.
- Join retries return the existing membership and cannot accept an `is_admin`
  input from the caller.
- New privileged implementations derive identity from
  `(select auth.uid())`, use a fixed search path, and expose only narrow public
  wrappers.
- Recipient resolution is unavailable to `anon` and `authenticated`; only
  `service_role` can execute it.
- Released clients may keep claiming and deleting legacy subscription rows.
  The bridge synchronizes those actions into account-device state, while the
  existing notification Function URLs resolve recipients account-wide.

## Verification

Local checks:

```bash
npm run verify:package1
```

TypeScript, Deno, ESLint, all 64 behavior/contract tests, and Android/iOS
production Metro exports passed.

The SQL behavior suite is:

`supabase/tests/multi_church_account_device_foundation.sql`

It runs inside a transaction and ends with `rollback`. It covers:

- Atomic and idempotent church creation.
- Owner membership and owner protection.
- Invited-row claim and idempotent join.
- Duplicate membership rejection.
- Cross-account membership RLS.
- Service-only recipient resolution.
- One device resolving to two memberships for the same account.
- Legacy claim, membership removal, delete, and reclaim bridges.
- Invalid invitation rejection.

Supabase branching was considered for isolated verification, but the linked
project is on the Free plan and branch creation was rejected before any branch
or hourly cost existed.

The complete migration and SQL behavior suite first passed against the linked
project inside one explicit transaction ending in `rollback`. Earlier rollback
runs caught and helped correct an extension-schema qualification issue, a test
grant, and the membership-removal/device lifecycle bridge.

## Live Deployment

The user explicitly approved deployment after the rollback-safe verification.
The migration API applied the change and recorded live version
`20260730005120`.

Deployed Edge Function versions:

- `send-service-reminders`: version 49, `verify_jwt = false`
- `send-fill-in-notifications`: version 40, `verify_jwt = true`
- `send-service-comment-notifications`: version 6, `verify_jwt = true`
- `send-fill-in-accepted-notification`: version 6, `verify_jwt = true`
- `delete-account`: version 2, `verify_jwt = true`

Post-deployment checks confirmed:

- The account-device table, private marker queue, partial membership index, and
  Package 1 RPCs exist.
- RLS is enabled and RPC grants match the intended authenticated/service-role
  boundaries.
- All 26 active legacy subscription rows resolve, with no missing subscription
  and no duplicate recipient pair.
- The service-reminder cron invoked version 49 successfully with HTTP 200.
- The reminder diagnostic reports OneSignal configured.
- Supabase advisors reported no new Package 1 security issue.

Do not use `supabase db push`: the live project contains historical migration
versions that are not present in this repository. Do not repair or mark those
production migrations reverted.

The remaining external verification is the Package 0 smoke test on the
currently released physical Android and iOS builds.

## Rollback

The owner backfill and linked-membership uniqueness protection should remain;
reversing them would permit invalid data.

Before any new client consumes Package 1, the new RPCs and triggers can be
disabled without changing released clients. Do not drop the device table after
new clients begin registering devices. A later retirement migration must first
confirm that no supported client or Edge Function uses the new contracts.
