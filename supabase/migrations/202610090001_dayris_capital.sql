begin;

create table if not exists public.capital_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  symbol text not null default '' check (length(symbol) <= 24),
  category text not null check (category in ('stock','etf','crypto','metal','real_estate','bond','deposit','other')),
  currency text not null check (currency ~ '^[A-Z]{3}$' or currency = 'USDT'),
  quote_source text not null default 'manual' check (quote_source in ('binance','manual')),
  manual_price numeric(24,10) not null default 0 check (manual_price >= 0),
  initial_manual_price numeric(24,10) not null default 0 check (initial_manual_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.capital_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null,
  operation text not null check (operation in ('buy','sell','revalue','dividend')),
  quantity numeric(28,12) not null check (quantity >= 0),
  unit_price numeric(24,10) not null check (unit_price >= 0),
  fee numeric(24,10) not null default 0 check (fee >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$' or currency = 'USDT'),
  occurred_on date not null,
  created_at timestamptz not null default now(),
  foreign key (user_id, asset_id) references public.capital_assets(user_id, id) on delete cascade,
  unique (user_id, id)
);

create table if not exists public.capital_valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$' or currency = 'USDT'),
  portfolio_value numeric(24,10) not null check (portfolio_value >= 0),
  sampled_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id,currency,sampled_on)
);

create index if not exists capital_assets_user_idx on public.capital_assets(user_id, created_at);
create index if not exists capital_operations_user_asset_date_idx on public.capital_operations(user_id, asset_id, occurred_on, created_at);
create index if not exists capital_snapshots_user_date_idx on public.capital_valuation_snapshots(user_id,currency,sampled_on);

alter table public.capital_assets enable row level security;
alter table public.capital_operations enable row level security;
alter table public.capital_valuation_snapshots enable row level security;
revoke all on public.capital_assets, public.capital_operations, public.capital_valuation_snapshots from public, anon, authenticated;
grant select on public.capital_assets, public.capital_operations, public.capital_valuation_snapshots to authenticated;

create or replace function public.dayris_capital_has_pro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pro_entitlements e
    where e.user_id = (select auth.uid())
      and e.starts_at <= now()
      and e.ends_at > now()
  );
$$;
revoke all on function public.dayris_capital_has_pro() from public, anon;
grant execute on function public.dayris_capital_has_pro() to authenticated;

drop policy if exists capital_assets_own on public.capital_assets;
create policy capital_assets_own on public.capital_assets for select to authenticated
  using ((select auth.uid()) = user_id and (select public.dayris_capital_has_pro()));
drop policy if exists capital_operations_own on public.capital_operations;
create policy capital_operations_own on public.capital_operations for select to authenticated
  using ((select auth.uid()) = user_id and (select public.dayris_capital_has_pro()));
drop policy if exists capital_snapshots_own on public.capital_valuation_snapshots;
create policy capital_snapshots_own on public.capital_valuation_snapshots for select to authenticated
  using ((select auth.uid()) = user_id and (select public.dayris_capital_has_pro()));

