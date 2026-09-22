-- Optional installment counter for recurring finance plans.
alter table public.reminders
  add column if not exists repeat_total integer,
  add column if not exists repeat_index integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reminders'::regclass
      and conname = 'reminders_repeat_total_check'
  ) then
    alter table public.reminders
      add constraint reminders_repeat_total_check
      check (repeat_total is null or repeat_total between 1 and 600);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reminders'::regclass
      and conname = 'reminders_repeat_index_check'
  ) then
    alter table public.reminders
      add constraint reminders_repeat_index_check
      check (repeat_index between 1 and 600);
  end if;
end $$;

-- Keep the previous 11-argument API intact and add a counter-aware overload.
drop function if exists public.dayris_create_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date,integer);
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
  p_repeat_until date,
  p_repeat_total integer
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid();
  v_id uuid;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_repeat_total is not null and (p_repeat_total < 1 or p_repeat_total > 600) then
    raise exception 'INVALID_REPEAT_TOTAL';
  end if;

  v_id := public.dayris_create_finance_plan(
    p_id, p_title, p_amount, p_currency, p_kind, p_local_at,
    p_timezone, p_scheduled_at, p_repeat_rule, p_remind_offset, p_repeat_until
  );

  update public.reminders
  set repeat_total = case when p_repeat_rule = 'none' then null else p_repeat_total end,
      repeat_index = 1
  where id = v_id and user_id = u;
  return v_id;
end $$;

revoke all on function public.dayris_create_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date,integer) from public, anon, authenticated;
grant execute on function public.dayris_create_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date,integer) to authenticated;

drop function if exists public.dayris_update_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date,integer);
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
  p_repeat_until date,
  p_repeat_total integer
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid();
  v_id uuid;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_repeat_total is not null and (p_repeat_total < 1 or p_repeat_total > 600) then
    raise exception 'INVALID_REPEAT_TOTAL';
  end if;

  v_id := public.dayris_update_finance_plan(
    p_id, p_title, p_amount, p_currency, p_kind, p_local_at,
    p_timezone, p_scheduled_at, p_repeat_rule, p_remind_offset, p_repeat_until
  );

  update public.reminders
  set repeat_total = case when p_repeat_rule = 'none' then null else p_repeat_total end,
      repeat_index = 1
  where id = v_id and user_id = u;
  return v_id;
end $$;

revoke all on function public.dayris_update_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date,integer) from public, anon, authenticated;
grant execute on function public.dayris_update_finance_plan(uuid,text,numeric,text,text,timestamp,text,timestamptz,text,text,date,integer) to authenticated;

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
  if existing_reminder.repeat_rule <> 'none'
     and p_outcome <> 'cancelled'
     and (existing_reminder.repeat_total is null or existing_reminder.repeat_index < existing_reminder.repeat_total) then
    next_local := case existing_reminder.repeat_rule
      when 'weekly' then existing_reminder.local_at + interval '7 days'
      when 'monthly' then existing_reminder.local_at + interval '1 month'
      when 'yearly' then existing_reminder.local_at + interval '1 year'
    end;
    if existing_reminder.repeat_until is null or next_local::date <= existing_reminder.repeat_until then
      next_scheduled := (next_local - (case existing_reminder.remind_offset when '1_day' then interval '1 day' when '3_days' then interval '3 days' when '1_week' then interval '7 days' else interval '0 days' end)) at time zone existing_reminder.timezone;
      if next_scheduled > now() and next_scheduled <= now()+interval '365 days' then
        insert into public.reminders(user_id,title,amount,currency,kind,local_at,timezone,scheduled_at,status,outcome,repeat_rule,remind_offset,repeat_until,repeat_total,repeat_index)
        values(auth.uid(),existing_reminder.title,existing_reminder.amount,existing_reminder.currency,existing_reminder.kind,next_local,existing_reminder.timezone,next_scheduled,'active','planned',existing_reminder.repeat_rule,existing_reminder.remind_offset,existing_reminder.repeat_until,existing_reminder.repeat_total,existing_reminder.repeat_index + 1)
        returning id into next_id;
        insert into public.reminder_deliveries(user_id,reminder_id,subscription_id)
          select auth.uid(), next_id, id from public.push_subscriptions where user_id=auth.uid() and active;
      end if;
    end if;
  end if;
end $$;
