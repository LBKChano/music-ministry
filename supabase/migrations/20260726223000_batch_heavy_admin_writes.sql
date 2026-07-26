-- Additive batch RPCs for heavy admin writes.
--
-- Compatibility: existing tables, RLS policies, RPC signatures, and client
-- behavior remain unchanged. Older app versions continue using their original
-- write paths.

create or replace function private.create_services_with_assignments_batch_impl(
  target_church_id uuid,
  service_drafts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  draft jsonb;
  draft_count integer;
  created_count integer := 0;
  service_date date;
  service_time time;
  service_type text;
  service_notes text;
  role_values jsonb;
  created_service public.services;
  created_assignments jsonb;
  created_services jsonb := '[]'::jsonb;
begin
  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can create services'
      using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(service_drafts, 'null'::jsonb)) <> 'array' then
    raise exception 'service_drafts must be a JSON array'
      using errcode = '22023';
  end if;

  draft_count := jsonb_array_length(service_drafts);
  if draft_count = 0 then
    return jsonb_build_object(
      'created_count', 0,
      'services', '[]'::jsonb
    );
  end if;

  if draft_count > 250 then
    raise exception 'A maximum of 250 services can be created at once'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_church_id::text));

  for draft in
    select item.value
    from jsonb_array_elements(service_drafts) with ordinality as item(value, position)
    order by item.position
  loop
    service_date := nullif(draft->>'date', '')::date;
    service_type := nullif(trim(draft->>'service_type'), '');
    service_notes := nullif(draft->>'notes', '');
    service_time := nullif(draft->>'time', '')::time;
    role_values := coalesce(draft->'roles', '[]'::jsonb);

    if service_date is null or service_type is null then
      raise exception 'Every service requires a date and service_type'
        using errcode = '22023';
    end if;

    if jsonb_typeof(role_values) <> 'array' then
      raise exception 'Every service roles value must be a JSON array'
        using errcode = '22023';
    end if;

    if jsonb_array_length(role_values) > 50 then
      raise exception 'A service cannot contain more than 50 assignment slots'
        using errcode = '22023';
    end if;

    insert into public.services (
      church_id,
      date,
      time,
      service_type,
      notes
    )
    values (
      target_church_id,
      service_date,
      service_time,
      service_type,
      service_notes
    )
    returning * into created_service;

    insert into public.assignments (
      service_id,
      member_id,
      role,
      person_name
    )
    select
      created_service.id,
      null,
      trim(role.value),
      ''
    from jsonb_array_elements_text(role_values) as role(value)
    where nullif(trim(role.value), '') is not null;

    select coalesce(
      jsonb_agg(to_jsonb(a) order by a.created_at, a.id),
      '[]'::jsonb
    )
    into created_assignments
    from public.assignments a
    where a.service_id = created_service.id;

    created_services := created_services || jsonb_build_array(
      to_jsonb(created_service)
      || jsonb_build_object(
        'assignments', created_assignments,
        'service_comments', '[]'::jsonb
      )
    );
    created_count := created_count + 1;
  end loop;

  return jsonb_build_object(
    'created_count', created_count,
    'services', created_services
  );
end;
$$;

create or replace function public.create_services_with_assignments_batch(
  target_church_id uuid,
  service_drafts jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.create_services_with_assignments_batch_impl(
    target_church_id,
    service_drafts
  );
$$;

create or replace function private.update_assignments_batch_impl(
  target_church_id uuid,
  assignment_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  update_count integer;
  matched_count integer;
  updated_assignments jsonb;
begin
  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can update assignments'
      using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(assignment_updates, 'null'::jsonb)) <> 'array' then
    raise exception 'assignment_updates must be a JSON array'
      using errcode = '22023';
  end if;

  update_count := jsonb_array_length(assignment_updates);
  if update_count = 0 then
    return '[]'::jsonb;
  end if;

  if update_count > 500 then
    raise exception 'A maximum of 500 assignments can be updated at once'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assignment_updates) as item(id text)
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'Duplicate assignment IDs are not allowed'
      using errcode = '22023';
  end if;

  select count(*)
  into matched_count
  from jsonb_to_recordset(assignment_updates) as item(id text)
  join public.assignments a on a.id = item.id::uuid
  join public.services s on s.id = a.service_id
  where s.church_id = target_church_id;

  if matched_count <> update_count then
    raise exception 'One or more assignments do not belong to this church'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assignment_updates) as item(member_id text)
    where nullif(item.member_id, '') is not null
      and not exists (
        select 1
        from public.church_members cm
        where cm.id = item.member_id::uuid
          and cm.church_id = target_church_id
      )
  ) then
    raise exception 'One or more members do not belong to this church'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_church_id::text));

  with input_rows as (
    select
      item.id::uuid as id,
      nullif(item.member_id, '')::uuid as member_id,
      coalesce(item.person_name, '') as person_name
    from jsonb_to_recordset(assignment_updates) as item(
      id text,
      member_id text,
      person_name text
    )
  ),
  updated as (
    update public.assignments a
    set
      member_id = input_rows.member_id,
      person_name = input_rows.person_name
    from input_rows
    where a.id = input_rows.id
    returning a.*
  )
  select coalesce(
    jsonb_agg(to_jsonb(updated) order by updated.id),
    '[]'::jsonb
  )
  into updated_assignments
  from updated;

  return updated_assignments;
end;
$$;

create or replace function public.update_assignments_batch(
  target_church_id uuid,
  assignment_updates jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.update_assignments_batch_impl(
    target_church_id,
    assignment_updates
  );
$$;

revoke all on function private.create_services_with_assignments_batch_impl(uuid, jsonb) from public;
revoke all on function private.create_services_with_assignments_batch_impl(uuid, jsonb) from anon;
grant execute on function private.create_services_with_assignments_batch_impl(uuid, jsonb) to authenticated;

revoke all on function public.create_services_with_assignments_batch(uuid, jsonb) from public;
revoke all on function public.create_services_with_assignments_batch(uuid, jsonb) from anon;
grant execute on function public.create_services_with_assignments_batch(uuid, jsonb) to authenticated;

revoke all on function private.update_assignments_batch_impl(uuid, jsonb) from public;
revoke all on function private.update_assignments_batch_impl(uuid, jsonb) from anon;
grant execute on function private.update_assignments_batch_impl(uuid, jsonb) to authenticated;

revoke all on function public.update_assignments_batch(uuid, jsonb) from public;
revoke all on function public.update_assignments_batch(uuid, jsonb) from anon;
grant execute on function public.update_assignments_batch(uuid, jsonb) to authenticated;

-- Reviewed rollback:
-- drop function if exists public.update_assignments_batch(uuid, jsonb);
-- drop function if exists private.update_assignments_batch_impl(uuid, jsonb);
-- drop function if exists public.create_services_with_assignments_batch(uuid, jsonb);
-- drop function if exists private.create_services_with_assignments_batch_impl(uuid, jsonb);
