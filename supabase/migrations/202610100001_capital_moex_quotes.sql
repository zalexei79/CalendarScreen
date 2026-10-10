begin;

alter table public.capital_assets
  drop constraint if exists capital_assets_quote_source_check;

alter table public.capital_assets
  add constraint capital_assets_quote_source_check
  check (quote_source in ('binance','manual','moex'));

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
  if p_quote_source='moex' and (p_category not in ('stock','etf','bond') or p_currency not in ('RUB','USD','CNY','EUR') or upper(trim(coalesce(p_symbol,''))) !~ '^[A-Z0-9-]{1,24}$') then
    raise exception 'MOEX quotes require a supported listed security';
  end if;
  insert into public.capital_assets(user_id,name,symbol,category,currency,quote_source,manual_price,initial_manual_price)
  values(v_user,trim(p_name),upper(trim(coalesce(p_symbol,''))),p_category,p_currency,p_quote_source,p_manual_price,p_manual_price)
  returning id into v_asset;
  insert into public.capital_operations(user_id,asset_id,operation,quantity,unit_price,fee,currency,occurred_on)
  values(v_user,v_asset,'buy',p_quantity,p_unit_price,p_fee,p_currency,p_occurred_on);
  return v_asset;
end $$;

commit;
