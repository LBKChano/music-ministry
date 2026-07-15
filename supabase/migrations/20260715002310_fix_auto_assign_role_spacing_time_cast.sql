do $$
declare
  function_sql text;
  updated_sql text;
begin
  select pg_get_functiondef('private.auto_assign_service_slots_impl(uuid, text, boolean, date, date, uuid[])'::regprocedure)
  into function_sql;

  updated_sql := replace(
    function_sql,
    'and coalesce(previous_scope.time, '''') < coalesce(service_rec.time, '''')',
    'and nullif(previous_scope.time, '''')::time < nullif(service_rec.time, '''')::time'
  );

  updated_sql := replace(
    updated_sql,
    'order by previous_scope.date desc, previous_scope.time desc nulls last, previous_scope.id desc',
    'order by previous_scope.date desc, nullif(previous_scope.time, '''')::time desc nulls last, previous_scope.id desc'
  );

  updated_sql := replace(
    updated_sql,
    'and coalesce(previous_service_scope.time, '''') < coalesce(service_rec.time, '''')',
    'and previous_service_scope.time < nullif(service_rec.time, '''')::time'
  );

  if updated_sql = function_sql then
    raise exception 'Could not find auto-assign time comparison block to replace';
  end if;

  execute updated_sql;
end $$;
