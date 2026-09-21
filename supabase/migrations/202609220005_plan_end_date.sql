-- Recurring finance plans need an optional inclusive end date.
alter table public.reminders
  add column if not exists repeat_until date;

drop function if exists public.dayris_create_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date);
create function public.dayris_create_finance_plan(
  p_id uuid,
  p_title text,
  p_amount numeric,
  p_currency text,
  p_kind text,
  p_local_at timestamp,
  p_timezone text,
  p_scheduled_at timestamptz,
  p_repeat_rule text,
  p_remind_offset text,
  p_repeat_until date
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid();
  reminder_was_clamped boolean := false;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'INVALID_TIMEZONE'; end if;
  if length(trim(coalesce(p_title, ''))) < 1 or length(trim(p_title)) > 120 then raise exception 'INVALID_TITLE'; end if;
  if p_amount is not null and p_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
  if p_kind not in ('expense', 'income') then raise exception 'INVALID_KIND'; end if;
  if p_repeat_rule not in ('none', 'weekly', 'monthly', 'yearly') then raise exception 'INVALID_REPEAT_RULE'; end if;
  if p_remind_offset not in ('at_time', '1_day', '3_days', '1_week') then raise exception 'INVALID_REMIND_OFFSET'; end if;
  if p_repeat_until is not null and p_repeat_until < p_local_at::date then raise exception 'INVALID_REPEAT_UNTIL'; end if;
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
  insert into public.reminders(id,user_id,title,amount,currency,kind,local_at,timezone,scheduled_at,status,outcome,repeat_rule,remind_offset,repeat_until)
  values(p_id,u,trim(p_title),case when p_amount is null then null else round(p_amount,2) end,p_currency,p_kind,p_local_at,p_timezone,p_scheduled_at,'active','planned',p_repeat_rule,p_remind_offset,case when p_repeat_rule='none' then null else p_repeat_until end);
  insert into public.reminder_deliveries(user_id,reminder_id,subscription_id)
    select u,p_id,id from public.push_subscriptions where user_id=u and active;
  return p_id;
end $$;

revoke all on function public.dayris_create_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date) from public, anon, authenticated;
grant execute on function public.dayris_create_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date) to authenticated;

drop function if exists public.dayris_update_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date);
create function public.dayris_update_finance_plan(
  p_id uuid,
  p_title text,
  p_amount numeric,
  p_currency text,
  p_kind text,
  p_local_at timestamp,
  p_timezone text,
  p_scheduled_at timestamptz,
  p_repeat_rule text,
  p_remind_offset text,
  p_repeat_until date
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid();
  existing_reminder public.reminders;
  reminder_was_clamped boolean := false;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'INVALID_TIMEZONE'; end if;
  if length(trim(coalesce(p_title, ''))) < 1 or length(trim(p_title)) > 120 then raise exception 'INVALID_TITLE'; end if;
  if p_amount is not null and p_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
  if p_kind not in ('expense', 'income') then raise exception 'INVALID_KIND'; end if;
  if p_repeat_rule not in ('none', 'weekly', 'monthly', 'yearly') then raise exception 'INVALID_REPEAT_RULE'; end if;
  if p_remind_offset not in ('at_time', '1_day', '3_days', '1_week') then raise exception 'INVALID_REMIND_OFFSET'; end if;
  if p_repeat_until is not null and p_repeat_until < p_local_at::date then raise exception 'INVALID_REPEAT_UNTIL'; end if;
  if p_local_at <= (now() at time zone p_timezone) then raise exception 'TIME_OUT_OF_RANGE'; end if;

  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select * into existing_reminder from public.reminders where id=p_id and user_id=u and status='active' and outcome='planned' for update;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  if p_scheduled_at <= now() then
    p_scheduled_at := p_local_at at time zone p_timezone;
    reminder_was_clamped := true;
  end if;
  if p_scheduled_at > now()+interval '5 years' then raise exception 'TIME_OUT_OF_RANGE'; end if;
  if not reminder_was_clamped and p_local_at <> ((p_scheduled_at at time zone p_timezone) + case p_remind_offset when '1_day' then interval '1 day' when '3_days' then interval '3 days' when '1_week' then interval '7 days' else interval '0 days' end) then raise exception 'LOCAL_TIME_MISMATCH'; end if;
  if not exists(select 1 from public.push_subscriptions where user_id=u and active) then raise exception 'NO_PUSH_DEVICE'; end if;

  update public.reminders
  set title=trim(p_title), amount=case when p_amount is null then null else round(p_amount,2) end, currency=p_currency, kind=p_kind,
      local_at=p_local_at, timezone=p_timezone, scheduled_at=p_scheduled_at, repeat_rule=p_repeat_rule,
      remind_offset=p_remind_offset, repeat_until=case when p_repeat_rule='none' then null else p_repeat_until end,
      outcome='planned', status='active', resolved_at=null, resolved_trade_id=null
  where id=p_id and user_id=u;
  delete from public.reminder_deliveries where user_id=u and reminder_id=p_id;
  insert into public.reminder_deliveries(user_id,reminder_id,subscription_id)
    select u,p_id,id from public.push_subscriptions where user_id=u and active;
  return p_id;
end $$;

revoke all on function public.dayris_update_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date) from public, anon, authenticated;
grant execute on function public.dayris_update_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date) to authenticated;

create or replace function public.dayris_resolve_reminder(p_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path='' as $$
declare
  existing_reminder public.reminders;
  next_local timestamp;
  next_scheduled timestamptz;
  next_id uuid;
begin
  if p_outcome not in ('completed', 'missed', 'cancelled') then raise exception 'INVALID_OUTCOME'; end if;
  select * into existing_reminder from public.reminders where id=p_id and user_id=auth.uid() and outcome='planned' for update;
  if not found then return; end if;
  update public.reminders set outcome=p_outcome, status='cancelled', resolved_at=now() where id=existing_reminder.id;
  update public.reminder_deliveries set status='cancelled' where reminder_id=p_id and user_id=auth.uid() and status='pending';
  if existing_reminder.repeat_rule <> 'none' and p_outcome <> 'cancelled' then
    next_local := case existing_reminder.repeat_rule
      when 'weekly' then existing_reminder.local_at + interval '7 days'
      when 'monthly' then existing_reminder.local_at + interval '1 month'
      when 'yearly' then existing_reminder.local_at + interval '1 year'
    end;
    if existing_reminder.repeat_until is null or next_local::date <= existing_reminder.repeat_until then
      next_scheduled := (next_local - (case existing_reminder.remind_offset when '1_day' then interval '1 day' when '3_days' then interval '3 days' when '1_week' then interval '7 days' else interval '0 days' end)) at time zone existing_reminder.timezone;
      if next_scheduled > now() and next_scheduled <= now()+interval '365 days' then
        insert into public.reminders(user_id,title,amount,currency,kind,local_at,timezone,scheduled_at,status,outcome,repeat_rule,remind_offset,repeat_until)
        values(auth.uid(),existing_reminder.title,existing_reminder.amount,existing_reminder.currency,existing_reminder.kind,next_local,existing_reminder.timezone,next_scheduled,'active','planned',existing_reminder.repeat_rule,existing_reminder.remind_offset,existing_reminder.repeat_until)
        returning id into next_id;
        insert into public.reminder_deliveries(user_id,reminder_id,subscription_id)
          select auth.uid(), next_id, id from public.push_subscriptions where user_id=auth.uid() and active;
      end if;
    end if;
  end if;
end $$;
