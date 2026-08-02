-- Package 18 role-scoped auto-assignment behavior verification.
-- Synthetic records and function calls are always rolled back.

begin;

create temporary table package_18_test_state (
  owner_account_id uuid not null,
  church_id uuid not null default gen_random_uuid(),
  keys_role_id uuid not null default gen_random_uuid(),
  vocals_role_id uuid not null default gen_random_uuid(),
  drums_role_id uuid not null default gen_random_uuid(),
  unused_role_id uuid not null default gen_random_uuid(),
  keys_member_id uuid not null default gen_random_uuid(),
  second_keys_member_id uuid not null default gen_random_uuid(),
  vocals_member_id uuid not null default gen_random_uuid(),
  drums_member_id uuid not null default gen_random_uuid(),
  all_roles_service_id uuid not null default gen_random_uuid(),
  reassign_service_id uuid not null default gen_random_uuid(),
  unavailable_service_id uuid not null default gen_random_uuid(),
  unused_service_id uuid not null default gen_random_uuid(),
  stale_service_id uuid not null default gen_random_uuid(),
  keys_assignment_id uuid not null default gen_random_uuid(),
  vocals_assignment_id uuid not null default gen_random_uuid(),
  reassign_keys_assignment_id uuid not null default gen_random_uuid(),
  reassign_vocals_assignment_id uuid not null default gen_random_uuid(),
  unavailable_assignment_id uuid not null default gen_random_uuid(),
  unused_assignment_id uuid not null default gen_random_uuid(),
  stale_assignment_id uuid not null default gen_random_uuid(),
  stale_preview_token text,
  deleted_role_preview_token text
);

insert into package_18_test_state (owner_account_id)
select id
from auth.users
where email is not null
order by created_at, id
limit 1;

do $assert_account$
begin
  if not exists (select 1 from package_18_test_state) then
    raise exception 'Package 18 tests require one Auth user with an email address';
  end if;
end
$assert_account$;

grant select, update on package_18_test_state to authenticated, service_role;
set local role service_role;

insert into public.churches (id, name, admin_id, invitation_code)
select church_id, 'Package 18 Church', owner_account_id,
  'P18' || substr(replace(church_id::text, '-', ''), 1, 8)
from package_18_test_state;

insert into public.church_roles (id, church_id, name, display_order)
select keys_role_id, church_id, 'Keys', 0 from package_18_test_state
union all
select vocals_role_id, church_id, 'Vocals', 1 from package_18_test_state
union all
select drums_role_id, church_id, 'Drums', 2 from package_18_test_state
union all
select unused_role_id, church_id, 'Unused Role', 3 from package_18_test_state;

insert into public.church_members (id, church_id, email, name, is_admin)
select keys_member_id, church_id, 'p18-keys-a@example.test', 'Keys A', false
from package_18_test_state
union all
select second_keys_member_id, church_id, 'p18-keys-b@example.test', 'Keys B', false
from package_18_test_state
union all
select vocals_member_id, church_id, 'p18-vocals@example.test', 'Vocals Member', false
from package_18_test_state
union all
select drums_member_id, church_id, 'p18-drums@example.test', 'Drums Member', false
from package_18_test_state;

insert into public.member_roles (member_id, role_id)
select keys_member_id, keys_role_id from package_18_test_state
union all
select second_keys_member_id, keys_role_id from package_18_test_state
union all
select vocals_member_id, vocals_role_id from package_18_test_state
union all
select drums_member_id, drums_role_id from package_18_test_state;

insert into public.services (id, church_id, date, time, service_type)
select all_roles_service_id, church_id, current_date + 14, time '09:00', 'All Roles'
from package_18_test_state
union all
select reassign_service_id, church_id, current_date + 21, time '09:00', 'Reassign'
from package_18_test_state
union all
select unavailable_service_id, church_id, current_date + 28, time '09:00', 'Unavailable'
from package_18_test_state
union all
select unused_service_id, church_id, current_date + 35, time '09:00', 'No Candidate'
from package_18_test_state
union all
select stale_service_id, church_id, current_date + 42, time '09:00', 'Stale Preview'
from package_18_test_state;

insert into public.assignments (id, service_id, role, member_id, person_name)
select keys_assignment_id, all_roles_service_id, 'Keys', null::uuid, ''
from package_18_test_state
union all
select vocals_assignment_id, all_roles_service_id, 'Vocals', null::uuid, ''
from package_18_test_state
union all
select reassign_keys_assignment_id, reassign_service_id, 'Keys', keys_member_id, 'Keys A'
from package_18_test_state
union all
select reassign_vocals_assignment_id, reassign_service_id, 'Vocals', vocals_member_id, 'Vocals Member'
from package_18_test_state
union all
select unavailable_assignment_id, unavailable_service_id, 'Drums', null::uuid, ''
from package_18_test_state
union all
select unused_assignment_id, unused_service_id, 'Unused Role', null::uuid, ''
from package_18_test_state
union all
select stale_assignment_id, stale_service_id, 'Keys', null::uuid, ''
from package_18_test_state;

