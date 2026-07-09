create table if not exists public.service_comments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  member_id uuid not null references public.church_members(id) on delete cascade,
  comment_text text not null check (char_length(btrim(comment_text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_comments_service_created_idx
  on public.service_comments (service_id, created_at asc);

create index if not exists service_comments_church_created_idx
  on public.service_comments (church_id, created_at desc);

revoke all on public.service_comments from anon, authenticated;
grant select, insert on public.service_comments to authenticated;

alter table public.service_comments enable row level security;

drop policy if exists "Church members can view service comments" on public.service_comments;
create policy "Church members can view service comments"
on public.service_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.church_members cm
    where cm.church_id = service_comments.church_id
      and cm.member_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.churches c
    where c.id = service_comments.church_id
      and c.admin_id = (select auth.uid())
  )
);

drop policy if exists "Church members can add service comments" on public.service_comments;
create policy "Church members can add service comments"
on public.service_comments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.services s
    where s.id = service_comments.service_id
      and s.church_id = service_comments.church_id
  )
  and exists (
    select 1
    from public.church_members cm
    where cm.id = service_comments.member_id
      and cm.church_id = service_comments.church_id
      and cm.member_id = (select auth.uid())
  )
);

do $$
begin
  alter publication supabase_realtime add table public.service_comments;
exception
  when duplicate_object then null;
end $$;
