begin;

do $$
begin
  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'member_notification_preferences'
      and relation.relrowsecurity
  ) then
    raise exception 'member_notification_preferences must have RLS enabled';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.member_notification_preferences',
    'select'
  ) then
    raise exception 'authenticated must use preference RPCs, not direct table access';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_my_notification_preferences(uuid)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.update_my_notification_preferences(uuid,boolean,boolean,boolean,boolean)',
    'execute'
  ) then
    raise exception 'authenticated preference RPC grants are missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_my_notification_preferences(uuid)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.update_my_notification_preferences(uuid,boolean,boolean,boolean,boolean)',
    'execute'
  ) then
    raise exception 'anonymous preference RPC access must remain disabled';
  end if;
end;
$$;

rollback;
