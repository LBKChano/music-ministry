# Package 4: Multi-Church Client and Multi-Device Push

## Scope

Package 4 connects the Package 2 church-session coordinator to the additive
Package 1 account/device foundation. It adds no table, policy, RPC, trigger, or
Edge Function and does not tighten any released-client contract.

## Church Discovery and Access

Church discovery reads owned churches and every `church_members` row whose
`member_id` matches the authenticated account. The client derives access
independently for each church:

- the church owner is an Admin;
- a matching membership with `is_admin = true` is an Admin;
- every other matching membership is a Member.

The selected church is persisted per account. Manual switching uses the same
generation-guarded `transitionChurchSession` action as startup and onboarding.
While its complete church snapshot is loading, an opaque transition state
blocks interaction with the previous church. Admin navigation is registered
only after the new church session reaches `ready` with exact Admin access.

The shared `ChurchSwitcher` appears in both native Profile implementations. It
lists each accessible church, shows the current church and per-church role, and
opens the existing safe Join a Church flow.

## Device Registration

Once Auth, the selected church membership, and the OneSignal subscription are
all ready, the client performs two ordered writes:

1. `register_account_notification_device` associates the physical subscription
   with the authenticated account.
2. `claim_onesignal_subscription` retains the released member-scoped record for
   compatibility.

The registration result must match both the authenticated account and the
current physical subscription. Operations for one subscription ID are
serialized. On sign-out or account deletion, the client first calls
`deactivate_account_notification_device`, then removes only the exact legacy
membership/subscription row, and only then clears OneSignal tags and identity.
Other devices signed into the same account remain active.

OneSignal still logs in with the current membership ID. That preserves fallback
delivery for released senders and older clients. The deployed recipient
resolver merges active account devices with legacy rows not already represented
by the account registry and returns distinct subscription IDs.

## Backward Compatibility

- Existing `church_members` ownership and role fields are unchanged.
- Existing create/join routes and database policies remain available.
- Existing `claim_onesignal_subscription(uuid, text)` behavior is unchanged.
- Legacy subscription insert, update, and delete triggers continue mirroring
  released-client activity into the account-device registry.
- Existing Edge Function URLs, JWT settings, notification payloads, and
  OneSignal external-ID fallback remain unchanged.
- Package 4 requires a new app build but no Supabase deployment.

## Live Contract Check

Verified on 2026-07-29 against project `cvgdxmmtrukahyvkgazj`:

- `account_notification_devices` exists with RLS enabled;
- register and deactivate RPCs are authenticated-only;
- the recipient resolver is service-role-only;
- both legacy bridge triggers are installed;
- all three public RPC wrappers use an empty fixed search path;
- 26 device rows are active with zero blank or duplicate subscription IDs;
- the live resolver returns 26 unique member/device pairs with no blank or
  missing active account-device pair;
- Supabase advisors report no Package 4-specific security or performance issue.

Existing advisor findings outside this package were not changed.

## Release Verification

TypeScript, ESLint, all 107 behavior/compatibility tests, and Android/iOS
production Metro exports pass. Automated verification covers per-church role
derivation, stale Admin-tab blocking, shared Android/iOS switcher parity,
account-first registration, legacy bridging, operation serialization, and
current-device-only sign-out.

Before publishing:

1. Sign one account into church A as Admin and church B as Member.
2. Switch in both directions and confirm Church admin tools appear only in A.
3. Confirm no schedule, member, notification, or cached church data flashes
   from the previous church.
4. Sign the account into Device A and Device B and open Schedules on both.
5. Trigger each notification type and confirm each device receives one copy.
6. Sign out on Device A and confirm a new notification reaches only Device B.
7. Sign Device A into another account and confirm it receives only that
   account's notifications.
8. Repeat create, join, notification, and sign-out smoke tests on the currently
   released Android and iOS builds before publishing the new build.
