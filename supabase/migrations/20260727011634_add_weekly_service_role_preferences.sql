-- Deployed as Supabase migration 20260727011634. Weekly-service role
-- preferences are intentionally additive. Released clients
-- may continue creating services without recurring_service_id and calling the
-- existing auto-assign RPC signatures.

alter table public.services
add column if not exists recurring_service_id uuid;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_recurring_service_id_fkey'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
    add constraint services_recurring_service_id_fkey
    foreign key (recurring_service_id)
    references public.recurring_services(id)
    on delete set null;
  end if;
end
$migration$;

create index if not exists services_recurring_service_id_idx
on public.services (recurring_service_id)
where recurring_service_id is not null;

-- Backfill only when church, normalized name, weekday, and time identify one
-- recurring template. Ambiguous and legacy one-off services remain null.
with candidate_matches as (
  select
    service.id as service_id,
    recurring.id as recurring_service_id,
    count(*) over (partition by service.id) as match_count
  from public.services as service
  join public.recurring_services as recurring
    on recurring.church_id = service.church_id
   and lower(regexp_replace(trim(recurring.name), '\s+', ' ', 'g'))
     = lower(regexp_replace(trim(service.service_type), '\s+', ' ', 'g'))
   and recurring.day_of_week
     = extract(dow from service.date at time zone 'UTC')::integer
   and recurring.time = service.time
  where service.recurring_service_id is null
)
update public.services as service
set recurring_service_id = candidate.recurring_service_id
from candidate_matches as candidate
where candidate.service_id = service.id
  and candidate.match_count = 1;

create or replace function private.infer_service_recurring_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inferred_recurring_service_id uuid;
  recurring_match_count integer;
begin
  if new.recurring_service_id is not null then
    if not exists (
      select 1
      from public.recurring_services as recurring
      where recurring.id = new.recurring_service_id
        and recurring.church_id = new.church_id
    ) then
      raise exception 'Recurring service must belong to the scheduled service church'
        using errcode = '23503';
    end if;

    return new;
  end if;

  select
    (array_agg(recurring.id order by recurring.id))[1],
    count(*)
  into inferred_recurring_service_id, recurring_match_count
  from public.recurring_services as recurring
  where recurring.church_id = new.church_id
    and lower(regexp_replace(trim(recurring.name), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(new.service_type), '\s+', ' ', 'g'))
    and recurring.day_of_week
      = extract(dow from new.date at time zone 'UTC')::integer
    and recurring.time = new.time;

  if recurring_match_count = 1 then
    new.recurring_service_id := inferred_recurring_service_id;
  end if;

  return new;
end;
$$;

revoke all on function private.infer_service_recurring_source() from public;
revoke all on function private.infer_service_recurring_source() from anon;
revoke all on function private.infer_service_recurring_source() from authenticated;

drop trigger if exists infer_service_recurring_source on public.services;
create trigger infer_service_recurring_source
before insert or update of church_id, date, time, service_type, recurring_service_id
on public.services
for each row
execute function private.infer_service_recurring_source();

create table if not exists public.member_scheduling_preferences (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null
    references public.churches(id)
    on delete cascade,
  member_id uuid not null,
  recurring_service_id uuid not null
    references public.recurring_services(id)
    on delete cascade,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_scheduling_preferences_member_role_fkey
    foreign key (member_id, role_id)
    references public.member_roles(member_id, role_id)
    on delete cascade,
  constraint member_scheduling_preferences_unique
    unique (member_id, recurring_service_id, role_id)
);

create index if not exists member_scheduling_preferences_church_idx
on public.member_scheduling_preferences (church_id);

create index if not exists member_scheduling_preferences_assignment_idx
on public.member_scheduling_preferences (
  recurring_service_id,
  role_id,
  member_id
);

create or replace function private.validate_member_scheduling_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.church_members as member
    join public.member_roles as member_role
      on member_role.member_id = member.id
     and member_role.role_id = new.role_id
    join public.church_roles as role
      on role.id = member_role.role_id
     and role.church_id = member.church_id
    join public.recurring_services as recurring
      on recurring.id = new.recurring_service_id
     and recurring.church_id = member.church_id
    where member.id = new.member_id
      and member.church_id = new.church_id
      and exists (
        select 1
        from public.recurring_service_roles as recurring_role
        where recurring_role.recurring_service_id = recurring.id
          and lower(
            regexp_replace(trim(recurring_role.role_name), '\s+', ' ', 'g')
          ) = lower(
            regexp_replace(trim(role.name), '\s+', ' ', 'g')
          )
      )
  ) then
    raise exception 'Preference member, role, and recurring service must belong to one church'
      using errcode = '23503';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_member_scheduling_preference() from public;
revoke all on function private.validate_member_scheduling_preference() from anon;
revoke all on function private.validate_member_scheduling_preference() from authenticated;

drop trigger if exists validate_member_scheduling_preference
on public.member_scheduling_preferences;
create trigger validate_member_scheduling_preference
before insert or update
on public.member_scheduling_preferences
for each row
execute function private.validate_member_scheduling_preference();

