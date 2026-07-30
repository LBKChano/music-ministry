# Package 3: Safe Onboarding

## Scope

Package 3 replaces role-specific entry choices with account-level Sign In,
Join a Church, and Create a Church paths. Legacy onboarding mode aliases remain
valid so stale links and older navigation targets still open the intended form.

New clients complete church setup through the additive Package 1 RPCs:

- `create_church_with_owner_membership`
- `join_church_by_invitation`

The released clients' direct create and self-join database policies are not
removed or tightened.

## Email Verification

When Supabase requires email confirmation, the client saves a versioned pending
create or join intent in local storage and stops before any church data is
written. The intent contains the account email, display name, requested church
action, and idempotency metadata. It never contains the password.

The `musicministry://verify-email` callback establishes the verified Supabase
session, resumes the pending RPC once, persists the selected church for that
account, and hands navigation back to the Package 2 startup coordinator.
Verification, password recovery, and normal startup remain separate routes.

The hosted Supabase Auth redirect allowlist must include:

```text
musicministry://verify-email
musicministry://reset-password
```

## Existing Accounts

Supabase may obscure whether an email already exists. The client handles both
the explicit existing-user error and the empty-identities response by returning
to Sign In. After successful authentication, the saved action resumes only when
the authenticated email exactly matches the pending intent.

## Form Behavior

- Name, email, password, invitation code, and church name are validated before
  submission when applicable.
- Labels remain visible while typing and field errors are announced inline.
- Native password-manager metadata is supplied for current and new credentials.
- One in-flight submission guard prevents duplicate Auth and RPC requests.
- Failed resumed actions reopen the correct Join or Create form with safe values
  restored.

## Deployment

Package 3 has no database migration and no Edge Function deployment. It depends
only on the already-deployed Package 1 RPCs and policies. Publishing Package 3
requires a new Android and iOS app build.

As verified on 2026-07-29, the live project has email auto-confirm enabled.
New accounts therefore receive a session immediately and do not enter the
verification screen. The same client remains ready for confirmation-required
signup if that hosted Auth setting is enabled later.

Before release:

1. Confirm both redirect URLs remain in Supabase Auth URL Configuration.
2. Create a new account with email confirmation enabled and complete Create.
3. Create another account and complete Join by invitation.
4. Start Create or Join with an existing email, sign in, and confirm it resumes.
5. Repeat verification from a cold and warm app on Android and iOS.
6. Confirm the currently released builds can still create and join churches.

Automated verification for this checkpoint includes TypeScript, focused
ESLint, 95 behavior/compatibility tests, and Android, iOS, and web production
Metro exports.
