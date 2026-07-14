do $$
declare
  function_sql text;
begin
  select pg_get_functiondef('private.auto_assign_service_slots_impl(uuid, text, boolean, date, date, uuid[])'::regprocedure)
  into function_sql;

  function_sql := replace(function_sql, E'\n  normalized_role text;', E'\n  slot_normalized_role text;');
  function_sql := replace(function_sql, 'normalized_role := slot_rec.normalized_role;', 'slot_normalized_role := slot_rec.normalized_role;');
  function_sql := replace(function_sql, '= normalized_role', '= slot_normalized_role');
  function_sql := replace(function_sql, 'mrc.normalized_role = slot_normalized_role', 'mrc.normalized_role = slot_normalized_role');
  function_sql := replace(function_sql, 'values (normalized_role, selected_member_id, 1, service_rec.date)', 'values (slot_normalized_role, selected_member_id, 1, service_rec.date)');

  execute function_sql;
end $$;
