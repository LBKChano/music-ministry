alter table public.service_comments
  add column if not exists song_type text not null default 'Song',
  add column if not exists song_number text;

alter table public.service_comments
  drop constraint if exists service_comments_song_type_not_blank,
  add constraint service_comments_song_type_not_blank
    check (char_length(btrim(song_type)) > 0);

alter table public.service_comments
  drop constraint if exists service_comments_song_number_length,
  add constraint service_comments_song_number_length
    check (song_number is null or char_length(btrim(song_number)) <= 40);

update public.service_comments
set
  song_type = coalesce(nullif(btrim(song_type), ''), 'Song'),
  song_number = nullif(btrim(song_number), '')
where song_type is null
  or btrim(song_type) = ''
  or song_number is not null;

grant update on public.service_comments to authenticated;

drop policy if exists "Church members can update own service comments" on public.service_comments;
create policy "Church members can update own service comments"
on public.service_comments
for update
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
)
with check (
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
