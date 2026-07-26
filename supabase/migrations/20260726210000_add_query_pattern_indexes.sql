-- Additive indexes for the app's existing query patterns.
--
-- Compatibility: this migration does not change tables, columns, constraints,
-- RLS policies, functions, or API contracts, so older app versions continue to
-- read and write the same rows.

create index if not exists services_church_date_time_idx
on public.services (church_id, date, time);

create index if not exists assignments_service_idx
on public.assignments (service_id);

create index if not exists assignments_member_service_idx
on public.assignments (member_id, service_id);

create index if not exists churches_admin_created_idx
on public.churches (admin_id, created_at desc);

create index if not exists member_roles_role_member_idx
on public.member_roles (role_id, member_id);

create index if not exists recurring_service_roles_service_idx
on public.recurring_service_roles (recurring_service_id);

create index if not exists onesignal_subscriptions_member_idx
on public.onesignal_subscriptions (member_id);

create index if not exists service_comments_member_idx
on public.service_comments (member_id);

create index if not exists member_notifications_church_idx
on public.member_notifications (church_id);

create index if not exists fill_in_requests_requesting_member_idx
on public.fill_in_requests (requesting_member_id);

create index if not exists fill_in_requests_filled_member_idx
on public.fill_in_requests (filled_by_member_id);

-- The existing pending-only unique index cannot accelerate updates and cleanup
-- for filled or cancelled requests.
create index if not exists fill_in_requests_assignment_idx
on public.fill_in_requests (assignment_id);

-- The reminder cron reads this rolling seven-day window every minute.
create index if not exists sent_reminders_created_idx
on public.sent_reminders (created_at);

-- Reviewed rollback (run only if these indexes must be removed):
-- drop index if exists public.sent_reminders_created_idx;
-- drop index if exists public.fill_in_requests_assignment_idx;
-- drop index if exists public.fill_in_requests_filled_member_idx;
-- drop index if exists public.fill_in_requests_requesting_member_idx;
-- drop index if exists public.member_notifications_church_idx;
-- drop index if exists public.service_comments_member_idx;
-- drop index if exists public.onesignal_subscriptions_member_idx;
-- drop index if exists public.recurring_service_roles_service_idx;
-- drop index if exists public.member_roles_role_member_idx;
-- drop index if exists public.churches_admin_created_idx;
-- drop index if exists public.assignments_member_service_idx;
-- drop index if exists public.assignments_service_idx;
-- drop index if exists public.services_church_date_time_idx;
