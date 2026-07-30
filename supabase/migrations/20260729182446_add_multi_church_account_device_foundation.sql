-- Package 1: additive multi-church and account-device foundation.
-- Existing tables, RPC signatures, policies, and legacy notification paths
-- remain available to released clients.

set lock_timeout = '10s';
set statement_timeout = '120s';

create schema if not exists private;

do $preflight$
declare
  duplicate_membership_groups integer;
  conflicting_owner_rows integer;
  owners_without_email integer;
  ambiguous_owner_invites integer;
begin
  select count(*)
  into duplicate_membership_groups
  from (
    select church_id, member_id
    from public.church_members
    where member_id is not null
    group by church_id, member_id
    having count(*) > 1
  ) as duplicates;

  if duplicate_membership_groups > 0 then
    raise exception
      'Package 1 blocked: % duplicate non-null church membership group(s) require manual review',
      duplicate_membership_groups
      using errcode = '23505';
  end if;

  select count(*)
  into owners_without_email
  from public.churches as church
  join auth.users as owner on owner.id = church.admin_id
  where owner.email is null
    and not exists (
      select 1
      from public.church_members as membership
      where membership.church_id = church.id
        and membership.member_id = church.admin_id
    );

  if owners_without_email > 0 then
    raise exception
      'Package 1 blocked: % church owner(s) need an Auth email before membership backfill',
      owners_without_email
      using errcode = '23502';
  end if;

  select count(*)
  into ambiguous_owner_invites
  from (
    select church.id
    from public.churches as church
    join auth.users as owner on owner.id = church.admin_id
    join public.church_members as membership
      on membership.church_id = church.id
     and membership.member_id is null
     and lower(btrim(membership.email)) = lower(btrim(owner.email))
    where not exists (
      select 1
      from public.church_members as owner_membership
      where owner_membership.church_id = church.id
        and owner_membership.member_id = church.admin_id
    )
    group by church.id
    having count(*) > 1
  ) as ambiguous;

  if ambiguous_owner_invites > 0 then
    raise exception
      'Package 1 blocked: % church owner(s) have multiple matching unclaimed rows',
      ambiguous_owner_invites
      using errcode = '23505';
  end if;

  select count(*)
  into conflicting_owner_rows
  from public.churches as church
  join auth.users as owner on owner.id = church.admin_id
  join public.church_members as membership
    on membership.church_id = church.id
   and lower(btrim(membership.email)) = lower(btrim(owner.email))
   and membership.member_id is distinct from church.admin_id
   and membership.member_id is not null
  where not exists (
    select 1
    from public.church_members as owner_membership
    where owner_membership.church_id = church.id
      and owner_membership.member_id = church.admin_id
  );

  if conflicting_owner_rows > 0 then
    raise exception
      'Package 1 blocked: % owner membership backfill conflict(s) require manual review',
      conflicting_owner_rows
      using errcode = '23505';
  end if;
end
$preflight$;

-- Claim a matching unlinked owner row first, preserving its existing identity
-- fields and roles.
update public.church_members as membership
set
  member_id = church.admin_id,
  is_admin = true,
  role = case
    when nullif(btrim(membership.role), '') is null then 'Admin'
    else membership.role
  end
from public.churches as church
join auth.users as owner on owner.id = church.admin_id
where membership.church_id = church.id
  and membership.member_id is null
  and lower(btrim(membership.email)) = lower(btrim(owner.email))
  and not exists (
    select 1
    from public.church_members as existing
    where existing.church_id = church.id
      and existing.member_id = church.admin_id
  );

