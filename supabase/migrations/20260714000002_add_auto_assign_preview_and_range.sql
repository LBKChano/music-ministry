drop function if exists public.auto_assign_service_slots(uuid, text, boolean, date, date, uuid[]);
drop function if exists public.auto_assign_service_slots(uuid, text);
drop function if exists private.auto_assign_service_slots_impl(uuid, text);
drop function if exists private.auto_assign_service_slots_impl(uuid, text, boolean, date, date, uuid[]);

create or replace function private.auto_assign_service_slots_impl(
  target_church_id uuid,
  assignment_mode text,
  dry_run boolean,
  target_start_date date,
  target_end_date date,
  target_service_ids uuid[]
)
returns table (
  assigned_count integer,
  open_slot_count integer,
  skipped_count integer,
  no_role_match_count integer,
  unavailable_slot_count integer,
  unavailable_candidate_count integer,
  same_service_conflict_count integer,
  cleared_count integer,
  preview jsonb
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_mode text := coalesce(nullif(trim(assignment_mode), ''), 'fill_empty');
  effective_start_date date := greatest(coalesce(target_start_date, current_date), current_date);
  effective_end_date date := target_end_date;
  has_service_filter boolean := coalesce(array_length(target_service_ids, 1), 0) > 0;
  service_rec record;
  slot_rec record;
  selected_member_id uuid;
  selected_member_name text;
  slot_normalized_role text;
  rejected_unavailable integer;
  same_service_conflicts_for_slot integer;
  has_role_candidates boolean;
begin
  if normalized_mode not in ('fill_empty', 'reassign_all') then
    raise exception 'Invalid assignment mode: %', assignment_mode
      using errcode = '22023';
  end if;

  if effective_end_date is not null and effective_end_date < effective_start_date then
    raise exception 'End date must be on or after start date'
      using errcode = '22023';
  end if;

  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can auto-assign services'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_church_id::text));

  assigned_count := 0;
  open_slot_count := 0;
  skipped_count := 0;
  no_role_match_count := 0;
  unavailable_slot_count := 0;
  unavailable_candidate_count := 0;
  same_service_conflict_count := 0;
  cleared_count := 0;
  preview := '[]'::jsonb;

  create temp table if not exists pg_temp.auto_assign_service_scope (
    id uuid primary key,
    date date not null,
    time text,
    service_type text not null
  ) on commit drop;

  create temp table if not exists pg_temp.auto_assign_member_counts (
    member_id uuid primary key,
    total_count integer not null default 0,
    last_assigned_date date
  ) on commit drop;

  create temp table if not exists pg_temp.auto_assign_member_role_counts (
    normalized_role text not null,
    member_id uuid not null,
    role_count integer not null default 0,
    last_assigned_date date,
    primary key (normalized_role, member_id)
  ) on commit drop;

  create temp table if not exists pg_temp.auto_assign_preview (
    assignment_id uuid primary key,
    service_id uuid not null,
    service_date date not null,
    service_time text,
    service_type text not null,
    role text not null,
    member_id uuid not null,
    person_name text not null,
    current_member_id uuid,
    current_person_name text
  ) on commit drop;

  truncate table pg_temp.auto_assign_service_scope;
  truncate table pg_temp.auto_assign_member_counts;
  truncate table pg_temp.auto_assign_member_role_counts;
  truncate table pg_temp.auto_assign_preview;

  insert into pg_temp.auto_assign_service_scope (id, date, time, service_type)
  select s.id, s.date, s.time, s.service_type
  from public.services s
  where s.church_id = target_church_id
    and s.date >= current_date
    and (
      (has_service_filter and s.id = any(target_service_ids))
      or (
        not has_service_filter
        and s.date >= effective_start_date
        and (effective_end_date is null or s.date <= effective_end_date)
      )
    );

  insert into pg_temp.auto_assign_member_counts (member_id)
  select cm.id
  from public.church_members cm
  where cm.church_id = target_church_id;

  if normalized_mode = 'reassign_all' then
    if dry_run then
      select count(*)::integer
      into cleared_count
      from public.assignments a
      join pg_temp.auto_assign_service_scope ss on ss.id = a.service_id
      where a.member_id is not null;
    else
      update public.assignments a
      set member_id = null,
          person_name = ''
      from pg_temp.auto_assign_service_scope ss
      where ss.id = a.service_id
        and a.member_id is not null;

      get diagnostics cleared_count = row_count;
    end if;
  end if;

  insert into pg_temp.auto_assign_member_counts (member_id, total_count, last_assigned_date)
  select
    a.member_id,
    count(*)::integer,
    max(s.date)::date
  from public.assignments a
  join public.services s on s.id = a.service_id
  where s.church_id = target_church_id
    and s.date >= current_date
    and a.member_id is not null
    and not (
      normalized_mode = 'reassign_all'
      and exists (
        select 1
        from pg_temp.auto_assign_service_scope ss
        where ss.id = s.id
      )
    )
  group by a.member_id
  on conflict (member_id) do update
  set total_count = excluded.total_count,
      last_assigned_date = excluded.last_assigned_date;

  insert into pg_temp.auto_assign_member_role_counts (
    normalized_role,
    member_id,
    role_count,
    last_assigned_date
  )
  select
    lower(regexp_replace(trim(a.role), '\s+', ' ', 'g')) as normalized_role,
    a.member_id,
    count(*)::integer,
    max(s.date)::date
  from public.assignments a
  join public.services s on s.id = a.service_id
  where s.church_id = target_church_id
    and s.date >= current_date
    and a.member_id is not null
    and nullif(trim(a.role), '') is not null
    and not (
      normalized_mode = 'reassign_all'
      and exists (
        select 1
        from pg_temp.auto_assign_service_scope ss
        where ss.id = s.id
      )
    )
  group by lower(regexp_replace(trim(a.role), '\s+', ' ', 'g')), a.member_id
  on conflict (normalized_role, member_id) do update
  set role_count = excluded.role_count,
      last_assigned_date = excluded.last_assigned_date;

  for service_rec in
    select ss.id, ss.date, ss.time, ss.service_type
    from pg_temp.auto_assign_service_scope ss
    order by ss.date asc, ss.time asc nulls last, ss.id asc
  loop
    for slot_rec in
      select
        a.id,
        a.role,
        a.member_id as current_member_id,
        a.person_name as current_person_name,
        lower(regexp_replace(trim(a.role), '\s+', ' ', 'g')) as normalized_role
      from public.assignments a
      where a.service_id = service_rec.id
        and nullif(trim(a.role), '') is not null
        and (
          normalized_mode = 'reassign_all'
          or a.member_id is null
        )
      order by a.role asc, a.id asc
    loop
      open_slot_count := open_slot_count + 1;
      slot_normalized_role := slot_rec.normalized_role;
      rejected_unavailable := 0;

      select exists (
        select 1
        from (
          select cm.id
          from public.church_members cm
          join public.member_roles mr on mr.member_id = cm.id
          join public.church_roles cr on cr.id = mr.role_id
          where cm.church_id = target_church_id
            and lower(regexp_replace(trim(cr.name), '\s+', ' ', 'g')) = slot_normalized_role

          union

          select cm.id
          from public.church_members cm
          where cm.church_id = target_church_id
            and cm.role is not null
            and lower(regexp_replace(trim(cm.role), '\s+', ' ', 'g')) = slot_normalized_role
        ) role_candidates
      ) into has_role_candidates;

      if not has_role_candidates then
        skipped_count := skipped_count + 1;
        no_role_match_count := no_role_match_count + 1;
        continue;
      end if;

      select count(*)::integer
      into rejected_unavailable
      from (
        select cm.id
        from public.church_members cm
        join public.member_roles mr on mr.member_id = cm.id
        join public.church_roles cr on cr.id = mr.role_id
        where cm.church_id = target_church_id
          and lower(regexp_replace(trim(cr.name), '\s+', ' ', 'g')) = slot_normalized_role

        union

        select cm.id
        from public.church_members cm
        where cm.church_id = target_church_id
          and cm.role is not null
          and lower(regexp_replace(trim(cm.role), '\s+', ' ', 'g')) = slot_normalized_role
      ) role_candidates
      where exists (
        select 1
        from public.member_unavailability mu
        where mu.member_id = role_candidates.id
          and mu.unavailable_date = service_rec.date
      );

      unavailable_candidate_count := unavailable_candidate_count + coalesce(rejected_unavailable, 0);

      select count(*)::integer
      into same_service_conflicts_for_slot
      from (
        select cm.id
        from public.church_members cm
        join public.member_roles mr on mr.member_id = cm.id
        join public.church_roles cr on cr.id = mr.role_id
        where cm.church_id = target_church_id
          and lower(regexp_replace(trim(cr.name), '\s+', ' ', 'g')) = slot_normalized_role

        union

        select cm.id
        from public.church_members cm
        where cm.church_id = target_church_id
          and cm.role is not null
          and lower(regexp_replace(trim(cm.role), '\s+', ' ', 'g')) = slot_normalized_role
      ) role_candidates
      where exists (
        select 1
        from public.assignments service_assignment
        where service_assignment.service_id = service_rec.id
          and service_assignment.member_id = role_candidates.id
          and normalized_mode <> 'reassign_all'
      )
      or exists (
        select 1
        from pg_temp.auto_assign_preview planned
        where planned.service_id = service_rec.id
          and planned.member_id = role_candidates.id
      );

      same_service_conflict_count :=
        same_service_conflict_count + coalesce(same_service_conflicts_for_slot, 0);

      selected_member_id := null;
      selected_member_name := null;

      select
        role_candidates.id,
        coalesce(nullif(trim(role_candidates.name), ''), role_candidates.email) as display_name
      into selected_member_id, selected_member_name
      from (
        select cm.id, cm.name, cm.email
        from public.church_members cm
        join public.member_roles mr on mr.member_id = cm.id
        join public.church_roles cr on cr.id = mr.role_id
        where cm.church_id = target_church_id
          and lower(regexp_replace(trim(cr.name), '\s+', ' ', 'g')) = slot_normalized_role

        union

        select cm.id, cm.name, cm.email
        from public.church_members cm
        where cm.church_id = target_church_id
          and cm.role is not null
          and lower(regexp_replace(trim(cm.role), '\s+', ' ', 'g')) = slot_normalized_role
      ) role_candidates
      left join pg_temp.auto_assign_member_counts mc on mc.member_id = role_candidates.id
      left join pg_temp.auto_assign_member_role_counts mrc
        on mrc.member_id = role_candidates.id
       and mrc.normalized_role = slot_normalized_role
      where not exists (
          select 1
          from public.member_unavailability mu
          where mu.member_id = role_candidates.id
            and mu.unavailable_date = service_rec.date
        )
        and (
          normalized_mode = 'reassign_all'
          or not exists (
            select 1
            from public.assignments service_assignment
            where service_assignment.service_id = service_rec.id
              and service_assignment.member_id = role_candidates.id
          )
        )
        and not exists (
          select 1
          from pg_temp.auto_assign_preview planned
          where planned.service_id = service_rec.id
            and planned.member_id = role_candidates.id
        )
      order by
        coalesce(mrc.role_count, 0) asc,
        coalesce(mc.total_count, 0) asc,
        mrc.last_assigned_date asc nulls first,
        mc.last_assigned_date asc nulls first,
        coalesce(nullif(trim(role_candidates.name), ''), role_candidates.email) asc,
        role_candidates.id asc
      limit 1;

      if selected_member_id is null then
        skipped_count := skipped_count + 1;
        if coalesce(rejected_unavailable, 0) > 0 then
          unavailable_slot_count := unavailable_slot_count + 1;
        end if;
        continue;
      end if;

      insert into pg_temp.auto_assign_preview (
        assignment_id,
        service_id,
        service_date,
        service_time,
        service_type,
        role,
        member_id,
        person_name,
        current_member_id,
        current_person_name
      )
      values (
        slot_rec.id,
        service_rec.id,
        service_rec.date,
        service_rec.time,
        service_rec.service_type,
        slot_rec.role,
        selected_member_id,
        selected_member_name,
        slot_rec.current_member_id,
        slot_rec.current_person_name
      );

      if not dry_run then
        update public.assignments a
        set member_id = selected_member_id,
            person_name = selected_member_name
        where a.id = slot_rec.id;
      end if;

      assigned_count := assigned_count + 1;

      insert into pg_temp.auto_assign_member_counts (member_id, total_count, last_assigned_date)
      values (selected_member_id, 1, service_rec.date)
      on conflict (member_id) do update
      set total_count = auto_assign_member_counts.total_count + 1,
          last_assigned_date = service_rec.date;

      insert into pg_temp.auto_assign_member_role_counts (
        normalized_role,
        member_id,
        role_count,
        last_assigned_date
      )
      values (slot_normalized_role, selected_member_id, 1, service_rec.date)
      on conflict (normalized_role, member_id) do update
      set role_count = auto_assign_member_role_counts.role_count + 1,
          last_assigned_date = service_rec.date;
    end loop;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'assignment_id', planned.assignment_id,
        'service_id', planned.service_id,
        'service_date', planned.service_date,
        'service_time', planned.service_time,
        'service_type', planned.service_type,
        'role', planned.role,
        'member_id', planned.member_id,
        'person_name', planned.person_name,
        'current_member_id', planned.current_member_id,
        'current_person_name', planned.current_person_name
      )
      order by planned.service_date, planned.service_time nulls last, planned.service_type, planned.role, planned.assignment_id
    ),
    '[]'::jsonb
  )
  into preview
  from pg_temp.auto_assign_preview planned;

  return next;
