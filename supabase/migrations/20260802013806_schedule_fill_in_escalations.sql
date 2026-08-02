do $$
declare
  job_name text;
begin
  foreach job_name in array array[
    'send-fill-in-escalations',
    'send-fill-in-escalations-every-five-minutes'
  ]
  loop
    if exists (select 1 from cron.job where jobname = job_name) then
      perform cron.unschedule(job_name);
    end if;
  end loop;
end $$;

select cron.schedule(
  'send-fill-in-escalations-every-five-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://cvgdxmmtrukahyvkgazj.supabase.co/functions/v1/send-fill-in-escalations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-music-ministry-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'fill_in_escalation_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
