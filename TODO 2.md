# TODO

## App Performance Roadmap

Work through these packages in order. Keep behavior unchanged unless a package
explicitly says otherwise. Run TypeScript checks after every package and test both
the default and iOS schedule implementations.

### Current Progress

- TanStack React Query is installed and its provider is configured in `app/_layout.tsx`.
- `NotificationBell.tsx` has been migrated to a cached notification query.
- The bell updates its cached list from realtime payloads instead of downloading
  the latest 50 notifications after every event.
- Performance package 1 instrumentation is implemented for Schedules, Church,
  and Profile on Android and iOS. It records sanitized Supabase request counts,
  load-ready time, and screen render counts only in explicitly enabled
  development runs.
- The repeatable protocol and privacy-safe reference dataset are documented in
  `docs/PERFORMANCE_BASELINE.md`. Physical Android, iOS, and two-device reports
  still need to be captured before package 1 is marked complete.
- Performance package 2 is implemented in the client. Services, assignments,
  service comments, notifications, members, roles, recurring services,
  notification settings, fill-in requests, and member unavailability now use
  account-and-church-scoped React Query caches.
- Schedule create/update/delete actions run as React Query mutations. Relevant
  cached schedule or church data is updated or invalidated after writes and
  realtime events.
- Auth account changes clear the entire server-data cache. Church changes cancel
  and remove the previous church cache before loading the next church.
- Package 2 changes no Supabase schema, RLS policy, RPC signature, table shape, or
  Edge Function contract, so released app versions remain backend-compatible.
- Package 2 implementation and verification notes are documented in
  `docs/PERFORMANCE_QUERY_CACHE.md`. Physical multi-device verification remains
  part of the repeatable baseline run.
- Performance package 3 is implemented. Schedules and the Church admin view now
  load services in independent 90-day windows instead of downloading the entire
  service history.
- Members can load the next 90 days from either schedule implementation. Failed
  windows retry in place, and newly created services automatically extend the
  loaded windows when their date is outside the current range.
- Auto-assignment still runs in Supabase with its selected target range and reads
  its own past-quarter fairness history, so limiting display data does not change
  assignment distribution.
- A read-only production aggregate on July 26, 2026 found 62 services in the
  initial window versus 224 services in full history. Package 3 details are in
  `docs/PERFORMANCE_SCHEDULE_WINDOWS.md`.
- Performance package 4 is implemented. The app now owns one consolidated
  account-and-church-scoped Realtime channel in `ChurchProvider` plus one
  account-and-member-scoped notification channel in `NotificationBell`.
- Schedule screens no longer create duplicate channels. Stable channel names,
  exact-instance cleanup, and account/church cache cleanup prevent old sessions
  or churches from continuing to process updates.
- Related Realtime events are coalesced into a 100 ms refresh batch. Direct
  church-owned tables use server-side filters, while relationship tables without
  a church ID are checked against the current church's cached records.
- The `churches` and `recurring_service_roles` tables were added to the live
  `supabase_realtime` publication through additive migrations. Existing app
  versions remain compatible because no schema, RLS, RPC, or API contract changed.
- Package 4 implementation and verification notes are documented in
  `docs/PERFORMANCE_REALTIME_LIFECYCLE.md`. Physical account-switch,
  church-switch, and two-device verification remains part of the release
  baseline.
- Performance package 5 is implemented. Service, assignment, song/comment,
  fill-in, member-name, and notification Realtime payloads now update their
  existing React Query caches by row ID instead of refetching complete schedule
  windows or the complete fill-in list.
- Service updates preserve nested assignments and songs, move between cached
  date windows when their date changes, and ignore older timestamped payloads.
  Assignment writes are deduplicated and guarded against delayed echoes from a
  previous local reassignment.
- Fill-in create, cancel, and accept actions update the local cache immediately.
  Accepting a fill-in reads only the changed assignment row and no longer reloads
  every visible schedule window.