alter table public.member_scheduling_preferences enable row level security;

drop policy if exists "Members and admins view scheduling preferences"
on public.member_scheduling_preferences;
create policy "Members and admins view scheduling preferences"
on public.member_scheduling_preferences
for select
to authenticated
using (
  exists (
    select 1
    from public.church_members as member
    where member.id = member_scheduling_preferences.member_id
      and member.member_id = (select auth.uid())
      and member.church_id = member_scheduling_preferences.church_id
  )
  or private.is_church_admin(member_scheduling_preferences.church_id)
);

drop policy if exists "Members add own scheduling preferences"
on public.member_scheduling_preferences;
create policy "Members add own scheduling preferences"
on public.member_scheduling_preferences
for insert
to authenticated
with check (
  exists (
    select 1
    from public.church_members as member
    join public.member_roles as member_role
      on member_role.member_id = member.id
     and member_role.role_id = member_scheduling_preferences.role_id
    join public.church_roles as role
      on role.id = member_role.role_id
     and role.church_id = member_scheduling_preferences.church_id
    join public.recurring_services as recurring
      on recurring.id = member_scheduling_preferences.recurring_service_id
     and recurring.church_id = member_scheduling_preferences.church_id
    where member.id = member_scheduling_preferences.member_id
      and member.member_id = (select auth.uid())
      and member.church_id = member_scheduling_preferences.church_id
      and exists (
        select 1
        from public.recurring_service_roles as recurring_role
        where recurring_role.recurring_service_id = recurring.id
          and lower(
            regexp_replace(trim(recurring_role.role_name), '\s+', ' ', 'g')
          ) = lower(
            regexp_replace(trim(role.name), '\s+', ' ', 'g')
          )
      )
  )
);

drop policy if exists "Members delete own scheduling preferences"
on public.member_scheduling_preferences;
create policy "Members delete own scheduling preferences"
on public.member_scheduling_preferences
for delete
to authenticated
using (
  exists (
    select 1
    from public.church_members as member
    where member.id = member_scheduling_preferences.member_id
      and member.member_id = (select auth.uid())
      and member.church_id = member_scheduling_preferences.church_id
  )
);

revoke all on table public.member_scheduling_preferences from public;
revoke all on table public.member_scheduling_preferences from anon;
grant select, insert, delete
on table public.member_scheduling_preferences
to authenticated;

alter table public.member_scheduling_preferences replica identity full;

do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'member_scheduling_preferences'
  ) then
    alter publication supabase_realtime
    add table public.member_scheduling_preferences;
  end if;
end
$migration$;

-- Teach the existing batch RPC about the optional recurring_service_id JSON
-- key without changing its public signature or any required payload key.
do $migration$
declare
  function_sql text;
  updated_sql text;
  old_fragment text;
  new_fragment text;
begin
  select pg_get_functiondef(
    'private.create_services_with_assignments_batch_impl(uuid,jsonb)'::regprocedure
  )
  into function_sql;

  old_fragment := $old$
  service_notes text;
  role_values jsonb;
$old$;
  new_fragment := $new$
  service_notes text;
  recurring_service_id uuid;
  role_values jsonb;
$new$;

  if position(old_fragment in function_sql) = 0 then
    raise exception 'Could not add recurring source variable to batch service creation';
  end if;
  updated_sql := replace(function_sql, old_fragment, new_fragment);

  old_fragment := $old$
    service_notes := nullif(draft->>'notes', '');
    service_time := nullif(draft->>'time', '')::time;
$old$;
  new_fragment := $new$
    service_notes := nullif(draft->>'notes', '');
    recurring_service_id := nullif(draft->>'recurring_service_id', '')::uuid;
    service_time := nullif(draft->>'time', '')::time;
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not read recurring source in batch service creation';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
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
$old$;
  new_fragment := $new$
    insert into public.services (
      church_id,
      date,
      time,
      service_type,
      notes,
      recurring_service_id
    )
    values (
      target_church_id,
      service_date,
      service_time,
      service_type,
      service_notes,
      recurring_service_id
    )
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not add recurring source to batch service insert';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  execute updated_sql;
end
$migration$;

-- Add the soft preference tier to the current live auto-assignment
-- implementation. Hard unavailability and same-service checks still filter
-- candidates before this ordering is applied.
do $migration$
declare
  function_sql text;
  updated_sql text;
  old_fragment text;
  new_fragment text;
begin
  select pg_get_functiondef(
    'private.auto_assign_service_slots_impl(uuid,text,boolean,date,date,uuid[])'::regprocedure
  )
  into function_sql;

  old_fragment := $old$
  selected_member_name text;
  slot_normalized_role text;
$old$;
  new_fragment := $new$
  selected_member_name text;
  selected_preference_override boolean;
  slot_normalized_role text;
