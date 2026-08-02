-- Package 17 role-aware manual assignment behavior verification.
-- Requires five Auth users and always rolls back synthetic records.

begin;

create temporary table package_17_test_state (
  owner_account_id uuid not null,
  first_role_account_id uuid not null,
  second_role_account_id uuid not null,
  non_role_account_id uuid not null,
  outsider_account_id uuid not null,
  church_id uuid not null default gen_random_uuid(),
  other_church_id uuid not null default gen_random_uuid(),
  role_id uuid not null default gen_random_uuid(),
  other_role_id uuid not null default gen_random_uuid(),
  owner_member_id uuid not null default gen_random_uuid(),
  first_role_member_id uuid not null default gen_random_uuid(),
  second_role_member_id uuid not null default gen_random_uuid(),
  non_role_member_id uuid not null default gen_random_uuid(),
  outsider_member_id uuid not null default gen_random_uuid(),
  cross_church_member_id uuid not null default gen_random_uuid(),
  service_id uuid not null default gen_random_uuid(),
  second_service_id uuid not null default gen_random_uuid(),
  assignment_id uuid not null default gen_random_uuid(),
  conflict_assignment_id uuid not null default gen_random_uuid(),
  unavailable_assignment_id uuid not null default gen_random_uuid(),
  stale_assignment_id uuid not null default gen_random_uuid()
);

insert into package_17_test_state (
  owner_account_id,
  first_role_account_id,
  second_role_account_id,
  non_role_account_id,
  outsider_account_id
)
select accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]
from (
  select array_agg(id order by created_at, id) as accounts
  from (
    select id, created_at
    from auth.users
    where email is not null
    order by created_at, id
    limit 5
  ) as available_accounts
) as selected
where cardinality(accounts) = 5;

do $assert_accounts$
begin
  if not exists (select 1 from package_17_test_state) then
    raise exception 'Package 17 tests require five Auth users with email addresses';
  end if;
end
$assert_accounts$;

grant select on package_17_test_state to authenticated;
grant select on package_17_test_state to service_role;

set local role service_role;

insert into public.churches (id, name, admin_id, invitation_code)
select church_id, 'Package 17 Church', owner_account_id,
  'P17' || substr(replace(church_id::text, '-', ''), 1, 8)
from package_17_test_state;

insert into public.churches (id, name, admin_id, invitation_code)
select other_church_id, 'Package 17 Other Church', outsider_account_id,
  'P18' || substr(replace(other_church_id::text, '-', ''), 1, 8)
from package_17_test_state;

insert into public.church_roles (id, church_id, name, display_order)
select role_id, church_id, 'Keys', 0
from package_17_test_state
union all
select other_role_id, church_id, 'Vocals', 1
from package_17_test_state;

insert into public.church_roles (church_id, name, display_order)
select other_church_id, 'Keys', 0
from package_17_test_state;

insert into public.church_members (
  id,
  church_id,
  member_id,
  email,
  name,
  is_admin
)
select owner_member_id, church_id, owner_account_id,
  'package17-owner@example.test', 'Admin Role Member', true
from package_17_test_state
union all
select first_role_member_id, church_id, first_role_account_id,
  'package17-first@example.test', 'Duplicate Name', false
from package_17_test_state
union all
select second_role_member_id, church_id, second_role_account_id,
  'package17-second@example.test', 'Duplicate Name', false
from package_17_test_state
union all
select non_role_member_id, church_id, non_role_account_id,
  'package17-non-role@example.test', 'No Matching Role', false
from package_17_test_state
union all
select outsider_member_id, church_id, outsider_account_id,
  'package17-outsider@example.test', 'Regular Member Caller', false
from package_17_test_state;

insert into public.church_members (
  id,
  church_id,
  member_id,
  email,
  name,
  is_admin
)
select cross_church_member_id, other_church_id, first_role_account_id,
  'package17-cross@example.test', 'Cross Church Member', false
from package_17_test_state;

insert into public.member_roles (member_id, role_id)
select owner_member_id, role_id from package_17_test_state
union all
select first_role_member_id, role_id from package_17_test_state
union all
select second_role_member_id, role_id from package_17_test_state
union all
select first_role_member_id, other_role_id from package_17_test_state
union all
select non_role_member_id, other_role_id from package_17_test_state;

insert into public.member_roles (member_id, role_id)
select state.cross_church_member_id, role.id
from package_17_test_state as state
join public.church_roles as role
  on role.church_id = state.other_church_id
  and role.name = 'Keys';

insert into public.services (
  id,
  church_id,
  date,
  time,
  service_type
)
select service_id, church_id, date '2026-08-09', time '10:00', 'Sunday Service'
from package_17_test_state
union all
select second_service_id, church_id, date '2026-08-16', time '10:00', 'Sunday Service'
from package_17_test_state;

insert into public.assignments (id, service_id, role, person_name)
select assignment_id, service_id, 'Keys', '' from package_17_test_state
union all
select conflict_assignment_id, service_id, 'Vocals', '' from package_17_test_state
union all
select unavailable_assignment_id, second_service_id, 'Keys', '' from package_17_test_state
union all
select stale_assignment_id, second_service_id, 'Keys', '' from package_17_test_state;

insert into public.member_unavailability (member_id, unavailable_date, reason)
select second_role_member_id, date '2026-08-16', 'Package 17 test'
from package_17_test_state;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', owner_account_id,
    'role', 'authenticated'
  )::text,
  true
)
from package_17_test_state;

set local role authenticated;

do $candidate_tests$
declare
  state package_17_test_state%rowtype;
  candidate_count integer;
  unavailable_reason text;
  first_duplicate uuid;
  expected_first_duplicate uuid;
