-- Package 9: additive atomic operations for the guided Church Admin Hub.
--
-- Released clients keep every existing table, policy, direct-write path, and
-- RPC signature. New clients prefer these functions so multi-part editor saves
-- either commit together or leave the database unchanged.

create or replace function private.save_church_member_admin_impl(
  target_church_id uuid,
  target_member_id uuid,
  member_name text,
  member_email text,
  member_is_admin boolean,
  member_role_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_member public.church_members;
  selected_church public.churches;
  normalized_name text := nullif(pg_catalog.btrim(member_name), '');
  normalized_email text := nullif(pg_catalog.lower(pg_catalog.btrim(member_email)), '');
  normalized_role_ids uuid[] := coalesce(member_role_ids, array[]::uuid[]);
  updated_member public.church_members;
  role_rows jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can update members' using errcode = '42501';
  end if;

  select *
  into selected_church
  from public.churches
  where id = target_church_id;

  select *
  into selected_member
  from public.church_members
  where id = target_member_id
    and church_id = target_church_id
  for update;

  if selected_member.id is null then
    raise exception 'Member not found in this church' using errcode = 'P0002';
  end if;

  if normalized_name is null then
    raise exception 'Member name is required' using errcode = '22023';
  end if;

  if pg_catalog.char_length(normalized_name) > 120 then
    raise exception 'Member name must be 120 characters or fewer' using errcode = '22023';
  end if;

  if normalized_email is null or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid member email is required' using errcode = '22023';
  end if;

  if coalesce(member_is_admin, false) = false
    and selected_member.member_id = selected_church.admin_id then
    raise exception 'The church owner cannot be demoted' using errcode = '42501';
  end if;

  if pg_catalog.cardinality(normalized_role_ids) > 50
    or pg_catalog.array_position(normalized_role_ids, null) is not null
    or (
      select count(distinct role_id)
      from pg_catalog.unnest(normalized_role_ids) as submitted(role_id)
    ) <> pg_catalog.cardinality(normalized_role_ids) then
    raise exception 'Member roles contain invalid or duplicate IDs' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(normalized_role_ids) as submitted(role_id)
    left join public.church_roles as role
      on role.id = submitted.role_id
      and role.church_id = target_church_id
    where role.id is null
  ) then
    raise exception 'Every member role must belong to this church' using errcode = '42501';
  end if;

  update public.church_members
  set
    name = normalized_name,
    email = normalized_email,
    is_admin = case
      when selected_member.member_id = selected_church.admin_id then true
      else coalesce(member_is_admin, false)
    end
  where id = target_member_id
    and church_id = target_church_id
  returning * into updated_member;

  delete from public.member_roles
  where member_id = target_member_id;

  insert into public.member_roles (member_id, role_id)
  select target_member_id, submitted.role_id
  from pg_catalog.unnest(normalized_role_ids) as submitted(role_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', role.id,
        'name', role.name,
        'description', role.description,
        'display_order', role.display_order
      )
      order by role.display_order, role.name, role.id
    ),
    '[]'::jsonb
  )
  into role_rows
  from public.church_roles as role
  where role.id = any(normalized_role_ids);

  return jsonb_build_object(
    'member', to_jsonb(updated_member),
    'roles', role_rows
  );
end;
$$;

