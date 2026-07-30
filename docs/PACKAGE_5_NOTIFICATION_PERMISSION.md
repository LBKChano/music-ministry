# Package 5: Contextual Notification Permission

## Scope

Package 5 replaces the automatic Android and iOS Schedule permission prompts
with one shared contextual flow. It is a client-only package and does not add or
change any Supabase table, policy, RPC, trigger, Edge Function, payload, or
OneSignal delivery contract.

## First Schedule Flow

The explainer becomes eligible only after all of these conditions are true:

- the Schedule route has completed its initial church and service load;
- the church session is `ready`;
- the current membership belongs to the selected church;
- that exact membership has been linked to OneSignal;
- native permission initialization has finished;
- notifications are not already enabled or denied;
- the physical installation has no saved decision.

The Schedule is committed to the screen before the component effect presents
the explainer. The native operating-system prompt opens only after the user
presses Enable Notifications. Not Now closes the explainer without consuming an
OS prompt.

## Device-Local State

The versioned AsyncStorage key is:

```text
music-ministry.notification-permission-onboarding.v1
```

It stores only `enabled`, `not_now`, or `denied` plus an update timestamp. It
contains no account, email, church, membership, or OneSignal subscription ID.
This makes the choice local to one physical app installation:

- Not Now on Device A does not suppress Device B.
- Switching accounts or churches on Device A does not show the first-run
  explainer again.
- Reinstalling the app creates a new installation decision.

Invalid JSON, an unknown state, or another storage version fails closed to no
saved decision and can safely run the current flow.

## Native Permission State

The native context uses the installed OneSignal 5.5 SDK's asynchronous
`getPermissionAsync()` and `canRequestPermission()` APIs. A real denial is
persisted so Android does not consume another available native prompt on the
next app start. SDK or initialization errors remain retryable and are not saved
as denials.

The app refreshes permission when it returns to the foreground. Once the OS can
no longer show a prompt, the notification bell and preferences screen offer one
shared Open Settings action. Granting permission in Settings updates the
context and lets the existing device registration flow continue.

## Identity and Delivery Ordering

OneSignal linking now runs only when Auth and the Package 2 church session are
fully ready and the membership belongs to both the authenticated account and
selected church. Package 4 device registration additionally waits until that
same linked identity is current.

Permission changes may rerun the idempotent OneSignal link, but account-device
registration retains its account/member/subscription key and the deployed
recipient resolver still returns distinct physical subscriptions. No second
notification sender or registration table is introduced.

## Backward Compatibility

- Released builds keep their existing automatic prompt behavior.
- Existing `OneSignal.login`, legacy subscription claim, account-device RPC,
  and recipient resolver contracts remain available.
- No database migration or Edge Function deployment is required.
- Rolling back Package 5 means publishing the previous client; no live data
  reversal is necessary.

## Release Verification

TypeScript, ESLint, all 118 behavior/compatibility tests, and Android/iOS
production Metro exports pass. Automated tests cover decision parsing,
device-only persistence, the full presentation gate, Not Now and denial
suppression, Android/iOS Schedule parity, native can-request behavior, Open
Settings, exact identity linking, and the absence of a Package 5 migration.

Before publishing:

1. Fresh-install Android 13+ and confirm Schedule appears before the explainer.
2. Choose Not Now, restart, switch churches/accounts, and confirm no automatic
   prompt returns.
3. Clear app data, choose Enable Notifications, grant the native prompt, and
   confirm one test push arrives.
4. Clear app data, deny the native prompt, restart, and confirm the bell offers
   Open Settings instead of another prompt.
5. Grant permission in Settings and confirm the bell updates after returning.
6. Repeat grant, denial, Not Now, cold start, and Settings restoration on iOS.
7. Repeat on Device A and Device B for the same account; each enabled device
   receives one copy and one device's choice does not change the other.
8. Sign Device A into another account and confirm notifications never cross
   accounts.
9. Run the currently released Android and iOS builds against production to
   confirm their original prompt and push behavior remain unchanged.