- Supabase DELETE listeners remove only primary keys already present in the
  current account/church cache. Related member names are resolved from cached
  members or one focused member-row query.
- Package 5 details are documented in
  `docs/PERFORMANCE_REALTIME_CACHE_UPDATES.md`. Physical two-device mutation
  testing remains part of the release baseline.
- Performance package 6 is implemented. Android and iOS schedule screens now
  render service cards with bounded `FlatList` windows and preserve the visible
  scroll position when live data changes.
- The auto-assignment modal now virtualizes both the schedule preview and skipped
  report with stable assignment keys. Its range controls remain scrollable while
  Cancel and Confirm remain fixed and reachable below the list.
- Package 6 static checks, Deno checks, and Android/iOS production exports pass.
  Details and the remaining long-list physical-device checks are documented in
  `docs/PERFORMANCE_VIRTUALIZED_LISTS.md`.
- Performance package 7 is implemented. Both schedule implementations now use
  one memoized service-card boundary with stable action callbacks and pre-grouped
  fill-in requests, so modal input and unrelated screen state do not rerender
  every visible service.
- `ChurchContext` now memoizes its public value and refresh callbacks by stable
  account/church IDs. A smaller session context isolates the notification bell,
  root navigation, and tab navigation from member, role, schedule, and fill-in
  collection updates while preserving the original `useChurch()` API.
- Android keeps its stacked assignment actions and iOS keeps its compact inline
  rows. Package 7 TypeScript, lint, Deno, and Android/iOS production exports pass.
  Details are in `docs/PERFORMANCE_RERENDER_ISOLATION.md`.
- Performance package 8 is implemented and deployed. Thirteen additive indexes
  now cover the measured service, assignment, church-owner, role, recurring-role,
  OneSignal, comment, notification, fill-in, and reminder query patterns.
- All new indexes are valid and ready. Representative plans use the service and
  assignment indexes directly; indexes on currently tiny tables were separately
  verified as eligible. Supabase reports no remaining unindexed public foreign
  keys and no new security or performance advisor findings.
- Package 8 changes no table, column, RLS policy, RPC, Edge Function, or API
  contract, so released app versions remain backend-compatible. Details and the
  reviewed rollback are in `docs/PERFORMANCE_DATABASE_INDEXES.md`.
- Performance package 9 is implemented and deployed. Quarter creation and batch
  assignment updates use additive atomic RPCs with a missing-function fallback
  for environments where the new migration is not present. Older app versions
  keep using their existing write paths unchanged.
- Auto-assignment reuses an unchanged preview, rejects a stale preview before
  applying it, and retains the existing server-side selected-range and
  past-quarter fairness behavior. Multi-song posting now uses one insert.
- Package 9 TypeScript, lint, Deno, 11 admin/notification regression tests, and Android/iOS
  production exports pass. Physical-device baseline and two-device functional
  measurements remain pending. Details are in
  `docs/PERFORMANCE_ADMIN_OPERATIONS.md`.
- The RLS performance migration
  `supabase/migrations/20260723000001_optimize_rls_policy_performance.sql`
  is deployed as production migration `20260726222037`. All 29 targeted policies
  retained their names, roles, commands, and row-access predicates; authenticated
  admin/member reads and post-deployment advisors passed. Released app versions
  remain compatible because no client-facing database contract changed.
- Final local checks and live Supabase verification were completed on 2026-07-26.
  Physical-device baseline and two-device delivery checks remain intentionally
  pending where noted below.

### 1. Establish a Performance Baseline

- Record the number of Supabase requests made when opening Schedules, Church, and
  Profile for the first time and when returning to each tab.
- Record schedule load time and rerender counts with a realistic test church:
  several months of services, multiple roles, comments, and assignments.
- Record behavior while two admin devices are logged into the same church.
- Use these measurements to verify that later packages improve performance
  without breaking live updates.

Done when:
- Before-change measurements are written down and can be repeated after each
  package.

### 2. Standardize Server Data with React Query

