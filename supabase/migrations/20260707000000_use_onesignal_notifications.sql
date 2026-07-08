create table if not exists public.onesignal_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.church_members(id) on delete cascade,
  subscription_id text not null,
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'onesignal_subscriptions_member_id_key'
      and conrelid = 'public.onesignal_subscriptions'::regclass
  ) then
    alter table public.onesignal_subscriptions
      add constraint onesignal_subscriptions_member_id_key unique (member_id);
  end if;
end $$;

create table if not exists public.sent_reminders (
  id uuid primary key default gen_random_uuid(),
  reminder_key text not null unique,
  created_at timestamptz default now()
);

alter table public.onesignal_subscriptions enable row level security;
alter table public.sent_reminders enable row level security;

drop policy if exists "Members can upsert own subscription" on public.onesignal_subscriptions;
drop policy if exists "Members can view own OneSignal subscription" on public.onesignal_subscriptions;
drop policy if exists "Members can insert own OneSignal subscription" on public.onesignal_subscriptions;
drop policy if exists "Members can update own OneSignal subscription" on public.onesignal_subscriptions;
drop policy if exists "Members can delete own OneSignal subscription" on public.onesignal_subscriptions;

create policy "Members can view own OneSignal subscription"
on public.onesignal_subscriptions
for select
to authenticated
using (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

create policy "Members can insert own OneSignal subscription"
on public.onesignal_subscriptions
for insert
to authenticated
with check (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

create policy "Members can update own OneSignal subscription"
on public.onesignal_subscriptions
for update
to authenticated
using (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
)
with check (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

create policy "Members can delete own OneSignal subscription"
on public.onesignal_subscriptions
for delete
to authenticated
using (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);
