alter table public.church_roles
  add column if not exists icon_key text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'church_roles_icon_key_allowed'
      and conrelid = 'public.church_roles'::pg_catalog.regclass
  ) then
    alter table public.church_roles
      add constraint church_roles_icon_key_allowed
      check (
        icon_key is null
        or icon_key = any (array[
          'microphone',
          'keyboard',
          'guitar',
          'drums',
          'music',
          'reading',
          'presentation',
          'sound',
          'camera',
          'hospitality',
          'person'
        ]::text[])
      );
  end if;
end;
$$;

comment on column public.church_roles.icon_key is
  'Optional controlled presentation key. Role matching and scheduling continue to use the role name and ID.';

create or replace function private.save_church_role_admin_v2_impl(
  target_church_id uuid,
  target_role_id uuid,
  role_name text,
  role_description text,
  role_icon_key text
)
returns public.church_roles
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_icon_key text := nullif(pg_catalog.lower(pg_catalog.btrim(role_icon_key)), '');
  saved_role public.church_roles;
begin
  if normalized_icon_key is not null
    and normalized_icon_key <> all (array[
      'microphone',
      'keyboard',
      'guitar',
      'drums',
      'music',
      'reading',
      'presentation',
      'sound',
      'camera',
      'hospitality',
      'person'
    ]::text[]) then
    raise exception 'Unknown role icon key' using errcode = '22023';
  end if;

  saved_role := private.save_church_role_admin_impl(
    target_church_id,
    target_role_id,
    role_name,
    role_description
  );

  update public.church_roles
  set
    icon_key = normalized_icon_key,
    updated_at = pg_catalog.now()
  where id = saved_role.id
    and church_id = target_church_id
  returning * into saved_role;

  return saved_role;
end;
$$;

create or replace function public.save_church_role_admin_v2(
  target_church_id uuid,
  target_role_id uuid,
  role_name text,
  role_description text,
  role_icon_key text
)
returns public.church_roles
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.save_church_role_admin_v2_impl(
    target_church_id,
    target_role_id,
    role_name,
    role_description,
    role_icon_key
  );
$$;

revoke all on function private.save_church_role_admin_v2_impl(uuid, uuid, text, text, text)
  from public, anon;
revoke all on function public.save_church_role_admin_v2(uuid, uuid, text, text, text)
  from public, anon;

grant execute on function private.save_church_role_admin_v2_impl(uuid, uuid, text, text, text)
  to authenticated;
grant execute on function public.save_church_role_admin_v2(uuid, uuid, text, text, text)
  to authenticated;
