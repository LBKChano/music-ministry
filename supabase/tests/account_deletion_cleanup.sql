begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.account_notification_devices'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ) then
    raise exception 'account notification devices must cascade with auth account deletion';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.member_notification_preferences'::regclass
      and confrelid = 'public.church_members'::regclass
      and confdeltype = 'c'
  ) then
    raise exception 'notification preferences must cascade with membership deletion';
  end if;
end
$$;

rollback;