insert into public.member_unavailability (member_id, unavailable_date, reason)
select drums_member_id, current_date + 28, 'Package 18 unavailable test'
from package_18_test_state;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', owner_account_id, 'role', 'authenticated')::text,
  true
)
from package_18_test_state;

set local role authenticated;

do $all_role_parity$
declare
  state package_18_test_state%rowtype;
  released_result jsonb;
  versioned_result jsonb;
begin
  select * into state from package_18_test_state;

  select to_jsonb(result)
  into released_result
  from public.auto_assign_service_slots(
    state.church_id,
    'fill_empty',
    true,
    null,
    null,
    array[state.all_roles_service_id]
  ) as result;

  select to_jsonb(result) - array[
    'scope_role_id',
    'scope_role_name',
    'preview_token'
  ]
  into versioned_result
  from public.auto_assign_service_slots_v2(
    state.church_id,
    'fill_empty',
    true,
    null,
    null,
    array[state.all_roles_service_id],
    null,
    null
  ) as result;

  if released_result is distinct from versioned_result then
    raise exception 'All Roles does not preserve the released allocator output';
  end if;
end
$all_role_parity$;

do $selected_date_range$
declare
  state package_18_test_state%rowtype;
  result record;
begin
  select * into state from package_18_test_state;
  select * into result
  from public.auto_assign_service_slots_v2(
    state.church_id,
    'fill_empty',
    true,
    current_date + 14,
    current_date + 14,
    null,
    state.keys_role_id,
    null
  );

  if result.open_slot_count <> 1
    or result.preview->0->>'service_id' <> state.all_roles_service_id::text
    or result.preview->0->>'role' <> 'Keys' then
    raise exception 'Selected date range escaped its service or role scope';
  end if;
end
$selected_date_range$;

do $scoped_fill_empty$
declare
  state package_18_test_state%rowtype;
  result record;
  applied record;
begin
  select * into state from package_18_test_state;

  select * into result
  from public.auto_assign_service_slots_v2(
    state.church_id,
    'fill_empty',
    true,
    null,
    null,
    array[state.all_roles_service_id],
    state.keys_role_id,
    null
  );

  if result.open_slot_count <> 1
    or result.assigned_count <> 1
    or result.scope_role_name <> 'Keys'
    or result.preview->0->>'role' <> 'Keys' then
    raise exception 'Fill Empty preview was not restricted to Keys';
  end if;

  select * into applied
  from public.auto_assign_service_slots_v2(
    state.church_id,
    'fill_empty',
    false,
    null,
    null,
    array[state.all_roles_service_id],
    state.keys_role_id,
    result.preview_token
  );

  if applied.preview is distinct from result.preview
    or applied.skipped_report is distinct from result.skipped_report
    or applied.assigned_count is distinct from result.assigned_count
    or applied.open_slot_count is distinct from result.open_slot_count then
    raise exception 'Scoped Fill Empty preview and apply results diverged';
  end if;

  if not exists (
    select 1 from public.assignments
    where id = state.keys_assignment_id and member_id is not null
  ) then
    raise exception 'Scoped Fill Empty did not assign the selected role';
  end if;

  if exists (
    select 1 from public.assignments
    where id = state.vocals_assignment_id and member_id is not null
  ) then
    raise exception 'Scoped Fill Empty modified an unrelated role';
  end if;
end
$scoped_fill_empty$;

do $scoped_reassign$
declare
  state package_18_test_state%rowtype;
  result record;
  applied record;
  unrelated_before jsonb;
  unrelated_after jsonb;
begin
  select * into state from package_18_test_state;
  select to_jsonb(assignment.*) into unrelated_before
  from public.assignments as assignment
  where assignment.id = state.reassign_vocals_assignment_id;

  select * into result
  from public.auto_assign_service_slots_v2(
    state.church_id,
    'reassign_all',
    true,
    null,
    null,
    array[state.reassign_service_id],
    state.keys_role_id,
    null
  );

  if result.open_slot_count <> 1
    or result.cleared_count <> 1
    or result.preview->0->>'role' <> 'Keys' then
    raise exception 'Reassign All preview was not restricted to Keys';
  end if;

  select * into applied
  from public.auto_assign_service_slots_v2(
    state.church_id,
    'reassign_all',
    false,
    null,
    null,
    array[state.reassign_service_id],
    state.keys_role_id,
    result.preview_token
  );

  if applied.preview is distinct from result.preview
    or applied.skipped_report is distinct from result.skipped_report
    or applied.cleared_count is distinct from result.cleared_count then
    raise exception 'Scoped Reassign preview and apply results diverged';
  end if;

  select to_jsonb(assignment.*) into unrelated_after
  from public.assignments as assignment
  where assignment.id = state.reassign_vocals_assignment_id;

  if unrelated_before is distinct from unrelated_after then
    raise exception 'Scoped Reassign changed an unrelated role assignment';
  end if;
