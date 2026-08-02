-- Additive, authoritative manual-assignment APIs for Package 17.
--
-- Compatibility: released clients keep their existing direct assignment
-- updates. These versioned RPCs are used only by new clients.

create or replace function private.get_manual_assignment_candidates_v1_impl(
  target_assignment_id uuid
)
returns table (
  assignment_id uuid,
  service_id uuid,
  church_id uuid,
  service_date date,
  role_id uuid,
  role_name text,
  member_id uuid,
  display_name text,
  eligible boolean,
  reason_code text,
  unavailable_date date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  slot_record record;
  normalized_role text;
begin
  if actor_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501', detail = 'authentication_required';
  end if;

  select
    assignment.id as assignment_id,
    assignment.service_id,
    assignment.role as assignment_role,
    service.church_id,
    service.date as service_date,
    church.allow_member_multiple_roles_same_service,
    role.id as role_id,
    role.name as role_name
  into slot_record
  from public.assignments as assignment
  join public.services as service
    on service.id = assignment.service_id
  join public.churches as church
    on church.id = service.church_id
  left join lateral (
    select church_role.id, church_role.name
    from public.church_roles as church_role
    where church_role.church_id = service.church_id
      and pg_catalog.lower(
        pg_catalog.regexp_replace(
          pg_catalog.btrim(church_role.name),
          '\s+',
          ' ',
          'g'
        )
      ) = pg_catalog.lower(
        pg_catalog.regexp_replace(
          pg_catalog.btrim(assignment.role),
          '\s+',
          ' ',
          'g'
        )
      )
    order by church_role.display_order, church_role.id
    limit 1
  ) as role on true
  where assignment.id = target_assignment_id;

  if slot_record.assignment_id is null then
    raise exception 'This assignment is no longer available.'
      using errcode = 'P0002', detail = 'assignment_not_found';
  end if;

  if not private.is_church_admin(slot_record.church_id) then
    raise exception 'Only church admins can assign members.'
      using errcode = '42501', detail = 'not_church_admin';
  end if;

  if slot_record.role_id is null then
    raise exception 'This assignment role is no longer available.'
      using errcode = 'P0002', detail = 'role_not_found';
  end if;

  normalized_role := pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(slot_record.assignment_role),
      '\s+',
      ' ',
      'g'
    )
  );

  return query
  with role_members as (
    select distinct
      member.id,
      pg_catalog.coalesce(
        pg_catalog.nullif(pg_catalog.btrim(member.name), ''),
        pg_catalog.nullif(pg_catalog.btrim(member.email), ''),
        'Unnamed member'
      ) as member_display_name
    from public.church_members as member
    where member.church_id = slot_record.church_id
      and member.member_id is not null
      and (
        exists (
          select 1
          from public.member_roles as member_role
          where member_role.member_id = member.id
            and member_role.role_id = slot_record.role_id
        )
        or (
          member.role is not null
          and pg_catalog.lower(
            pg_catalog.regexp_replace(
              pg_catalog.btrim(member.role),
              '\s+',
              ' ',
              'g'
            )
          ) = normalized_role
        )
      )
  ),
  evaluated as (
    select
      role_member.id,
      role_member.member_display_name,
      unavailable.unavailable_date,
      exists (
        select 1
        from public.assignments as other_assignment
        where other_assignment.service_id = slot_record.service_id
          and other_assignment.id <> slot_record.assignment_id
          and other_assignment.member_id = role_member.id
          and (
            not slot_record.allow_member_multiple_roles_same_service
            or pg_catalog.lower(
              pg_catalog.regexp_replace(
                pg_catalog.btrim(other_assignment.role),
                '\s+',
                ' ',
                'g'
              )
            ) = normalized_role
          )
      ) as has_same_service_conflict
    from role_members as role_member
    left join public.member_unavailability as unavailable
      on unavailable.member_id = role_member.id
      and unavailable.unavailable_date = slot_record.service_date
  )
  select
    slot_record.assignment_id,
    slot_record.service_id,
    slot_record.church_id,
    slot_record.service_date,
    slot_record.role_id,
    slot_record.role_name,
    evaluated.id,
    evaluated.member_display_name,
    evaluated.unavailable_date is null
      and not evaluated.has_same_service_conflict,
    case
      when evaluated.unavailable_date is not null then 'unavailable_date'
      when evaluated.has_same_service_conflict then 'same_service_conflict'
      else null
    end,
    evaluated.unavailable_date
  from evaluated
  order by
    (evaluated.unavailable_date is null
      and not evaluated.has_same_service_conflict) desc,
    pg_catalog.lower(evaluated.member_display_name),
    evaluated.member_display_name,
    evaluated.id;
end;
$$;

