# Compatibility Baseline

Captured: 2026-07-29

This document is the Package 0 safety harness for roadmap items 12-23. It
records the source contracts that released clients currently depend on and
defines the smoke test to run before and after every additive Supabase
migration.

Package 0 does not deploy schema changes and must not intentionally change app
behavior.

## Recorded Source Build

| Platform | Source value |
| --- | --- |
| App version | `1.1.1` |
| Android package | `com.lbkchano.musicministry` |
| Android source version code | `12` |
| Android target SDK | `36` |
| iOS bundle identifier | `com.lbkchano.musicministry` |
| iOS source build number | `3` |
| Deep-link scheme | `musicministry` |
| Baseline Git commit | `df37048` |
| Supabase project | `cvgdxmmtrukahyvkgazj` |

EAS uses remote app-version sourcing and production auto-increment. Therefore,
the values above describe the source tree and do not prove which build is
currently installed from TestFlight, App Store, or Play Store.

The recorded app version remains the released-client compatibility floor. New
source releases may increase the semantic version, but the automated contract
test rejects any regression below `1.1.1` and continues to protect all released
identifiers, build-source values, routes, RPCs, tables, and notification events.

Before Package 1 is deployed, record these external values here:

| Distribution | Confirmed version/build | Confirmed date | Tester |
| --- | --- | --- | --- |
| App Store production | Pending external confirmation | - | - |
| TestFlight build used for compatibility | Pending external confirmation | - | - |
| Play Store production | Pending external confirmation | - | - |
| Android APK used for compatibility | Pending external confirmation | - | - |

## Live Supabase Audit

The production project was read-only audited on 2026-07-29:

- Supabase reported 130 applied migration-history entries.
- The latest applied migration was
  `index_member_scheduling_preference_role`.
- `public.onesignal_subscriptions` has a primary key on `id`, a unique
  constraint on `subscription_id`, and a cascading foreign key from
  `member_id` to `church_members.id`.
- There is no unique constraint on `member_id`. One member may therefore own
  multiple physical device subscriptions, while one physical subscription
  cannot be duplicated.

The generated relationship metadata was refreshed to mark the
`onesignal_subscriptions.member_id` relationship as one-to-many. This is a type
correction only; the live database was not changed.

## Machine-Readable Contract

`docs/compatibility-baseline.json` protects:

- Mobile identifiers, source versions, URL scheme, and Android target SDK.
- Auth persistence, flow, storage key, signed-out route, and password-reset
  route.
- Public route entry points, including onboarding and password recovery.
- Client-visible Supabase tables represented in generated TypeScript types.
- Existing public RPC names and generated RPC types.
- Edge Function entry points and `verify_jwt` settings.
- Existing notification event names.

Run:

```bash
pnpm test:compatibility
```

An intentional contract change must update the manifest and explain how
released builds remain compatible. Never update the manifest only to silence a
failing test.

## Synthetic Fixtures

`tests/fixtures/compatibility-scenarios.json` contains only reserved
`example.test` identities. It models:

- A church owner.
- A scheduling admin.
- A regular member.
- One account that is a member in church A and an admin in church B.
- An invited membership without an Auth user.
- Assigned roles and one recurring service.
- One hard unavailable date.
- One soft weekly-service/role preference.
- Two physical OneSignal subscriptions for the same member.

These fixtures are safe for local automated tests. Do not insert them into the
production project. Live smoke testing must use a dedicated test church and
test accounts, never a real member's account.

## Automated Baseline

Run the complete Package 0 verification:

```bash
pnpm verify:package0
```

This covers TypeScript plus the full behavior/contract suite, including
account-scoped cache isolation, password recovery, church access, admin
operations, multi-device notification targeting, scheduling preferences, and
the compatibility fixtures.

It must execute TypeScript plus every JavaScript regression test. Supabase SQL
and Edge Function checks remain separate because they require Deno and a linked
or local Supabase environment:

```bash
pnpm typecheck:functions
supabase test db
```

If the local project does not support `supabase test db`, run each SQL behavior
test inside an explicit transaction that ends with `rollback`.

## Released-Build Migration Smoke Test

Run this sequence on the currently released Android and iOS builds before a
migration, immediately after deployment, and again after the new client is
published.

### Authentication and Routing

- Cold-launch while signed out and confirm Onboarding appears.
- Sign in with an existing owner, scheduling-admin, and regular-member account.
- Force-close and reopen; confirm the same account and church return.
- Open a valid password-reset link and confirm the reset route is interactive.
- Sign out and confirm Onboarding appears without a permanent loading screen.
- Sign in with a different account on the same device and confirm no previous
  church/member data appears.

### Church Discovery and Permissions

- Owner sees the owned church and Church tab.
- Scheduling admin sees the Church tab only in the church where `is_admin` is
  true.
- Regular member does not see the Church tab.
- The current church remains selected after refresh when access still exists.
- Removing access causes a safe fallback or recoverable state, never stale
  permissions.

### Scheduling and Church Operations

- Load Schedules and verify services, assignments, names, songs, and fill-ins.
- Manually assign and clear one member, then reload on a second device.
- Create, edit, and delete a test service.
- Preview auto-assignment without applying, then apply only in the test church.
- Create and accept one fill-in request.
- Add, edit, reorder, and delete test songs.
- Edit a test church setting and verify another released device receives the
  Realtime update.

### Availability and Preferences

- Save an unavailable date and verify it reloads exactly as the same local date.
- Toggle one weekly-service/role preference and verify rollback/retry behavior
  if the network is interrupted.
- Confirm auto-assignment still treats unavailable dates as hard blocks and
  preferences as soft avoidance.

### Notifications

- Confirm the device has exactly one current OneSignal subscription ID.
- With the same member signed in on two devices, send one eligible event and
  verify each device receives one notification.
- Send a service reminder, fill-in request, fill-in acceptance, and service
  comment notification.
- Verify notification history contains one member/event row rather than one row
  per physical device.
- Sign out one device and verify that device stops receiving notifications while
  the other device continues.

### Account Deletion

- Use only a disposable test account.
- Delete a member-only account and confirm Auth, membership, notification
  subscriptions, and local caches are cleared.
- Do not test owner deletion against a shared or production church.

## Migration Gate Record

Copy this table for each live migration:

| Gate | Result |
| --- | --- |
| Migration filename | |
| Local SQL/RLS tests | |
| Database advisors reviewed | |
| Edge Functions checked | |
| Released Android before deployment | |
| Released iOS before deployment | |
| Migration deployed | |
| Released Android after deployment | |
| Released iOS after deployment | |
| Rollback/capability fallback confirmed | |

Do not begin the client package that consumes a migration until every applicable
row is complete.
