# Realtime Cache Updates

## Scope

Performance package 5 replaces broad Realtime refetches with typed, idempotent
React Query cache updates. The shared transforms live in
`lib/realtime/cache-updates.ts`.

The package covers:

- services;
- assignments;
- service songs/comments;
- fill-in requests;
- member names used by songs and fill-ins; and
- member notification history.

The user-initiated pull-to-refresh action remains available as an explicit full
refresh. Routine Realtime events and individual mutations no longer use it.

## Schedule Updates

### Services

INSERT and UPDATE payloads merge the base service row into every matching cached
date window. Existing assignments and songs are preserved because those
relationships are not included in the service-table payload.

If a service date changes, the service is removed from its old cached range and
inserted into the matching range. Services remain sorted by date and time.
Payloads older than the newest cached `updated_at` value are ignored.

DELETE payloads remove the service ID from every loaded range without querying
Supabase.

Creating a single service now inserts the returned row directly into an already
loaded matching range. Creating from a template also returns and merges the new
assignment slots. A newly created service outside the loaded range still causes
only its new date window to load.

### Assignments

Assignment payloads search loaded services by assignment ID and service ID:

- INSERT adds the assignment only to its service.
- UPDATE replaces the assignment and removes it from an old service if its
  relationship changed.
- DELETE removes the assignment ID wherever it is cached.

Duplicate payloads produce no new rows. Assignment rows do not currently have an
`updated_at` column, so local update and delete operations register a short-lived
expected result before writing. A delayed echo from an earlier local
reassignment is ignored until the expected database event arrives. The guard is
automatically removed after 15 seconds.

Accepting a fill-in performs the existing atomic Supabase RPC, then reads only
the affected assignment row and merges it into the schedule cache. Both Android
and iOS no longer refetch every active schedule window after acceptance.

### Songs And Comments

Song/comment payloads update only the matching service:

- rows are deduplicated by comment ID;
- stale `updated_at` values are ignored;
- songs remain sorted by creation time; and
- deletes remove only the matching song.

Postgres Changes payloads do not contain the joined church-member name. The app
first uses the cached member row. If it is unavailable, it queries only that one
member and enriches the existing cached comment without reloading a schedule
window.

Changing a member's name also updates that member's already cached songs
directly.

## Fill-In Updates

Fill-in payloads update both the Church context state and its React Query cache
by request ID. They remain sorted newest first.

Requester and filler names come from the cached church-member list. If either
relationship is missing, the app requests only those member IDs and reapplies
the same payload. Member-name changes update existing fill-in labels directly.

Local create, cancel, and accept actions apply their returned fill-in row
immediately. They no longer rerun
`get_fill_in_requests_with_member_info` after every action.

## Notification Updates

The notification channel applies INSERT, UPDATE, and DELETE payloads directly to
the signed-in member's 50-row cache:

- duplicate notification IDs are replaced rather than appended;
- history remains sorted newest first;
- a delayed INSERT cannot make a locally read notification unread again; and
- deletes remove only IDs already present for the current member.

## Delete Handling

Supabase Postgres Changes does not support filtered DELETE events. The channel
therefore uses unfiltered DELETE listeners for services, songs/comments,
fill-ins, and notifications.

With RLS-enabled tables, the DELETE payload exposes only primary-key
information. Each handler compares that ID with the current account/church cache
and ignores unknown IDs. It never adds data or selects another church because of
an unfiltered DELETE event.

## Backward Compatibility

Package 5 changes only the new client cache behavior. It does not change:

- tables or columns;
- RLS policies;
- RPC signatures;
- Edge Function request or response contracts; or
- notification payload contracts.

Released app versions continue to use the same backend. No Step 5 Supabase
migration or deployment is required.

On July 26, 2026, production project `cvgdxmmtrukahyvkgazj` was checked
read-only and confirmed that `services`, `assignments`, `service_comments`,
`fill_in_requests`, and `member_notifications` are all members of the
`supabase_realtime` publication.

## Verification

Completed locally on July 26, 2026:

- `tsc --noEmit`
- full ESLint: zero errors and one unrelated existing array-style warning in
  `supabase/functions/delete-account/index.ts`
- Deno checks for all five Edge Functions
- Android production Expo export
- iOS production Expo export
- source audit confirming routine service, assignment, comment, and fill-in
  events no longer invalidate complete schedule windows

Still required on physical devices:

1. Create, edit, move, and delete a service on one admin device.
2. Manually reassign the same slot twice quickly and confirm the second choice
   remains visible on both devices.
3. Add, edit, and delete several songs and confirm no duplicates appear.
4. Create, cancel, and accept fill-in requests and confirm the request and
   assignment update on both devices.
5. Rename a member and confirm song authors and fill-in names update.
6. Receive and read a notification on one device and confirm duplicate events do
   not create duplicate history rows.
