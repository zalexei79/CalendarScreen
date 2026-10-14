begin;
alter table public.capital_assets add column if not exists display_unit text not null default 'native' check(display_unit in ('native','gram'));
create or replace function public.capital_create_asset_with_unit(p_name text,p_symbol text,p_category text,p_currency text,p_quote_source text,p_manual_price numeric,p_quantity numeric,p_unit_price numeric,p_fee numeric,p_occurred_on date,p_display_unit text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid;
begin
 if auth.uid() is null or not public.dayris_capital_has_pro() then raise exception 'PRO access required';end if;
 if p_display_unit is null or p_display_unit not in ('native','gram') or (p_display_unit='gram' and (p_category<>'metal' or p_currency<>'USD' or coalesce(upper(trim(p_symbol)),'') not in ('XAU','XAG','XPT','XPD'))) then raise exception 'Unsupported display unit';end if;
 a:=public.capital_create_asset(p_name,p_symbol,p_category,p_currency,p_quote_source,p_manual_price,p_quantity,p_unit_price,p_fee,p_occurred_on);
 update public.capital_assets set display_unit=p_display_unit where id=a and user_id=auth.uid();return a;
end $$;
revoke all on function public.capital_create_asset_with_unit(text,text,text,text,text,numeric,numeric,numeric,numeric,date,text) from public,anon;
grant execute on function public.capital_create_asset_with_unit(text,text,text,text,text,numeric,numeric,numeric,numeric,date,text) to authenticated;
create table public.capital_alert_preferences(user_id uuid primary key references auth.users(id) on delete cascade,enabled boolean not null default false,income_enabled boolean not null default false,share_enabled boolean not null default false,share_limit integer not null default 50 check(share_limit between 1 and 100),updated_at timestamptz not null default now());
create table public.capital_price_alerts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,asset_id uuid not null,threshold numeric(24,10) not null check(threshold>0),direction text not null check(direction in ('above','below')),active boolean not null default true,triggered_at timestamptz,created_at timestamptz not null default now(),foreign key(user_id,asset_id) references public.capital_assets(user_id,id) on delete cascade);
create unique index capital_price_alerts_active_condition on public.capital_price_alerts(user_id,asset_id,direction,threshold) where active;
create index capital_price_alerts_user_active on public.capital_price_alerts(user_id,asset_id) where active;
create table public.capital_alert_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,asset_id uuid not null,kind text not null check(kind in ('price','income','concentration')),event_key text not null,amount numeric(24,10),currency text not null,share numeric(6,2),operation_id uuid references public.capital_operations(id) on delete cascade,created_at timestamptz not null default now(),seen_at timestamptz,foreign key(user_id,asset_id) references public.capital_assets(user_id,id) on delete cascade,unique(user_id,event_key));
create index capital_alert_events_unread on public.capital_alert_events(user_id,created_at) where seen_at is null;
alter table public.capital_alert_preferences enable row level security;alter table public.capital_price_alerts enable row level security;alter table public.capital_alert_events enable row level security;
revoke all on public.capital_alert_preferences,public.capital_price_alerts,public.capital_alert_events from public,anon,authenticated;
grant select,insert,update,delete on public.capital_alert_preferences,public.capital_price_alerts to authenticated;
grant select,update(seen_at) on public.capital_alert_events to authenticated;
create policy capital_alert_preferences_own on public.capital_alert_preferences for all to authenticated using(user_id=auth.uid() and public.dayris_capital_has_pro()) with check(user_id=auth.uid() and public.dayris_capital_has_pro());
create policy capital_price_alerts_own on public.capital_price_alerts for all to authenticated using(user_id=auth.uid() and public.dayris_capital_has_pro()) with check(user_id=auth.uid() and public.dayris_capital_has_pro());
create policy capital_alert_events_read on public.capital_alert_events for select to authenticated using(user_id=auth.uid() and public.dayris_capital_has_pro());
create policy capital_alert_events_seen on public.capital_alert_events for update to authenticated using(user_id=auth.uid() and public.dayris_capital_has_pro()) with check(user_id=auth.uid() and public.dayris_capital_has_pro());
create or replace function public.capital_check_price_alerts(p_asset_id uuid,p_price numeric,p_quote_at timestamptz,p_transport text)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.capital_assets%rowtype; r record; counter integer:=0;max_age interval;
begin
 if auth.uid() is null or not public.dayris_capital_has_pro() then raise exception 'PRO access required';end if;
 if not exists(select 1 from public.capital_alert_preferences where user_id=auth.uid() and enabled) then return 0;end if;
 select * into a from public.capital_assets where id=p_asset_id and user_id=auth.uid();if not found then raise exception 'Asset not found';end if;
 max_age:=case when a.quote_source='binance' and a.currency='USDT' and p_transport in ('websocket','rest') then interval '15 seconds' when a.quote_source='moex' and p_transport='moex-delay' then interval '36 hours' when a.quote_source='alphavantage' and p_transport='alphavantage-daily' then interval '5 days' when a.currency='USD' and a.category in ('metal','commodity') and a.symbol in ('XAU','XAG','XPT','XPD','HG') and p_transport='gold-api' then interval '5 minutes' else null end;
 if max_age is null or p_price is null or p_price<=0 or p_price::text in ('NaN','Infinity','-Infinity') or p_quote_at is null or p_quote_at<now()-max_age or p_quote_at>(now()+(case when p_transport='alphavantage-daily' then interval '1 day' else interval '5 seconds' end)) then return 0;end if;
 for r in select * from public.capital_price_alerts where user_id=auth.uid() and asset_id=a.id and active and ((direction='above' and p_price>=threshold) or (direction='below' and p_price<=threshold)) for update loop
  insert into public.capital_alert_events(user_id,asset_id,kind,event_key,amount,currency) values(auth.uid(),a.id,'price','price:'||r.id::text,p_price,a.currency) on conflict(user_id,event_key) do nothing;
  update public.capital_price_alerts set active=false,triggered_at=now() where id=r.id;counter:=counter+1;
 end loop;return counter;
