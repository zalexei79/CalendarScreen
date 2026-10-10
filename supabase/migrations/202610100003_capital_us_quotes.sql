begin;

alter table public.capital_assets
  drop constraint if exists capital_assets_quote_source_check;
alter table public.capital_assets
  add constraint capital_assets_quote_source_check
  check (quote_source in ('binance','manual','moex','alphavantage'));
alter table public.capital_assets
  add constraint capital_assets_alphavantage_quote_check
  check (
    quote_source <> 'alphavantage'
    or (category in ('stock','etf') and currency = 'USD' and symbol ~ '^[A-Z][A-Z0-9.-]{0,9}$')
  );

create table if not exists public.capital_market_quote_cache (
  provider text not null check (provider = 'alphavantage'),
  symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  currency text not null default 'USD' check (currency = 'USD'),
  quote_as_of date not null,
  last_checked_on date not null,
  last_after_close_check_on date,
  price numeric(30,12) not null check (price >= 0),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (provider, symbol)
);

alter table public.capital_market_quote_cache enable row level security;
revoke all on public.capital_market_quote_cache from public, anon, authenticated;
grant all on public.capital_market_quote_cache to service_role;

commit;