insert into public.church_members (
  church_id,
  member_id,
  email,
  name,
  role,
  is_admin
)
select
  church.id,
  church.admin_id,
  owner.email,
  coalesce(
    nullif(btrim(owner.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(owner.email, '@', 1), ''),
    'Church Admin'
  ),
  'Admin',
  true
from public.churches as church
join auth.users as owner on owner.id = church.admin_id
where not exists (
  select 1
  from public.church_members as membership
  where membership.church_id = church.id
    and membership.member_id = church.admin_id
);

update public.church_members as membership
set
  is_admin = true,
  role = case
    when nullif(btrim(membership.role), '') is null then 'Admin'
    else membership.role
  end
from public.churches as church
where membership.church_id = church.id
  and membership.member_id = church.admin_id
  and (
    coalesce(membership.is_admin, false) = false
    or nullif(btrim(membership.role), '') is null
  );

create unique index if not exists church_members_church_account_key
on public.church_members (church_id, member_id)
where member_id is not null;

create or replace function private.protect_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  owner_account_id uuid;
begin
  -- Service-role and direct maintenance work have no end-user auth.uid().
  -- Authenticated app requests always carry one and must preserve the owner.
  if (select auth.uid()) is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select church.admin_id
  into owner_account_id
  from public.churches as church
  where church.id = old.church_id;

  if owner_account_id is null or old.member_id is distinct from owner_account_id then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'The church owner membership cannot be deleted'
      using errcode = '42501';
  end if;

  if new.church_id is distinct from old.church_id
    or new.member_id is distinct from old.member_id
    or coalesce(new.is_admin, false) = false
  then
    raise exception 'The church owner membership identity and admin access are protected'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function private.protect_owner_membership() from public;
revoke all on function private.protect_owner_membership() from anon;
revoke all on function private.protect_owner_membership() from authenticated;

drop trigger if exists protect_owner_membership
on public.church_members;

create trigger protect_owner_membership
before update or delete
on public.church_members
for each row
execute function private.protect_owner_membership();

create table if not exists private.church_creation_requests (
  account_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  church_id uuid not null references public.churches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, request_id),
  unique (church_id)
);

revoke all on table private.church_creation_requests from public;
revoke all on table private.church_creation_requests from anon;
revoke all on table private.church_creation_requests from authenticated;

