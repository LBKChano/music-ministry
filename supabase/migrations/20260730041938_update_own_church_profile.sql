-- Package 11: church-scoped self-service display-name editing.
--
-- This migration is additive. Released clients keep their existing table
-- policies and admin member-management RPCs. The new function can update only
-- the authenticated account's name in one requested church membership.

create or replace function private.update_own_church_profile_impl(
  target_church_id uuid,
  display_name text
)
returns public.church_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_name text := nullif(pg_catalog.btrim(display_name), '');
  selected_member public.church_members;
  updated_member public.church_members;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_name is null then
    raise exception 'Display name is required' using errcode = '22023';
  end if;

  if pg_catalog.char_length(normalized_name) > 120 then
    raise exception 'Display name must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if normalized_name ~ '[[:cntrl:]]' then
    raise exception 'Display name cannot contain control characters'
      using errcode = '22023';
  end if;

  select *
  into selected_member
  from public.church_members
  where church_id = target_church_id
    and member_id = actor_id
  for update;

  if selected_member.id is null then
    raise exception 'Membership not found for this church'
      using errcode = '42501';
  end if;

  update public.church_members
  set name = normalized_name
  where id = selected_member.id
    and church_id = target_church_id
    and member_id = actor_id
  returning * into updated_member;

  return updated_member;
end;
$$;

create or replace function public.update_own_church_profile(
  target_church_id uuid,
  display_name text
)
returns public.church_members
language sql
security invoker
set search_path = ''
as $$
  select private.update_own_church_profile_impl(
    target_church_id,
    display_name
  );
$$;

revoke all on function private.update_own_church_profile_impl(uuid, text)
  from public, anon;
revoke all on function public.update_own_church_profile(uuid, text)
  from public, anon;

grant execute on function private.update_own_church_profile_impl(uuid, text)
  to authenticated;
grant execute on function public.update_own_church_profile(uuid, text)
  to authenticated;
