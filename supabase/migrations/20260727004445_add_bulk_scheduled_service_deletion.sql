-- Additive migration; deployed without changing existing client APIs.
create index if not exists sent_reminders_service_key_idx
on public.sent_reminders ((split_part(reminder_key, ':', 1)));

create index if not exists notification_log_service_id_idx
on public.notification_log (service_id);

create or replace function public.manage_scheduled_services_bulk(
  target_church_id uuid,
  target_start_date date default null,
  target_end_date date default null,
  target_service_ids uuid[] default null,
  dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  maximum_service_count constant integer := 200;
  has_date_range boolean;
  has_explicit_ids boolean;
  matched_service_ids uuid[] := array[]::uuid[];
  matched_service_count integer := 0;
  distinct_service_count integer := 0;
  assignment_count integer := 0;
  fill_in_request_count integer := 0;
  song_count integer := 0;
  sent_reminder_count integer := 0;
  member_notification_count integer := 0;
  notification_log_count integer := 0;
  deleted_service_count integer := 0;
  deleted_sent_reminder_count integer := 0;
  deleted_member_notification_count integer := 0;
  deleted_notification_log_count integer := 0;
  service_preview jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not private.is_church_admin(target_church_id) then
    raise exception 'Only a church admin can manage scheduled services'
      using errcode = '42501';
  end if;

  if dry_run is null then
    raise exception 'Preview mode must be true or false'
      using errcode = '22023';
  end if;

  has_date_range := target_start_date is not null
    or target_end_date is not null;
  has_explicit_ids := target_service_ids is not null;

  if has_date_range and (
    target_start_date is null
    or target_end_date is null
    or target_start_date > target_end_date
  ) then
    raise exception 'A valid start and end date are required'
      using errcode = '22023';
  end if;

  if has_date_range = has_explicit_ids then
    raise exception 'Provide either a date range or explicit service IDs'
      using errcode = '22023';
  end if;

  if not dry_run and not has_explicit_ids then
    raise exception 'Apply requires the exact service IDs returned by preview'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bulk-service-delete:' || target_church_id::text,
      0
    )
  );

  if has_explicit_ids then
    if cardinality(target_service_ids) = 0
      or cardinality(target_service_ids) > maximum_service_count
      or array_position(target_service_ids, null) is not null then
      raise exception 'Select between 1 and % services', maximum_service_count
        using errcode = '22023';
    end if;

    select count(distinct submitted_id)
    into distinct_service_count
    from unnest(target_service_ids) as submitted(submitted_id);

    if distinct_service_count <> cardinality(target_service_ids) then
      raise exception 'Service selection contains duplicate IDs'
        using errcode = '22023';
    end if;

    select coalesce(array_agg(service.id order by service.date, service.time, service.id), array[]::uuid[])
    into matched_service_ids
    from public.services as service
    where service.id = any(target_service_ids)
      and service.church_id = target_church_id;

    if cardinality(matched_service_ids) <> cardinality(target_service_ids) then
      raise exception 'Every selected service must belong to this church'
        using errcode = '42501';
    end if;
  else
    select coalesce(array_agg(matched.id order by matched.date, matched.time, matched.id), array[]::uuid[])
    into matched_service_ids
    from (
      select service.id, service.date, service.time
      from public.services as service
      where service.church_id = target_church_id
        and service.date::date between target_start_date and target_end_date
      order by service.date, service.time, service.id
      limit maximum_service_count + 1
    ) as matched;

    if cardinality(matched_service_ids) > maximum_service_count then
      raise exception 'Date range matches more than % services; choose a smaller range',
        maximum_service_count
        using errcode = '22023';
    end if;
  end if;

  matched_service_count := cardinality(matched_service_ids);

  if matched_service_count > 0 then
    perform 1
    from public.services as service
    where service.id = any(matched_service_ids)
      and service.church_id = target_church_id
    order by service.id
    for update;
  end if;

  select count(*)
  into assignment_count
  from public.assignments as assignment
  where assignment.service_id = any(matched_service_ids);

  select count(*)
  into fill_in_request_count
  from public.fill_in_requests as request
  where request.service_id = any(matched_service_ids)
    and request.church_id = target_church_id;

  select count(*)
  into song_count
  from public.service_comments as song
  where song.service_id = any(matched_service_ids)
    and song.church_id = target_church_id;

  select count(*)
  into sent_reminder_count
  from public.sent_reminders as reminder
  where split_part(reminder.reminder_key, ':', 1)
    = any(matched_service_ids::text[]);

  select count(*)
  into member_notification_count
  from public.member_notifications as notification
  where notification.church_id = target_church_id
    and coalesce(
      notification.data ->> 'serviceId',
      notification.data ->> 'service_id'
    ) = any(matched_service_ids::text[]);

  select count(*)
  into notification_log_count
  from public.notification_log as log
  where log.service_id = any(matched_service_ids::text[]);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', service.id,
        'date', service.date::date,
        'time', service.time,
        'service_type', service.service_type,
        'assignment_count', (
          select count(*)
          from public.assignments as assignment
          where assignment.service_id = service.id
        ),
        'fill_in_request_count', (
          select count(*)
          from public.fill_in_requests as request
          where request.service_id = service.id
        ),
        'song_count', (
          select count(*)
          from public.service_comments as song
          where song.service_id = service.id
        ),
        'sent_reminder_count', (
          select count(*)
          from public.sent_reminders as reminder
          where split_part(reminder.reminder_key, ':', 1) = service.id::text
        ),
        'member_notification_count', (
          select count(*)
          from public.member_notifications as notification
          where notification.church_id = target_church_id
            and coalesce(
              notification.data ->> 'serviceId',
              notification.data ->> 'service_id'
            ) = service.id::text
        ),
        'notification_log_count', (
          select count(*)
          from public.notification_log as log
          where log.service_id = service.id::text
        )
      )
      order by service.date, service.time, service.id
    ),
    '[]'::jsonb
  )
  into service_preview
  from public.services as service
  where service.id = any(matched_service_ids)
    and service.church_id = target_church_id;

  if not dry_run and matched_service_count > 0 then
    delete from public.member_notifications as notification
    where notification.church_id = target_church_id
      and coalesce(
        notification.data ->> 'serviceId',
        notification.data ->> 'service_id'
      ) = any(matched_service_ids::text[]);
    get diagnostics deleted_member_notification_count = row_count;

    delete from public.notification_log as log
    where log.service_id = any(matched_service_ids::text[]);
    get diagnostics deleted_notification_log_count = row_count;

    delete from public.sent_reminders as reminder
    where split_part(reminder.reminder_key, ':', 1)
      = any(matched_service_ids::text[]);
    get diagnostics deleted_sent_reminder_count = row_count;

    delete from public.services as service
    where service.id = any(matched_service_ids)
      and service.church_id = target_church_id;
    get diagnostics deleted_service_count = row_count;

    if deleted_service_count <> matched_service_count
      or deleted_member_notification_count <> member_notification_count
      or deleted_notification_log_count <> notification_log_count
      or deleted_sent_reminder_count <> sent_reminder_count then
      raise exception 'Scheduled services changed during deletion; no changes were saved'
        using errcode = '40001';
    end if;
  end if;

  return jsonb_build_object(
    'operation', case when dry_run then 'preview' else 'applied' end,
    'service_count', matched_service_count,
    'service_ids', to_jsonb(matched_service_ids),
    'services', service_preview,
    'dependent_counts', jsonb_build_object(
      'assignments', assignment_count,
      'fill_in_requests', fill_in_request_count,
      'songs', song_count,
      'sent_reminders', sent_reminder_count,
      'member_notifications', member_notification_count,
      'notification_logs', notification_log_count
    ),
    'deleted_service_ids', case
      when dry_run then '[]'::jsonb
      else to_jsonb(matched_service_ids)
    end
  );
end;
$$;

revoke all on function public.manage_scheduled_services_bulk(
  uuid,
  date,
  date,
  uuid[],
  boolean
) from public;
revoke execute on function public.manage_scheduled_services_bulk(
  uuid,
  date,
  date,
  uuid[],
  boolean
) from anon;
grant execute on function public.manage_scheduled_services_bulk(
  uuid,
  date,
  date,
  uuid[],
  boolean
) to authenticated;
