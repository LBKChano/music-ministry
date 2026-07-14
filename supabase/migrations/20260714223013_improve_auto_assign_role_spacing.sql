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
                    and coalesce(previous_scope.time, '') < coalesce(service_rec.time, '')
                  )
                order by previous_scope.date desc, previous_scope.time desc nulls last, previous_scope.id desc
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
                      and coalesce(previous_service_scope.time, '') < coalesce(service_rec.time, '')
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

  if position(old_order in function_sql) = 0 then
    raise exception 'Could not find current auto-assign candidate order block to replace';
  end if;

  execute replace(function_sql, old_order, new_order);
end $$;
