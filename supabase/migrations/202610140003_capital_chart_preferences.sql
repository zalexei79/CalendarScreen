begin;
create table if not exists public.capital_chart_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check (provider in ('binance','moex','alphavantage')),
 symbol text not null check (symbol ~ '^[A-Z0-9.-]{1,24}$'),
 timeframe text not null default '1d' check (timeframe in ('1m','5m','15m','1h','4h','1d','1w','1M')),
 sma boolean not null default false,
 rsi boolean not null default false,
 volume boolean not null default false,
 primary key (user_id,provider,symbol),
 check (provider='binance' or timeframe in ('1d','1w','1M'))
);
alter table public.capital_chart_preferences enable row level security;
revoke all on public.capital_chart_preferences from anon;
grant select,insert,update,delete on public.capital_chart_preferences to authenticated;
grant all on public.capital_chart_preferences to service_role;
drop policy if exists capital_chart_owner_pro on public.capital_chart_preferences;
create policy capital_chart_owner_pro on public.capital_chart_preferences for all to authenticated
 using (user_id=(select auth.uid()) and (select public.dayris_capital_has_pro()))
 with check (user_id=(select auth.uid()) and (select public.dayris_capital_has_pro()));

commit;
