-- Keep notification history bounded without weakening durable delivery dedupe.
-- This migration is additive for released clients: the public table, policies,
-- realtime publication, and unique event-key contract remain unchanged.

create schema if not exists private;

create table if not exists private.member_notification_event_ledger (
  member_id uuid not null
    references public.church_members(id) on delete cascade,
  event_key text not null,
  first_recorded_at timestamptz not null default now(),
  primary key (member_id, event_key)
);

comment on table private.member_notification_event_ledger is
  'Durable notification event claims retained independently of prunable member history.';

alter table private.member_notification_event_ledger enable row level security;

revoke all on table private.member_notification_event_ledger
  from public, anon, authenticated, service_role;

-- Prevent a writer from landing between the one-time backfill and trigger
-- installation. The lock is released with the migration transaction.
lock table public.member_notifications in share row exclusive mode;

insert into private.member_notification_event_ledger (
  member_id,
  event_key,
  first_recorded_at
)
select
  notification.member_id,
  notification.event_key,
  min(notification.created_at)
from public.member_notifications notification
where notification.event_key is not null
  and btrim(notification.event_key) <> ''
group by notification.member_id, notification.event_key
on conflict (member_id, event_key) do nothing;

create or replace function private.claim_member_notification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_key is null or btrim(new.event_key) = '' then
    return new;
  end if;

  insert into private.member_notification_event_ledger (
    member_id,
    event_key,
    first_recorded_at
  )
  values (
    new.member_id,
    new.event_key,
    coalesce(new.created_at, now())
  )
  on conflict (member_id, event_key) do nothing;

  if not found then
    -- Existing Edge Functions use ignoreDuplicates and do not depend on a
    -- returned history row, so suppressing a replay preserves that contract.
    return null;
  end if;

  return new;
end;
$$;

revoke all on function private.claim_member_notification_event()
  from public, anon, authenticated, service_role;

drop trigger if exists claim_member_notification_event
  on public.member_notifications;
create trigger claim_member_notification_event
before insert on public.member_notifications
for each row
execute function private.claim_member_notification_event();

create index if not exists member_notifications_read_retention_idx
  on public.member_notifications (read_at, id)
  where read_at is not null;

create or replace function private.prune_read_member_notifications()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  with eligible as (
    select notification.id
    from public.member_notifications notification
    where notification.read_at < statement_timestamp() - interval '90 days'
    order by notification.read_at, notification.id
    limit 500
    for update skip locked
  )
  delete from public.member_notifications notification
  using eligible
  where notification.id = eligible.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function private.prune_read_member_notifications() is
  'Deletes at most 500 read notification-history rows older than 90 days; unread rows and durable event claims are retained.';

revoke all on function private.prune_read_member_notifications()
  from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'prune-read-member-notifications-daily'
  ) then
    perform cron.unschedule('prune-read-member-notifications-daily');
  end if;
end
$$;

select cron.schedule(
  'prune-read-member-notifications-daily',
  '17 3 * * *',
  $schedule$
  select private.prune_read_member_notifications();
  $schedule$
);

-- Reviewed rollback:
-- 1. Unschedule prune-read-member-notifications-daily.
-- 2. Drop private.prune_read_member_notifications().
-- 3. Drop claim_member_notification_event and its trigger.
-- 4. Keep the ledger if notification event keys must remain deduplicated.
