-- If the first early-notification window has already passed, keep the plan
-- and deliver the first reminder at the event time. Recurring occurrences
-- retain the selected early-notification rule.
create or replace function public.dayris_create_finance_plan(
  p_id uuid,
  p_title text,
  p_amount numeric,
  p_currency text,
  p_kind text,
  p_local_at timestamp,
  p_timezone text,
  p_scheduled_at timestamptz,
  p_repeat_rule text default 'none',
  p_remind_offset text default 'at_time'
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid();
  reminder_was_clamped boolean := false;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(trim(coalesce(p_title, ''))) < 1 or length(trim(p_title)) > 120 then raise exception 'INVALID_TITLE'; end if;
  if p_amount is not null and p_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
  if p_kind not in ('expense', 'income') then raise exception 'INVALID_KIND'; end if;
  if p_repeat_rule not in ('none', 'weekly', 'monthly', 'yearly') then raise exception 'INVALID_REPEAT_RULE'; end if;
  if p_remind_offset not in ('at_time', '1_day', '3_days', '1_week') then raise exception 'INVALID_REMIND_OFFSET'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'INVALID_TIMEZONE'; end if;
  if p_local_at <= (now() at time zone p_timezone) then raise exception 'TIME_OUT_OF_RANGE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if exists(select 1 from public.reminders where id=p_id and user_id=u) then return p_id; end if;
  if p_scheduled_at <= now() then
    p_scheduled_at := p_local_at at time zone p_timezone;
    reminder_was_clamped := true;
  end if;
  if p_scheduled_at > now()+interval '5 years' then raise exception 'TIME_OUT_OF_RANGE'; end if;
  if not reminder_was_clamped and p_local_at <> ((p_scheduled_at at time zone p_timezone) + case p_remind_offset when '1_day' then interval '1 day' when '3_days' then interval '3 days' when '1_week' then interval '7 days' else interval '0 days' end) then raise exception 'LOCAL_TIME_MISMATCH'; end if;
  if (select count(*) from public.reminders where user_id=u and status='active' and scheduled_at>now())>=60 then raise exception 'PLAN_LIMIT'; end if;
  if not exists(select 1 from public.push_subscriptions where user_id=u and active) then raise exception 'NO_PUSH_DEVICE'; end if;
  insert into public.reminders(id,user_id,title,amount,currency,kind,local_at,timezone,scheduled_at,status,outcome,repeat_rule,remind_offset)
  values(p_id,u,trim(p_title),case when p_amount is null then null else round(p_amount,2) end,p_currency,p_kind,p_local_at,p_timezone,p_scheduled_at,'active','planned',p_repeat_rule,p_remind_offset);
  insert into public.reminder_deliveries(user_id,reminder_id,subscription_id)
    select u,p_id,id from public.push_subscriptions where user_id=u and active;
  return p_id;
end $$;

revoke all on function public.dayris_create_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.dayris_create_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text) to authenticated;
