-- Package 18: additive role-scoped auto-assignment.
--
-- The released six-argument auto_assign_service_slots function is deliberately
-- untouched. The v2 planner starts from its final implementation so All Roles
-- keeps exactly the same fairness and eligibility behavior.

do $migration$
declare
  function_sql text;
  patched_sql text;
begin
  select pg_catalog.pg_get_functiondef(
    'private.auto_assign_service_slots_impl(uuid,text,boolean,date,date,uuid[])'::pg_catalog.regprocedure
  ) into function_sql;

  patched_sql := pg_catalog.replace(
    function_sql,
    'CREATE OR REPLACE FUNCTION private.auto_assign_service_slots_impl(target_church_id uuid, assignment_mode text, dry_run boolean, target_start_date date, target_end_date date, target_service_ids uuid[])',
    'CREATE OR REPLACE FUNCTION private.auto_assign_service_slots_v2_impl(target_church_id uuid, assignment_mode text, dry_run boolean, target_start_date date, target_end_date date, target_service_ids uuid[], target_role_id uuid)'
  );
  if patched_sql = function_sql then
    raise exception 'Could not version the auto-assignment implementation';
  end if;
  function_sql := patched_sql;

  function_sql := pg_catalog.replace(
    function_sql,
    $$SET search_path TO 'public', 'private'$$,
    $$SET search_path TO 'pg_catalog', 'pg_temp', 'public', 'private'$$
  );

  patched_sql := pg_catalog.replace(
    function_sql,
    $$  has_service_filter boolean := coalesce(array_length(target_service_ids, 1), 0) > 0;
  allow_same_member_multiple_roles boolean := false;$$,
    $$  has_service_filter boolean := coalesce(array_length(target_service_ids, 1), 0) > 0;
  selected_role_normalized_name text := null;
  allow_same_member_multiple_roles boolean := false;$$
  );
  if patched_sql = function_sql then
    raise exception 'Could not add role scope state to auto-assignment';
  end if;
  function_sql := patched_sql;

  patched_sql := pg_catalog.replace(
    function_sql,
    $$  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can auto-assign services'
      using errcode = '42501';
  end if;

  select coalesce(c.allow_member_multiple_roles_same_service, false)$$,
    $$  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can auto-assign services'
      using errcode = '42501';
  end if;

  if target_role_id is not null then
    select lower(regexp_replace(trim(role.name), '\s+', ' ', 'g'))
    into selected_role_normalized_name
    from public.church_roles as role
    where role.id = target_role_id
      and role.church_id = target_church_id
    for key share;

    if selected_role_normalized_name is null then
      raise exception 'The selected role is no longer available in this church.'
        using errcode = '22023', detail = 'role_not_found';
    end if;
  end if;

  select coalesce(c.allow_member_multiple_roles_same_service, false)$$
  );
  if patched_sql = function_sql then
    raise exception 'Could not add role ownership validation to auto-assignment';
  end if;
  function_sql := patched_sql;

  patched_sql := pg_catalog.replace(
    function_sql,
    $$      where a.member_id is not null;
    else
      update public.assignments a
      set member_id = null,
          person_name = ''
      from pg_temp.auto_assign_service_scope ss
      where ss.id = a.service_id
        and a.member_id is not null;$$,
    $$      where a.member_id is not null
        and (
          target_role_id is null
          or lower(regexp_replace(trim(a.role), '\s+', ' ', 'g'))
            = selected_role_normalized_name
        );
    else
      update public.assignments a
      set member_id = null,
          person_name = ''
      from pg_temp.auto_assign_service_scope ss
      where ss.id = a.service_id
        and a.member_id is not null
        and (
          target_role_id is null
          or lower(regexp_replace(trim(a.role), '\s+', ' ', 'g'))
            = selected_role_normalized_name
        );$$
  );
  if patched_sql = function_sql then
    raise exception 'Could not scope auto-assignment clearing';
  end if;
  function_sql := patched_sql;

  patched_sql := pg_catalog.replace(
    function_sql,
    $$    and not (
      normalized_mode = 'reassign_all'
      and exists (
        select 1
        from pg_temp.auto_assign_service_scope ss
        where ss.id = s.id
      )
    )
  group by a.member_id$$,
    $$    and not (
      normalized_mode = 'reassign_all'
      and (
        target_role_id is null
        or lower(regexp_replace(trim(a.role), '\s+', ' ', 'g'))
          = selected_role_normalized_name
      )
      and exists (
        select 1
        from pg_temp.auto_assign_service_scope ss
        where ss.id = s.id
      )
    )
  group by a.member_id$$
  );
  if patched_sql = function_sql then
    raise exception 'Could not preserve unrelated-role total history';
  end if;
  function_sql := patched_sql;

  patched_sql := pg_catalog.replace(
    function_sql,
    $$    and not (
      normalized_mode = 'reassign_all'
      and exists (
        select 1
        from pg_temp.auto_assign_service_scope ss
        where ss.id = s.id
      )
    )
  group by lower(regexp_replace(trim(a.role), '\s+', ' ', 'g')), a.member_id$$,
    $$    and not (
      normalized_mode = 'reassign_all'
      and (
        target_role_id is null
        or lower(regexp_replace(trim(a.role), '\s+', ' ', 'g'))
          = selected_role_normalized_name
      )
      and exists (
        select 1
        from pg_temp.auto_assign_service_scope ss
        where ss.id = s.id
      )
    )
  group by lower(regexp_replace(trim(a.role), '\s+', ' ', 'g')), a.member_id$$
  );
  if patched_sql = function_sql then
    raise exception 'Could not preserve unrelated-role role history';
  end if;
  function_sql := patched_sql;

  patched_sql := pg_catalog.replace(
    function_sql,
    $$    where a.member_id is not null
      and nullif(trim(a.role), '') is not null
    group by$$,
    $$    where a.member_id is not null
      and nullif(trim(a.role), '') is not null
      and (
        target_role_id is null
        or lower(regexp_replace(trim(a.role), '\s+', ' ', 'g'))
          = selected_role_normalized_name
      )
    group by$$
  );
  if patched_sql = function_sql then
    raise exception 'Could not scope retained role turns';
  end if;
  function_sql := patched_sql;

  patched_sql := pg_catalog.replace(
    function_sql,
    $$      where a.service_id = service_rec.id
        and nullif(trim(a.role), '') is not null
        and (
          normalized_mode = 'reassign_all'$$,
    $$      where a.service_id = service_rec.id
        and nullif(trim(a.role), '') is not null
        and (
          target_role_id is null
          or lower(regexp_replace(trim(a.role), '\s+', ' ', 'g'))
            = selected_role_normalized_name
        )
        and (
          normalized_mode = 'reassign_all'$$
  );
  if patched_sql = function_sql then
    raise exception 'Could not scope assignment slots';
  end if;
  function_sql := patched_sql;

  patched_sql := pg_catalog.replace(
    function_sql,
    $$          where service_assignment.service_id = service_rec.id
            and service_assignment.member_id = role_candidates.id
            and normalized_mode <> 'reassign_all'$$,
    $$          where service_assignment.service_id = service_rec.id
            and service_assignment.member_id = role_candidates.id
            and not (
              normalized_mode = 'reassign_all'
              and (
                target_role_id is null
                or lower(regexp_replace(trim(service_assignment.role), '\s+', ' ', 'g'))
                  = selected_role_normalized_name
              )
            )$$
  );
  if patched_sql = function_sql then
    raise exception 'Could not preserve unrelated same-service conflicts';
  end if;
  function_sql := patched_sql;

  patched_sql := pg_catalog.replace(
    function_sql,
    $$        and (
          allow_same_member_multiple_roles
          or normalized_mode = 'reassign_all'
          or not exists (
            select 1
            from public.assignments service_assignment
            where service_assignment.service_id = service_rec.id
              and service_assignment.member_id = role_candidates.id
          )
        )$$,
    $$        and (
          allow_same_member_multiple_roles
          or not exists (
            select 1
            from public.assignments service_assignment
            where service_assignment.service_id = service_rec.id
              and service_assignment.member_id = role_candidates.id
              and not (
                normalized_mode = 'reassign_all'
                and (
                  target_role_id is null
                  or lower(regexp_replace(trim(service_assignment.role), '\s+', ' ', 'g'))
                    = selected_role_normalized_name
                )
              )
          )
        )$$
  );
  if patched_sql = function_sql then
    raise exception 'Could not scope candidate same-service checks';
  end if;
  function_sql := patched_sql;

  execute function_sql;
end
$migration$;

create or replace function public.auto_assign_service_slots_v2(
  target_church_id uuid,
  assignment_mode text default 'fill_empty',
  dry_run boolean default true,
  target_start_date date default null,
  target_end_date date default null,
  target_service_ids uuid[] default null,
  target_role_id uuid default null,
  expected_preview_token text default null
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
  preview jsonb,
  skipped_report jsonb,
  scope_role_id uuid,
  scope_role_name text,
  preview_token text
)
language plpgsql
security invoker
set search_path = 'pg_catalog', 'pg_temp', 'public', 'private'
as $$
declare
  requested_dry_run boolean := coalesce(dry_run, true);
  planned record;
  applied record;
  selected_role_name text := null;
  planned_token text;
  sorted_service_ids jsonb;
begin
  -- This is the same transaction-level lock used by both planner versions.
  -- It serializes new and released auto-assignment calls for this church.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(target_church_id::text)
  );

  select *
  into planned
  from private.auto_assign_service_slots_v2_impl(
    target_church_id,
    assignment_mode,
    true,
    target_start_date,
    target_end_date,
    target_service_ids,
    target_role_id
  );

  if target_role_id is not null then
    select role.name
    into selected_role_name
    from public.church_roles as role
    where role.id = target_role_id
      and role.church_id = target_church_id;

    if selected_role_name is null then
      raise exception 'The selected role is no longer available in this church.'
        using errcode = '22023', detail = 'role_not_found';
    end if;
  end if;

  select coalesce(
    jsonb_agg(scoped_id.value order by scoped_id.value),
    '[]'::jsonb
  )
  into sorted_service_ids
  from unnest(coalesce(target_service_ids, array[]::uuid[])) as scoped_id(value);

  planned_token := pg_catalog.md5(
    jsonb_build_object(
      'version', 2,
      'church_id', target_church_id,
      'mode', coalesce(nullif(trim(assignment_mode), ''), 'fill_empty'),
      'start_date', target_start_date,
      'end_date', target_end_date,
      'service_ids', sorted_service_ids,
      'role_id', target_role_id,
      'role_name', selected_role_name,
      'assigned_count', planned.assigned_count,
      'open_slot_count', planned.open_slot_count,
      'skipped_count', planned.skipped_count,
      'cleared_count', planned.cleared_count,
      'preview', planned.preview,
      'skipped_report', planned.skipped_report
    )::text
  );

  if not requested_dry_run then
    if expected_preview_token is null
      or expected_preview_token is distinct from planned_token then
      raise exception 'The schedule changed after this preview was generated.'
        using errcode = '40001', detail = 'stale_preview';
    end if;

    select *
    into applied
    from private.auto_assign_service_slots_v2_impl(
      target_church_id,
      assignment_mode,
      false,
      target_start_date,
      target_end_date,
      target_service_ids,
      target_role_id
    );

    if applied.assigned_count is distinct from planned.assigned_count
      or applied.open_slot_count is distinct from planned.open_slot_count
      or applied.skipped_count is distinct from planned.skipped_count
      or applied.no_role_match_count is distinct from planned.no_role_match_count
      or applied.unavailable_slot_count is distinct from planned.unavailable_slot_count
      or applied.unavailable_candidate_count is distinct from planned.unavailable_candidate_count
      or applied.same_service_conflict_count is distinct from planned.same_service_conflict_count
      or applied.cleared_count is distinct from planned.cleared_count
      or applied.skipped_report is distinct from planned.skipped_report
      or (
        select coalesce(
          jsonb_agg(
            item.value - 'current_member_id' - 'current_person_name'
            order by item.value->>'assignment_id'
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(applied.preview) as item(value)
      ) is distinct from (
        select coalesce(
          jsonb_agg(
            item.value - 'current_member_id' - 'current_person_name'
            order by item.value->>'assignment_id'
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(planned.preview) as item(value)
      ) then
      raise exception 'The committed assignment plan diverged from its preview.'
        using errcode = '40001', detail = 'preview_apply_diverged';
    end if;

    -- Reassign All clears rows before rebuilding them, so its internal apply
    -- result no longer carries the original member labels. Return the approved
    -- preview after proving the committed member/slot plan is identical.
    applied := planned;
  else
    applied := planned;
  end if;

  return query
  select
    applied.assigned_count::integer,
    applied.open_slot_count::integer,
    applied.skipped_count::integer,
    applied.no_role_match_count::integer,
    applied.unavailable_slot_count::integer,
    applied.unavailable_candidate_count::integer,
    applied.same_service_conflict_count::integer,
    applied.cleared_count::integer,
    applied.preview::jsonb,
    applied.skipped_report::jsonb,
    target_role_id,
    selected_role_name,
    planned_token;
end;
$$;

revoke all on function private.auto_assign_service_slots_v2_impl(
  uuid,
  text,
  boolean,
  date,
  date,
  uuid[],
  uuid
) from public, anon;
grant execute on function private.auto_assign_service_slots_v2_impl(
  uuid,
  text,
  boolean,
  date,
  date,
  uuid[],
  uuid
) to authenticated;

revoke all on function public.auto_assign_service_slots_v2(
  uuid,
  text,
  boolean,
  date,
  date,
  uuid[],
  uuid,
  text
) from public, anon;
grant execute on function public.auto_assign_service_slots_v2(
  uuid,
  text,
  boolean,
  date,
  date,
  uuid[],
  uuid,
  text
) to authenticated;

-- Roll back only the new APIs if needed. The released allocator remains live.
-- drop function if exists public.auto_assign_service_slots_v2(
--   uuid, text, boolean, date, date, uuid[], uuid, text
-- );
-- drop function if exists private.auto_assign_service_slots_v2_impl(
--   uuid, text, boolean, date, date, uuid[], uuid
-- );
