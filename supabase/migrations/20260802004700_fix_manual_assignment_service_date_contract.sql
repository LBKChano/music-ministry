-- The released services table stores its calendar day as timestamptz. Package
-- 17 exposes and compares a date-only value so device and database time zones
-- cannot shift manual-assignment availability checks.

do $migration$
declare
  function_sql text;
begin
  select pg_catalog.pg_get_functiondef(
    'private.get_manual_assignment_candidates_v1_impl(uuid)'::pg_catalog.regprocedure
  ) into function_sql;
  function_sql := pg_catalog.replace(
    function_sql,
    'service.date as service_date',
    'service.date::date as service_date'
  );
  execute function_sql;

  select pg_catalog.pg_get_functiondef(
    'private.assign_member_to_slot_v2_impl(uuid,uuid,uuid,date,uuid)'::pg_catalog.regprocedure
  ) into function_sql;
  function_sql := pg_catalog.replace(
    function_sql,
    'service.date as service_date',
    'service.date::date as service_date'
  );
  execute function_sql;
end
$migration$;

-- No data or released signature changes; no rollback is needed.
