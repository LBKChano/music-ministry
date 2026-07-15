create or replace function private.get_fill_in_requests_with_member_info_impl(
  target_church_id uuid
)
returns table (
  id uuid,
  assignment_id uuid,
  service_id uuid,
  church_id uuid,
  requesting_member_id uuid,
  role_name text,
  reason text,
  status text,
  filled_by_member_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  requesting_member_name text,
  requesting_member_email text,
  filled_by_member_name text,
  filled_by_member_email text
)
language sql
security definer
set search_path = public, private
as $$
  select
    fir.id,
    fir.assignment_id,
    fir.service_id,
    fir.church_id,
    fir.requesting_member_id,
    fir.role_name,
    fir.reason,
    fir.status::text,
    fir.filled_by_member_id,
    fir.created_at,
    fir.updated_at,
    coalesce(nullif(trim(requesting_member.name), ''), requesting_member.email, 'Member') as requesting_member_name,
    requesting_member.email as requesting_member_email,
    coalesce(nullif(trim(filled_member.name), ''), filled_member.email) as filled_by_member_name,
    filled_member.email as filled_by_member_email
  from public.fill_in_requests fir
  join public.churches c on c.id = fir.church_id
  left join public.church_members requesting_member
    on requesting_member.id = fir.requesting_member_id
   and requesting_member.church_id = fir.church_id
  left join public.church_members filled_member
    on filled_member.id = fir.filled_by_member_id
   and filled_member.church_id = fir.church_id
  where fir.church_id = target_church_id
    and (
      c.admin_id = (select auth.uid())
      or exists (
        select 1
        from public.church_members viewer
        where viewer.church_id = fir.church_id
          and viewer.member_id = (select auth.uid())
      )
    )
  order by fir.created_at desc;
$$;

create or replace function public.get_fill_in_requests_with_member_info(
  target_church_id uuid
)
returns table (
  id uuid,
  assignment_id uuid,
  service_id uuid,
  church_id uuid,
  requesting_member_id uuid,
  role_name text,
  reason text,
  status text,
  filled_by_member_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  requesting_member_name text,
  requesting_member_email text,
  filled_by_member_name text,
  filled_by_member_email text
)
language sql
security invoker
set search_path = public, private
as $$
  select *
  from private.get_fill_in_requests_with_member_info_impl(target_church_id);
$$;

revoke all on function private.get_fill_in_requests_with_member_info_impl(uuid) from public;
revoke all on function private.get_fill_in_requests_with_member_info_impl(uuid) from anon;
grant execute on function private.get_fill_in_requests_with_member_info_impl(uuid) to authenticated;

revoke all on function public.get_fill_in_requests_with_member_info(uuid) from public;
revoke all on function public.get_fill_in_requests_with_member_info(uuid) from anon;
grant execute on function public.get_fill_in_requests_with_member_info(uuid) to authenticated;