begin
  select * into state from package_17_test_state;

  select count(*) into candidate_count
  from public.get_manual_assignment_candidates_v1(state.assignment_id);

  if candidate_count <> 3 then
    raise exception 'Candidate RPC did not return exactly the three Keys members';
  end if;

  if exists (
    select 1
    from public.get_manual_assignment_candidates_v1(state.assignment_id)
    where member_id in (state.non_role_member_id, state.cross_church_member_id)
  ) then
    raise exception 'Candidate RPC leaked a non-role or cross-church member';
  end if;

  if not exists (
    select 1
    from public.get_manual_assignment_candidates_v1(state.assignment_id)
    where member_id = state.owner_member_id
      and eligible
  ) then
    raise exception 'An admin with the slot role was omitted';
  end if;

  select reason_code into unavailable_reason
  from public.get_manual_assignment_candidates_v1(state.unavailable_assignment_id)
  where member_id = state.second_role_member_id;

  if unavailable_reason is distinct from 'unavailable_date' then
    raise exception 'Unavailable member was not blocked by date';
  end if;

  select member_id into first_duplicate
  from public.get_manual_assignment_candidates_v1(state.assignment_id)
  where display_name = 'Duplicate Name'
  order by display_name, member_id
  limit 1;

  expected_first_duplicate := least(
    state.first_role_member_id,
    state.second_role_member_id
  );
  if first_duplicate is distinct from expected_first_duplicate then
    raise exception 'Duplicate names do not use member ID as a stable tie-breaker';
  end if;
end
$candidate_tests$;

do $valid_assignment_test$
declare
  state package_17_test_state%rowtype;
  assigned public.assignments;
begin
  select * into state from package_17_test_state;
  select * into assigned
  from public.assign_member_to_slot_v2(
    state.assignment_id,
    state.first_role_member_id,
    state.service_id,
    date '2026-08-09',
    state.role_id
  );

  if assigned.member_id is distinct from state.first_role_member_id
    or assigned.person_name is distinct from 'Duplicate Name' then
    raise exception 'Valid role member was not assigned atomically';
  end if;
end
$valid_assignment_test$;

do $rejection_tests$
declare
  state package_17_test_state%rowtype;
  failure_detail text;
begin
  select * into state from package_17_test_state;

  begin
    perform public.assign_member_to_slot_v2(
      state.unavailable_assignment_id,
      state.second_role_member_id,
      state.second_service_id,
      date '2026-08-16',
      state.role_id
    );
    raise exception 'Unavailable member assignment unexpectedly succeeded';
  exception when others then
    get stacked diagnostics failure_detail = PG_EXCEPTION_DETAIL;
    if failure_detail is distinct from 'unavailable_date' then raise; end if;
  end;

  begin
    perform public.assign_member_to_slot_v2(
      state.unavailable_assignment_id,
      state.non_role_member_id,
      state.second_service_id,
      date '2026-08-16',
      state.role_id
    );
    raise exception 'Non-role member assignment unexpectedly succeeded';
  exception when others then
    get stacked diagnostics failure_detail = PG_EXCEPTION_DETAIL;
    if failure_detail is distinct from 'role_mismatch' then raise; end if;
  end;

  begin
    perform public.assign_member_to_slot_v2(
      state.unavailable_assignment_id,
      state.cross_church_member_id,
      state.second_service_id,
      date '2026-08-16',
      state.role_id
    );
    raise exception 'Cross-church member assignment unexpectedly succeeded';
  exception when others then
    get stacked diagnostics failure_detail = PG_EXCEPTION_DETAIL;
    if failure_detail is distinct from 'member_not_found' then raise; end if;
  end;

  begin
    perform public.assign_member_to_slot_v2(
      state.conflict_assignment_id,
      state.first_role_member_id,
      state.service_id,
      date '2026-08-09',
      state.other_role_id
    );
    raise exception 'Same-service duplicate unexpectedly succeeded';
  exception when others then
    get stacked diagnostics failure_detail = PG_EXCEPTION_DETAIL;
    if failure_detail is distinct from 'same_service_conflict' then raise; end if;
  end;

  begin
    perform public.assign_member_to_slot_v2(
      state.stale_assignment_id,
      state.first_role_member_id,
      state.second_service_id,
      date '2026-08-23',
      state.role_id
    );
    raise exception 'Stale service date unexpectedly succeeded';
  exception when others then
    get stacked diagnostics failure_detail = PG_EXCEPTION_DETAIL;
    if failure_detail is distinct from 'stale_assignment' then raise; end if;
  end;
end
$rejection_tests$;

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', outsider_account_id,
    'role', 'authenticated'
  )::text,
  true
)
from package_17_test_state;

set local role authenticated;

do $unauthorized_test$
declare
  state package_17_test_state%rowtype;
  failure_detail text;
begin
  select * into state from package_17_test_state;
  begin
    perform *
    from public.get_manual_assignment_candidates_v1(state.assignment_id);
    raise exception 'Regular member unexpectedly loaded admin candidates';
  exception when others then
    get stacked diagnostics failure_detail = PG_EXCEPTION_DETAIL;
    if failure_detail is distinct from 'not_church_admin' then raise; end if;
  end;
end
$unauthorized_test$;

reset role;
set local role service_role;

delete from public.church_members
where id = (
  select second_role_member_id from package_17_test_state
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', owner_account_id,
    'role', 'authenticated'
  )::text,
  true
)
from package_17_test_state;

set local role authenticated;

do $deleted_member_test$
declare
  state package_17_test_state%rowtype;
begin
  select * into state from package_17_test_state;
  if exists (
    select 1
    from public.get_manual_assignment_candidates_v1(state.assignment_id)
    where member_id = state.second_role_member_id
  ) then
    raise exception 'Deleted member remained in the candidate list';
  end if;
end
$deleted_member_test$;

rollback;
