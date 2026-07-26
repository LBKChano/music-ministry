-- Allow recurring-service role edits to update other signed-in admin devices.
-- RLS remains responsible for deciding which rows each subscriber can receive.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recurring_service_roles'
  ) then
    execute
      'alter publication supabase_realtime add table public.recurring_service_roles';
  end if;
end
$$;

-- Rollback:
-- alter publication supabase_realtime drop table public.recurring_service_roles;
