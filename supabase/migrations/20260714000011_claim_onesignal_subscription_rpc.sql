create or replace function private.claim_onesignal_subscription_impl(
  target_member_id uuid,
  target_subscription_id text
)
returns public.onesignal_subscriptions
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_subscription_id text := btrim(target_subscription_id);
  claimed_subscription public.onesignal_subscriptions;
begin
  if normalized_subscription_id is null or normalized_subscription_id = '' then
    raise exception 'OneSignal subscription ID is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.church_members cm
    where cm.id = target_member_id
      and cm.member_id = (select auth.uid())
  ) then
    raise exception 'Only the logged-in member can claim this subscription'
      using errcode = '42501';
  end if;

  delete from public.onesignal_subscriptions
  where subscription_id = normalized_subscription_id
    and member_id <> target_member_id;

  insert into public.onesignal_subscriptions (
    member_id,
    subscription_id,
    updated_at
  )
  values (
    target_member_id,
    normalized_subscription_id,
    now()
  )
  on conflict (subscription_id)
  do update set
    member_id = excluded.member_id,
    updated_at = now()
  returning * into claimed_subscription;

  delete from public.onesignal_subscriptions
  where member_id = target_member_id
    and subscription_id <> normalized_subscription_id;

  return claimed_subscription;
end;
$$;

create or replace function public.claim_onesignal_subscription(
  target_member_id uuid,
  target_subscription_id text
)
returns public.onesignal_subscriptions
language sql
security invoker
set search_path = public, private
as $$
  select *
  from private.claim_onesignal_subscription_impl(
    target_member_id,
    target_subscription_id
  );
$$;

revoke all on function private.claim_onesignal_subscription_impl(uuid, text) from public;
revoke all on function private.claim_onesignal_subscription_impl(uuid, text) from anon;
grant execute on function private.claim_onesignal_subscription_impl(uuid, text) to authenticated;

revoke all on function public.claim_onesignal_subscription(uuid, text) from public;
revoke all on function public.claim_onesignal_subscription(uuid, text) from anon;
grant execute on function public.claim_onesignal_subscription(uuid, text) to authenticated;
