-- Keep every physical device subscription for a member while preserving the
-- existing public RPC signature used by released app versions.

alter table public.member_notifications
  add column if not exists event_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_notifications_member_event_key_key'
      and conrelid = 'public.member_notifications'::regclass
  ) then
    alter table public.member_notifications
      add constraint member_notifications_member_event_key_key
      unique (member_id, event_key);
  end if;
end
$$;

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

  perform pg_advisory_xact_lock(hashtext(normalized_subscription_id));

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

  return claimed_subscription;
end;
$$;

revoke all on function private.claim_onesignal_subscription_impl(uuid, text) from public;
revoke all on function private.claim_onesignal_subscription_impl(uuid, text) from anon;
grant execute on function private.claim_onesignal_subscription_impl(uuid, text) to authenticated;

-- Existing public.claim_onesignal_subscription(uuid, text) remains unchanged and
-- continues to call this implementation.

-- Reviewed rollback:
-- 1. Restore the previous implementation from
--    20260714000011_claim_onesignal_subscription_rpc.sql.
-- 2. alter table public.member_notifications
--      drop constraint if exists member_notifications_member_event_key_key;
-- 3. alter table public.member_notifications drop column if exists event_key;
