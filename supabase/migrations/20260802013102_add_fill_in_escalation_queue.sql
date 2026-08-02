create schema if not exists private;

create table private.fill_in_escalation_deliveries (
  fill_in_request_id uuid primary key
    references public.fill_in_requests(id) on delete cascade,
  eligible_at timestamptz not null,
  state text not null default 'pending'
    check (state in ('pending', 'leased', 'sent', 'skipped')),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  skipped_at timestamptz,
  last_error text,
  last_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (state = 'leased' and lease_token is not null and lease_expires_at is not null)
    or state <> 'leased'
  )
);

comment on table private.fill_in_escalation_deliveries is
  'Private one-time delivery queue for unresolved fill-in reminders.';

create index fill_in_escalation_deliveries_due_idx
on private.fill_in_escalation_deliveries (eligible_at, lease_expires_at)
where state in ('pending', 'leased');

revoke all on table private.fill_in_escalation_deliveries from public, anon, authenticated;

create or replace function private.queue_fill_in_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    insert into private.fill_in_escalation_deliveries (
      fill_in_request_id,
      eligible_at
    ) values (
      new.id,
      new.created_at + interval '3 hours'
    )
    on conflict (fill_in_request_id) do update
    set eligible_at = excluded.eligible_at,
        state = case
          when private.fill_in_escalation_deliveries.state = 'sent' then 'sent'
          else 'pending'
        end,
        lease_token = null,
        lease_expires_at = null,
        skipped_at = null,
        last_error = null,
        updated_at = clock_timestamp();
  end if;

  return new;
end;
$$;

revoke all on function private.queue_fill_in_escalation() from public, anon, authenticated;

drop trigger if exists queue_fill_in_escalation on public.fill_in_requests;
create trigger queue_fill_in_escalation
after insert or update of status on public.fill_in_requests
for each row
when (new.status = 'pending')
execute function private.queue_fill_in_escalation();

insert into private.fill_in_escalation_deliveries (
  fill_in_request_id,
  eligible_at
)
select
  request.id,
  request.created_at + interval '3 hours'
from public.fill_in_requests request
where request.status = 'pending'
on conflict (fill_in_request_id) do nothing;

