-- Run AFTER the migration and worker deployment, using SQL Editor as owner.
-- Reuse the existing DAYRIS internal scheduler credential in Vault. No new
-- browser credential, service-role exposure or changes to the reminders job.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='dayris_cron_secret')
    then raise exception 'Missing dayris_cron_secret in Vault'; end if;
end $$;

-- pg_cron runs in UTC. Cover both winter and summer offsets, then gate by
-- Bucharest local time so DST never shifts the requested 08:00–20:00 window.
select cron.schedule('dayris-bot-calendar-hourly','0 5-18 * * *', $$
  select net.http_post(
    url:='https://mqdejoorgmhfgfzwpyog.supabase.co/functions/v1/bot-calendar-sync',
    headers:=jsonb_build_object('Content-Type','application/json','x-dayris-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='dayris_cron_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=120000
  ) where extract(hour from now() at time zone 'Europe/Bucharest') between 8 and 20;
$$);

-- Replace the former daily job; leave all other DAYRIS schedules untouched.
select cron.unschedule(jobid) from cron.job where jobname='dayris-bot-calendar-daily';
commit;
