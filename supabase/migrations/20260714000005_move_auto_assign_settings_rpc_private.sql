create or replace function private.update_church_auto_assign_settings_impl(
  target_church_id uuid,
  allow_multiple_roles_same_service boolean
)
returns public.churches
language plpgsql
security definer
set search_path = public, private
as $$
declare
  updated_church public.churches;
begin
  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can update auto-assign settings'
      using errcode = '42501';
  end if;

  update public.churches
  set
    allow_member_multiple_roles_same_service = coalesce(allow_multiple_roles_same_service, false),
    updated_at = now()
  where id = target_church_id
  returning * into updated_church;

  if updated_church.id is null then
    raise exception 'Church not found'
      using errcode = 'P0002';
  end if;

  return updated_church;
end;
$$;

drop function if exists public.update_church_auto_assign_settings(uuid, boolean);

create or replace function public.update_church_auto_assign_settings(
  target_church_id uuid,
  allow_multiple_roles_same_service boolean
)
returns public.churches
language sql
security invoker
set search_path = public, private
as $$
  select *
  from private.update_church_auto_assign_settings_impl(
    target_church_id,
    allow_multiple_roles_same_service
  );
$$;

revoke all on function private.update_church_auto_assign_settings_impl(uuid, boolean) from public;
revoke all on function private.update_church_auto_assign_settings_impl(uuid, boolean) from anon;
grant execute on function private.update_church_auto_assign_settings_impl(uuid, boolean) to authenticated;

revoke all on function public.update_church_auto_assign_settings(uuid, boolean) from public;
revoke all on function public.update_church_auto_assign_settings(uuid, boolean) from anon;
grant execute on function public.update_church_auto_assign_settings(uuid, boolean) to authenticated;
