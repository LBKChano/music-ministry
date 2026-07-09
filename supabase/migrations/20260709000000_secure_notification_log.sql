-- Keep notification diagnostics private. Edge Functions write these logs with
-- service-role access; the mobile app does not need direct client access.
alter table public.notification_log enable row level security;

revoke all on table public.notification_log from anon;
revoke all on table public.notification_log from authenticated;

grant all on table public.notification_log to service_role;
