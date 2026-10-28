begin;

-- Preserve existing earned counters, but visits can no longer advance them.
alter table public.account_activity_streaks add column last_entry_date date;
alter table public.account_activity_streaks drop constraint account_activity_streaks_current_streak_check;
alter table public.account_activity_streaks add constraint account_activity_streaks_current_streak_check check (current_streak between 0 and 36500);
alter table public.account_activity_streaks alter column current_streak set default 0;

create or replace function public.sync_activity_streak(
  p_time_zone text default 'UTC', p_legacy_device uuid default null,
  p_legacy_count integer default null, p_legacy_date date default null,
  p_legacy_paused boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  zone text;
  today date;
  state public.account_activity_streaks%rowtype;
  expired boolean;
begin
  if owner_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select name into zone from pg_catalog.pg_timezone_names where name = p_time_zone limit 1;
  zone := coalesce(zone, 'UTC');
  today := (now() at time zone zone)::date;
  insert into public.account_activity_streaks(user_id, current_streak, last_active_date, time_zone)
    values(owner_id, 0, today, zone) on conflict (user_id) do nothing;
  select * into strict state from public.account_activity_streaks where user_id = owner_id for update;
  today := (now() at time zone state.time_zone)::date;
  expired := today - state.last_active_date >= 3;
  -- No write on a read: repeated opens cannot extend the grace period, and old
  -- clients cannot re-import login counters after the new rule takes effect.
  return jsonb_build_object('accountId', owner_id,
    'currentStreak', case when expired then 0 else state.current_streak end,
    'lastActiveDate', state.last_active_date,
    'entryDate', state.last_entry_date, 'completedToday', state.last_entry_date = today,
    'paused', state.last_entry_date is distinct from today,
    'timeZone', state.time_zone, 'serverDate', today, 'rule', 'daily-entry');
end;
$$;

create function public.continue_streak_after_entry() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  state public.account_activity_streaks%rowtype;
  today date;
  distance integer;
  next_count integer;
begin
  -- Imported trading history is not a daily action by the person.
  if tg_table_name = 'trades' and lower(coalesce(to_jsonb(new)->>'platform', 'manual')) in ('ctrader','mt4','mt5') then return new; end if;
  if new.user_id is null then return new; end if;
  -- Initialize with UTC only when no account timezone has been selected yet.
  today := (now() at time zone 'UTC')::date;
  insert into public.account_activity_streaks(user_id, current_streak, last_active_date)
    values(new.user_id, 0, today) on conflict (user_id) do nothing;
  select * into strict state from public.account_activity_streaks where user_id = new.user_id for update;
  today := (now() at time zone state.time_zone)::date;
  if state.last_entry_date >= today then return new; end if;
  distance := today - state.last_active_date;
  next_count := case
    when state.current_streak = 0 or distance >= 3 then 1
    when distance = 1 then least(36500, state.current_streak + 1)
    else state.current_streak end;
  update public.account_activity_streaks set current_streak = next_count,
    last_active_date = today, last_entry_date = today, paused = false, updated_at = now()
    where user_id = new.user_id;
  return new;
end;
$$;
revoke all on function public.continue_streak_after_entry() from public, anon, authenticated;
create trigger trades_continue_activity_streak after insert on public.trades
  for each row execute function public.continue_streak_after_entry();
create trigger wallet_continue_activity_streak after insert on public.wallet_transactions
  for each row execute function public.continue_streak_after_entry();
notify pgrst, 'reload schema';
commit;
