-- Allow church name and church-level setting edits to update other admin devices.
-- RLS remains responsible for deciding which church rows each subscriber receives.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'churches'
  ) then
    execute 'alter publication supabase_realtime add table public.churches';
  end if;
end
$$;

-- Rollback:
-- alter publication supabase_realtime drop table public.churches;
