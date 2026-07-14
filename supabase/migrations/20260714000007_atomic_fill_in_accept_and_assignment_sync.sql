create or replace function private.sync_fill_in_requests_for_assignment_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.member_id is not distinct from old.member_id then
    return new;
  end if;

  if new.member_id is null then
    update public.fill_in_requests
    set
      status = 'cancelled',
      filled_by_member_id = null,
      updated_at = now()
    where assignment_id = new.id
      and status = 'pending';

    update public.fill_in_requests
    set
      filled_by_member_id = null,
      updated_at = now()
    where assignment_id = new.id
      and status = 'filled';

    return new;
  end if;

  update public.fill_in_requests
  set
    status = 'filled',
    filled_by_member_id = new.member_id,
    updated_at = now()
  where assignment_id = new.id
    and status in ('pending', 'filled')
    and (
      status <> 'filled'
      or filled_by_member_id is distinct from new.member_id
    );

  return new;
end;
$$;

drop trigger if exists sync_fill_in_requests_for_assignment_update on public.assignments;

create trigger sync_fill_in_requests_for_assignment_update
after update of member_id on public.assignments
for each row
execute function private.sync_fill_in_requests_for_assignment_update();

create or replace function private.accept_fill_in_request_impl(
  target_request_id uuid,
  target_filled_by_member_id uuid
)
returns public.fill_in_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  fill_in_request public.fill_in_requests;
  filling_member public.church_members;
  assignment_record record;
  normalized_role text;
  updated_request public.fill_in_requests;
begin
  select *
  into fill_in_request
  from public.fill_in_requests
  where id = target_request_id
  for update;

  if fill_in_request.id is null then
    raise exception 'Fill-in request not found'
      using errcode = 'P0002';
  end if;

  if fill_in_request.status <> 'pending' then
    raise exception 'This fill-in request has already been processed'
      using errcode = '22023';
  end if;

  select
    a.id as assignment_id,
    a.role as assignment_role,
    a.service_id,
    s.church_id
  into assignment_record
  from public.assignments a
  join public.services s on s.id = a.service_id
  where a.id = fill_in_request.assignment_id
    and a.service_id = fill_in_request.service_id
    and s.church_id = fill_in_request.church_id
  for update;

  if assignment_record.assignment_id is null then
    raise exception 'Assignment not found for fill-in request'
      using errcode = 'P0002';
  end if;

  select *
  into filling_member
  from public.church_members cm
  where cm.id = target_filled_by_member_id
    and cm.church_id = fill_in_request.church_id
    and cm.member_id = (select auth.uid());

  if filling_member.id is null then
    raise exception 'Only the accepting member can accept this fill-in request'
      using errcode = '42501';
  end if;

  if filling_member.id = fill_in_request.requesting_member_id then
    raise exception 'The requesting member cannot accept their own fill-in request'
      using errcode = '22023';
  end if;

  normalized_role := lower(regexp_replace(trim(fill_in_request.role_name), '\s+', ' ', 'g'));

  if not exists (
    select 1
    from public.member_roles mr
    join public.church_roles cr on cr.id = mr.role_id
    where mr.member_id = filling_member.id
      and cr.church_id = fill_in_request.church_id
      and lower(regexp_replace(trim(cr.name), '\s+', ' ', 'g')) = normalized_role
  )
  and not (
    filling_member.role is not null
    and lower(regexp_replace(trim(filling_member.role), '\s+', ' ', 'g')) = normalized_role
  ) then
    raise exception 'Member does not have the requested role'
      using errcode = '42501';
  end if;

  update public.assignments
  set
    member_id = filling_member.id,
    person_name = coalesce(nullif(trim(filling_member.name), ''), filling_member.email)
  where id = fill_in_request.assignment_id;

  update public.fill_in_requests
  set
    status = 'filled',
    filled_by_member_id = filling_member.id,
    updated_at = now()
  where assignment_id = fill_in_request.assignment_id
    and status = 'pending';

  select *
  into updated_request
  from public.fill_in_requests
  where id = target_request_id;

  return updated_request;
end;
$$;

create or replace function public.accept_fill_in_request(
  target_request_id uuid,
  target_filled_by_member_id uuid
)
returns public.fill_in_requests
language sql
security invoker
set search_path = public, private
as $$
  select *
  from private.accept_fill_in_request_impl(
    target_request_id,
    target_filled_by_member_id
  );
$$;

revoke all on function private.sync_fill_in_requests_for_assignment_update() from public;
revoke all on function private.sync_fill_in_requests_for_assignment_update() from anon;
grant execute on function private.sync_fill_in_requests_for_assignment_update() to authenticated;

revoke all on function private.accept_fill_in_request_impl(uuid, uuid) from public;
revoke all on function private.accept_fill_in_request_impl(uuid, uuid) from anon;
grant execute on function private.accept_fill_in_request_impl(uuid, uuid) to authenticated;

revoke all on function public.accept_fill_in_request(uuid, uuid) from public;
revoke all on function public.accept_fill_in_request(uuid, uuid) from anon;
grant execute on function public.accept_fill_in_request(uuid, uuid) to authenticated;

update public.fill_in_requests fir
set
  filled_by_member_id = a.member_id,
  updated_at = now()
from public.assignments a
where a.id = fir.assignment_id
  and fir.status = 'filled'
  and a.member_id is not null
  and fir.filled_by_member_id is distinct from a.member_id;

update public.fill_in_requests fir
set
  status = 'cancelled',
  filled_by_member_id = null,
  updated_at = now()
from public.assignments a
where a.id = fir.assignment_id
  and fir.status = 'filled'
  and a.member_id is null;
