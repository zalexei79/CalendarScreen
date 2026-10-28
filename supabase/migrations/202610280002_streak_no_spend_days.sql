begin;
create table public.streak_no_spend_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key(user_id, day)
);
alter table public.streak_no_spend_days enable row level security;
revoke all on public.streak_no_spend_days from public, anon, authenticated;
grant select on public.streak_no_spend_days to authenticated;
create policy no_spend_read_own on public.streak_no_spend_days for select to authenticated using(user_id=auth.uid());

-- Both real entries and a no-spend check-in use one locked daily counter.
create function public.record_streak_day(p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.account_activity_streaks%rowtype; today date; distance integer;
begin
  today := (now() at time zone 'UTC')::date;
  insert into public.account_activity_streaks(user_id,current_streak,last_active_date)
    values(p_owner,0,today) on conflict(user_id) do nothing;
  select * into strict s from public.account_activity_streaks where user_id=p_owner for update;
  today := (now() at time zone s.time_zone)::date;
  if s.last_entry_date >= today then return; end if;
  distance := today-s.last_active_date;
  update public.account_activity_streaks set current_streak=case
    when s.current_streak=0 or distance>=3 then 1
    when distance=1 then least(36500,s.current_streak+1) else s.current_streak end,
    last_active_date=today,last_entry_date=today,paused=false,updated_at=now() where user_id=p_owner;
end $$;
revoke all on function public.record_streak_day(uuid) from public,anon,authenticated;

create or replace function public.continue_streak_after_entry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='trades' and lower(coalesce(to_jsonb(new)->>'platform','manual')) in ('ctrader','mt4','mt5') then return new; end if;
  if new.user_id is not null then perform public.record_streak_day(new.user_id); end if;
  return new;
end $$;

create or replace function public.sync_activity_streak(
  p_time_zone text default 'UTC',p_legacy_device uuid default null,p_legacy_count integer default null,
  p_legacy_date date default null,p_legacy_paused boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); zone text; today date; s public.account_activity_streaks%rowtype;
begin
  if owner_id is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select name into zone from pg_catalog.pg_timezone_names where name=p_time_zone limit 1;
  zone:=coalesce(zone,'UTC'); today:=(now() at time zone zone)::date;
  insert into public.account_activity_streaks(user_id,current_streak,last_active_date,time_zone)
    values(owner_id,0,today,zone) on conflict(user_id) do nothing;
  select * into strict s from public.account_activity_streaks where user_id=owner_id for update;
  today:=(now() at time zone s.time_zone)::date;
  return jsonb_build_object('accountId',owner_id,'currentStreak',case when today-s.last_active_date>=3 then 0 else s.current_streak end,
    'lastActiveDate',s.last_active_date,'entryDate',s.last_entry_date,'completedToday',s.last_entry_date=today,
    'paused',s.last_entry_date is distinct from today,'timeZone',s.time_zone,'serverDate',today,'rule','daily-entry',
    'noSpendToday',exists(select 1 from public.streak_no_spend_days where user_id=owner_id and day=today));
end $$;

create function public.mark_streak_no_spend(p_time_zone text default 'UTC') returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); state jsonb; today date; inserted integer;
begin
  -- This initializes the account timezone and holds its row lock through both
  -- validation and credit. Neither owner nor day comes from the client.
  state:=public.sync_activity_streak(p_time_zone);
  today:=(state->>'serverDate')::date;
  if exists(select 1 from public.trades where user_id=owner_id and date_key=today::text and pnl<0
      and lower(coalesce(platform,'manual')) not in ('ctrader','mt4','mt5'))
    or exists(select 1 from public.wallet_transactions where user_id=owner_id and date_key=today and kind='expense' and amount>0)
    then raise exception 'STREAK_HAS_EXPENSES' using errcode='P0001'; end if;
  insert into public.streak_no_spend_days(user_id,day) values(owner_id,today) on conflict do nothing;
  get diagnostics inserted=row_count;
  perform public.record_streak_day(owner_id);
  if inserted>0 then update public.account_activity_streaks set updated_at=now() where user_id=owner_id; end if;
  return public.sync_activity_streak(p_time_zone);
end $$;
revoke all on function public.mark_streak_no_spend(text) from public,anon;
grant execute on function public.mark_streak_no_spend(text) to authenticated;

-- If spending is added later (including an edit), remove the no-spend label.
-- The saved entry itself still qualifies, so the streak stays earned.
create function public.invalidate_no_spend_after_expense() returns trigger
language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
  if new.user_id is null then return new; end if;
  if tg_table_name='trades' then
    if not(coalesce((to_jsonb(new)->>'pnl')::numeric,0)<0 and lower(coalesce(to_jsonb(new)->>'platform','manual')) not in ('ctrader','mt4','mt5')) then return new; end if;
  elsif not(coalesce(to_jsonb(new)->>'kind','')='expense' and coalesce((to_jsonb(new)->>'amount')::numeric,0)>0) then return new;
  end if;
  perform 1 from public.account_activity_streaks where user_id=new.user_id for update;
  delete from public.streak_no_spend_days where user_id=new.user_id and day::text=new.date_key::text;
  get diagnostics removed=row_count;
  if removed>0 then update public.account_activity_streaks set updated_at=now() where user_id=new.user_id; end if;
  return new;
end $$;
revoke all on function public.invalidate_no_spend_after_expense() from public,anon,authenticated;
create trigger trades_invalidate_no_spend after insert or update on public.trades
  for each row execute function public.invalidate_no_spend_after_expense();
create trigger wallet_invalidate_no_spend after insert or update on public.wallet_transactions
  for each row execute function public.invalidate_no_spend_after_expense();
notify pgrst,'reload schema';
commit;
