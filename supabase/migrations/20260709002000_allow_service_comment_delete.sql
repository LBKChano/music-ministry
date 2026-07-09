drop policy if exists "Church members can delete own service comments" on public.service_comments;

create policy "Church members can delete own service comments"
on public.service_comments
for delete
to authenticated
using (
  exists (
    select 1
    from public.services s
    where s.id = service_comments.service_id
      and s.church_id = service_comments.church_id
  )
  and (
    exists (
      select 1
      from public.church_members cm
      where cm.id = service_comments.member_id
        and cm.church_id = service_comments.church_id
        and cm.member_id = (select auth.uid())
    )
    or private.is_church_admin(service_comments.church_id)
  )
);