Implementation status: complete. Repeat the physical-device baseline protocol
before release to record the request-count improvement.

- Move reusable Supabase reads from hand-managed loading state into typed query
  hooks, starting with services and their related schedule data.
- Use query keys that include the current church ID and any selected date range.
- Reuse cached members, roles, assignments, comments, and fill-in requests instead
  of downloading the same records in multiple components.
- Use mutations for create, update, and delete operations. Update or invalidate
  only the relevant query after a mutation.
- Clear account-specific cached data on sign-out, account change, and church
  change so one user's data can never appear for another user.
- Preserve useful cached data while tabs change and show a full loading screen
  only when no usable data exists.

Done when:
- Reopening a tab does not duplicate requests for fresh cached data.
- Switching accounts or churches shows only the newly selected account's data.
- Failed requests have consistent errors and controlled retries.

### 3. Bound and Consolidate Schedule Loading

Implementation status: complete. Physical Android and iOS interaction testing
remains part of the release baseline because no simulator or connected device was
available during implementation.

- Load an initial schedule window instead of the church's complete service
  history. Base the window on the currently visible period and include enough
  nearby data for smooth navigation and load-distribution context.
- Fetch another date window when the user navigates outside the cached range.
- Keep past services required by auto-assignment fairness available to the
  assignment RPC without rendering or downloading unnecessary history.
- Consolidate related schedule reads to remove per-service or per-assignment
  request patterns. Prefer set-based Supabase queries or an RPC only where it
  clearly reduces round trips and keeps RLS behavior correct.
- Cache each church/date-range combination independently.

Done when:
- Opening Schedules does not download all historical services.
- Moving between already visited periods uses cached data.
- Assignment fairness still considers the required past-quarter history.
- No service, role, song, comment, assignment, or fill-in data is missing.

### 4. Stabilize Realtime Subscription Lifecycles

Implementation status: complete. Static verification and Android/iOS production
exports pass. Repeat the physical two-device baseline protocol before release to
verify account switching, church switching, and cross-device updates against the
production Realtime service.

- Maintain one subscription per required table/data stream for the current church.
- Add church-level filters where Supabase Realtime supports the required filter.
- Prevent duplicate channels when components rerender or auth/church state changes.
- Remove old channels during sign-out, account switching, church switching, and
  component cleanup.
- Coalesce rapid related events where a focused refetch is still required.

Done when:
- Subscription logs show no duplicate active channels.
- A user logged into a second account receives and displays only that account's
  permitted church updates and notifications.
- Switching churches does not continue processing events from the old church.

### 5. Update the Query Cache from Realtime Payloads

Implementation status: complete. TypeScript, Deno Edge Function checks, full
lint, and Android/iOS production exports pass. Production publication membership
was verified for services, assignments, service comments, fill-in requests, and
member notifications. Repeat the physical two-device checklist before release.

- Apply inserts, updates, and deletes for services, assignments, songs/comments,
  fill-in requests, and notification records directly to the relevant cached data
  when the payload contains enough information.
- Use a focused query invalidation when related data is missing from the payload.
- Do not reload the complete schedule for a change affecting one service.
- Handle out-of-order and duplicate realtime events idempotently.

Done when:
- Creating, editing, deleting, manually reassigning, and accepting a fill-in
  updates the affected UI on two devices without a full-screen reload.
- Deleted services and their dependent information disappear from cached views.
- Duplicate events do not create duplicate rows in the interface.

### 6. Virtualize Long Schedule and Preview Lists

Implementation status: complete. TypeScript, Deno Edge Function checks, full
lint, and Android/iOS production exports pass. Repeat the long-schedule and
long-preview physical-device checklist before release because no connected
Android or iOS device was available during implementation.

- Replace the schedule `ScrollView` with `FlatList`, `SectionList`, or another
  suitable virtualized list.
- Virtualize the auto-assignment preview and skipped-slot report as well.
- Preserve sticky controls, modal sizing, scroll restoration, expansion state,
  and all existing schedule actions.