create or replace function public.capital_create_asset(
  p_name text, p_symbol text, p_category text, p_currency text, p_quote_source text,
  p_manual_price numeric, p_quantity numeric, p_unit_price numeric, p_fee numeric, p_occurred_on date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_asset uuid;
begin
  if v_user is null or not public.dayris_capital_has_pro() then raise exception 'PRO access required'; end if;
  if p_quantity <= 0 or p_unit_price < 0 or p_fee < 0 or p_manual_price < 0 or p_occurred_on > current_date then raise exception 'Invalid amount or date'; end if;
  if p_quote_source='binance' and (p_category <> 'crypto' or p_currency <> 'USDT' or upper(trim(coalesce(p_symbol,''))) !~ '^[A-Z0-9]{5,20}$') then
    raise exception 'Binance quotes require a crypto asset in USDT';
  end if;
  insert into public.capital_assets(user_id,name,symbol,category,currency,quote_source,manual_price,initial_manual_price)
  values(v_user,trim(p_name),upper(trim(coalesce(p_symbol,''))),p_category,p_currency,p_quote_source,p_manual_price,p_manual_price)
  returning id into v_asset;
  insert into public.capital_operations(user_id,asset_id,operation,quantity,unit_price,fee,currency,occurred_on)
  values(v_user,v_asset,'buy',p_quantity,p_unit_price,p_fee,p_currency,p_occurred_on);
  return v_asset;
end $$;

create or replace function public.capital_record_operation(
  p_asset_id uuid, p_operation text, p_quantity numeric, p_unit_price numeric, p_fee numeric, p_occurred_on date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_quote_source text; v_asset_currency text; v_invalid_position boolean; v_operation uuid;
begin
  if v_user is null or not public.dayris_capital_has_pro() then raise exception 'PRO access required'; end if;
  select quote_source,currency into v_quote_source,v_asset_currency from public.capital_assets
    where id=p_asset_id and user_id=v_user for update;
  if not found then raise exception 'Asset not found'; end if;
  if p_operation not in ('buy','sell','revalue','dividend') then raise exception 'Invalid operation'; end if;
  if p_quantity < 0 or p_unit_price < 0 or p_fee < 0 or p_occurred_on > current_date then raise exception 'Invalid amount or date'; end if;
  if p_operation in ('buy','sell','dividend') and p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  if p_operation='revalue' and v_quote_source <> 'manual' then raise exception 'Market quoted assets cannot be manually revalued'; end if;
  insert into public.capital_operations(user_id,asset_id,operation,quantity,unit_price,fee,currency,occurred_on)
  values(v_user,p_asset_id,p_operation,case when p_operation='revalue' then 0 else p_quantity end,p_unit_price,p_fee,v_asset_currency,p_occurred_on)
  returning id into v_operation;
  if p_operation in ('buy','sell') then
    select exists (
      select 1 from (
        select sum(case when operation='buy' then quantity when operation='sell' then -quantity else 0 end)
          over (order by occurred_on,created_at,id rows between unbounded preceding and current row) as running_quantity
        from public.capital_operations where user_id=v_user and asset_id=p_asset_id
      ) ledger where running_quantity < 0
    ) into v_invalid_position;
    if v_invalid_position then raise exception 'Sale exceeds available quantity on its operation date'; end if;
  end if;
  if p_operation='revalue' then
    update public.capital_assets set manual_price=(
      select unit_price from public.capital_operations where user_id=v_user and asset_id=p_asset_id and operation='revalue'
      order by occurred_on desc,created_at desc,id desc limit 1
    ),updated_at=now() where id=p_asset_id and user_id=v_user;
  end if;
  return v_operation;
end $$;

create or replace function public.capital_delete_latest_operation(p_operation_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_asset uuid; v_op text; v_date date; v_created timestamptz; v_latest_id uuid; v_restore numeric;
begin
  if v_user is null or not public.dayris_capital_has_pro() then raise exception 'PRO access required'; end if;
  select asset_id,operation,occurred_on,created_at into v_asset,v_op,v_date,v_created
    from public.capital_operations where id=p_operation_id and user_id=v_user;
  if not found then raise exception 'Operation not found'; end if;
  perform 1 from public.capital_assets where id=v_asset and user_id=v_user for update;
  select id into v_latest_id from public.capital_operations where asset_id=v_asset and user_id=v_user
    order by occurred_on desc,created_at desc,id desc limit 1;
  if v_latest_id <> p_operation_id then raise exception 'Only the latest operation can be cancelled'; end if;
  delete from public.capital_operations where id=p_operation_id and user_id=v_user;
  if v_op='revalue' then
    select unit_price into v_restore from public.capital_operations where asset_id=v_asset and user_id=v_user and operation='revalue'
      order by occurred_on desc,created_at desc,id desc limit 1;
    update public.capital_assets set manual_price=coalesce(v_restore,initial_manual_price),updated_at=now()
      where id=v_asset and user_id=v_user;
  end if;
  return true;
end $$;

create or replace function public.capital_record_daily_snapshot(p_currency text,p_value numeric,p_sampled_on date)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not public.dayris_capital_has_pro() then raise exception 'PRO access required'; end if;
  if p_value < 0 or p_sampled_on <> current_date then raise exception 'Invalid portfolio snapshot'; end if;
  if not exists (select 1 from public.capital_assets where user_id=v_user and currency=p_currency) then
    raise exception 'Currency is not present in this portfolio';
  end if;
  insert into public.capital_valuation_snapshots(user_id,currency,portfolio_value,sampled_on)
  values(v_user,p_currency,p_value,p_sampled_on) on conflict (user_id,currency,sampled_on) do nothing;
  return true;
end $$;

revoke all on function public.capital_create_asset(text,text,text,text,text,numeric,numeric,numeric,numeric,date) from public,anon;
revoke all on function public.capital_record_operation(uuid,text,numeric,numeric,numeric,date) from public,anon;
revoke all on function public.capital_delete_latest_operation(uuid) from public,anon;
revoke all on function public.capital_record_daily_snapshot(text,numeric,date) from public,anon;
grant execute on function public.capital_create_asset(text,text,text,text,text,numeric,numeric,numeric,numeric,date) to authenticated;
grant execute on function public.capital_record_operation(uuid,text,numeric,numeric,numeric,date) to authenticated;
grant execute on function public.capital_delete_latest_operation(uuid) to authenticated;
grant execute on function public.capital_record_daily_snapshot(text,numeric,date) to authenticated;

commit;
