do $$
declare
  function_sql text;
  old_order text := $old$
      order by
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
  new_order text := $new$
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
$new$;
begin
  select pg_get_functiondef('private.auto_assign_service_slots_impl(uuid, text, boolean, date, date, uuid[])'::regprocedure)
  into function_sql;

  function_sql := replace(
    function_sql,
    $count_filter$
    and s.date >= current_date
    and a.member_id is not null
$count_filter$,
    $count_filter$
    and s.date >= (effective_start_date - interval '3 months')::date
    and a.member_id is not null
$count_filter$
  );

  if position(old_order in function_sql) = 0 then
    raise exception 'Could not find current auto-assign candidate order block to replace';
  end if;

  execute replace(function_sql, old_order, new_order);
end $$;