- Configure stable item keys and estimated/stable item dimensions where practical.

Done when:
- Long schedules and assignment previews can be scrolled to the end without
  freezing or excessive memory growth.
- Members can still expand services, edit songs, request fill-ins, and confirm
  assignment previews on Android and iOS.

### 7. Isolate React Rerenders and Context State

Implementation status: complete. TypeScript, Deno Edge Function checks, full
lint, and Android/iOS production exports pass. Repeat the development baseline
and two-device interaction checklist before release to measure card-level
improvements on physical devices.

- Profile schedule/service cards to identify components rerendering after unrelated
  updates.
- Memoize context values, callbacks, and expensive derived sorting/filtering.
- Split `ChurchContext` only where separate state ownership prevents broad
  rerenders; do not split it solely to create more files.
- Extract and memoize service rows/cards so changing one service does not rerender
  every service.
- Keep the default and iOS schedule implementations behaviorally aligned.

Done when:
- Editing one assignment, comment, or song rerenders the affected service and
  necessary controls rather than the complete schedule.
- Tab navigation and scrolling remain visually unchanged.

### 8. Add Database Indexes from Real Query Patterns

Implementation status: complete and deployed to production. All indexes are
additive and compatible with older app versions. Query evidence, plan results,
advisor verification, and rollback statements are documented in
`docs/PERFORMANCE_DATABASE_INDEXES.md`.

- Capture the filters, joins, and ordering used by the optimized queries before
  choosing indexes.
- Review indexes for church IDs, service IDs and dates, member IDs, assignment
  relationships, fill-in participants, notification ownership, recurring-service
  relationships, and comment ownership.
- Add only indexes supported by actual query patterns; avoid redundant indexes
  that add write cost without improving reads.
- Create a separate Supabase migration and review `EXPLAIN` output and database
  advisors before live deployment.

Done when:
- Target queries use the intended indexes and return the same authorized rows.
- Supabase advisors report no new security or performance regressions.
- The migration has a reviewed rollback statement before live deployment.

### 9. Optimize and Regression-Test Heavy Admin Operations

Implementation status: code, additive production migration, static regression
tests, and Android/iOS production exports are complete. Physical Android, iOS,
and two-device performance captures remain pending and are required before this
package is marked fully complete. See
`docs/PERFORMANCE_ADMIN_OPERATIONS.md`.

- Confirm auto-assignment preview calls the existing atomic Supabase assignment
  function with only the selected range and required fairness history.
- Avoid recalculating an unchanged preview and avoid one-request-per-assignment
  save behavior.
- Keep the UI responsive and show controlled progress during preview, reassignment,
  quarter creation, and other long admin operations.
- Run the baseline again and compare request counts, loading time, rerenders, and
  memory use.
- Regression-test service deletion, manual reassignment, fill-in acceptance,
  songs/comments, notification delivery, account switching, and realtime updates.

Done when:
- Long admin operations remain responsive and produce one consistent database
  result.
- Functional regression tests pass on Android and iOS.
- Final performance measurements improve over the baseline and are documented.

## Multi-Device Push Notifications

Allow the same member account to remain signed in on multiple Android and/or iOS
devices and receive the same push notification on every active device.

Implementation status: deployed to production on 2026-07-26. The additive
migration, all four notification functions, local checks, rollback tests,
advisors, and Android/iOS exports pass. Physical two-device delivery and sign-out
verification remain pending. See `docs/MULTI_DEVICE_PUSH_NOTIFICATIONS.md`.

### Current Problem

- Resolved: `claim_onesignal_subscription` now keeps every unique physical device
  subscription for the member.
- Resolved: all notification Edge Functions target every unique saved device and
  use external IDs only for members without saved subscriptions.
- Resolved: stable OneSignal idempotency keys prevent request retries from
  duplicating physical pushes.
- Resolved: notification history remains one logical row per member event,
  regardless of the number of physical devices.

### Implementation

