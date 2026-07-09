alter table public.churches
add column if not exists song_type_options text[] not null
default array['Opening', 'Praise', 'Worship', 'Offering', 'Special', 'Closing', 'Other']::text[];

create or replace function public.update_church_song_type_options(
  target_church_id uuid,
  options text[]
)
returns public.churches
language plpgsql
security definer
set search_path = public, private
as $$
declare
  cleaned_options text[];
  updated_church public.churches;
begin
  if not private.is_church_admin(target_church_id) then
    raise exception 'Only church admins can update song type options'
      using errcode = '42501';
  end if;

  select array_agg(option order by first_position)
  into cleaned_options
  from (
    select option, min(position) as first_position
    from (
      select btrim(value) as option, position
      from unnest(coalesce(options, array[]::text[])) with ordinality as submitted(value, position)
      where btrim(value) <> ''
    ) trimmed
    group by option
  ) deduped;

  if cleaned_options is null or array_length(cleaned_options, 1) is null then
    raise exception 'At least one song type option is required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(cleaned_options) option
    where char_length(option) > 40
  ) then
    raise exception 'Song type options must be 40 characters or fewer'
      using errcode = '22023';
  end if;

  update public.churches
  set
    song_type_options = cleaned_options,
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

revoke all on function public.update_church_song_type_options(uuid, text[]) from public;
grant execute on function public.update_church_song_type_options(uuid, text[]) to authenticated;