create or replace function public.get_manual_assignment_candidates_v1(
  target_assignment_id uuid
)
returns table (
  assignment_id uuid,
  service_id uuid,
  church_id uuid,
  service_date date,
  role_id uuid,
  role_name text,
  member_id uuid,
  display_name text,
  eligible boolean,
  reason_code text,
  unavailable_date date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_manual_assignment_candidates_v1_impl(
    target_assignment_id
  );
$$;

create or replace function private.assign_member_to_slot_v2_impl(
  target_assignment_id uuid,
  target_member_id uuid,
  expected_service_id uuid,
  expected_service_date date,
  expected_role_id uuid
)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  slot_record record;
  selected_member public.church_members;
  selected_role public.church_roles;
  normalized_role text;
  updated_assignment public.assignments;
begin
  if actor_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501', detail = 'authentication_required';
  end if;

  select
    assignment.id as assignment_id,
    assignment.service_id,
    assignment.role as assignment_role,
    service.church_id,
    service.date as service_date,
    church.allow_member_multiple_roles_same_service
  into slot_record
  from public.assignments as assignment
  join public.services as service
    on service.id = assignment.service_id
  join public.churches as church
    on church.id = service.church_id
  where assignment.id = target_assignment_id
  for update of assignment, service;

  if slot_record.assignment_id is null then
    raise exception 'This assignment is no longer available.'
      using errcode = 'P0002', detail = 'assignment_not_found';
  end if;

  if not private.is_church_admin(slot_record.church_id) then
    raise exception 'Only church admins can assign members.'
      using errcode = '42501', detail = 'not_church_admin';
  end if;

  normalized_role := pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(slot_record.assignment_role),
      '\s+',
      ' ',
      'g'
    )
  );

  select role.*
  into selected_role
  from public.church_roles as role
  where role.church_id = slot_record.church_id
    and pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.btrim(role.name),
        '\s+',
        ' ',
        'g'
      )
    ) = normalized_role
  order by role.display_order, role.id
  limit 1;

  if selected_role.id is null then
    raise exception 'This assignment role is no longer available.'
      using errcode = 'P0002', detail = 'role_not_found';
  end if;

  if slot_record.service_id is distinct from expected_service_id
    or slot_record.service_date is distinct from expected_service_date
    or selected_role.id is distinct from expected_role_id then
    raise exception 'This assignment changed. Refresh the member list and try again.'
      using errcode = '40001', detail = 'stale_assignment';
  end if;

  select member.*
  into selected_member
  from public.church_members as member
  where member.id = target_member_id
    and member.church_id = slot_record.church_id
    and member.member_id is not null
  for key share;

  if selected_member.id is null then
    raise exception 'This member is no longer available in this church.'
      using errcode = '22023', detail = 'member_not_found';
  end if;

  if not exists (
    select 1
    from public.member_roles as member_role
    where member_role.member_id = selected_member.id
      and member_role.role_id = selected_role.id
  ) and not (
    selected_member.role is not null
    and pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.btrim(selected_member.role),
        '\s+',
        ' ',
        'g'
      )
    ) = normalized_role
  ) then
    raise exception 'This member no longer has the required role.'
      using errcode = '22023', detail = 'role_mismatch';
  end if;

  if exists (
    select 1
    from public.member_unavailability as unavailable
    where unavailable.member_id = selected_member.id
      and unavailable.unavailable_date = slot_record.service_date
  ) then
    raise exception 'This member is unavailable on this service date.'
      using errcode = '22023', detail = 'unavailable_date';
  end if;

  if exists (
    select 1
    from public.assignments as other_assignment
    where other_assignment.service_id = slot_record.service_id
      and other_assignment.id <> slot_record.assignment_id
      and other_assignment.member_id = selected_member.id
      and (
        not slot_record.allow_member_multiple_roles_same_service
        or pg_catalog.lower(
          pg_catalog.regexp_replace(
            pg_catalog.btrim(other_assignment.role),
            '\s+',
            ' ',
            'g'
          )
        ) = normalized_role
      )
  ) then
    raise exception 'This member is already assigned in this service.'
      using errcode = '22023', detail = 'same_service_conflict';
  end if;

  update public.assignments as assignment
  set
    member_id = selected_member.id,
    person_name = pg_catalog.coalesce(
      pg_catalog.nullif(pg_catalog.btrim(selected_member.name), ''),
      pg_catalog.nullif(pg_catalog.btrim(selected_member.email), ''),
      'Member'
    )
  where assignment.id = slot_record.assignment_id
  returning assignment.* into updated_assignment;

  return updated_assignment;
end;
$$;

create or replace function public.assign_member_to_slot_v2(
  target_assignment_id uuid,
  target_member_id uuid,
  expected_service_id uuid,
  expected_service_date date,
  expected_role_id uuid
)
returns public.assignments
language sql
security invoker
set search_path = ''
as $$
  select private.assign_member_to_slot_v2_impl(
    target_assignment_id,
    target_member_id,
    expected_service_id,
    expected_service_date,
    expected_role_id
  );
$$;

revoke all on function private.get_manual_assignment_candidates_v1_impl(uuid)
from public, anon;
grant execute on function private.get_manual_assignment_candidates_v1_impl(uuid)
to authenticated;

revoke all on function public.get_manual_assignment_candidates_v1(uuid)
from public, anon;
grant execute on function public.get_manual_assignment_candidates_v1(uuid)
to authenticated;

revoke all on function private.assign_member_to_slot_v2_impl(
  uuid,
  uuid,
  uuid,
  date,
  uuid
) from public, anon;
grant execute on function private.assign_member_to_slot_v2_impl(
  uuid,
  uuid,
  uuid,
  date,
  uuid
) to authenticated;

revoke all on function public.assign_member_to_slot_v2(
  uuid,
  uuid,
  uuid,
  date,
  uuid
) from public, anon;
grant execute on function public.assign_member_to_slot_v2(
  uuid,
  uuid,
  uuid,
  date,
  uuid
) to authenticated;

-- Reviewed rollback. Leave these APIs live when rolling back only the client;
-- released versions never call them.
-- drop function if exists public.assign_member_to_slot_v2(uuid, uuid, uuid, date, uuid);
-- drop function if exists private.assign_member_to_slot_v2_impl(uuid, uuid, uuid, date, uuid);
-- drop function if exists public.get_manual_assignment_candidates_v1(uuid);
-- drop function if exists private.get_manual_assignment_candidates_v1_impl(uuid);