create or replace function public.save_church_member_admin(
  target_church_id uuid,
  target_member_id uuid,
  member_name text,
  member_email text,
  member_is_admin boolean,
  member_role_ids uuid[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_church_member_admin_impl(
    target_church_id,
    target_member_id,
    member_name,
    member_email,
    member_is_admin,
    member_role_ids
  );
$$;

create or replace function private.save_recurring_service_admin_impl(
  target_church_id uuid,
  target_service_id uuid,
  service_name text,
  service_day_of_week integer,
  service_time time,
  service_notes text,
  service_role_names text[]
)
returns public.recurring_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := nullif(pg_catalog.btrim(service_name), '');
  normalized_role_names text[] := coalesce(service_role_names, array[]::text[]);
  saved_service public.recurring_services;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can save weekly services' using errcode = '42501';
  end if;

  if normalized_name is null or pg_catalog.char_length(normalized_name) > 120 then
    raise exception 'Weekly service name must contain 1 to 120 characters' using errcode = '22023';
  end if;

  if service_day_of_week is null or service_day_of_week < 0 or service_day_of_week > 6 then
    raise exception 'Day of week must be between 0 and 6' using errcode = '22023';
  end if;

  if service_time is null then
    raise exception 'Weekly service time is required' using errcode = '22023';
  end if;

  if pg_catalog.cardinality(normalized_role_names) > 50
    or exists (
      select 1
      from pg_catalog.unnest(normalized_role_names) as submitted(role_name)
      where nullif(pg_catalog.btrim(submitted.role_name), '') is null
    )
    or (
      select count(distinct pg_catalog.lower(pg_catalog.btrim(role_name)))
      from pg_catalog.unnest(normalized_role_names) as submitted(role_name)
    ) <> pg_catalog.cardinality(normalized_role_names) then
    raise exception 'Weekly service roles contain invalid or duplicate names' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(normalized_role_names) as submitted(role_name)
    where not exists (
      select 1
      from public.church_roles as role
      where role.church_id = target_church_id
        and pg_catalog.lower(role.name) = pg_catalog.lower(pg_catalog.btrim(submitted.role_name))
    )
  ) then
    raise exception 'Every weekly service role must belong to this church' using errcode = '42501';
  end if;

  if target_service_id is null then
    insert into public.recurring_services (
      church_id,
      name,
      day_of_week,
      time,
      notes
    )
    values (
      target_church_id,
      normalized_name,
      service_day_of_week,
      service_time,
      nullif(pg_catalog.btrim(service_notes), '')
    )
    returning * into saved_service;
  else
    select *
    into saved_service
    from public.recurring_services
    where id = target_service_id
      and church_id = target_church_id
    for update;

    if saved_service.id is null then
      raise exception 'Weekly service not found in this church' using errcode = 'P0002';
    end if;

    update public.recurring_services
    set
      name = normalized_name,
      day_of_week = service_day_of_week,
      time = service_time,
      notes = nullif(pg_catalog.btrim(service_notes), ''),
      updated_at = pg_catalog.now()
    where id = target_service_id
      and church_id = target_church_id
    returning * into saved_service;
  end if;

  delete from public.recurring_service_roles
  where recurring_service_id = saved_service.id;

  insert into public.recurring_service_roles (recurring_service_id, role_name)
  select
    saved_service.id,
    role.name
  from pg_catalog.unnest(normalized_role_names) with ordinality as submitted(role_name, position)
  join public.church_roles as role
    on role.church_id = target_church_id
    and pg_catalog.lower(role.name) = pg_catalog.lower(pg_catalog.btrim(submitted.role_name))
  order by submitted.position;

  return saved_service;
end;
$$;

create or replace function public.save_recurring_service_admin(
  target_church_id uuid,
  target_service_id uuid,
  service_name text,
  service_day_of_week integer,
  service_time time,
  service_notes text,
  service_role_names text[]
)
returns public.recurring_services
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.save_recurring_service_admin_impl(
    target_church_id,
    target_service_id,
    service_name,
    service_day_of_week,
    service_time,
    service_notes,
    service_role_names
  );
$$;

create or replace function private.save_church_role_admin_impl(
  target_church_id uuid,
  target_role_id uuid,
  role_name text,
  role_description text
)
returns public.church_roles
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := nullif(pg_catalog.btrim(role_name), '');
  selected_role public.church_roles;
  saved_role public.church_roles;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can update roles' using errcode = '42501';
  end if;

  if normalized_name is null or pg_catalog.char_length(normalized_name) > 80 then
    raise exception 'Role name must contain 1 to 80 characters' using errcode = '22023';
  end if;

  select *
  into selected_role
  from public.church_roles
  where id = target_role_id
    and church_id = target_church_id
  for update;

  if selected_role.id is null then
    raise exception 'Role not found in this church' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.church_roles as role
    where role.church_id = target_church_id
      and role.id <> target_role_id
      and pg_catalog.lower(role.name) = pg_catalog.lower(normalized_name)
  ) then
    raise exception 'A role with this name already exists' using errcode = '23505';
  end if;

  update public.church_roles
  set
    name = normalized_name,
    description = nullif(pg_catalog.btrim(role_description), ''),
    updated_at = pg_catalog.now()
  where id = target_role_id
    and church_id = target_church_id
  returning * into saved_role;

  update public.recurring_service_roles as recurring_role
  set role_name = normalized_name
  from public.recurring_services as recurring
  where recurring.id = recurring_role.recurring_service_id
    and recurring.church_id = target_church_id
    and pg_catalog.lower(recurring_role.role_name) = pg_catalog.lower(selected_role.name);

  update public.assignments as assignment
  set role = normalized_name
  from public.services as service
  where service.id = assignment.service_id
    and service.church_id = target_church_id
    and pg_catalog.lower(assignment.role) = pg_catalog.lower(selected_role.name);

  update public.fill_in_requests as fill_in
  set
    role_name = normalized_name,
    updated_at = pg_catalog.now()
  where fill_in.church_id = target_church_id
    and pg_catalog.lower(fill_in.role_name) = pg_catalog.lower(selected_role.name);

  return saved_role;
