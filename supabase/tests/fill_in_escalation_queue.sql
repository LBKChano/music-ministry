-- Package 19 durable queue behavior verification. Always rolls back fixtures.

begin;

create temporary table package_19_test_state (
  owner_account_id uuid not null,
  church_id uuid not null default gen_random_uuid(),
  requester_member_id uuid not null default gen_random_uuid(),
  replacement_member_id uuid not null default gen_random_uuid(),
  future_service_id uuid not null default gen_random_uuid(),
  past_service_id uuid not null default gen_random_uuid(),
  not_due_assignment_id uuid not null default gen_random_uuid(),
  due_assignment_id uuid not null default gen_random_uuid(),
  cancelled_assignment_id uuid not null default gen_random_uuid(),
  past_assignment_id uuid not null default gen_random_uuid(),
  stale_assignment_id uuid not null default gen_random_uuid(),
  not_due_request_id uuid not null default gen_random_uuid(),
  due_request_id uuid not null default gen_random_uuid(),
  cancelled_request_id uuid not null default gen_random_uuid(),
  past_request_id uuid not null default gen_random_uuid(),
  stale_request_id uuid not null default gen_random_uuid(),
  first_worker uuid not null default gen_random_uuid(),
  second_worker uuid not null default gen_random_uuid()
);

insert into package_19_test_state (owner_account_id)
select id from auth.users order by created_at, id limit 1;

do $assert_account$
begin
  if not exists (select 1 from package_19_test_state) then
    raise exception 'Package 19 tests require one Auth user';
  end if;
end
$assert_account$;

grant select on package_19_test_state to service_role;

set local role service_role;

insert into public.churches (id, name, admin_id, invitation_code)
select church_id, 'Package 19 Church', owner_account_id,
  'P19' || substr(replace(church_id::text, '-', ''), 1, 8)
from package_19_test_state;

insert into public.church_members (id, church_id, email, name, is_admin, member_id)
select requester_member_id, church_id, 'p19-requester@example.test', 'P19 Requester', false, owner_account_id
from package_19_test_state
union all
select replacement_member_id, church_id, 'p19-replacement@example.test', 'P19 Replacement', false, null
from package_19_test_state;

insert into public.services (id, church_id, date, time, service_type)
select future_service_id, church_id, current_date + 2, time '10:00', 'Future Service'
from package_19_test_state
union all
select past_service_id, church_id, current_date - 1, time '10:00', 'Past Service'
from package_19_test_state;

insert into public.assignments (id, service_id, member_id, role, person_name)
select not_due_assignment_id, future_service_id, requester_member_id, 'Keys', 'P19 Requester'
from package_19_test_state
union all
select due_assignment_id, future_service_id, requester_member_id, 'Keys', 'P19 Requester'
from package_19_test_state
union all
select cancelled_assignment_id, future_service_id, requester_member_id, 'Keys', 'P19 Requester'
from package_19_test_state
union all
select past_assignment_id, past_service_id, requester_member_id, 'Keys', 'P19 Requester'
from package_19_test_state
union all
select stale_assignment_id, future_service_id, requester_member_id, 'Keys', 'P19 Requester'
from package_19_test_state;

insert into public.fill_in_requests (
  id, assignment_id, service_id, church_id, requesting_member_id,
  role_name, status, created_at, updated_at
)
select not_due_request_id, not_due_assignment_id, future_service_id, church_id,
  requester_member_id, 'Keys', 'pending', clock_timestamp() - interval '2 hours 59 minutes', clock_timestamp()
from package_19_test_state
union all
select due_request_id, due_assignment_id, future_service_id, church_id,
  requester_member_id, 'Keys', 'pending', clock_timestamp() - interval '3 hours', clock_timestamp()
from package_19_test_state
union all
select cancelled_request_id, cancelled_assignment_id, future_service_id, church_id,
  requester_member_id, 'Keys', 'pending', clock_timestamp() - interval '4 hours', clock_timestamp()
from package_19_test_state
union all
select past_request_id, past_assignment_id, past_service_id, church_id,
  requester_member_id, 'Keys', 'pending', clock_timestamp() - interval '4 hours', clock_timestamp()
from package_19_test_state
union all
select stale_request_id, stale_assignment_id, future_service_id, church_id,
  requester_member_id, 'Keys', 'pending', clock_timestamp() - interval '4 hours', clock_timestamp()
from package_19_test_state;

update public.fill_in_requests request
set status = 'cancelled'
from package_19_test_state state
where request.id = state.cancelled_request_id;

update public.assignments assignment
set role = 'Vocals'
from package_19_test_state state
where assignment.id = state.stale_assignment_id;

create temporary table package_19_first_claims as
select claimed.*
from package_19_test_state state
cross join lateral public.claim_due_fill_in_escalations(
  state.first_worker,
  25,
  120
) claimed;

do $claim_tests$
declare
  state package_19_test_state%rowtype;
  first_claim record;
  second_claim_count integer;
  recheck_count integer;
begin
  select * into state from package_19_test_state;

  if exists (
    select 1 from package_19_first_claims
    where fill_in_request_id = state.not_due_request_id
  ) then
    raise exception '2h59 request was claimed early';
  end if;

  select * into first_claim
  from package_19_first_claims
  where fill_in_request_id = state.due_request_id;

  if first_claim.fill_in_request_id is distinct from state.due_request_id then
    raise exception '3h request was not claimed';
  end if;

  select count(*) into second_claim_count
  from public.claim_due_fill_in_escalations(state.second_worker, 25, 120)
  where fill_in_request_id = state.due_request_id;
  if second_claim_count <> 0 then
    raise exception 'Overlapping worker claimed an active lease';
  end if;

  select count(*) into recheck_count
  from public.recheck_fill_in_escalation(state.due_request_id, state.first_worker)
  where requesting_member_id = state.requester_member_id;
  if recheck_count <> 1 then
    raise exception 'Final relevance check returned the wrong request context';
  end if;

  if not public.release_fill_in_escalation(
    state.due_request_id,
    state.first_worker,
    'simulated OneSignal failure'
  ) then
    raise exception 'Leased delivery could not be released';
  end if;

  select * into first_claim
  from public.claim_due_fill_in_escalations(state.second_worker, 25, 120)
  where fill_in_request_id = state.due_request_id;
  if first_claim.attempt_count <> 2 then
    raise exception 'Released delivery was not retried';
  end if;

  if not public.complete_fill_in_escalation(
    state.due_request_id,
    state.second_worker,
    '{"sent":2}'::jsonb
  ) then
    raise exception 'Successful delivery was not finalized';
  end if;
  if public.complete_fill_in_escalation(
    state.due_request_id,
    state.second_worker,
    '{"sent":2}'::jsonb
  ) then
    raise exception 'Successful delivery was finalized more than once';
  end if;

end
$claim_tests$;

reset role;

do $skip_tests$
declare
  state package_19_test_state%rowtype;
begin
  select * into state from package_19_test_state;
  if exists (
    select 1 from private.fill_in_escalation_deliveries delivery
    where delivery.fill_in_request_id in (
      state.cancelled_request_id,
      state.past_request_id,
      state.stale_request_id
    )
      and delivery.state <> 'skipped'
  ) then
    raise exception 'Cancelled, past, or stale requests were not skipped';
  end if;
end
$skip_tests$;

rollback;
