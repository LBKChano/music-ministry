-- Package 1 behavior and RLS verification.
-- This file is self-contained and always rolls back its synthetic records.

begin;

create temporary table package_1_test_state (
  owner_id uuid not null,
  member_id uuid not null,
  outsider_id uuid not null,
  first_request_id uuid not null default gen_random_uuid(),
  second_request_id uuid not null default gen_random_uuid(),
  first_church_id uuid,
  second_church_id uuid,
  first_owner_membership_id uuid,
  first_member_membership_id uuid,
  second_member_membership_id uuid,
  first_invited_membership_id uuid,
  second_invited_membership_id uuid,
  subscription_id text not null default (
    'package-1-test-' || replace(gen_random_uuid()::text, '-', '')
  )
);

insert into package_1_test_state (
  owner_id,
  member_id,
  outsider_id
)
select
  accounts[1],
  accounts[2],
  accounts[3]
from (
  select array_agg(id order by created_at, id) as accounts
  from (
    select id, created_at
    from auth.users
    where email is not null
    order by created_at, id
    limit 3
  ) as candidates
) as selected
where cardinality(accounts) = 3;

do $assert_accounts$
begin
  if not exists (select 1 from package_1_test_state) then
    raise exception 'Package 1 tests require three Auth users with email addresses';
  end if;
end
$assert_accounts$;

grant select, update on package_1_test_state to authenticated;
grant select on package_1_test_state to service_role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', owner_id,
    'role', 'authenticated'
  )::text,
  true
)
from package_1_test_state;

set local role authenticated;

do $create_church_tests$
declare
  state package_1_test_state%rowtype;
  first_result record;
  repeated_result record;
  second_result record;
begin
  select * into state from package_1_test_state;

  select *
  into first_result
  from public.create_church_with_owner_membership(
    'Package 1 First Church',
    state.first_request_id,
    'Package 1 Owner'
  );

  select *
  into repeated_result
  from public.create_church_with_owner_membership(
    'A changed retry name must not create another church',
    state.first_request_id,
    'A changed retry owner'
  );

  if (first_result.church_record).id
    is distinct from (repeated_result.church_record).id
    or (first_result.membership_record).id
      is distinct from (repeated_result.membership_record).id
  then
    raise exception 'Church creation is not idempotent by account/request ID';
  end if;

  if (first_result.church_record).admin_id is distinct from state.owner_id
    or (first_result.membership_record).member_id is distinct from state.owner_id
    or coalesce((first_result.membership_record).is_admin, false) = false
  then
    raise exception 'Owner church and membership were not created atomically';
  end if;

  select *
  into second_result
  from public.create_church_with_owner_membership(
    'Package 1 Second Church',
    state.second_request_id,
    'Package 1 Owner'
  );

  update package_1_test_state
  set
    first_church_id = (first_result.church_record).id,
    second_church_id = (second_result.church_record).id,
    first_owner_membership_id = (first_result.membership_record).id;
end
$create_church_tests$;

do $owner_protection_test$
declare
  state package_1_test_state%rowtype;
begin
  select * into state from package_1_test_state;

  begin
    delete from public.church_members
    where id = state.first_owner_membership_id;

    raise exception 'Owner membership deletion unexpectedly succeeded';
  exception
    when insufficient_privilege then
      null;
  end;

  if not exists (
    select 1
    from public.church_members
    where id = state.first_owner_membership_id
  ) then
    raise exception 'Owner membership protection did not preserve the row';
  end if;
end
$owner_protection_test$;

reset role;

do $prepare_invitations$
declare
  state package_1_test_state%rowtype;
  member_email text;
