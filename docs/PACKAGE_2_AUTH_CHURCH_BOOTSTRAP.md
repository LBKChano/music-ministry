# Package 2 Auth and Church Bootstrap

Implemented: 2026-07-29

Package 2 makes startup, account changes, and church changes deterministic. It
is a client-only package: it adds no Supabase schema object, policy, RPC, Edge
Function, or secret.

## Startup States

The shared coordinator exposes:

- `restoring`
- `signed-out`
- `loading-memberships`
- `selecting-church`
- `ready`
- `no-membership`
- `error`

The root layout and index route consume the same destination decision. Password
recovery links remain higher priority than normal startup routing.

## Atomic Church Transition

`ChurchContext` now has one `switchChurch` transition:

1. Validate that the target belongs to the account's visible churches.
2. Increment a request generation and cancel stale account queries.
3. Load members, recurring services, roles, current membership, notification
   settings, and fill-in requests into a new snapshot.
4. Verify the authenticated membership still exists.
5. Commit the church and every church-scoped value together.
6. Ignore any result whose account or request generation is stale.
7. Persist the selected church under an account-specific AsyncStorage key.

If a manual switch fails, the previous complete church session remains active.
An account change clears all visible church state before the new account starts
loading.

## Recovery

- Auth restoration uses `getSession` and the Auth event stream without a blind
  timeout.
- Auth restoration failures remain recoverable and do not masquerade as a
  signed-out state.
- Accounts with no visible membership reach `/no-membership`, which provides
  Retry and Sign Out.
- Onboarding waits for a successful shared church transition before opening
  Schedules.

## Compatibility

- Released backend table, RPC, policy, and Edge Function contracts are
  unchanged.
- Existing onboarding, sign-in, direct create/join, and password-reset routes
  remain available.
- The Church tab uses Package 1's already-live atomic create RPC so every newly
  created church has an owner membership before selection. It retains one
  request ID across retries to prevent a lost response from creating a
  duplicate church.
- The released direct create/join paths remain available. Full onboarding
  adoption of the Package 1 create/join RPCs remains Package 3 work.
- The raw `setCurrentChurch` context field remains available for existing
  internal update helpers, while user-driven switching uses `switchChurch`.

## Verification

```bash
npm run verify:package2
```

Verified locally:

- TypeScript passes.
- Focused ESLint passes.
- All 79 behavior and compatibility tests pass.
- Android production Metro export passes.
- iOS production Metro export passes.

The temporary export directories were removed after verification. A new native
app build is required before users receive Package 2.
