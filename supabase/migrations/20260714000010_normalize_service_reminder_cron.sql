create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  reminder_job_name text;
begin
  foreach reminder_job_name in array array[
    'send-service-reminders',
    'send-service-reminders-hourly',
    'send-service-reminders-30min',
    'send-service-reminders-every-minute'
  ]
  loop
    if exists (select 1 from cron.job where jobname = reminder_job_name) then
      perform cron.unschedule(reminder_job_name);
    end if;
  end loop;
end $$;

select cron.schedule(
  'send-service-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://cvgdxmmtrukahyvkgazj.supabase.co/functions/v1/send-service-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
