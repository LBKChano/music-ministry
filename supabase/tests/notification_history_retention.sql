-- Package 29 notification-retention verification. All fixtures roll back.

begin;

-- Keep the bounded-count assertions deterministic if a local test database
-- already contains notification fixtures from another package.
update public.member_notifications
set read_at = now()
where read_at < statement_timestamp() - interval '90 days';

create temporary table package_29_notification_state (
  owner_account_id uuid not null,
  church_a_id uuid not null default gen_random_uuid(),
  church_b_id uuid not null default gen_random_uuid(),
  member_a_id uuid not null default gen_random_uuid(),
  member_b_id uuid not null default gen_random_uuid(),
  old_read_a_id uuid not null default gen_random_uuid(),
  recent_read_a_id uuid not null default gen_random_uuid(),
  old_unread_a_id uuid not null default gen_random_uuid(),
  old_read_b_id uuid not null default gen_random_uuid()
);

insert into package_29_notification_state (owner_account_id)
select id from auth.users order by created_at, id limit 1;

do $assert_account$
begin
  if not exists (select 1 from package_29_notification_state) then
    raise exception 'Package 29 tests require one Auth user';
  end if;
end
$assert_account$;

grant select on package_29_notification_state to service_role, authenticated;
set local role service_role;

insert into public.churches (id, name, admin_id, invitation_code)
select church_a_id, 'Package 29 Church A', owner_account_id,
  'P29A' || substr(replace(church_a_id::text, '-', ''), 1, 7)
from package_29_notification_state
union all
select church_b_id, 'Package 29 Church B', owner_account_id,
  'P29B' || substr(replace(church_b_id::text, '-', ''), 1, 7)
from package_29_notification_state;

insert into public.church_members (
  id,
  church_id,
  email,
  name,
  is_admin,
  member_id
)
select member_a_id, church_a_id, 'p29-a@example.test', 'Package 29 A', false, owner_account_id
from package_29_notification_state
union all
select member_b_id, church_b_id, 'p29-b@example.test', 'Package 29 B', false, owner_account_id
from package_29_notification_state;

insert into public.member_notifications (
  id,
  church_id,
  member_id,
  event_key,
  notification_type,
  title,
  body,
  read_at,
  created_at
)
select old_read_a_id, church_a_id, member_a_id, 'p29-old-a', 'service_reminder',
  'Old read A', 'Old read A', now() - interval '91 days', now() - interval '92 days'
from package_29_notification_state
union all
select recent_read_a_id, church_a_id, member_a_id, 'p29-recent-a', 'service_reminder',
  'Recent read A', 'Recent read A', now() - interval '89 days', now() - interval '90 days'
from package_29_notification_state
union all
select old_unread_a_id, church_a_id, member_a_id, 'p29-unread-a', 'service_reminder',
  'Old unread A', 'Old unread A', null, now() - interval '200 days'
from package_29_notification_state
union all
select old_read_b_id, church_b_id, member_b_id, 'p29-old-b', 'service_reminder',
  'Old read B', 'Old read B', now() - interval '120 days', now() - interval '121 days'
from package_29_notification_state;

reset role;

do $retention_contract$
declare
  state package_29_notification_state%rowtype;
  pruned integer;
begin
  select * into state from package_29_notification_state;
  select private.prune_read_member_notifications() into pruned;

  if pruned <> 2 then
    raise exception 'Expected two old read rows to be pruned, got %', pruned;
  end if;
  if exists (
    select 1 from public.member_notifications
    where id in (state.old_read_a_id, state.old_read_b_id)
  ) then
    raise exception 'Old read history survived retention across church scopes';
  end if;
  if not exists (
    select 1 from public.member_notifications
    where id = state.recent_read_a_id
  ) then
    raise exception 'A read row newer than the 90-day boundary was pruned';
  end if;
  if not exists (
    select 1 from public.member_notifications
    where id = state.old_unread_a_id and read_at is null
  ) then
    raise exception 'An unread row was age-pruned';
  end if;
  if not exists (
    select 1 from private.member_notification_event_ledger
    where member_id = state.member_a_id and event_key = 'p29-old-a'
  ) then
    raise exception 'Durable event claim was deleted with visible history';
  end if;
end
$retention_contract$;

