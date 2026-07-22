create or replace function private.update_church_name_impl(
  target_church_id uuid,
  church_name text
)
returns public.churches
language plpgsql
security definer
set search_path = public, private
as $$
declare
  cleaned_name text := btrim(coalesce(church_name, ''));
  updated_church public.churches;
begin
  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can update the church name'
      using errcode = '42501';
  end if;

  if cleaned_name = '' then
    raise exception 'Church name is required'
      using errcode = '22023';
  end if;

  if char_length(cleaned_name) > 120 then
    raise exception 'Church name must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  update public.churches
  set
    name = cleaned_name,
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

create or replace function public.update_church_name(
  target_church_id uuid,
  church_name text
)
returns public.churches
language sql
security invoker
set search_path = public, private
as $$
  select *
  from private.update_church_name_impl(target_church_id, church_name);
$$;

revoke all on function private.update_church_name_impl(uuid, text) from public;
revoke all on function private.update_church_name_impl(uuid, text) from anon;
grant execute on function private.update_church_name_impl(uuid, text) to authenticated;

revoke all on function public.update_church_name(uuid, text) from public;
revoke all on function public.update_church_name(uuid, text) from anon;
grant execute on function public.update_church_name(uuid, text) to authenticated;
