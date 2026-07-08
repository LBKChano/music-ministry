do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'onesignal_subscriptions_member_id_key'
      and conrelid = 'public.onesignal_subscriptions'::regclass
  ) then
    alter table public.onesignal_subscriptions
      drop constraint onesignal_subscriptions_member_id_key;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'onesignal_subscriptions_subscription_id_key'
      and conrelid = 'public.onesignal_subscriptions'::regclass
  ) then
    alter table public.onesignal_subscriptions
      add constraint onesignal_subscriptions_subscription_id_key unique (subscription_id);
  end if;
end $$;
