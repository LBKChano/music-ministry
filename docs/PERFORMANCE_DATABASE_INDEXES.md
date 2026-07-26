# Database Index Audit

This document records Step 8 of the performance roadmap. The migration is
additive and remains compatible with every older app version because it changes
only PostgreSQL indexes.

## Query Evidence

| Query pattern | Supporting index |
| --- | --- |
| Services filtered by church and date range, then ordered by date/time | `services_church_date_time_idx` |
| Assignments loaded, deleted, or joined by service | `assignments_service_idx` |
| Assignment history and cleanup filtered by member and service | `assignments_member_service_idx` |
| Churches loaded by owner and ordered by creation time | `churches_admin_created_idx` |
| Fill-in candidates loaded by role | `member_roles_role_member_idx` |
| Recurring-service roles loaded or deleted by recurring service | `recurring_service_roles_service_idx` |
| OneSignal devices loaded or deleted by member | `onesignal_subscriptions_member_idx` |
| Service comments deleted by their member owner | `service_comments_member_idx` |
| Notification history deleted by church | `member_notifications_church_idx` |
| Fill-in requests joined or deleted by requester/filler | `fill_in_requests_requesting_member_idx`, `fill_in_requests_filled_member_idx` |
| Fill-in synchronization across every request status by assignment | `fill_in_requests_assignment_idx` |
| Reminder deduplication reads a rolling seven-day creation window every minute | `sent_reminders_created_idx` |

Existing indexes already cover member unavailability, church role ordering,
notification history by member, recurring services by church, and service
comments by service. No duplicate indexes were added for those queries.

## Deployment Notes

The production tables are currently small, so normal transactional index
creation has a very short lock window. `create index concurrently` is not used
because Supabase migration application is transactional and PostgreSQL does not
allow concurrent index creation inside a transaction block.

The migration was deployed to production as Supabase migration
`20260726214915_add_query_pattern_indexes`.

Before deployment, baseline plans showed sequential scans for the unindexed
service range, assignment-by-service, OneSignal-by-member, and reminder-window
queries. After deployment:

- All 13 indexes report both `indisready = true` and `indisvalid = true`.
- The normal service-range plan uses `services_church_date_time_idx`, removing
  both the sequential scan and explicit sort.
- The normal assignment-by-service plan uses `assignments_service_idx`.
- OneSignal and reminder tables are currently small enough that PostgreSQL
  correctly prefers a sequential scan. Read-only validation with sequential
  scans disabled confirmed `onesignal_subscriptions_member_idx` and
  `sent_reminders_created_idx` are eligible for their exact production
  predicates as those tables grow.
- Read-only validation exercised every new index, and `pg_stat_user_indexes`
  recorded at least one scan for each.
- A catalog check reports no public single-column foreign key without a valid
  leading index. This clears all 11 unindexed-foreign-key notices reported
  before the migration.
- The post-migration performance advisor reports no new findings. Existing RLS
  initialization-plan, multiple-permissive-policy, and four older unused-index
  notices are unchanged and outside this migration's scope. See the
  [Supabase performance linter guidance](https://supabase.com/docs/guides/database/database-linter).
- The post-migration security advisor is identical to the pre-migration result;
  indexes introduced no security change or regression. Existing security
  notices remain tracked separately in the
  [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).

Because an index cannot alter query predicates, RLS evaluation, or returned row
shapes, existing clients continue to receive the same authorized records.

## Rollback

The reviewed `drop index if exists` statements are included as comments at the
bottom of
`supabase/migrations/20260726210000_add_query_pattern_indexes.sql`. Removing the
indexes changes performance only; it does not alter stored data or app behavior.
