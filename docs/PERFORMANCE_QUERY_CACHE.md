# React Query Cache

Performance package 2 standardizes reusable Supabase data with TanStack React
Query while preserving the app's existing context and hook interfaces.

## Cache Ownership

Every server-data key starts with `music-ministry` and includes the authenticated
Supabase account ID. Church-scoped records also include the selected church ID.
Schedule keys include a range key; the current implementation uses `all`, and
package 3 can add bounded date ranges without changing existing callers.

Cached data includes:

- services, assignments, and service comments
- member notification history
- church members and member roles
- church roles and recurring services
- the authenticated church-member record
- notification settings
- fill-in requests
- member unavailability

## Isolation Rules

- A Supabase account change cancels active queries and clears all cached
  server data before the new account renders.
- A church change cancels and removes the previous church's cached data.
- Disabled queries use placeholder key values but never execute without a valid
  account and church.
- Async church responses verify that the account and church are still current
  before updating context state.

## Refresh Rules

- Fresh cached data is reused during tab navigation.
- Manual refreshes, successful writes, and realtime events invalidate only the
  relevant account/church query.
- Schedule cache updates are immutable for service, assignment, and song/comment
  changes.
- Query retries are limited to two attempts. Mutations are not retried
  automatically, avoiding duplicate writes.

## Backward Compatibility

This package is client-only. It does not remove or rename database columns,
tables, RPC parameters, RLS policies, Edge Functions, or notification payload
fields. Older released builds therefore continue to use the same live Supabase
contracts.

## Verification

Completed:

- application TypeScript check
- full ESLint check with zero errors
- Deno checks for all Supabase Edge Functions
- Android production Expo export
- iOS production Expo export
- whitespace and patch validation

The repository still has one unrelated ESLint warning in
`supabase/functions/delete-account/index.ts` for the `Array<T>` style.

Before release, repeat `docs/PERFORMANCE_BASELINE.md` on physical Android and iOS
devices, including an account switch, a church switch, and a two-admin realtime
test.
