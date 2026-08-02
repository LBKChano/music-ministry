-- Forward fix for Package 17's empty-search-path function bodies.
-- NULLIF and COALESCE are SQL expressions, not schema-qualified functions.

do $migration$
declare
  function_sql text;
begin
  select pg_catalog.pg_get_functiondef(
    'private.get_manual_assignment_candidates_v1_impl(uuid)'::pg_catalog.regprocedure
  ) into function_sql;
  function_sql := pg_catalog.replace(
    pg_catalog.replace(function_sql, 'pg_catalog.nullif', 'nullif'),
    'pg_catalog.coalesce',
    'coalesce'
  );
  execute function_sql;

  select pg_catalog.pg_get_functiondef(
    'private.assign_member_to_slot_v2_impl(uuid,uuid,uuid,date,uuid)'::pg_catalog.regprocedure
  ) into function_sql;
  function_sql := pg_catalog.replace(
    pg_catalog.replace(function_sql, 'pg_catalog.nullif', 'nullif'),
    'pg_catalog.coalesce',
    'coalesce'
  );
  execute function_sql;
end
$migration$;

-- No rollback is needed. This migration changes only executable function text
-- and preserves signatures, grants, data, and released-client contracts.
