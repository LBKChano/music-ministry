alter table public.service_comments
  add column if not exists display_order integer;

with ranked_comments as (
  select
    id,
    row_number() over (
      partition by service_id
      order by created_at, id
    ) - 1 as display_order
  from public.service_comments
)
update public.service_comments as service_comment
set display_order = ranked_comments.display_order
from ranked_comments
where service_comment.id = ranked_comments.id
  and service_comment.display_order is null;

alter table public.service_comments
  drop constraint if exists service_comments_display_order_nonnegative,
  add constraint service_comments_display_order_nonnegative
    check (display_order is null or display_order >= 0);

create index if not exists service_comments_service_display_order_idx
on public.service_comments (
  service_id,
  display_order asc nulls last,
  created_at,
  id
);

create or replace function private.assign_service_comment_display_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.services as service
  where service.id = new.service_id
  for update;

  if new.display_order is not null then
    return new;
  end if;

  select coalesce(max(service_comment.display_order), -1) + 1
  into new.display_order
  from public.service_comments as service_comment
  where service_comment.service_id = new.service_id;

  return new;
end;
$$;

revoke all on function private.assign_service_comment_display_order() from public;

drop trigger if exists assign_service_comment_display_order
on public.service_comments;

create trigger assign_service_comment_display_order
before insert on public.service_comments
for each row
execute function private.assign_service_comment_display_order();

create or replace function public.reorder_service_songs(
  target_service_id uuid,
  ordered_comment_ids uuid[]
)
returns setof public.service_comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_church_id uuid;
  submitted_count integer;
  distinct_count integer;
  service_comment_count integer;
  matching_comment_count integer;
  reorder_timestamp timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select service.church_id
  into target_church_id
  from public.services as service
  where service.id = target_service_id
  for update;

  if target_church_id is null then
    raise exception 'Service not found'
      using errcode = 'P0002';
  end if;

  if not (
    private.is_church_admin(target_church_id)
    or exists (
      select 1
      from public.assignments as assignment
      join public.church_members as church_member
        on church_member.id = assignment.member_id
       and church_member.church_id = target_church_id
      where assignment.service_id = target_service_id
        and church_member.member_id = (select auth.uid())
    )
  ) then
    raise exception 'Only an admin or a member assigned to this service can reorder songs'
      using errcode = '42501';
  end if;

  perform 1
  from public.service_comments as service_comment
  where service_comment.service_id = target_service_id
    and service_comment.church_id = target_church_id
  order by service_comment.id
  for update;

  if ordered_comment_ids is null
    or array_position(ordered_comment_ids, null) is not null then
    raise exception 'Song order must contain a non-null list of song IDs'
      using errcode = '22023';
  end if;

  submitted_count := cardinality(ordered_comment_ids);

  select count(distinct submitted_id)
  into distinct_count
  from unnest(ordered_comment_ids) as submitted(submitted_id);

  if submitted_count <> distinct_count then
    raise exception 'Song order contains duplicate IDs'
      using errcode = '22023';
  end if;

  select count(*)
  into service_comment_count
  from public.service_comments as service_comment
  where service_comment.service_id = target_service_id
    and service_comment.church_id = target_church_id;

  select count(*)
  into matching_comment_count
  from public.service_comments as service_comment
  where service_comment.service_id = target_service_id
    and service_comment.church_id = target_church_id
    and service_comment.id = any(ordered_comment_ids);

  if submitted_count <> service_comment_count
    or matching_comment_count <> service_comment_count then
    raise exception 'Song order must contain every song for this service exactly once'
      using errcode = '22023';
  end if;

  reorder_timestamp := clock_timestamp();

  update public.service_comments as service_comment
  set
    display_order = submitted.position::integer - 1,
    updated_at = reorder_timestamp
  from unnest(ordered_comment_ids) with ordinality
    as submitted(comment_id, position)
  where service_comment.id = submitted.comment_id
    and service_comment.service_id = target_service_id
    and service_comment.church_id = target_church_id;

  return query
  select service_comment.*
  from public.service_comments as service_comment
  where service_comment.service_id = target_service_id
    and service_comment.church_id = target_church_id
  order by
    service_comment.display_order,
    service_comment.created_at,
    service_comment.id;
end;
$$;

revoke all on function public.reorder_service_songs(uuid, uuid[]) from public;
revoke execute on function public.reorder_service_songs(uuid, uuid[]) from anon;
grant execute on function public.reorder_service_songs(uuid, uuid[]) to authenticated;