select set_config(
  'request.jwt.claim.sub',
  (select owner_account_id::text from package_29_notification_state),
  true
);
set local role authenticated;

do $old_client_contract$
declare
  state package_29_notification_state%rowtype;
  visible_count integer;
begin
  select * into state from package_29_notification_state;

  select count(*) into visible_count
  from public.member_notifications
  where member_id in (state.member_a_id, state.member_b_id);
  if visible_count < 2 then
    raise exception 'Released-client SELECT access lost remaining notification history';
  end if;

  update public.member_notifications
  set read_at = now()
  where id = state.old_unread_a_id;
  if not found then
    raise exception 'Released-client read-state update no longer works';
  end if;
end
$old_client_contract$;

reset role;

set local role service_role;

-- Replaying a pruned event is a successful no-op for old Edge Function upserts.
insert into public.member_notifications (
  church_id,
  member_id,
  event_key,
  notification_type,
  title,
  body
)
select church_a_id, member_a_id, 'p29-old-a', 'service_reminder',
  'Replay', 'Replay'
from package_29_notification_state;

-- The same event key still belongs to a different member independently.
insert into public.member_notifications (
  church_id,
  member_id,
  event_key,
  notification_type,
  title,
  body,
  read_at,
  created_at
)
select church_b_id, member_b_id, 'p29-old-a', 'service_reminder',
  'Other member', 'Other member', null, now()
from package_29_notification_state;

-- Build a larger eligible set to verify the per-run bound.
insert into public.member_notifications (
  church_id,
  member_id,
  event_key,
  notification_type,
  title,
  body,
  read_at,
  created_at
)
select
  state.church_a_id,
  state.member_a_id,
  'p29-batch-' || value,
  'service_reminder',
  'Batch',
  'Batch',
  now() - interval '91 days',
  now() - interval '92 days'
from package_29_notification_state state
cross join generate_series(1, 505) as batch(value);

reset role;

do $dedupe_and_batch_contract$
declare
  state package_29_notification_state%rowtype;
  pruned integer;
  remaining_batch integer;
begin
  select * into state from package_29_notification_state;

  if exists (
    select 1 from public.member_notifications
    where member_id = state.member_a_id and event_key = 'p29-old-a'
  ) then
    raise exception 'A pruned event-key replay recreated visible history';
  end if;
  if not exists (
    select 1 from public.member_notifications
    where member_id = state.member_b_id and event_key = 'p29-old-a'
  ) then
    raise exception 'Event keys were incorrectly shared across members';
  end if;

  select private.prune_read_member_notifications() into pruned;
  if pruned <> 500 then
    raise exception 'Retention batch exceeded or missed its 500-row bound: %', pruned;
  end if;

  select count(*) into remaining_batch
  from public.member_notifications
  where member_id = state.member_a_id
    and event_key like 'p29-batch-%';
  if remaining_batch <> 5 then
    raise exception 'Expected the bounded run to leave the final batch tail, got %', remaining_batch;
  end if;
end
$dedupe_and_batch_contract$;

do $security_contract$
declare
  function_definition text;
begin
  if has_function_privilege(
    'anon',
    'private.prune_read_member_notifications()',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'private.prune_read_member_notifications()',
    'execute'
  ) or has_function_privilege(
    'service_role',
    'private.prune_read_member_notifications()',
    'execute'
  ) then
    raise exception 'Retention function is callable by a Data API role';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.member_notifications'::regclass
      and relrowsecurity
  ) then
    raise exception 'member_notifications RLS is not enabled';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'private.member_notification_event_ledger'::regclass
      and relrowsecurity
  ) then
    raise exception 'Private notification event ledger RLS is not enabled';
  end if;

  if not exists (
    select 1 from cron.job
    where jobname = 'prune-read-member-notifications-daily'
      and schedule = '17 3 * * *'
  ) then
    raise exception 'Daily notification-retention cron is missing';
  end if;

  select pg_get_functiondef(
    'private.prune_read_member_notifications()'::regprocedure
  ) into function_definition;
  if function_definition ~* '(notification_log|onesignal|fill_in|assignment|sent_reminder)' then
    raise exception 'Retention function reaches outside member notification history';
  end if;
end
$security_contract$;

rollback;