end;
$$;

create or replace function public.auto_assign_service_slots(
  target_church_id uuid,
  assignment_mode text
)
returns table (
  assigned_count integer,
  open_slot_count integer,
  skipped_count integer,
  no_role_match_count integer,
  unavailable_slot_count integer,
  unavailable_candidate_count integer,
  same_service_conflict_count integer,
  cleared_count integer,
  preview jsonb
)
language sql
security invoker
set search_path = public, private
as $$
  select *
  from private.auto_assign_service_slots_impl(
    target_church_id,
    assignment_mode,
    false,
    current_date,
    null,
    null
  );
$$;

create or replace function public.auto_assign_service_slots(
  target_church_id uuid,
  assignment_mode text,
  dry_run boolean,
  target_start_date date,
  target_end_date date,
  target_service_ids uuid[]
)
returns table (
  assigned_count integer,
  open_slot_count integer,
  skipped_count integer,
  no_role_match_count integer,
  unavailable_slot_count integer,
  unavailable_candidate_count integer,
  same_service_conflict_count integer,
  cleared_count integer,
  preview jsonb
)
language sql
security invoker
set search_path = public, private
as $$
  select *
  from private.auto_assign_service_slots_impl(
    target_church_id,
    assignment_mode,
    dry_run,
    target_start_date,
    target_end_date,
    target_service_ids
  );
$$;

revoke all on function private.auto_assign_service_slots_impl(uuid, text, boolean, date, date, uuid[]) from public;
revoke all on function private.auto_assign_service_slots_impl(uuid, text, boolean, date, date, uuid[]) from anon;
grant execute on function private.auto_assign_service_slots_impl(uuid, text, boolean, date, date, uuid[]) to authenticated;

revoke all on function public.auto_assign_service_slots(uuid, text) from public;
revoke all on function public.auto_assign_service_slots(uuid, text) from anon;
grant execute on function public.auto_assign_service_slots(uuid, text) to authenticated;

revoke all on function public.auto_assign_service_slots(uuid, text, boolean, date, date, uuid[]) from public;
revoke all on function public.auto_assign_service_slots(uuid, text, boolean, date, date, uuid[]) from anon;
grant execute on function public.auto_assign_service_slots(uuid, text, boolean, date, date, uuid[]) to authenticated;