end $$;
create or replace function public.capital_check_share_alert(p_asset_id uuid,p_share numeric)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.capital_assets%rowtype; inserted integer;
begin
 if auth.uid() is null or not public.dayris_capital_has_pro() then raise exception 'PRO access required';end if;
 if p_share is null or p_share<0 or p_share>100 or not exists(select 1 from public.capital_alert_preferences where user_id=auth.uid() and enabled and share_enabled and p_share>=share_limit) then return false;end if;
 select * into a from public.capital_assets where id=p_asset_id and user_id=auth.uid();if not found then raise exception 'Asset not found';end if;
 insert into public.capital_alert_events(user_id,asset_id,kind,event_key,currency,share) values(auth.uid(),a.id,'concentration','share:'||a.id::text||':'||current_date::text,a.currency,p_share) on conflict(user_id,event_key) do nothing;
 get diagnostics inserted=row_count;return inserted>0;
end $$;
revoke all on function public.capital_check_price_alerts(uuid,numeric,timestamptz,text),public.capital_check_share_alert(uuid,numeric) from public,anon;
grant execute on function public.capital_check_price_alerts(uuid,numeric,timestamptz,text),public.capital_check_share_alert(uuid,numeric) to authenticated;
create or replace function public.capital_notify_recorded_income() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.operation='dividend' and exists(select 1 from public.capital_alert_preferences where user_id=new.user_id and enabled and income_enabled) then
  insert into public.capital_alert_events(user_id,asset_id,kind,event_key,amount,currency,operation_id) values(new.user_id,new.asset_id,'income','income:'||new.id::text,round(new.quantity*new.unit_price,10)-new.fee,new.currency,new.id) on conflict(user_id,event_key) do nothing;
 end if;return new;
end $$;
revoke all on function public.capital_notify_recorded_income() from public,anon,authenticated;
create trigger capital_notify_recorded_income after insert on public.capital_operations for each row execute function public.capital_notify_recorded_income();
notify pgrst,'reload schema';commit;
