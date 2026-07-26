# Realtime Subscription Lifecycle

## Scope

Performance package 4 gives every signed-in app instance two explicit Realtime
owners:

1. `ChurchProvider` owns one consolidated channel for the current account and
   church.
2. `NotificationBell` owns one channel for the current account and church-member
   record.

The Schedules and Church screens share the provider-owned stream. Mounting both
screens no longer creates duplicate schedule subscriptions.

## Stable Ownership

Channel names include the data ownership boundary:

- `church:{accountId}:{churchId}`
- `member-notifications:{accountId}:{memberId}`

`lib/realtime/channels.ts` tracks each locally active name. If a duplicate owner
is registered, the exact previous channel instance is removed before the
replacement is retained. Cleanup also checks the exact instance, so a delayed
cleanup from an old render cannot unregister a newer channel with the same name.

React effect cleanup removes channels during:

- sign-out;
- account changes;
- church changes;
- member identity changes; and
- provider or notification-bell unmount.

The React Query account and church cache cleanup added in package 2 remains a
second isolation boundary. Events queued by an old channel cannot write into the
new account or church cache.

## Consolidated Church Stream

The church channel listens for changes to:

- churches;
- services;
- assignments;
- service comments;
- church members;
- member roles;
- church roles;
- fill-in requests;
- recurring services;
- recurring-service roles; and
- notification settings.

Tables with a direct `church_id` or current church row use a server-side Realtime
filter. Relationship tables without a direct church ID use the current church's
cached service, member, or recurring-service relationships before scheduling a
refresh.

Supabase DELETE payloads may contain only primary-key information and Postgres
Changes DELETE events cannot always use the same relationship filtering as
INSERT and UPDATE events. Relationship events with insufficient old-row data are
therefore allowed to trigger a focused current-church refresh. This can produce
an occasional extra request, but it avoids retaining stale current-church data
and never changes the rows authorized by RLS.

## Event Coalescing

Related events are collected for 100 ms and then refreshed together. For
example, a service write followed by assignment writes produces one schedule
invalidation batch instead of one complete refetch per database event.

The batch targets only affected query groups:

- services and their assignments/comments;
- members and the current member;
- roles;
- recurring services;
- fill-in requests;
- notification settings; or
- the current church row.

Notification records are handled separately. The bell applies each payload
directly to its 50-item React Query cache, so it does not download notification
history after every event.

## Supabase Publication

Two additive migrations ensure every required table is available to Realtime:

- `20260726204808_enable_recurring_service_roles_realtime.sql`
- `20260726204950_enable_churches_realtime.sql`

Both migrations were applied to project `cvgdxmmtrukahyvkgazj` and verified in
`pg_publication_tables` on July 26, 2026.

These migrations only add existing RLS-protected tables to the
`supabase_realtime` publication. They do not alter tables, columns, policies,
function signatures, or Edge Function contracts. Released app versions that do
not subscribe to these streams continue to work unchanged.

## Verification

Completed locally on July 26, 2026:

- `tsc --noEmit`
- full ESLint: zero errors and one unrelated existing array-style warning in
  `supabase/functions/delete-account/index.ts`
- Deno checks for all five Edge Functions
- Android production Expo export
- iOS production Expo export
- source audit confirming no component-owned schedule channel remains

Still required on physical devices before release:

1. Open Schedules and Church repeatedly and confirm one church channel remains.
2. Switch churches and confirm the old church channel closes before updates to
   the new church are processed.
3. Sign out and into another account and confirm the old church and notification
   channels close.
4. Make service, assignment, comment, member-role, recurring-service, fill-in,
   and settings changes from a second device and confirm the first device updates.
5. Confirm a notification history event appears only for the signed-in member.