end
$scoped_reassign$;

do $skip_reports$
declare
  state package_18_test_state%rowtype;
  unavailable_result record;
  no_candidate_result record;
begin
  select * into state from package_18_test_state;

  select * into unavailable_result
  from public.auto_assign_service_slots_v2(
    state.church_id,
    'fill_empty',
    true,
    null,
    null,
    array[state.unavailable_service_id],
    state.drums_role_id,
    null
  );

  if unavailable_result.skipped_count <> 1
    or unavailable_result.unavailable_slot_count <> 1
    or jsonb_array_length(
      unavailable_result.skipped_report->0->'unavailable_members'
    ) <> 1 then
    raise exception 'Unavailable role scope did not preserve skipped details';
  end if;

  select * into no_candidate_result
  from public.auto_assign_service_slots_v2(
    state.church_id,
    'fill_empty',
    true,
    null,
    null,
    array[state.unused_service_id],
    state.unused_role_id,
    null
  );

  if no_candidate_result.skipped_count <> 1
    or no_candidate_result.no_role_match_count <> 1
    or no_candidate_result.skipped_report->0->>'reason'
      <> 'No members have this role' then
    raise exception 'No-candidate role scope did not preserve skipped details';
  end if;

  update package_18_test_state
  set deleted_role_preview_token = no_candidate_result.preview_token;
end
$skip_reports$;

do $capture_stale_token$
declare
  state package_18_test_state%rowtype;
  result record;
begin
  select * into state from package_18_test_state;
  select * into result
  from public.auto_assign_service_slots_v2(
    state.church_id,
    'fill_empty',
    true,
    null,
    null,
    array[state.stale_service_id],
    state.keys_role_id,
    null
  );

  update package_18_test_state set stale_preview_token = result.preview_token;
end
$capture_stale_token$;

set local role service_role;

insert into public.member_unavailability (member_id, unavailable_date, reason)
select keys_member_id, current_date + 42, 'Package 18 stale preview test'
from package_18_test_state
union all
select second_keys_member_id, current_date + 42, 'Package 18 stale preview test'
from package_18_test_state;

delete from public.church_roles as role
using package_18_test_state as state
where role.id = state.unused_role_id;

set local role authenticated;

do $stale_preview$
declare
  state package_18_test_state%rowtype;
  failure_detail text;
begin
  select * into state from package_18_test_state;

  begin
    perform *
    from public.auto_assign_service_slots_v2(
      state.church_id,
      'fill_empty',
      false,
      null,
      null,
      array[state.stale_service_id],
      state.keys_role_id,
      state.stale_preview_token
    );
    raise exception 'Stale preview was accepted';
  exception
    when serialization_failure then
      get stacked diagnostics failure_detail = pg_exception_detail;
      if failure_detail is distinct from 'stale_preview' then
        raise;
      end if;
  end;

  if exists (
    select 1 from public.assignments
    where id = state.stale_assignment_id and member_id is not null
  ) then
    raise exception 'Stale preview wrote an assignment';
  end if;
end
$stale_preview$;

do $deleted_role$
declare
  state package_18_test_state%rowtype;
  failure_detail text;
begin
  select * into state from package_18_test_state;
  begin
    perform *
    from public.auto_assign_service_slots_v2(
      state.church_id,
      'fill_empty',
      false,
      null,
      null,
      array[state.unused_service_id],
      state.unused_role_id,
      state.deleted_role_preview_token
    );
    raise exception 'A deleted preview role was accepted';
  exception
    when invalid_parameter_value then
      get stacked diagnostics failure_detail = pg_exception_detail;
      if failure_detail is distinct from 'role_not_found' then
        raise;
      end if;
  end;

  if exists (
    select 1 from public.assignments
    where id = state.unused_assignment_id and member_id is not null
  ) then
    raise exception 'Deleted-role preview wrote an assignment';
  end if;
end
$deleted_role$;

do $wrong_church_role$
declare
  state package_18_test_state%rowtype;
  failure_detail text;
begin
  select * into state from package_18_test_state;
  begin
    perform *
    from public.auto_assign_service_slots_v2(
      state.church_id,
      'fill_empty',
      true,
      null,
      null,
      array[state.all_roles_service_id],
      gen_random_uuid(),
      null
    );
    raise exception 'A role outside the church was accepted';
  exception
    when invalid_parameter_value then
      get stacked diagnostics failure_detail = pg_exception_detail;
      if failure_detail is distinct from 'role_not_found' then
        raise;
      end if;
  end;
end
$wrong_church_role$;

rollback;
