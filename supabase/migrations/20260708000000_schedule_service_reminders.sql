create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-service-reminders-every-minute') then
    perform cron.unschedule('send-service-reminders-every-minute');
  end if;
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