$new$;

  if position(old_fragment in function_sql) = 0 then
    raise exception 'Could not add auto-assign preference state';
  end if;
  updated_sql := replace(function_sql, old_fragment, new_fragment);

  old_fragment := $old$
  create temp table if not exists pg_temp.auto_assign_service_scope (
    id uuid primary key,
    date date not null,
    time text,
    service_type text not null
  ) on commit drop;
$old$;
  new_fragment := $new$
  create temp table if not exists pg_temp.auto_assign_service_scope (
    id uuid primary key,
    date date not null,
    time text,
    service_type text not null,
    recurring_service_id uuid
  ) on commit drop;
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not add recurring source to auto-assign scope';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
    current_member_id uuid,
    current_person_name text
  ) on commit drop;
$old$;
  new_fragment := $new$
    current_member_id uuid,
    current_person_name text,
    preference_override boolean not null default false
  ) on commit drop;
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not add preference metadata to auto-assign preview';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
  insert into pg_temp.auto_assign_service_scope (id, date, time, service_type)
  select s.id, s.date, s.time, s.service_type
$old$;
  new_fragment := $new$
  insert into pg_temp.auto_assign_service_scope (
    id,
    date,
    time,
    service_type,
    recurring_service_id
  )
  select s.id, s.date, s.time, s.service_type, s.recurring_service_id
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not load recurring source into auto-assign scope';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
    select ss.id, ss.date, ss.time, ss.service_type
    from pg_temp.auto_assign_service_scope ss
$old$;
  new_fragment := $new$
    select
      ss.id,
      ss.date,
      ss.time,
      ss.service_type,
      ss.recurring_service_id
    from pg_temp.auto_assign_service_scope ss
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not expose recurring source to auto-assign loop';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
      selected_member_id := null;
      selected_member_name := null;

      select
        role_candidates.id,
        coalesce(nullif(trim(role_candidates.name), ''), role_candidates.email) as display_name
      into selected_member_id, selected_member_name
$old$;
  new_fragment := $new$
      selected_member_id := null;
      selected_member_name := null;
      selected_preference_override := false;

      select
        role_candidates.id,
        coalesce(nullif(trim(role_candidates.name), ''), role_candidates.email) as display_name,
        preference.preference_override
      into
        selected_member_id,
        selected_member_name,
        selected_preference_override
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not select auto-assign preference metadata';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
      left join pg_temp.auto_assign_run_role_counts rrc
        on rrc.member_id = role_candidates.id
       and rrc.normalized_role = slot_normalized_role
      where not exists (
$old$;
  new_fragment := $new$
      left join pg_temp.auto_assign_run_role_counts rrc
        on rrc.member_id = role_candidates.id
       and rrc.normalized_role = slot_normalized_role
      cross join lateral (
        select (
          service_rec.recurring_service_id is not null
          and exists (
            select 1
            from public.member_scheduling_preferences as preference_row
            join public.church_roles as preference_role
              on preference_role.id = preference_row.role_id
            where preference_row.church_id = target_church_id
              and preference_row.member_id = role_candidates.id
              and preference_row.recurring_service_id
                = service_rec.recurring_service_id
              and lower(
                regexp_replace(trim(preference_role.name), '\s+', ' ', 'g')
              ) = slot_normalized_role
          )
        ) as preference_override
      ) as preference
      where not exists (
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not join auto-assign scheduling preferences';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
      order by
        -- Avoid the same member on consecutive services for this role whenever
$old$;
  new_fragment := $new$
      order by
        -- A soft preference is considered before fairness and spacing, but only
        -- after hard eligibility filters have removed unavailable candidates.
        preference.preference_override asc,
        -- Avoid the same member on consecutive services for this role whenever
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not add preference tier to auto-assign priority';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
        current_member_id,
        current_person_name
      )
      values (
$old$;
  new_fragment := $new$
        current_member_id,
        current_person_name,
        preference_override
      )
      values (
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not add preference field to auto-assign preview insert';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
        slot_rec.current_member_id,
        slot_rec.current_person_name
      );
$old$;
  new_fragment := $new$
        slot_rec.current_member_id,
        slot_rec.current_person_name,
        coalesce(selected_preference_override, false)
      );
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not save preference metadata in auto-assign preview';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
        'current_member_id', planned.current_member_id,
        'current_person_name', planned.current_person_name
$old$;
  new_fragment := $new$
        'current_member_id', planned.current_member_id,
        'current_person_name', planned.current_person_name,
        'preference_override', planned.preference_override
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not return auto-assign preference metadata';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  execute updated_sql;
end
$migration$;

-- Reviewed rollback:
-- alter publication supabase_realtime
--   drop table public.member_scheduling_preferences;
-- drop table if exists public.member_scheduling_preferences;
-- drop trigger if exists infer_service_recurring_source on public.services;
-- drop function if exists private.infer_service_recurring_source();
-- alter table public.services drop column if exists recurring_service_id;
-- Auto-assign and batch-function rollback should restore their immediately
-- preceding definitions rather than dropping their public signatures.
