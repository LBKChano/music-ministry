do $migration$
declare
  function_sql text;
  updated_sql text;
  old_fragment text;
  new_fragment text;
begin
  select pg_get_functiondef(
    'private.auto_assign_service_slots_impl(uuid, text, boolean, date, date, uuid[])'::regprocedure
  )
  into function_sql;

  old_fragment := $old$
  create temp table if not exists pg_temp.auto_assign_preview (
$old$;
  new_fragment := $new$
  create temp table if not exists pg_temp.auto_assign_run_role_counts (
    normalized_role text not null,
    member_id uuid not null,
    run_count integer not null default 0,
    primary key (normalized_role, member_id)
  ) on commit drop;

  create temp table if not exists pg_temp.auto_assign_preview (
$new$;

  if position(old_fragment in function_sql) = 0 then
    raise exception 'Could not add the auto-assign run role count table';
  end if;
  updated_sql := replace(function_sql, old_fragment, new_fragment);

  old_fragment := $old$
  truncate table pg_temp.auto_assign_member_role_counts;
  truncate table pg_temp.auto_assign_preview;
$old$;
  new_fragment := $new$
  truncate table pg_temp.auto_assign_member_role_counts;
  truncate table pg_temp.auto_assign_run_role_counts;
  truncate table pg_temp.auto_assign_preview;
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not add the auto-assign run role count reset';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
  on conflict (normalized_role, member_id) do update
  set role_count = excluded.role_count,
      last_assigned_date = excluded.last_assigned_date;

  for service_rec in
$old$;
  new_fragment := $new$
  on conflict (normalized_role, member_id) do update
  set role_count = excluded.role_count,
      last_assigned_date = excluded.last_assigned_date;

  -- Retained assignments are already turns in this run. Reassign All starts
  -- every role at zero because all scoped assignments will be rebuilt.
  if normalized_mode = 'fill_empty' then
    insert into pg_temp.auto_assign_run_role_counts (
      normalized_role,
      member_id,
      run_count
    )
    select
      lower(regexp_replace(trim(a.role), '\s+', ' ', 'g')),
      a.member_id,
      count(*)::integer
    from public.assignments a
    join pg_temp.auto_assign_service_scope ss on ss.id = a.service_id
    where a.member_id is not null
      and nullif(trim(a.role), '') is not null
    group by
      lower(regexp_replace(trim(a.role), '\s+', ' ', 'g')),
      a.member_id
    on conflict (normalized_role, member_id) do update
    set run_count = excluded.run_count;
  end if;

  for service_rec in
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not seed retained auto-assign role turns';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
      left join pg_temp.auto_assign_member_role_counts mrc
        on mrc.member_id = role_candidates.id
       and mrc.normalized_role = slot_normalized_role
      where not exists (
$old$;
  new_fragment := $new$
      left join pg_temp.auto_assign_member_role_counts mrc
        on mrc.member_id = role_candidates.id
       and mrc.normalized_role = slot_normalized_role
      left join pg_temp.auto_assign_run_role_counts rrc
        on rrc.member_id = role_candidates.id
       and rrc.normalized_role = slot_normalized_role
      where not exists (
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not join auto-assign run role turns';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
      order by
        (
          coalesce((
            select count(distinct planned_recent.service_id)::integer
            from pg_temp.auto_assign_preview planned_recent
            where planned_recent.member_id = role_candidates.id
              and lower(regexp_replace(trim(planned_recent.role), '\s+', ' ', 'g')) = slot_normalized_role
              and planned_recent.service_id in (
                select recent_scope.id
                from pg_temp.auto_assign_service_scope recent_scope
                where recent_scope.date >= (service_rec.date - interval '3 months')::date
                  and (
                    recent_scope.date < service_rec.date
                    or (
                      recent_scope.date = service_rec.date
                      and nullif(recent_scope.time, '')::time < nullif(service_rec.time, '')::time
                    )
                  )
              )
          ), 0)
          +
          coalesce((
            select count(distinct recent_assignment.service_id)::integer
            from public.assignments recent_assignment
            where recent_assignment.member_id = role_candidates.id
              and lower(regexp_replace(trim(recent_assignment.role), '\s+', ' ', 'g')) = slot_normalized_role
              and recent_assignment.service_id in (
                select recent_service.id
                from public.services recent_service
                where recent_service.church_id = target_church_id
                  and recent_service.date >= (service_rec.date - interval '3 months')::date
                  and (
                    recent_service.date < service_rec.date
                    or (
                      recent_service.date = service_rec.date
                      and recent_service.time < nullif(service_rec.time, '')::time
                    )
                  )
                  and not (
                    normalized_mode = 'reassign_all'
                    and exists (
                      select 1
                      from pg_temp.auto_assign_service_scope scoped_recent
                      where scoped_recent.id = recent_service.id
                    )
                  )
              )
          ), 0)
        ) asc,
        case
          when exists (
            select 1
            from pg_temp.auto_assign_preview planned_previous
            where planned_previous.member_id = role_candidates.id
              and lower(regexp_replace(trim(planned_previous.role), '\s+', ' ', 'g')) = slot_normalized_role
              and planned_previous.service_id = (
                select previous_scope.id
                from pg_temp.auto_assign_service_scope previous_scope
                where previous_scope.date < service_rec.date
                  or (
                    previous_scope.date = service_rec.date
                    and nullif(previous_scope.time, '')::time < nullif(service_rec.time, '')::time
                  )
                order by previous_scope.date desc, nullif(previous_scope.time, '')::time desc nulls last, previous_scope.id desc
                limit 1
              )
          )
          or exists (
            select 1
            from public.assignments previous_assignment
            join public.services previous_service on previous_service.id = previous_assignment.service_id
            where previous_assignment.member_id = role_candidates.id
              and previous_service.church_id = target_church_id
              and lower(regexp_replace(trim(previous_assignment.role), '\s+', ' ', 'g')) = slot_normalized_role
              and previous_service.id = (
                select previous_service_scope.id
                from public.services previous_service_scope
                where previous_service_scope.church_id = target_church_id
                  and (
                    previous_service_scope.date < service_rec.date
                    or (
                      previous_service_scope.date = service_rec.date
                      and previous_service_scope.time < nullif(service_rec.time, '')::time
                    )
                  )
                order by previous_service_scope.date desc, previous_service_scope.time desc nulls last, previous_service_scope.id desc
                limit 1
              )
              and not (
                normalized_mode = 'reassign_all'
                and exists (
                  select 1
                  from pg_temp.auto_assign_service_scope scoped_previous
                  where scoped_previous.id = previous_service.id
                )
              )
          )
          then 1
          else 0
        end asc,
        case
          when exists (
            select 1
            from pg_temp.auto_assign_preview planned_previous
            where planned_previous.member_id = role_candidates.id
              and planned_previous.service_type = service_rec.service_type
              and planned_previous.service_date = service_rec.date - 7
          )
          or exists (
            select 1
            from public.assignments previous_assignment
            join public.services previous_service on previous_service.id = previous_assignment.service_id
            where previous_assignment.member_id = role_candidates.id
              and previous_service.church_id = target_church_id
              and previous_service.service_type = service_rec.service_type
              and previous_service.date = service_rec.date - 7
              and not (
                normalized_mode = 'reassign_all'
                and exists (
                  select 1
                  from pg_temp.auto_assign_service_scope scoped_previous
                  where scoped_previous.id = previous_service.id
                )
              )
          )
          then 1
          else 0
        end asc,
        coalesce(mrc.role_count, 0) asc,
        coalesce(mc.total_count, 0) asc,
        mrc.last_assigned_date asc nulls first,
        mc.last_assigned_date asc nulls first,
        coalesce(nullif(trim(role_candidates.name), ''), role_candidates.email) asc,
        role_candidates.id asc
      limit 1;
$old$;
  new_fragment := $new$
      order by
        -- Avoid the same member on consecutive services for this role whenever
        -- another eligible member is available.
        case
          when exists (
            select 1
            from pg_temp.auto_assign_preview planned_previous
            where planned_previous.member_id = role_candidates.id
              and lower(regexp_replace(trim(planned_previous.role), '\s+', ' ', 'g')) = slot_normalized_role
              and planned_previous.service_id = (
                select previous_scope.id
                from pg_temp.auto_assign_service_scope previous_scope
                where previous_scope.date < service_rec.date
                  or (
                    previous_scope.date = service_rec.date
                    and nullif(previous_scope.time, '')::time < nullif(service_rec.time, '')::time
                  )
                order by
                  previous_scope.date desc,
                  nullif(previous_scope.time, '')::time desc nulls last,
                  previous_scope.id desc
                limit 1
              )
          )
          or exists (
            select 1
            from public.assignments previous_assignment
            join public.services previous_service
              on previous_service.id = previous_assignment.service_id
            where previous_assignment.member_id = role_candidates.id
              and previous_service.church_id = target_church_id
              and lower(regexp_replace(trim(previous_assignment.role), '\s+', ' ', 'g')) = slot_normalized_role
              and previous_service.id = (
                select previous_service_scope.id
                from public.services previous_service_scope
                where previous_service_scope.church_id = target_church_id
                  and (
                    previous_service_scope.date < service_rec.date
                    or (
                      previous_service_scope.date = service_rec.date
                      and previous_service_scope.time < nullif(service_rec.time, '')::time
                    )
                  )
                order by
                  previous_service_scope.date desc,
                  previous_service_scope.time desc nulls last,
                  previous_service_scope.id desc
                limit 1
              )
              and not (
                normalized_mode = 'reassign_all'
                and exists (
                  select 1
                  from pg_temp.auto_assign_service_scope scoped_previous
                  where scoped_previous.id = previous_service.id
                )
              )
          )
          then 1
          else 0
        end asc,
        -- Finish the current role round before anyone receives another turn.
        coalesce(rrc.run_count, 0) asc,
        -- Past-quarter history chooses who starts each round.
        coalesce(mrc.role_count, 0) asc,
        mrc.last_assigned_date asc nulls first,
        coalesce(mc.total_count, 0) asc,
        mc.last_assigned_date asc nulls first,
        coalesce(nullif(trim(role_candidates.name), ''), role_candidates.email) asc,
        role_candidates.id asc
      limit 1;
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not replace the auto-assign candidate priority';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  old_fragment := $old$
      insert into pg_temp.auto_assign_member_role_counts (
        normalized_role,
        member_id,
        role_count,
        last_assigned_date
      )
      values (slot_normalized_role, selected_member_id, 1, service_rec.date)
$old$;
  new_fragment := $new$
      insert into pg_temp.auto_assign_run_role_counts (
        normalized_role,
        member_id,
        run_count
      )
      values (slot_normalized_role, selected_member_id, 1)
      on conflict (normalized_role, member_id) do update
      set run_count = auto_assign_run_role_counts.run_count + 1;

      insert into pg_temp.auto_assign_member_role_counts (
        normalized_role,
        member_id,
        role_count,
        last_assigned_date
      )
      values (slot_normalized_role, selected_member_id, 1, service_rec.date)
$new$;

  if position(old_fragment in updated_sql) = 0 then
    raise exception 'Could not increment the auto-assign role round';
  end if;
  updated_sql := replace(updated_sql, old_fragment, new_fragment);

  execute updated_sql;
end
$migration$;
