begin;

do $$
declare
  role_column_is_nullable boolean;
  icon_constraint_exists boolean;
  legacy_function_exists boolean;
  versioned_function_exists boolean;
begin
  select columns.is_nullable = 'YES'
  into role_column_is_nullable
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name = 'church_roles'
    and columns.column_name = 'icon_key';

  if role_column_is_nullable is distinct from true then
    raise exception 'church_roles.icon_key must remain nullable for released clients';
  end if;

  select exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'church_roles_icon_key_allowed'
      and conrelid = 'public.church_roles'::pg_catalog.regclass
  ) into icon_constraint_exists;

  if not icon_constraint_exists then
    raise exception 'Role icon keys are not constrained';
  end if;

  select pg_catalog.to_regprocedure(
    'public.save_church_role_admin(uuid,uuid,text,text)'
  ) is not null into legacy_function_exists;

  if not legacy_function_exists then
    raise exception 'Released save_church_role_admin contract was removed';
  end if;

  select pg_catalog.to_regprocedure(
    'public.save_church_role_admin_v2(uuid,uuid,text,text,text)'
  ) is not null into versioned_function_exists;

  if not versioned_function_exists then
    raise exception 'Versioned role-symbol save contract is missing';
  end if;
end;
$$;

rollback;
