create schema if not exists private;

create or replace function private.is_church_admin(target_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.churches c
    where c.id = target_church_id
      and c.admin_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.church_members cm
    where cm.church_id = target_church_id
      and cm.member_id = (select auth.uid())
      and cm.is_admin = true
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_church_admin(uuid) from public;
grant execute on function private.is_church_admin(uuid) to authenticated;

drop policy if exists "Admins can add members" on public.church_members;
create policy "Admins can add members"
on public.church_members
for insert
to authenticated
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can delete members" on public.church_members;
create policy "Admins can delete members"
on public.church_members
for delete
to authenticated
using (private.is_church_admin(church_id));

drop policy if exists "Admins can update members" on public.church_members;
create policy "Admins can update members"
on public.church_members
for update
to authenticated
using (private.is_church_admin(church_id))
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can view church members" on public.church_members;
create policy "Admins can view church members"
on public.church_members
for select
to authenticated
using (private.is_church_admin(church_id));

drop policy if exists "Users can join church as member" on public.church_members;
create policy "Users can join church as member"
on public.church_members
for insert
to authenticated
with check (
  member_id = (select auth.uid())
  and is_admin = false
);

drop policy if exists "Users can update own member record" on public.church_members;

drop policy if exists "Admins can insert roles" on public.church_roles;
create policy "Admins can insert roles"
on public.church_roles
for insert
to authenticated
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can update roles" on public.church_roles;
create policy "Admins can update roles"
on public.church_roles
for update
to authenticated
using (private.is_church_admin(church_id))
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can delete roles" on public.church_roles;
create policy "Admins can delete roles"
on public.church_roles
for delete
to authenticated
using (private.is_church_admin(church_id));

drop policy if exists "Admins can insert member roles" on public.member_roles;
create policy "Admins can insert member roles"
on public.member_roles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.church_members cm
    where cm.id = member_roles.member_id
      and private.is_church_admin(cm.church_id)
  )
);

drop policy if exists "Admins can delete member roles" on public.member_roles;
create policy "Admins can delete member roles"
on public.member_roles
for delete
to authenticated
using (
  exists (
    select 1
    from public.church_members cm
    where cm.id = member_roles.member_id
      and private.is_church_admin(cm.church_id)
  )
);

drop policy if exists "Admins can manage member roles" on public.member_roles;
create policy "Admins can manage member roles"
on public.member_roles
for all
to authenticated
using (
  exists (
    select 1
    from public.church_members cm
    where cm.id = member_roles.member_id
      and private.is_church_admin(cm.church_id)
  )
)
with check (
  exists (
    select 1
    from public.church_members cm
    where cm.id = member_roles.member_id
      and private.is_church_admin(cm.church_id)
  )
);

drop policy if exists "Admins can insert recurring services" on public.recurring_services;
create policy "Admins can insert recurring services"
on public.recurring_services
for insert
to authenticated
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can update recurring services" on public.recurring_services;
create policy "Admins can update recurring services"
on public.recurring_services
for update
to authenticated
using (private.is_church_admin(church_id))
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can delete recurring services" on public.recurring_services;
create policy "Admins can delete recurring services"
on public.recurring_services
for delete
to authenticated
using (private.is_church_admin(church_id));

drop policy if exists "Admins can insert recurring service roles" on public.recurring_service_roles;
create policy "Admins can insert recurring service roles"
on public.recurring_service_roles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.recurring_services rs
    where rs.id = recurring_service_roles.recurring_service_id
      and private.is_church_admin(rs.church_id)
  )
);

drop policy if exists "Admins can delete recurring service roles" on public.recurring_service_roles;
create policy "Admins can delete recurring service roles"
on public.recurring_service_roles
for delete
to authenticated
using (
  exists (
    select 1
    from public.recurring_services rs
    where rs.id = recurring_service_roles.recurring_service_id
      and private.is_church_admin(rs.church_id)
  )
);

drop policy if exists "Admins can manage recurring service roles" on public.recurring_service_roles;
create policy "Admins can manage recurring service roles"
on public.recurring_service_roles
for all
to authenticated
using (
  exists (
    select 1
    from public.recurring_services rs
    where rs.id = recurring_service_roles.recurring_service_id
      and private.is_church_admin(rs.church_id)
  )
)
with check (
  exists (
    select 1
    from public.recurring_services rs
    where rs.id = recurring_service_roles.recurring_service_id
      and private.is_church_admin(rs.church_id)
  )
);

drop policy if exists "Admins can create services in their churches" on public.services;
create policy "Admins can create services in their churches"
on public.services
for insert
to authenticated
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can update services in their churches" on public.services;
create policy "Admins can update services in their churches"
on public.services
for update
to authenticated
using (private.is_church_admin(church_id))
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can delete services in their churches" on public.services;
create policy "Admins can delete services in their churches"
on public.services
for delete
to authenticated
using (private.is_church_admin(church_id));

drop policy if exists "Admins can create assignments in their churches" on public.assignments;
create policy "Admins can create assignments in their churches"
on public.assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.services s
    where s.id = assignments.service_id
      and private.is_church_admin(s.church_id)
  )
);

drop policy if exists "Admins can update assignments in their churches" on public.assignments;
create policy "Admins can update assignments in their churches"
on public.assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.services s
    where s.id = assignments.service_id
      and private.is_church_admin(s.church_id)
  )
)
with check (
  exists (
    select 1
    from public.services s
    where s.id = assignments.service_id
      and private.is_church_admin(s.church_id)
  )
);

drop policy if exists "Admins can delete assignments in their churches" on public.assignments;
create policy "Admins can delete assignments in their churches"
on public.assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.services s
    where s.id = assignments.service_id
      and private.is_church_admin(s.church_id)
  )
);

drop policy if exists "Admins can view notification settings for their church" on public.notification_settings;
create policy "Admins can view notification settings for their church"
on public.notification_settings
for select
to authenticated
using (private.is_church_admin(church_id));

drop policy if exists "Admins can insert notification settings for their church" on public.notification_settings;
create policy "Admins can insert notification settings for their church"
on public.notification_settings
for insert
to authenticated
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can update notification settings for their church" on public.notification_settings;
create policy "Admins can update notification settings for their church"
on public.notification_settings
for update
to authenticated
using (private.is_church_admin(church_id))
with check (private.is_church_admin(church_id));

drop policy if exists "Admins can delete notification settings for their church" on public.notification_settings;
create policy "Admins can delete notification settings for their church"
on public.notification_settings
for delete
to authenticated
using (private.is_church_admin(church_id));
