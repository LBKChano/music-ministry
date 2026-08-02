-- Package 14 adds opt-out-only push preferences. A missing row intentionally
-- means every category is enabled so released clients keep their behavior.

create unique index if not exists church_members_id_church_id_key
on public.church_members (id, church_id);

create table if not exists public.member_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  member_id uuid not null unique,
  service_reminders boolean not null default true,
  fill_in_requests boolean not null default true,
  fill_in_updates boolean not null default true,
  service_comments boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_notification_preferences_membership_fkey
    foreign key (member_id, church_id)
    references public.church_members (id, church_id)
    on delete cascade,
  constraint member_notification_preferences_church_id_fkey
    foreign key (church_id)
    references public.churches (id)
    on delete cascade
);

create index if not exists member_notification_preferences_church_idx
on public.member_notification_preferences (church_id);

alter table public.member_notification_preferences enable row level security;

create policy "Members view own notification preferences"
on public.member_notification_preferences
for select
to authenticated
using (
  exists (
    select 1
    from public.church_members member
    where member.id = member_notification_preferences.member_id
      and member.church_id = member_notification_preferences.church_id
      and member.member_id = (select auth.uid())
  )
);

create policy "Members insert own notification preferences"
on public.member_notification_preferences
for insert
to authenticated
with check (
  exists (
    select 1
    from public.church_members member
    where member.id = member_notification_preferences.member_id
      and member.church_id = member_notification_preferences.church_id
      and member.member_id = (select auth.uid())
  )
);

create policy "Members update own notification preferences"
on public.member_notification_preferences
for update
to authenticated
using (
  exists (
    select 1
    from public.church_members member
    where member.id = member_notification_preferences.member_id
      and member.church_id = member_notification_preferences.church_id
      and member.member_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.church_members member
    where member.id = member_notification_preferences.member_id
      and member.church_id = member_notification_preferences.church_id
      and member.member_id = (select auth.uid())
  )
);

revoke all on table public.member_notification_preferences from public;
revoke all on table public.member_notification_preferences from anon;
revoke all on table public.member_notification_preferences from authenticated;
grant select, insert, update, delete
on table public.member_notification_preferences
to service_role;

create or replace function public.get_my_notification_preferences(
  target_church_id uuid
)
returns table (
  church_id uuid,
  member_id uuid,
  service_reminders boolean,
  fill_in_requests boolean,
  fill_in_updates boolean,
  service_comments boolean,
  has_explicit_preferences boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_member_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select member.id
  into caller_member_id
  from public.church_members member
  where member.church_id = target_church_id
    and member.member_id = caller_id
  limit 1;

  if caller_member_id is null then
    raise exception 'Church membership not found' using errcode = '42501';
  end if;

  return query
  select
    target_church_id,
    caller_member_id,
    coalesce(preference.service_reminders, true),
    coalesce(preference.fill_in_requests, true),
    coalesce(preference.fill_in_updates, true),
    coalesce(preference.service_comments, true),
    preference.id is not null,
    preference.updated_at
  from (select 1) seed
  left join public.member_notification_preferences preference
    on preference.member_id = caller_member_id
   and preference.church_id = target_church_id;
end;
$$;

create or replace function public.update_my_notification_preferences(
  target_church_id uuid,
  receive_service_reminders boolean,
  receive_fill_in_requests boolean,
  receive_fill_in_updates boolean,
  receive_service_comments boolean
)
returns table (
  church_id uuid,
  member_id uuid,
  service_reminders boolean,
  fill_in_requests boolean,
  fill_in_updates boolean,
  service_comments boolean,
  has_explicit_preferences boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_member_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if receive_service_reminders is null
    or receive_fill_in_requests is null
    or receive_fill_in_updates is null
    or receive_service_comments is null
  then
    raise exception 'Notification preferences cannot be null'
      using errcode = '22004';
  end if;

  select member.id
  into caller_member_id
  from public.church_members member
  where member.church_id = target_church_id
    and member.member_id = caller_id
  limit 1;

  if caller_member_id is null then
    raise exception 'Church membership not found' using errcode = '42501';
  end if;

  insert into public.member_notification_preferences (
    church_id,
    member_id,
    service_reminders,
    fill_in_requests,
    fill_in_updates,
    service_comments
  )
  values (
    target_church_id,
    caller_member_id,
    receive_service_reminders,
    receive_fill_in_requests,
    receive_fill_in_updates,
    receive_service_comments
  )
  on conflict on constraint member_notification_preferences_member_id_key
  do update
  set church_id = excluded.church_id,
      service_reminders = excluded.service_reminders,
      fill_in_requests = excluded.fill_in_requests,
      fill_in_updates = excluded.fill_in_updates,
      service_comments = excluded.service_comments,
      updated_at = now();

  return query
  select
    preference.church_id,
    preference.member_id,
    preference.service_reminders,
    preference.fill_in_requests,
    preference.fill_in_updates,
    preference.service_comments,
    true,
    preference.updated_at
  from public.member_notification_preferences preference
  where preference.member_id = caller_member_id
    and preference.church_id = target_church_id;
end;
$$;

revoke all on function public.get_my_notification_preferences(uuid) from public;
revoke all on function public.get_my_notification_preferences(uuid) from anon;
revoke all on function public.get_my_notification_preferences(uuid) from service_role;
grant execute on function public.get_my_notification_preferences(uuid) to authenticated;

revoke all on function public.update_my_notification_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean
) from public;
revoke all on function public.update_my_notification_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean
) from anon;
revoke all on function public.update_my_notification_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean
) from service_role;
grant execute on function public.update_my_notification_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean
) to authenticated;

comment on table public.member_notification_preferences is
  'Church-membership push opt-outs. Missing rows mean all categories enabled.';

comment on function public.get_my_notification_preferences(uuid) is
  'Returns effective membership push settings; a missing row resolves to all enabled.';

comment on function public.update_my_notification_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean
) is
  'Atomically stores all push settings for the authenticated church membership.';