create or replace function public.claim_due_fill_in_escalations(
  worker_token uuid,
  max_count integer default 25,
  lease_seconds integer default 120
)
returns table (
  fill_in_request_id uuid,
  eligible_at timestamptz,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  effective_limit integer := greatest(1, least(coalesce(max_count, 25), 100));
  effective_lease_seconds integer := greatest(30, least(coalesce(lease_seconds, 120), 600));
begin
  if worker_token is null then
    raise exception 'worker_token is required';
  end if;

  update private.fill_in_escalation_deliveries delivery
  set state = 'skipped',
      lease_token = null,
      lease_expires_at = null,
      skipped_at = clock_timestamp(),
      last_error = case
        when request.status <> 'pending' then 'request_not_pending'
        when service.id is null then 'service_missing'
        when assignment.id is null then 'assignment_missing'
        when assignment.member_id is distinct from request.requesting_member_id then 'assignment_reassigned'
        when assignment.service_id is distinct from request.service_id then 'assignment_service_changed'
        when lower(regexp_replace(trim(assignment.role), '\\s+', ' ', 'g'))
          <> lower(regexp_replace(trim(request.role_name), '\\s+', ' ', 'g')) then 'assignment_role_changed'
        when service.church_id is distinct from request.church_id then 'service_church_changed'
        else 'service_is_past'
      end,
      updated_at = clock_timestamp()
  from public.fill_in_requests request
  left join public.services service on service.id = request.service_id
  left join public.assignments assignment on assignment.id = request.assignment_id
  where delivery.fill_in_request_id = request.id
    and delivery.eligible_at <= clock_timestamp()
    and (
      delivery.state = 'pending'
      or (delivery.state = 'leased' and delivery.lease_expires_at <= clock_timestamp())
    )
    and not (
      request.status = 'pending'
      and service.id is not null
      and assignment.id is not null
      and assignment.member_id = request.requesting_member_id
      and assignment.service_id = request.service_id
      and lower(regexp_replace(trim(assignment.role), '\\s+', ' ', 'g'))
        = lower(regexp_replace(trim(request.role_name), '\\s+', ' ', 'g'))
      and service.church_id = request.church_id
      and (
        service.date::date > current_date
        or (
          service.date::date = current_date
          and coalesce(service.time, time '23:59:59') > localtime
        )
      )
    );

  return query
  with due as (
    select delivery.fill_in_request_id
    from private.fill_in_escalation_deliveries delivery
    join public.fill_in_requests request on request.id = delivery.fill_in_request_id
    join public.services service on service.id = request.service_id
    join public.assignments assignment on assignment.id = request.assignment_id
    where delivery.eligible_at <= clock_timestamp()
      and (
        delivery.state = 'pending'
        or (delivery.state = 'leased' and delivery.lease_expires_at <= clock_timestamp())
      )
      and request.status = 'pending'
      and assignment.member_id = request.requesting_member_id
      and assignment.service_id = request.service_id
      and lower(regexp_replace(trim(assignment.role), '\\s+', ' ', 'g'))
        = lower(regexp_replace(trim(request.role_name), '\\s+', ' ', 'g'))
      and service.church_id = request.church_id
      and (
        service.date::date > current_date
        or (
          service.date::date = current_date
          and coalesce(service.time, time '23:59:59') > localtime
        )
      )
    order by delivery.eligible_at, delivery.fill_in_request_id
    for update of delivery skip locked
    limit effective_limit
  ), claimed as (
    update private.fill_in_escalation_deliveries delivery
    set state = 'leased',
        lease_token = worker_token,
        lease_expires_at = clock_timestamp() + make_interval(secs => effective_lease_seconds),
        attempt_count = delivery.attempt_count + 1,
        last_error = null,
        updated_at = clock_timestamp()
    from due
    where delivery.fill_in_request_id = due.fill_in_request_id
    returning delivery.fill_in_request_id, delivery.eligible_at, delivery.attempt_count
  )
  select claimed.fill_in_request_id, claimed.eligible_at, claimed.attempt_count
  from claimed
  order by claimed.eligible_at, claimed.fill_in_request_id;
end;
$$;

create or replace function public.recheck_fill_in_escalation(
  target_fill_in_request_id uuid,
  worker_token uuid
)
returns table (
  fill_in_request_id uuid,
  assignment_id uuid,
  service_id uuid,
  church_id uuid,
  requesting_member_id uuid,
  role_name text,
  reason text,
  request_created_at timestamptz,
  church_name text,
  church_owner_user_id uuid,
  requester_name text,
  requester_email text,
  service_date timestamptz,
  service_time time,
  service_type text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_fill_in_request_id is null or worker_token is null then
    return;
  end if;

  if not exists (
    select 1
    from private.fill_in_escalation_deliveries delivery
    join public.fill_in_requests request on request.id = delivery.fill_in_request_id
    join public.services service on service.id = request.service_id
    join public.assignments assignment on assignment.id = request.assignment_id
    where delivery.fill_in_request_id = target_fill_in_request_id
      and delivery.state = 'leased'
      and delivery.lease_token = worker_token
      and delivery.lease_expires_at > clock_timestamp()
      and request.status = 'pending'
      and assignment.member_id = request.requesting_member_id
      and assignment.service_id = request.service_id
      and lower(regexp_replace(trim(assignment.role), '\\s+', ' ', 'g'))
        = lower(regexp_replace(trim(request.role_name), '\\s+', ' ', 'g'))
      and service.church_id = request.church_id
      and (
        service.date::date > current_date
        or (
          service.date::date = current_date
          and coalesce(service.time, time '23:59:59') > localtime
        )
      )
  ) then
    update private.fill_in_escalation_deliveries delivery
    set state = 'skipped',
        lease_token = null,
        lease_expires_at = null,
        skipped_at = clock_timestamp(),
        last_error = 'request_no_longer_relevant',
        updated_at = clock_timestamp()
    where delivery.fill_in_request_id = target_fill_in_request_id
      and delivery.state = 'leased'
      and delivery.lease_token = worker_token;
    return;
  end if;

  return query
  select
    request.id,
    request.assignment_id,
    request.service_id,
    request.church_id,
    request.requesting_member_id,
    request.role_name,
    request.reason,
    request.created_at,
    church.name,
    church.admin_id,
    member.name,
    member.email,
    service.date,
    service.time,
    service.service_type
  from private.fill_in_escalation_deliveries delivery
  join public.fill_in_requests request on request.id = delivery.fill_in_request_id
  join public.churches church on church.id = request.church_id
  join public.church_members member on member.id = request.requesting_member_id
  join public.services service on service.id = request.service_id
  where delivery.fill_in_request_id = target_fill_in_request_id
    and delivery.state = 'leased'
    and delivery.lease_token = worker_token;
end;
$$;

create or replace function public.complete_fill_in_escalation(
  target_fill_in_request_id uuid,
  worker_token uuid,
  delivery_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update private.fill_in_escalation_deliveries delivery
  set state = 'sent',
      lease_token = null,
      lease_expires_at = null,
      sent_at = clock_timestamp(),
      last_error = null,
      last_result = coalesce(delivery_result, '{}'::jsonb),
      updated_at = clock_timestamp()
  where delivery.fill_in_request_id = target_fill_in_request_id
    and delivery.state = 'leased'
    and delivery.lease_token = worker_token;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.release_fill_in_escalation(
  target_fill_in_request_id uuid,
  worker_token uuid,
  failure_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update private.fill_in_escalation_deliveries delivery
  set state = 'pending',
      lease_token = null,
      lease_expires_at = null,
      last_error = left(coalesce(failure_message, 'delivery_failed'), 1000),
      updated_at = clock_timestamp()
  where delivery.fill_in_request_id = target_fill_in_request_id
    and delivery.state = 'leased'
    and delivery.lease_token = worker_token;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.get_fill_in_escalation_diagnostics()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pending', count(*) filter (where state = 'pending'),
    'due', count(*) filter (
      where state = 'pending' and eligible_at <= clock_timestamp()
    ),
    'leased', count(*) filter (where state = 'leased'),
    'sent', count(*) filter (where state = 'sent'),
    'skipped', count(*) filter (where state = 'skipped'),
    'retried', count(*) filter (where attempt_count > 1),
    'failed', count(*) filter (where state = 'pending' and last_error is not null)
  )
  from private.fill_in_escalation_deliveries;
$$;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'fill_in_escalation_cron_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'fill_in_escalation_cron_secret',
      'Authenticates the delayed fill-in reminder cron request.'
    );
  end if;
end;
$$;

create or replace function public.verify_fill_in_escalation_cron_secret(
  candidate_secret text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    extensions.digest(coalesce(candidate_secret, ''), 'sha256') =
      extensions.digest(secret.decrypted_secret, 'sha256'),
    false
  )
  from vault.decrypted_secrets secret
  where secret.name = 'fill_in_escalation_cron_secret'
  limit 1;
$$;

revoke all on function public.claim_due_fill_in_escalations(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.recheck_fill_in_escalation(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_fill_in_escalation(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.release_fill_in_escalation(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_fill_in_escalation_diagnostics()
  from public, anon, authenticated;
revoke all on function public.verify_fill_in_escalation_cron_secret(text)
  from public, anon, authenticated;

grant execute on function public.claim_due_fill_in_escalations(uuid, integer, integer)
  to service_role;
grant execute on function public.recheck_fill_in_escalation(uuid, uuid)
  to service_role;
grant execute on function public.complete_fill_in_escalation(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.release_fill_in_escalation(uuid, uuid, text)
  to service_role;
grant execute on function public.get_fill_in_escalation_diagnostics()
  to service_role;
grant execute on function public.verify_fill_in_escalation_cron_secret(text)
  to service_role;
