# Package 11: Church-Scoped Identity and Roles

## What Shipped

- A focused Profile editor for the current church membership.
- Exact Owner, Admin, or Member access plus assigned ministry roles.
- The Supabase Auth email shown as global and read-only.
- A church-scoped display name that can differ between memberships.
- The existing multi-church switcher and admin member editors remain unchanged.

## Database Contract

Migration `20260730041938_update_own_church_profile.sql` adds:

- `public.update_own_church_profile(uuid, text)`, a `SECURITY INVOKER` API.
- `private.update_own_church_profile_impl(uuid, text)`, a fixed-search-path
  `SECURITY DEFINER` implementation.

The implementation derives the account from `auth.uid()`, locks only that
account's membership in the requested church, validates the name, and updates
only `church_members.name`. Anonymous and public execution are revoked.

No tables, columns, policies, triggers, roles, or existing RPC signatures were
changed. Released Android and iOS clients continue using their existing paths.

## Client Consistency

- Optimistic updates are keyed by account, church, and membership ID.
- Failure rollback runs only while the optimistic name is still current.
- A newer Realtime value is not replaced by stale rollback.
- An editor draft initializes only when membership identity changes, so
  background refreshes do not replace text being typed.

## Verification

- Isolated PostgreSQL migration behavior and grants passed.
- Live migration version `20260730041938` is deployed.
- Live catalog checks confirmed fixed search paths and authenticated-only
  execution.
- A live update smoke test ran inside a rolled-back transaction and verified
  protected membership fields remained unchanged.
- TypeScript, full ESLint, all 198 automated tests, and Android/iOS production
  Metro exports passed.

Physical release checks remain:

1. Edit the same account as admin in church A and member in church B.
2. Confirm each church keeps its own name, access level, and roles.
3. Edit from one device while viewing Profile on another device.
4. Exercise church switching, offline failure, Larger Text, VoiceOver, and
   TalkBack on released and new builds.