create or replace function private.create_church_with_owner_membership_impl(
  target_church_name text,
  target_request_id uuid,
  target_owner_name text default null
)
returns table (
  church_record public.churches,
  membership_record public.church_members
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  normalized_church_name text := btrim(target_church_name);
  normalized_owner_name text := nullif(btrim(target_owner_name), '');
  owner_email text;
  generated_invitation_code text;
  existing_church_id uuid;
  created_church public.churches;
  created_membership public.church_members;
  attempt integer;
begin
  if caller_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if target_request_id is null then
    raise exception 'A request ID is required'
      using errcode = '22023';
  end if;

  if normalized_church_name is null or normalized_church_name = '' then
    raise exception 'Church name is required'
      using errcode = '22023';
  end if;

  if char_length(normalized_church_name) > 120 then
    raise exception 'Church name must be 120 characters or fewer'
      using errcode = '22001';
  end if;

  select
    account.email,
    coalesce(
      normalized_owner_name,
      nullif(btrim(account.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(account.email, '@', 1), ''),
      'Church Admin'
    )
  into owner_email, normalized_owner_name
  from auth.users as account
  where account.id = caller_id;

  if owner_email is null then
    raise exception 'The authenticated account has no email address'
      using errcode = '23502';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(caller_id::text),
    hashtext(target_request_id::text)
  );

  select request.church_id
  into existing_church_id
  from private.church_creation_requests as request
  where request.account_id = caller_id
    and request.request_id = target_request_id;

  if existing_church_id is not null then
    select church.*
    into created_church
    from public.churches as church
    where church.id = existing_church_id;

    select membership.*
    into created_membership
    from public.church_members as membership
    where membership.church_id = existing_church_id
      and membership.member_id = caller_id;

    if created_church.id is null or created_membership.id is null then
      raise exception 'The previous church creation result is incomplete'
        using errcode = 'P0001';
    end if;

    return query select created_church, created_membership;
    return;
  end if;

  for attempt in 1..20 loop
    generated_invitation_code := upper(
      encode(extensions.gen_random_bytes(4), 'hex')
    );

    begin
      insert into public.churches (
        name,
        admin_id,
        invitation_code
      )
      values (
        normalized_church_name,
        caller_id,
        generated_invitation_code
      )
      returning * into created_church;

      exit;
    exception
      when unique_violation then
        if attempt = 20 then
          raise exception 'Could not generate a unique invitation code'
            using errcode = '23505';
        end if;
    end;
  end loop;

  insert into public.church_members (
    church_id,
    member_id,
    email,
    name,
    role,
    is_admin
  )
  values (
    created_church.id,
    caller_id,
    owner_email,
    normalized_owner_name,
    'Admin',
    true
  )
  returning * into created_membership;

  insert into private.church_creation_requests (
    account_id,
    request_id,
    church_id
  )
  values (
    caller_id,
    target_request_id,
    created_church.id
  );

  return query select created_church, created_membership;
end;
$function$;

create or replace function public.create_church_with_owner_membership(
  target_church_name text,
  target_request_id uuid,
  target_owner_name text default null
)
returns table (
  church_record public.churches,
  membership_record public.church_members
)
language sql
security invoker
set search_path = ''
as $function$
  select *
  from private.create_church_with_owner_membership_impl(
    target_church_name,
    target_request_id,
    target_owner_name
  );
$function$;

revoke all on function private.create_church_with_owner_membership_impl(text, uuid, text) from public;
revoke all on function private.create_church_with_owner_membership_impl(text, uuid, text) from anon;
grant execute on function private.create_church_with_owner_membership_impl(text, uuid, text) to authenticated;

revoke all on function public.create_church_with_owner_membership(text, uuid, text) from public;
revoke all on function public.create_church_with_owner_membership(text, uuid, text) from anon;
grant execute on function public.create_church_with_owner_membership(text, uuid, text) to authenticated;

create or replace function private.join_church_by_invitation_impl(
  target_invitation_code text,
  target_member_name text default null
)
returns table (
  church_record public.churches,
  membership_record public.church_members
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  normalized_invitation_code text := upper(btrim(target_invitation_code));
  normalized_member_name text := nullif(btrim(target_member_name), '');
  account_email text;
  selected_church public.churches;
  selected_membership public.church_members;
begin
  if caller_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if normalized_invitation_code is null or normalized_invitation_code = '' then
    raise exception 'Invitation code is required'
      using errcode = '22023';
  end if;

  select
    account.email,
    coalesce(
      normalized_member_name,
      nullif(btrim(account.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(account.email, '@', 1), ''),
      'Member'
    )
  into account_email, normalized_member_name
  from auth.users as account
  where account.id = caller_id;

  if account_email is null then
    raise exception 'The authenticated account has no email address'
      using errcode = '23502';
  end if;

  select church.*
  into selected_church
  from public.churches as church
  where upper(btrim(church.invitation_code)) = normalized_invitation_code
  for update;

  if selected_church.id is null then
    raise exception 'Invitation code is invalid'
      using errcode = 'P0002';
  end if;

  select membership.*
  into selected_membership
  from public.church_members as membership
  where membership.church_id = selected_church.id
    and membership.member_id = caller_id
  limit 1;

  if selected_membership.id is not null then
    return query select selected_church, selected_membership;
    return;
  end if;

  select membership.*
  into selected_membership
  from public.church_members as membership
  where membership.church_id = selected_church.id
    and membership.member_id is null
    and lower(btrim(membership.email)) = lower(btrim(account_email))
  order by membership.created_at, membership.id
  limit 1
  for update;

  if selected_membership.id is not null then
    update public.church_members as membership
    set
      member_id = caller_id,
      name = coalesce(
        nullif(btrim(membership.name), ''),
        normalized_member_name
      ),
      is_admin = case
        when selected_church.admin_id = caller_id then true
        else coalesce(membership.is_admin, false)
      end,
      role = case
        when selected_church.admin_id = caller_id
          and nullif(btrim(membership.role), '') is null
          then 'Admin'
        else membership.role
      end
    where membership.id = selected_membership.id
    returning * into selected_membership;
  else
    insert into public.church_members (
      church_id,
      member_id,
      email,
      name,
      role,
      is_admin
    )
    values (
      selected_church.id,
      caller_id,
      account_email,
      normalized_member_name,
      case when selected_church.admin_id = caller_id then 'Admin' else null end,
      selected_church.admin_id = caller_id
    )
    returning * into selected_membership;
  end if;

  return query select selected_church, selected_membership;
end;
$function$;

create or replace function public.join_church_by_invitation(
  target_invitation_code text,
  target_member_name text default null
)
returns table (
  church_record public.churches,
  membership_record public.church_members
)
language sql
security invoker
set search_path = ''
as $function$
  select *
  from private.join_church_by_invitation_impl(
    target_invitation_code,
    target_member_name
  );
$function$;

revoke all on function private.join_church_by_invitation_impl(text, text) from public;
revoke all on function private.join_church_by_invitation_impl(text, text) from anon;
grant execute on function private.join_church_by_invitation_impl(text, text) to authenticated;

revoke all on function public.join_church_by_invitation(text, text) from public;
revoke all on function public.join_church_by_invitation(text, text) from anon;
grant execute on function public.join_church_by_invitation(text, text) to authenticated;

create table if not exists public.account_notification_devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  subscription_id text not null unique,
  platform text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint account_notification_devices_subscription_not_blank
    check (btrim(subscription_id) <> '')
);

create index if not exists account_notification_devices_account_active_idx
on public.account_notification_devices (account_id, active);

alter table public.account_notification_devices enable row level security;

revoke all on table public.account_notification_devices from anon;
revoke all on table public.account_notification_devices from authenticated;
grant select on table public.account_notification_devices to authenticated;
grant all on table public.account_notification_devices to service_role;

drop policy if exists "Accounts can view own notification devices"
on public.account_notification_devices;

create policy "Accounts can view own notification devices"
on public.account_notification_devices
for select
to authenticated
using (account_id = (select auth.uid()));

create table if not exists private.notification_subscription_reanchors (
  transaction_id bigint not null,
  subscription_id text not null,
  replacement_member_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (transaction_id, subscription_id)
);

create index if not exists notification_subscription_reanchors_created_at_idx
on private.notification_subscription_reanchors (created_at);

revoke all on table private.notification_subscription_reanchors from public;
revoke all on table private.notification_subscription_reanchors from anon;
revoke all on table private.notification_subscription_reanchors from authenticated;

create or replace function private.register_account_notification_device_impl(
  target_subscription_id text,
  target_platform text default null
)
returns public.account_notification_devices
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  normalized_subscription_id text := btrim(target_subscription_id);
  normalized_platform text := nullif(lower(btrim(target_platform)), '');
  registered_device public.account_notification_devices;
begin
  if caller_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if normalized_subscription_id is null or normalized_subscription_id = '' then
    raise exception 'OneSignal subscription ID is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(normalized_subscription_id));

  insert into public.account_notification_devices (
    account_id,
    subscription_id,
    platform,
    active,
    updated_at,
    last_seen_at
  )
  values (
    caller_id,
    normalized_subscription_id,
    normalized_platform,
    true,
    now(),
    now()
  )
  on conflict (subscription_id)
  do update set
    account_id = excluded.account_id,
    platform = coalesce(excluded.platform, account_notification_devices.platform),
    active = true,
    updated_at = now(),
    last_seen_at = now()
  returning * into registered_device;

  return registered_device;
end;
$function$;

create or replace function public.register_account_notification_device(
  target_subscription_id text,
  target_platform text default null
)
returns public.account_notification_devices
language sql
security invoker
set search_path = ''
as $function$
  select *
  from private.register_account_notification_device_impl(
    target_subscription_id,
    target_platform
  );
$function$;

revoke all on function private.register_account_notification_device_impl(text, text) from public;
revoke all on function private.register_account_notification_device_impl(text, text) from anon;
grant execute on function private.register_account_notification_device_impl(text, text) to authenticated;

revoke all on function public.register_account_notification_device(text, text) from public;
revoke all on function public.register_account_notification_device(text, text) from anon;
grant execute on function public.register_account_notification_device(text, text) to authenticated;

create or replace function private.deactivate_account_notification_device_impl(
  target_subscription_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  normalized_subscription_id text := btrim(target_subscription_id);
  changed_rows integer;
begin
  if caller_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if normalized_subscription_id is null or normalized_subscription_id = '' then
    raise exception 'OneSignal subscription ID is required'
      using errcode = '22023';
  end if;

  update public.account_notification_devices as device
  set
    active = false,
    updated_at = now()
  where device.account_id = caller_id
    and device.subscription_id = normalized_subscription_id
    and device.active = true;

  get diagnostics changed_rows = row_count;
  return changed_rows > 0;
end;
$function$;

create or replace function public.deactivate_account_notification_device(
  target_subscription_id text
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.deactivate_account_notification_device_impl(
    target_subscription_id
  );
$function$;

revoke all on function private.deactivate_account_notification_device_impl(text) from public;
revoke all on function private.deactivate_account_notification_device_impl(text) from anon;
grant execute on function private.deactivate_account_notification_device_impl(text) to authenticated;

revoke all on function public.deactivate_account_notification_device(text) from public;
revoke all on function public.deactivate_account_notification_device(text) from anon;
grant execute on function public.deactivate_account_notification_device(text) to authenticated;

create or replace function private.sync_legacy_onesignal_subscription_device()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  linked_account_id uuid;
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from private.notification_subscription_reanchors as reanchor
      where reanchor.transaction_id = txid_current()
        and reanchor.subscription_id = old.subscription_id
        and exists (
          select 1
          from public.account_notification_devices as device
          join public.church_members as membership
            on membership.member_id = device.account_id
          where device.subscription_id = old.subscription_id
        )
    ) then
      return old;
    end if;

    update public.account_notification_devices as device
    set
      active = false,
      updated_at = now()
    where device.subscription_id = old.subscription_id
      and device.active = true;

    return old;
  end if;

  select membership.member_id
  into linked_account_id
  from public.church_members as membership
  where membership.id = new.member_id;

  if linked_account_id is not null then
    insert into public.account_notification_devices (
      account_id,
      subscription_id,
      active,
      updated_at,
      last_seen_at
    )
    values (
      linked_account_id,
      btrim(new.subscription_id),
      true,
      now(),
      now()
    )
    on conflict (subscription_id)
    do update set
      account_id = excluded.account_id,
      active = true,
      updated_at = now(),
      last_seen_at = now();
  end if;

  return new;
end;
$function$;

revoke all on function private.sync_legacy_onesignal_subscription_device() from public;
revoke all on function private.sync_legacy_onesignal_subscription_device() from anon;
revoke all on function private.sync_legacy_onesignal_subscription_device() from authenticated;

drop trigger if exists sync_legacy_onesignal_subscription_device_upsert
on public.onesignal_subscriptions;

create trigger sync_legacy_onesignal_subscription_device_upsert
after insert or update of member_id, subscription_id
on public.onesignal_subscriptions
for each row
execute function private.sync_legacy_onesignal_subscription_device();

drop trigger if exists sync_legacy_onesignal_subscription_device_delete
on public.onesignal_subscriptions;

create trigger sync_legacy_onesignal_subscription_device_delete
after delete
on public.onesignal_subscriptions
for each row
execute function private.sync_legacy_onesignal_subscription_device();

create or replace function private.preserve_account_subscription_on_membership_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  replacement_membership_id uuid;
begin
  if old.member_id is null then
    return old;
  end if;

  delete from private.notification_subscription_reanchors as reanchor
  where reanchor.created_at < now() - interval '1 day';

  select membership.id
  into replacement_membership_id
  from public.church_members as membership
  where membership.member_id = old.member_id
    and membership.id <> old.id
  order by membership.created_at, membership.id
  limit 1
  for update;

  if replacement_membership_id is not null then
    insert into private.notification_subscription_reanchors (
      transaction_id,
      subscription_id,
      replacement_member_id
    )
    select
      txid_current(),
      subscription.subscription_id,
      replacement_membership_id
    from public.onesignal_subscriptions as subscription
    where subscription.member_id = old.id
    on conflict (transaction_id, subscription_id)
    do update set
      replacement_member_id = excluded.replacement_member_id,
      created_at = now();
  end if;

  return old;
end;
$function$;

revoke all on function private.preserve_account_subscription_on_membership_delete() from public;
revoke all on function private.preserve_account_subscription_on_membership_delete() from anon;
revoke all on function private.preserve_account_subscription_on_membership_delete() from authenticated;

drop trigger if exists preserve_account_subscription_on_membership_delete
on public.church_members;

create trigger preserve_account_subscription_on_membership_delete
before delete
on public.church_members
for each row
execute function private.preserve_account_subscription_on_membership_delete();

create or replace function private.cleanup_account_subscription_membership_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from private.notification_subscription_reanchors as reanchor
  where reanchor.transaction_id = txid_current();

  return old;
end;
$function$;

revoke all on function private.cleanup_account_subscription_membership_delete() from public;
revoke all on function private.cleanup_account_subscription_membership_delete() from anon;
revoke all on function private.cleanup_account_subscription_membership_delete() from authenticated;

drop trigger if exists cleanup_account_subscription_membership_delete
on public.church_members;

create constraint trigger cleanup_account_subscription_membership_delete
after delete
on public.church_members
deferrable initially deferred
for each row
execute function private.cleanup_account_subscription_membership_delete();

insert into public.account_notification_devices (
  account_id,
  subscription_id,
  active,
  created_at,
  updated_at,
  last_seen_at
)
select
  membership.member_id,
  btrim(subscription.subscription_id),
  true,
  coalesce(subscription.updated_at, now()),
  coalesce(subscription.updated_at, now()),
  coalesce(subscription.updated_at, now())
from public.onesignal_subscriptions as subscription
join public.church_members as membership
  on membership.id = subscription.member_id
where membership.member_id is not null
on conflict (subscription_id)
do update set
  account_id = excluded.account_id,
  active = true,
  updated_at = greatest(
    account_notification_devices.updated_at,
    excluded.updated_at
  ),
  last_seen_at = greatest(
    account_notification_devices.last_seen_at,
    excluded.last_seen_at
  );

create or replace function public.resolve_notification_recipient_subscriptions(
  target_member_ids uuid[]
)
returns table (
  member_id uuid,
  subscription_id text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with target_members as (
    select
      membership.id as member_id,
      membership.member_id as account_id
    from public.church_members as membership
    where membership.id = any(
      coalesce(target_member_ids, array[]::uuid[])
    )
  ),
  resolved as (
    select
      target.member_id,
      device.subscription_id
    from target_members as target
    join public.account_notification_devices as device
      on device.account_id = target.account_id
     and device.active = true
    where target.account_id is not null

    union

    select
      target.member_id,
      subscription.subscription_id
    from target_members as target
    join public.onesignal_subscriptions as subscription
      on subscription.member_id = target.member_id
    left join public.account_notification_devices as device
      on device.subscription_id = subscription.subscription_id
    where device.id is null
       or device.active = true
  )
  select distinct
    resolved.member_id,
    resolved.subscription_id
  from resolved
  where nullif(btrim(resolved.subscription_id), '') is not null;
$function$;

revoke all on function public.resolve_notification_recipient_subscriptions(uuid[]) from public;
revoke all on function public.resolve_notification_recipient_subscriptions(uuid[]) from anon;
revoke all on function public.resolve_notification_recipient_subscriptions(uuid[]) from authenticated;
grant execute on function public.resolve_notification_recipient_subscriptions(uuid[]) to service_role;

-- Reviewed rollback:
-- Keep the owner membership backfill and uniqueness index; removing them would
-- reintroduce invalid state. New RPCs/table can be retired only after new
-- clients stop using them. Dropping the trigger restores the legacy
-- subscription lifecycle without deleting any onesignal_subscriptions rows.
