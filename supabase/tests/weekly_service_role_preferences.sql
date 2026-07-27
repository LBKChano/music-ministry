-- Run inside a transaction after the Step 7 migration. The caller must roll
-- the transaction back so this isolated church never persists.
do $behavior$
declare
  caller_id uuid;
  test_church_id uuid := gen_random_uuid();
  test_role_id uuid := gen_random_uuid();
  test_recurring_id uuid := gen_random_uuid();
  preferred_member_id uuid := gen_random_uuid();
  available_member_id uuid := gen_random_uuid();
  service_one_id uuid := gen_random_uuid();
  service_two_id uuid := gen_random_uuid();
  service_three_id uuid := gen_random_uuid();
  service_one_date date := current_date + 14;
  service_two_date date := current_date + 21;
  service_three_date date := current_date + 28;
  preview_result jsonb;
  batch_result jsonb;
  batch_service_id uuid;
begin
  select id
  into caller_id
  from auth.users
  order by created_at
  limit 1;

  if caller_id is null then
    raise exception 'No auth user is available for migration behavior checks';
  end if;

  insert into public.churches (id, name, admin_id, invitation_code)
  values (
    test_church_id,
    'Step 7 Migration Test',
    caller_id,
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  );

  insert into public.church_roles (id, church_id, name)
  values (test_role_id, test_church_id, 'Piano');

  insert into public.recurring_services (
    id,
    church_id,
    name,
    day_of_week,
    time
  )
  values (
    test_recurring_id,
    test_church_id,
    'Sunday Test',
    extract(dow from service_one_date)::integer,
    time '09:00'
  );

  insert into public.recurring_service_roles (
    recurring_service_id,
    role_name
  )
  values (test_recurring_id, 'Piano');

  insert into public.church_members (
    id,
    church_id,
    email,
    name,
    is_admin
  )
  values
    (
      preferred_member_id,
      test_church_id,
      'step7-preferred@example.invalid',
      'A Preferred',
      false
    ),
    (
      available_member_id,
      test_church_id,
      'step7-available@example.invalid',
      'B Available',
      false
    );

  insert into public.member_roles (member_id, role_id)
  values
    (preferred_member_id, test_role_id),
    (available_member_id, test_role_id);

  insert into public.member_scheduling_preferences (
    church_id,
    member_id,
    recurring_service_id,
    role_id
  )
  values (
    test_church_id,
    preferred_member_id,
    test_recurring_id,
    test_role_id
  );

  insert into public.services (
    id,
    church_id,
    date,
    time,
    service_type,
    recurring_service_id
  )
  values
    (
      service_one_id,
      test_church_id,
      service_one_date,
      time '09:00',
      'Sunday Test',
      test_recurring_id
    ),
    (
      service_two_id,
      test_church_id,
      service_two_date,
      time '09:00',
      'Sunday Test',
      test_recurring_id
    ),
    (
      service_three_id,
      test_church_id,
      service_three_date,
      time '09:00',
      'Sunday Test',
      test_recurring_id
    );

  insert into public.assignments (service_id, role, person_name)
  values
    (service_one_id, 'Piano', ''),
    (service_two_id, 'Piano', ''),
    (service_three_id, 'Piano', '');

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', caller_id,
      'role', 'authenticated'
    )::text,
    true
  );

  select result.preview
  into preview_result
  from public.auto_assign_service_slots(
    test_church_id,
    'fill_empty',
    true,
    null,
    null,
    array[service_one_id]
  ) as result;

  if preview_result->0->>'member_id' <> available_member_id::text
    or coalesce(
      (preview_result->0->>'preference_override')::boolean,
      true
    ) then
    raise exception 'Non-avoiding candidate was not preferred';
  end if;

  delete from public.member_roles as member_role
  where member_role.member_id = available_member_id
    and member_role.role_id = test_role_id;

  select result.preview
  into preview_result
  from public.auto_assign_service_slots(
    test_church_id,
    'fill_empty',
    true,
    null,
    null,
    array[service_two_id]
  ) as result;

  if preview_result->0->>'member_id' <> preferred_member_id::text
    or not coalesce(
      (preview_result->0->>'preference_override')::boolean,
      false
    ) then
    raise exception 'Avoiding candidate was not used as the eligible fallback';
  end if;

  insert into public.member_roles (member_id, role_id)
  values (available_member_id, test_role_id);

  insert into public.member_unavailability (member_id, unavailable_date)
  values (preferred_member_id, service_three_date);

  select result.preview
  into preview_result
  from public.auto_assign_service_slots(
    test_church_id,
    'fill_empty',
    true,
    null,
    null,
    array[service_three_id]
  ) as result;

  if preview_result->0->>'member_id' <> available_member_id::text then
    raise exception 'Hard unavailability did not block the preferred member';
  end if;

  -- This intentionally omits recurring_service_id to represent a released
  -- client. The inference trigger must still identify the source safely.
  select public.create_services_with_assignments_batch(
    test_church_id,
    jsonb_build_array(
      jsonb_build_object(
        'date', service_one_date,
        'service_type', 'Sunday Test',
        'notes', null,
        'roles', jsonb_build_array('Piano'),
        'time', '09:00'
      )
    )
  )
  into batch_result;

  batch_service_id := (batch_result->'services'->0->>'id')::uuid;
  if not exists (
    select 1
    from public.services as service
    where service.id = batch_service_id
      and service.recurring_service_id = test_recurring_id
  ) then
    raise exception 'Legacy batch payload did not infer its recurring source';
  end if;
end
$behavior$;
