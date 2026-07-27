# Password Recovery and Autofill

## Implementation

Password recovery now uses one dedicated route and one shared callback parser.
The app accepts all recovery formats that may still exist in previously sent
emails:

- Implicit-flow access and refresh tokens.
- Recovery token hashes.
- PKCE authorization codes that Supabase identifies as password recovery.

Cold-start links are routed by `app/index.tsx`. Links received while the app is
open are routed by `app/_layout.tsx`. Both paths open
`app/reset-password.tsx`, which is now the only screen allowed to update a
forgotten password.

The reset form is enabled only after a recovery callback establishes a verified
session. An unrelated existing session or a non-recovery PKCE code cannot enable
the form. Leaving the screen clears a recovery session, including one that
finishes after the user has already left.

## Password Managers

`components/auth/AuthTextInput.tsx` applies consistent native credential hints:

- Login email fields: username.
- Login password fields: current password.
- Signup email fields: new username.
- Signup and reset fields: new password.
- Forgot-password email: email address.

The fields retain paste, secure entry, focus progression, submit-key behavior,
and Android autofill participation. This supports the normal in-app behavior of
Apple Passwords, Google Password Manager, 1Password, and other providers.

Website/app credential sharing is not configured because a verified website
domain has not been identified. Normal in-app password-manager support does not
depend on that optional association.

## Supabase Configuration

The hosted Supabase Auth redirect allowlist must continue to include:

```text
musicministry://reset-password
```

The mobile client remains on the implicit flow so recovery links produced by
released versions remain compatible. The new callback parser also handles
token-hash and valid PKCE recovery links without changing the existing flow.

No database migration or Edge Function deployment is required.

## Verification

Automated checks:

- TypeScript passes.
- ESLint passes.
- Password-recovery tests cover implicit, token-hash, PKCE, expired, incomplete,
  unrelated, and wrong-purpose links.
- Existing admin and notification regression tests pass.
- Android and iOS production exports pass.

Physical-device release checks:

1. Request a reset email from a cold Android app and complete the reset.
2. Repeat from a warm Android app.
3. Repeat both states on iOS.
4. Confirm expired and reused links show Request New Reset Link.
5. Confirm Back to Login never leaves the recovery account signed in.
6. Save a generated password during admin and member signup.
7. Fill saved credentials during both admin and member login.
8. Fill and replace a saved password during reset using Apple Passwords, Google
   Password Manager, and one third-party manager where available.
