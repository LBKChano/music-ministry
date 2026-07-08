create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  member_id uuid not null references public.church_members(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists member_notifications_member_created_idx
  on public.member_notifications (member_id, created_at desc);

create index if not exists member_notifications_member_unread_idx
  on public.member_notifications (member_id, read_at)
  where read_at is null;

revoke all on public.member_notifications from anon, authenticated;
grant select on public.member_notifications to authenticated;
grant update (read_at) on public.member_notifications to authenticated;

alter table public.member_notifications enable row level security;

drop policy if exists "Members can view own notifications" on public.member_notifications;
create policy "Members can view own notifications"
on public.member_notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.church_members cm
    where cm.id = member_notifications.member_id
      and cm.member_id = (select auth.uid())
  )
);

drop policy if exists "Members can mark own notifications read" on public.member_notifications;
create policy "Members can mark own notifications read"
on public.member_notifications
for update
to authenticated
using (
  exists (
    select 1
    from public.church_members cm
    where cm.id = member_notifications.member_id
      and cm.member_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.church_members cm
    where cm.id = member_notifications.member_id
      and cm.member_id = (select auth.uid())
  )
);

alter publication supabase_realtime add table public.member_notifications;