begin
  select * into state from package_1_test_state;
  select email into member_email from auth.users where id = state.member_id;

  insert into public.church_members (
    church_id,
    email,
    name,
    is_admin
  )
  values (
    state.first_church_id,
    member_email,
    'Existing Invited Name',
    false
  )
  returning id into state.first_invited_membership_id;

  insert into public.church_members (
    church_id,
    email,
    name,
    is_admin
  )
  values (
    state.second_church_id,
    member_email,
    'Second Existing Invite',
    true
  )
  returning id into state.second_invited_membership_id;

  update package_1_test_state
  set
    first_invited_membership_id = state.first_invited_membership_id,
    second_invited_membership_id = state.second_invited_membership_id;
end
$prepare_invitations$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', member_id,
    'role', 'authenticated'
  )::text,
  true
)
from package_1_test_state;

set local role authenticated;

do $join_tests$
declare
  state package_1_test_state%rowtype;
  first_join record;
  repeated_join record;
  second_join record;
  first_code text;
  second_code text;
begin
  select * into state from package_1_test_state;

  select invitation_code
  into first_code
  from public.churches
  where id = state.first_church_id;

  select invitation_code
  into second_code
  from public.churches
  where id = state.second_church_id;

  select *
  into first_join
  from public.join_church_by_invitation(first_code, 'Changed Join Name');

  select *
  into repeated_join
  from public.join_church_by_invitation(first_code, 'Another Retry Name');

  if (first_join.membership_record).id
    is distinct from state.first_invited_membership_id
    or (repeated_join.membership_record).id
      is distinct from state.first_invited_membership_id
  then
    raise exception 'Invitation claim/retry did not preserve one membership row';
  end if;

  if (first_join.membership_record).member_id is distinct from state.member_id
    or (first_join.membership_record).name <> 'Existing Invited Name'
    or coalesce((first_join.membership_record).is_admin, false)
  then
    raise exception 'Invitation claim changed protected member identity or admin state';
  end if;

  select *
  into second_join
  from public.join_church_by_invitation(second_code, 'Package 1 Member');

  if (second_join.membership_record).id
    is distinct from state.second_invited_membership_id
    or coalesce((second_join.membership_record).is_admin, false) = false
  then
    raise exception 'Admin-prepared invitation state was not preserved';
  end if;

  update package_1_test_state
  set
    first_member_membership_id = (first_join.membership_record).id,
    second_member_membership_id = (second_join.membership_record).id;

  begin
    insert into public.church_members (
      church_id,
      member_id,
      email,
      name,
      is_admin
    )
    values (
      state.first_church_id,
      state.member_id,
      'package-1-duplicate@example.invalid',
      'Duplicate Membership',
      false
    );

    raise exception 'Duplicate non-null membership unexpectedly succeeded';
  exception
    when unique_violation then
      null;
  end;
end
$join_tests$;

do $cross_church_rls_test$
declare
  state package_1_test_state%rowtype;
begin
  select * into state from package_1_test_state;

  if exists (
    select 1
    from public.church_members
    where id = state.first_owner_membership_id
  ) then
    raise exception 'Regular member can read another account membership';
  end if;
end
$cross_church_rls_test$;

do $legacy_device_bridge_test$
declare
  state package_1_test_state%rowtype;
  claimed public.onesignal_subscriptions;
begin
  select * into state from package_1_test_state;

  select *
  into claimed
  from public.claim_onesignal_subscription(
    state.first_member_membership_id,
    state.subscription_id
  );

  if claimed.subscription_id is distinct from state.subscription_id then
    raise exception 'Legacy subscription claim failed';
  end if;

  if not exists (
    select 1
    from public.account_notification_devices as device
    where device.account_id = state.member_id
      and device.subscription_id = state.subscription_id
      and device.active = true
  ) then
    raise exception 'Legacy claim did not register an active account device';
  end if;

  begin
    perform public.resolve_notification_recipient_subscriptions(
      array[state.first_member_membership_id]
    );
    raise exception 'Authenticated clients can execute service-only recipient resolution';
  exception
    when insufficient_privilege then
      null;
  end;
end
$legacy_device_bridge_test$;

reset role;
set local role service_role;