end;
$$;

create or replace function public.save_church_role_admin(
  target_church_id uuid,
  target_role_id uuid,
  role_name text,
  role_description text
)
returns public.church_roles
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.save_church_role_admin_impl(
    target_church_id,
    target_role_id,
    role_name,
    role_description
  );
$$;

create or replace function private.reorder_church_roles_admin_impl(
  target_church_id uuid,
  ordered_role_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_role_ids uuid[] := coalesce(ordered_role_ids, array[]::uuid[]);
  church_role_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can reorder roles' using errcode = '42501';
  end if;

  select count(*)
  into church_role_count
  from public.church_roles
  where church_id = target_church_id;

  if pg_catalog.cardinality(normalized_role_ids) <> church_role_count
    or pg_catalog.array_position(normalized_role_ids, null) is not null
    or (
      select count(distinct role_id)
      from pg_catalog.unnest(normalized_role_ids) as submitted(role_id)
    ) <> pg_catalog.cardinality(normalized_role_ids)
    or exists (
      select 1
      from pg_catalog.unnest(normalized_role_ids) as submitted(role_id)
      left join public.church_roles as role
        on role.id = submitted.role_id
        and role.church_id = target_church_id
      where role.id is null
    ) then
    raise exception 'Role order must contain every church role exactly once' using errcode = '22023';
  end if;

  perform 1
  from public.church_roles
  where church_id = target_church_id
  order by id
  for update;

  update public.church_roles as role
  set
    display_order = submitted.position - 1,
    updated_at = pg_catalog.now()
  from pg_catalog.unnest(normalized_role_ids) with ordinality as submitted(role_id, position)
  where role.id = submitted.role_id
    and role.church_id = target_church_id;

  return jsonb_build_object(
    'updated_count', church_role_count,
    'role_ids', to_jsonb(normalized_role_ids)
  );
end;
$$;

create or replace function public.reorder_church_roles_admin(
  target_church_id uuid,
  ordered_role_ids uuid[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.reorder_church_roles_admin_impl(
    target_church_id,
    ordered_role_ids
  );
$$;

create or replace function private.upsert_church_notification_settings_admin_impl(
  target_church_id uuid,
  reminder_hours integer[],
  reminders_enabled boolean
)
returns public.notification_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_hours integer[];
  saved_settings public.notification_settings;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can update reminder settings' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct hour order by hour desc), array[]::integer[])
  into normalized_hours
  from pg_catalog.unnest(coalesce(reminder_hours, array[]::integer[])) as submitted(hour);

  if pg_catalog.cardinality(normalized_hours) = 0
    or pg_catalog.cardinality(normalized_hours) > 20
    or exists (
      select 1
      from pg_catalog.unnest(normalized_hours) as submitted(hour)
      where submitted.hour < 1 or submitted.hour > 168
    ) then
    raise exception 'Select between 1 and 20 reminder times from 1 to 168 hours' using errcode = '22023';
  end if;

  insert into public.notification_settings (
    church_id,
    notification_hours,
    enabled,
    updated_at
  )
  values (
    target_church_id,
    normalized_hours,
    coalesce(reminders_enabled, true),
    pg_catalog.now()
  )
  on conflict (church_id)
  do update set
    notification_hours = excluded.notification_hours,
    enabled = excluded.enabled,
    updated_at = pg_catalog.now()
  returning * into saved_settings;

  return saved_settings;
end;
$$;

create or replace function public.upsert_church_notification_settings_admin(
  target_church_id uuid,
  reminder_hours integer[],
  reminders_enabled boolean
)
returns public.notification_settings
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.upsert_church_notification_settings_admin_impl(
    target_church_id,
    reminder_hours,
    reminders_enabled
  );
$$;

create or replace function private.preview_church_admin_delete_impact_impl(
  target_church_id uuid,
  target_type text,
  target_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_type text := pg_catalog.lower(pg_catalog.btrim(target_type));
  target_role public.church_roles;
  target_member public.church_members;
  target_church public.churches;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can preview deletion impact' using errcode = '42501';
  end if;

  select *
  into target_church
  from public.churches
  where id = target_church_id;

  if normalized_type = 'role' then
    select *
    into target_role
    from public.church_roles
    where id = target_id
      and church_id = target_church_id;

    if target_role.id is null then
      raise exception 'Role not found in this church' using errcode = 'P0002';
    end if;

    return jsonb_build_object(
      'target_type', 'role',
      'target_id', target_role.id,
      'target_name', target_role.name,
      'weekly_services', (
        select count(*)
        from public.recurring_service_roles as recurring_role
        join public.recurring_services as recurring
          on recurring.id = recurring_role.recurring_service_id
        where recurring.church_id = target_church_id
          and pg_catalog.lower(recurring_role.role_name) = pg_catalog.lower(target_role.name)
      ),
      'member_roles', (
        select count(*)
        from public.member_roles
        where role_id = target_role.id
      ),
      'assignments', (
        select count(*)
        from public.assignments as assignment
        join public.services as service on service.id = assignment.service_id
        where service.church_id = target_church_id
          and pg_catalog.lower(assignment.role) = pg_catalog.lower(target_role.name)
      ),
      'scheduling_preferences', (
        select count(*)
        from public.member_scheduling_preferences
        where church_id = target_church_id
          and role_id = target_role.id
      ),
      'protected', false
    );
  elsif normalized_type = 'member' then
    select *
    into target_member
    from public.church_members
    where id = target_id
      and church_id = target_church_id;

    if target_member.id is null then
      raise exception 'Member not found in this church' using errcode = 'P0002';
    end if;

    return jsonb_build_object(
      'target_type', 'member',
      'target_id', target_member.id,
      'target_name', coalesce(target_member.name, target_member.email),
      'member_roles', (
        select count(*) from public.member_roles where member_id = target_member.id
      ),
      'assignments', (
        select count(*) from public.assignments where member_id = target_member.id
      ),
      'unavailable_dates', (
        select count(*) from public.member_unavailability where member_id = target_member.id
      ),
      'scheduling_preferences', (
        select count(*)
        from public.member_scheduling_preferences
        where church_id = target_church_id
          and member_id = target_member.id
      ),
      'fill_in_requests', (
        select count(*)
        from public.fill_in_requests
        where church_id = target_church_id
          and (
            requesting_member_id = target_member.id
            or filled_by_member_id = target_member.id
          )
      ),
      'protected', target_member.member_id = target_church.admin_id
    );
  end if;

  raise exception 'target_type must be member or role' using errcode = '22023';
end;
$$;

create or replace function public.preview_church_admin_delete_impact(
  target_church_id uuid,
  target_type text,
  target_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.preview_church_admin_delete_impact_impl(
    target_church_id,
    target_type,
    target_id
  );
$$;

revoke all on function private.save_church_member_admin_impl(uuid, uuid, text, text, boolean, uuid[]) from public, anon;
revoke all on function private.save_recurring_service_admin_impl(uuid, uuid, text, integer, time, text, text[]) from public, anon;
revoke all on function private.save_church_role_admin_impl(uuid, uuid, text, text) from public, anon;
revoke all on function private.reorder_church_roles_admin_impl(uuid, uuid[]) from public, anon;
revoke all on function private.upsert_church_notification_settings_admin_impl(uuid, integer[], boolean) from public, anon;
revoke all on function private.preview_church_admin_delete_impact_impl(uuid, text, uuid) from public, anon;

revoke all on function public.save_church_member_admin(uuid, uuid, text, text, boolean, uuid[]) from public, anon;
revoke all on function public.save_recurring_service_admin(uuid, uuid, text, integer, time, text, text[]) from public, anon;
revoke all on function public.save_church_role_admin(uuid, uuid, text, text) from public, anon;
revoke all on function public.reorder_church_roles_admin(uuid, uuid[]) from public, anon;
revoke all on function public.upsert_church_notification_settings_admin(uuid, integer[], boolean) from public, anon;
revoke all on function public.preview_church_admin_delete_impact(uuid, text, uuid) from public, anon;

grant execute on function private.save_church_member_admin_impl(uuid, uuid, text, text, boolean, uuid[]) to authenticated;
grant execute on function private.save_recurring_service_admin_impl(uuid, uuid, text, integer, time, text, text[]) to authenticated;
grant execute on function private.save_church_role_admin_impl(uuid, uuid, text, text) to authenticated;
grant execute on function private.reorder_church_roles_admin_impl(uuid, uuid[]) to authenticated;
grant execute on function private.upsert_church_notification_settings_admin_impl(uuid, integer[], boolean) to authenticated;
grant execute on function private.preview_church_admin_delete_impact_impl(uuid, text, uuid) to authenticated;

grant execute on function public.save_church_member_admin(uuid, uuid, text, text, boolean, uuid[]) to authenticated;
grant execute on function public.save_recurring_service_admin(uuid, uuid, text, integer, time, text, text[]) to authenticated;
grant execute on function public.save_church_role_admin(uuid, uuid, text, text) to authenticated;
grant execute on function public.reorder_church_roles_admin(uuid, uuid[]) to authenticated;
grant execute on function public.upsert_church_notification_settings_admin(uuid, integer[], boolean) to authenticated;
grant execute on function public.preview_church_admin_delete_impact(uuid, text, uuid) to authenticated;