1. Create a new Supabase migration using the CLI migration command.
   - Complete: production migration
     `20260726223652_enable_multi_device_push_notifications`.
   - Update `private.claim_onesignal_subscription_impl` so it removes a
     subscription from a different member when necessary, then upserts the current
     `(member_id, subscription_id)` relationship without deleting the member's
     other device subscriptions.
   - Keep `subscription_id` unique globally so one physical subscription cannot
     belong to two accounts simultaneously.
   - Preserve the logged-in-member ownership check and restricted function grants.

2. Update every notification Edge Function.
   - Complete: deployed versions are recorded in
     `docs/MULTI_DEVICE_PUSH_NOTIFICATIONS.md`.
   - `send-service-reminders`
   - `send-fill-in-notifications`
   - `send-fill-in-accepted-notification`
   - `send-service-comment-notifications`
   - Replace latest-subscription-per-member helpers with logic that retains every
     unique active subscription ID for each recipient member.
   - Send one OneSignal request to the deduplicated set of physical subscription
     IDs where possible.
   - Use the member's OneSignal `external_id` only when that member has no saved
     subscription rows, so the same device is not targeted by both methods.
   - Remove only subscription IDs that OneSignal explicitly reports as invalid.

3. Preserve device-specific sign-out behavior.
   - Complete in the current app; physical two-device verification remains.
   - Before calling `OneSignal.logout`, read the current device subscription ID.
   - Delete only the row matching both the signed-in member ID and current device
     subscription ID.
   - Never remove another signed-in device's subscription during ordinary sign-out.
   - Account deletion may remove every subscription belonging to the deleted
     member.

4. Keep notification history deduplicated.
   - Complete: nullable `event_key` plus unique `(member_id, event_key)`.
   - Insert one `member_notifications` row per recipient member and notification
     event, not one row per physical subscription.
   - Both devices should display the same history item and unread state from the
     member account.
   - Confirm repeated OneSignal delivery callbacks cannot create duplicate history
     rows.

5. Deploy and verify in a controlled order.
   - Complete for migration, functions, static checks, advisors, rollback tests,
     and production exports. Physical delivery remains.
   - Run TypeScript and Deno checks locally.
   - Apply the database migration before deploying the updated Edge Functions.
   - Run Supabase security and performance advisors after the migration.
   - Verify current RLS policies still prevent one member from claiming or deleting
     another member's subscriptions.

Done when:
- Device A and Device B can sign into the same member account and both subscription
  IDs remain in `onesignal_subscriptions`.
- Service reminders, fill-in requests, accepted fill-in notices, and service
  song/comment notifications arrive once on both devices.
- The notification bell contains one history item for the event, not one per
  device.
- Signing out on Device A stops future pushes to Device A without interrupting
  Device B.
- Signing into Device A with a different account reassigns that device subscription
  to the new member and prevents notifications for the previous member.
- Invalid or uninstalled device subscriptions are cleaned up without removing
  healthy subscriptions for the same member.

## Supabase RLS Performance Migration

Status: deployed to production as migration `20260726222037` on 2026-07-26.

- Deployed `supabase/migrations/20260723000001_optimize_rls_policy_performance.sql`.
- Purpose: replace raw `auth.uid()` calls in RLS policies with `(select auth.uid())` so Supabase/Postgres can evaluate the auth value once per statement instead of once per row.
- Compatibility verification: all 29 policies preserve their original tables,
  names, roles, commands, and predicates. The only semantic-neutral change is the
  statement-level evaluation of `auth.uid()`.
- Post-deployment verification: zero policies were missing, zero targeted
  policies retained direct `auth.uid()` evaluation, and read-only authenticated
  access checks succeeded for an existing admin and regular member.
- Advisor result: the targeted `auth_rls_initplan` warnings are cleared. Existing
  unused-index, multiple-permissive-policy, and unrelated security notices remain
  separate follow-up work.
- Separate follow-up: consolidate duplicate permissive RLS policies only after reviewing each table's access rules one by one.
