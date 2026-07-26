-- Behavior-preserving RLS performance cleanup.
-- Supabase's advisor recommends wrapping auth.uid() in a SELECT so Postgres
-- can evaluate it once per statement instead of once per row.

-- assignments
drop policy if exists "Admins can view assignments in their churches" on public.assignments;
create policy "Admins can view assignments in their churches"
on public.assignments
for select
to public
using (
  exists (
    select 1
    from public.services
    join public.churches on churches.id = services.church_id
    where services.id = assignments.service_id
      and churches.admin_id = (select auth.uid())
  )
);

drop policy if exists "Members view assignments" on public.assignments;
create policy "Members view assignments"
on public.assignments
for select
to authenticated
using (
  service_id in (
    select s.id
    from public.services s
    join public.church_members cm on cm.church_id = s.church_id
    where cm.member_id = (select auth.uid())
  )
);

drop policy if exists "Members can update assignments when accepting fill-in requests" on public.assignments;
create policy "Members can update assignments when accepting fill-in requests"
on public.assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.fill_in_requests fir
    join public.church_members cm on cm.church_id = fir.church_id
    where fir.assignment_id = assignments.id
      and fir.status = 'pending'
      and cm.member_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.fill_in_requests fir
    join public.church_members cm on cm.church_id = fir.church_id
    where fir.assignment_id = assignments.id
      and fir.status = 'pending'
      and cm.member_id = (select auth.uid())
  )
);

-- church_members
drop policy if exists "Users can view own member record" on public.church_members;
create policy "Users can view own member record"
on public.church_members
for select
to authenticated
using (member_id = (select auth.uid()));

-- church_roles
drop policy if exists "Members view church roles" on public.church_roles;
create policy "Members view church roles"
on public.church_roles
for select
to authenticated
using (
  church_id in (
    select church_members.church_id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

drop policy if exists "Users can view roles for their churches" on public.church_roles;
create policy "Users can view roles for their churches"
on public.church_roles
for select
to public
using (
  church_id in (
    select churches.id
    from public.churches
    where churches.admin_id = (select auth.uid())
  )
);

-- churches
drop policy if exists "Admins delete own churches" on public.churches;
create policy "Admins delete own churches"
on public.churches
for delete
to authenticated
using (admin_id = (select auth.uid()));

drop policy if exists "Users create churches" on public.churches;
create policy "Users create churches"
on public.churches
for insert
to authenticated
with check (admin_id = (select auth.uid()));

drop policy if exists "Admins view own churches" on public.churches;
create policy "Admins view own churches"
on public.churches
for select
to authenticated
using (admin_id = (select auth.uid()));

drop policy if exists "Admins update own churches" on public.churches;
create policy "Admins update own churches"
on public.churches
for update
to authenticated
using (admin_id = (select auth.uid()));

-- fill_in_requests
drop policy if exists "Admins can delete fill-in requests" on public.fill_in_requests;
create policy "Admins can delete fill-in requests"
on public.fill_in_requests
for delete
to public
using (
  church_id in (
    select church_members.church_id
    from public.church_members
    where church_members.member_id = (select auth.uid())
      and church_members.is_admin = true
  )
);

drop policy if exists "Members can create fill-in requests for their assignments" on public.fill_in_requests;
create policy "Members can create fill-in requests for their assignments"
on public.fill_in_requests
for insert
to public
with check (
  requesting_member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

drop policy if exists "Members can view fill-in requests for their church" on public.fill_in_requests;
create policy "Members can view fill-in requests for their church"
on public.fill_in_requests
for select
to public
using (
  church_id in (
    select church_members.church_id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

drop policy if exists "Members can update fill-in requests" on public.fill_in_requests;
create policy "Members can update fill-in requests"
on public.fill_in_requests
for update
to public
using (
  church_id in (
    select church_members.church_id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

-- member_roles
drop policy if exists "Members view roles in their churches" on public.member_roles;
create policy "Members view roles in their churches"
on public.member_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.church_members cm1
    join public.church_members cm2 on cm1.church_id = cm2.church_id
    where cm1.member_id = (select auth.uid())
      and cm2.id = member_roles.member_id
  )
);

-- member_unavailability
drop policy if exists "Admins can view member unavailability" on public.member_unavailability;
create policy "Admins can view member unavailability"
on public.member_unavailability
for select
to authenticated
using (
  member_id in (
    select cm.id
    from public.church_members cm
    join public.churches c on c.id = cm.church_id
    where c.admin_id = (select auth.uid())
  )
);

drop policy if exists "Users delete own unavailability" on public.member_unavailability;
create policy "Users delete own unavailability"
on public.member_unavailability
for delete
to authenticated
using (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

drop policy if exists "Users insert own unavailability" on public.member_unavailability;
create policy "Users insert own unavailability"
on public.member_unavailability
for insert
to authenticated
with check (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

drop policy if exists "Users view own unavailability" on public.member_unavailability;
create policy "Users view own unavailability"
on public.member_unavailability
for select
to authenticated
using (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

-- push_tokens
drop policy if exists "Members can delete their own push tokens" on public.push_tokens;
create policy "Members can delete their own push tokens"
on public.push_tokens
for delete
to public
using (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

drop policy if exists "Members can insert their own push tokens" on public.push_tokens;
create policy "Members can insert their own push tokens"
on public.push_tokens
for insert
to public
with check (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

drop policy if exists "Members can update their own push tokens" on public.push_tokens;
create policy "Members can update their own push tokens"
on public.push_tokens
for update
to public
using (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

drop policy if exists "Members can view their own push tokens" on public.push_tokens;
create policy "Members can view their own push tokens"
on public.push_tokens
for select
to public
using (
  member_id in (
    select church_members.id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

-- recurring_service_roles
drop policy if exists "Members view recurring service roles" on public.recurring_service_roles;
create policy "Members view recurring service roles"
on public.recurring_service_roles
for select
to authenticated
using (
  recurring_service_id in (
    select rs.id
    from public.recurring_services rs
    join public.church_members cm on cm.church_id = rs.church_id
    where cm.member_id = (select auth.uid())
  )
);

drop policy if exists "Users can view recurring service roles for their church" on public.recurring_service_roles;
create policy "Users can view recurring service roles for their church"
on public.recurring_service_roles
for select
to public
using (
  exists (
    select 1
    from public.recurring_services rs
    join public.churches c on rs.church_id = c.id
    where rs.id = recurring_service_roles.recurring_service_id
      and c.admin_id = (select auth.uid())
  )
);

-- recurring_services
drop policy if exists "Members view recurring services" on public.recurring_services;
create policy "Members view recurring services"
on public.recurring_services
for select
to authenticated
using (
  church_id in (
    select church_members.church_id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);

drop policy if exists "Users can view recurring services for their churches" on public.recurring_services;
create policy "Users can view recurring services for their churches"
on public.recurring_services
for select
to public
using (
  church_id in (
    select churches.id
    from public.churches
    where churches.admin_id = (select auth.uid())
  )
);

-- services
drop policy if exists "Admins can view services in their churches" on public.services;
create policy "Admins can view services in their churches"
on public.services
for select
to public
using (
  exists (
    select 1
    from public.churches
    where churches.id = services.church_id
      and churches.admin_id = (select auth.uid())
  )
);

drop policy if exists "Members view services" on public.services;
create policy "Members view services"
on public.services
for select
to authenticated
using (
  church_id in (
    select church_members.church_id
    from public.church_members
    where church_members.member_id = (select auth.uid())
  )
);