do $recipient_resolution_test$
declare
  state package_1_test_state%rowtype;
  resolved_count integer;
begin
  select * into state from package_1_test_state;

  select count(*)
  into resolved_count
  from public.resolve_notification_recipient_subscriptions(
    array[
      state.first_member_membership_id,
      state.second_member_membership_id
    ]
  )
  where subscription_id = state.subscription_id;

  if resolved_count <> 2 then
    raise exception
      'One account device did not resolve for both church memberships: %',
      resolved_count;
  end if;
end
$recipient_resolution_test$;

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', owner_id,
    'role', 'authenticated'
  )::text,
  true
)
from package_1_test_state;

set local role authenticated;

do $membership_removal_bridge_test$
declare
  state package_1_test_state%rowtype;
  remaining_subscription_count integer;
begin
  select * into state from package_1_test_state;

  delete from public.church_members
  where id = state.first_member_membership_id;

  select
    count(*)
  into
    remaining_subscription_count
  from public.onesignal_subscriptions as subscription
  where subscription.subscription_id = state.subscription_id;

  if remaining_subscription_count <> 0 then
    raise exception
      'Membership removal bridge retained a legacy row: rows=%',
      remaining_subscription_count;
  end if;
end
$membership_removal_bridge_test$;

reset role;
set local role service_role;

do $post_removal_resolution_test$
declare
  state package_1_test_state%rowtype;
  resolved_count integer;
begin
  select * into state from package_1_test_state;

  if not exists (
    select 1
    from public.account_notification_devices as device
    where device.account_id = state.member_id
      and device.subscription_id = state.subscription_id
      and device.active = true
  ) then
    raise exception 'Membership removal incorrectly deactivated another church device';
  end if;

  select count(*)
  into resolved_count
  from public.resolve_notification_recipient_subscriptions(
    array[state.second_member_membership_id]
  )
  where subscription_id = state.subscription_id;

  if resolved_count <> 1 then
    raise exception
      'Remaining membership did not resolve the preserved account device';
  end if;
end
$post_removal_resolution_test$;

reset role;

-- Flush the deferred membership-delete cleanup to model the transaction boundary
-- between membership removal and a later device logout request.
set constraints cleanup_account_subscription_membership_delete immediate;
set constraints cleanup_account_subscription_membership_delete deferred;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', member_id,
    'role', 'authenticated'
  )::text,
  true
)
from package_1_test_state;

set local role authenticated;

do $legacy_delete_test$
declare
  state package_1_test_state%rowtype;
begin
  select * into state from package_1_test_state;

  perform public.claim_onesignal_subscription(
    state.second_member_membership_id,
    state.subscription_id
  );

  delete from public.onesignal_subscriptions
  where subscription_id = state.subscription_id;

  if exists (
    select 1
    from public.account_notification_devices as device
    where device.account_id = state.member_id
      and device.subscription_id = state.subscription_id
      and device.active = true
  ) then
    raise exception 'Legacy subscription deletion did not deactivate its device';
  end if;

  perform public.claim_onesignal_subscription(
    state.second_member_membership_id,
    state.subscription_id
  );

  if not exists (
    select 1
    from public.account_notification_devices as device
    where device.account_id = state.member_id
      and device.subscription_id = state.subscription_id
      and device.active = true
  ) then
    raise exception 'Legacy subscription reclaim did not reactivate its device';
  end if;
end
$legacy_delete_test$;

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', outsider_id,
    'role', 'authenticated'
  )::text,
  true
)
from package_1_test_state;

set local role authenticated;

do $invalid_invitation_test$
begin
  begin
    perform public.join_church_by_invitation(
      'NOT-A-REAL-CODE',
      'Package 1 Outsider'
    );
    raise exception 'Invalid invitation unexpectedly succeeded';
  exception
    when no_data_found then
      null;
  end;
end
$invalid_invitation_test$;

reset role;
rollback;
