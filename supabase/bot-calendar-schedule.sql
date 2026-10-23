-- Run AFTER the migration and worker deployment, using SQL Editor as owner.
-- Reuse the existing DAYRIS internal scheduler credential in Vault. No new
-- browser credential, service-role exposure or changes to the reminders job.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='dayris_cron_secret')
    then raise exception 'Missing dayris_cron_secret in Vault'; end if;
end $$;

select cron.schedule('dayris-bot-calendar-daily','15 0 * * *', $$
  select net.http_post(
    url:='https://mqdejoorgmhfgfzwpyog.supabase.co/functions/v1/bot-calendar-sync',
    headers:=jsonb_build_object('Content-Type','application/json','x-dayris-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='dayris_cron_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=120000
  );
$$);
