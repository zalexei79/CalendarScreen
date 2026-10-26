begin;

create table public.account_activity_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 1 check (current_streak between 1 and 36500),
  last_active_date date not null,
  paused boolean not null default false,
  time_zone text not null default 'UTC',
  legacy_import_until timestamptz not null default (now() + interval '14 days'),
  updated_at timestamptz not null default now()
);
create table public.activity_streak_legacy_imports (
  user_id uuid not null references public.account_activity_streaks(user_id) on delete cascade,
  device_id uuid not null,
  primary key (user_id, device_id)
);
alter table public.account_activity_streaks enable row level security;
alter table public.activity_streak_legacy_imports enable row level security;
revoke all on public.account_activity_streaks, public.activity_streak_legacy_imports from public, anon, authenticated;
grant select on public.account_activity_streaks to authenticated;
create policy account_streak_read_own on public.account_activity_streaks for select to authenticated using (user_id = auth.uid());

-- The caller never supplies an account ID, a current day or a new counter.
-- A row lock makes simultaneous visits from multiple devices count just once.
create function public.sync_activity_streak(
  p_time_zone text default 'UTC',
  p_legacy_device uuid default null,
  p_legacy_count integer default null,
  p_legacy_date date default null,
  p_legacy_paused boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  zone text;
  today date;
  state public.account_activity_streaks%rowtype;
  next_count integer;
  next_paused boolean;
  distance integer;
  imported integer;
  legacy_count integer;
  legacy_paused boolean;
begin
  if owner_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select name into zone from pg_catalog.pg_timezone_names where name = p_time_zone limit 1;
  zone := coalesce(zone, 'UTC');
  today := (now() at time zone zone)::date;
  insert into public.account_activity_streaks(user_id, last_active_date, time_zone)
    values(owner_id, today, zone) on conflict (user_id) do nothing;
  select * into strict state from public.account_activity_streaks where user_id = owner_id for update;
  -- Once selected, the account's day boundary is identical on every device.
  today := (now() at time zone state.time_zone)::date;
  distance := today - state.last_active_date;
  next_count := state.current_streak;
  next_paused := state.paused;
  if distance = 1 then next_count := least(36500, next_count + 1); next_paused := false;
  elsif distance = 2 then next_paused := true;
  elsif distance >= 3 then next_count := 1; next_paused := false;
  end if;

  -- Recover existing device-only streaks once per browser during rollout.
  -- Take the larger active streak, never sum devices or resurrect expired data.
  if p_legacy_device is not null and now() <= state.legacy_import_until then
    insert into public.activity_streak_legacy_imports values(owner_id, p_legacy_device) on conflict do nothing;
    get diagnostics imported = row_count;
    if imported = 1 and p_legacy_count between 1 and 36500 and p_legacy_date between today - 2 and today then
      legacy_count := p_legacy_count;
      legacy_paused := coalesce(p_legacy_paused, false);
      if p_legacy_date = today - 1 then legacy_count := least(36500, legacy_count + 1); legacy_paused := false;
      elsif p_legacy_date = today - 2 then legacy_paused := true;
      end if;
      if legacy_count > next_count then next_count := legacy_count; next_paused := legacy_paused;
      elsif legacy_count = next_count then next_paused := next_paused and legacy_paused;
      end if;
    end if;
  end if;
  if (state.current_streak, state.last_active_date, state.paused) is distinct from (next_count, greatest(today, state.last_active_date), next_paused) then
    update public.account_activity_streaks set current_streak = next_count,
      last_active_date = greatest(today, state.last_active_date), paused = next_paused, updated_at = now()
      where user_id = owner_id returning * into state;
  end if;
  return jsonb_build_object('accountId', owner_id, 'currentStreak', state.current_streak, 'lastActiveDate', state.last_active_date,
    'paused', state.paused, 'timeZone', state.time_zone, 'serverDate', today);
end;
$$;
revoke all on function public.sync_activity_streak(text, uuid, integer, date, boolean) from public, anon;
grant execute on function public.sync_activity_streak(text, uuid, integer, date, boolean) to authenticated;

do $$ begin
  if exists(select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
    and not exists(select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'account_activity_streaks') then
    alter publication supabase_realtime add table public.account_activity_streaks;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
