do $$
declare
  helper_table text;
begin
  foreach helper_table in array array[
    '_android_build_fixes',
    '_church_tsx_store',
    '_file_writes',
    '_file_chunks',
    '_church_tsx_tail'
  ]
  loop
    if to_regclass(format('public.%I', helper_table)) is not null then
      execute format('alter table public.%I enable row level security', helper_table);
    end if;
  end loop;
end $$;

revoke all on function public.delete_account() from anon;
revoke all on function public.update_church_song_type_options(uuid, text[]) from anon;
