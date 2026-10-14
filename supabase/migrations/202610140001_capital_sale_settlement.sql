begin;
create table if not exists public.capital_sale_settlements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, operation_id uuid references public.capital_operations(id) on delete set null,
 asset_id uuid not null references public.capital_assets(id) on delete cascade,
 destination text not null check(destination in ('wallet','calendar','both')),
 quantity numeric(28,12) not null, unit_price numeric(24,10) not null, fee numeric(24,10) not null,
 occurred_on date not null, proceeds numeric(24,10) not null, realized_pnl numeric(24,10) not null,
 wallet_transaction_id uuid references public.wallet_transactions(id) on delete set null,
 calendar_record_id uuid references public.trades(id) on delete set null,
 cancelled_at timestamptz, created_at timestamptz not null default now(), unique(user_id,request_id)
);
create index if not exists capital_sale_settlements_operation_idx on public.capital_sale_settlements(operation_id);
alter table public.capital_sale_settlements enable row level security;
revoke all on public.capital_sale_settlements from public,anon,authenticated;
grant select on public.capital_sale_settlements to authenticated;
create policy capital_sale_settlements_own on public.capital_sale_settlements for select to authenticated
 using(user_id=(select auth.uid()) and (select public.dayris_capital_has_pro()));
create or replace function public.capital_sell_and_settle(p_asset_id uuid,p_quantity numeric,p_unit_price numeric,p_fee numeric,p_occurred_on date,p_destination text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_asset public.capital_assets%rowtype; v_previous public.capital_sale_settlements%rowtype;
 v_quantity numeric:=0; v_basis numeric:=0; v_allocated numeric; v_net numeric; v_pnl numeric;
 v_operation uuid; v_wallet uuid; v_calendar uuid; r record;
begin
 if v_user is null or not public.dayris_capital_has_pro() then raise exception 'PRO access required'; end if;
 if p_request_id is null or p_destination is null or p_destination not in ('wallet','calendar','both') then raise exception 'Invalid settlement destination'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||p_request_id::text,0));
 select * into v_previous from public.capital_sale_settlements where user_id=v_user and request_id=p_request_id;
 if found then
  if v_previous.cancelled_at is not null or v_previous.operation_id is null then raise exception 'Settlement was cancelled'; end if;
  if v_previous.asset_id is distinct from p_asset_id or v_previous.destination is distinct from p_destination or v_previous.quantity is distinct from p_quantity or v_previous.unit_price is distinct from p_unit_price or v_previous.fee is distinct from p_fee or v_previous.occurred_on is distinct from p_occurred_on then raise exception 'Settlement request changed'; end if;
  return jsonb_build_object('operation_id',v_previous.operation_id,'proceeds',v_previous.proceeds::text,'realized_pnl',v_previous.realized_pnl::text);
 end if;
 if p_quantity is null or p_unit_price is null or p_fee is null or p_occurred_on is null or p_quantity<=0 or p_unit_price<0 or p_fee<0 or p_occurred_on<>current_date
 or p_quantity<>round(p_quantity,12) or p_unit_price<>round(p_unit_price,10) or p_fee<>round(p_fee,10) then raise exception 'Invalid sale amount or date'; end if;
 select * into v_asset from public.capital_assets where id=p_asset_id and user_id=v_user for update;
 if not found then raise exception 'Asset not found'; end if;
 if v_asset.currency!~'^[A-Z]{3}$' then raise exception 'Settlement currency unsupported'; end if;
 for r in select * from public.capital_operations where user_id=v_user and asset_id=p_asset_id order by occurred_on,created_at,id loop
  if r.operation='buy' then v_quantity:=v_quantity+r.quantity;v_basis:=v_basis+round(r.quantity*r.unit_price,10)+r.fee;
  elsif r.operation='sell' then
   if v_quantity<=0 or r.quantity>v_quantity then raise exception 'Invalid position history'; end if;
   v_allocated:=round(v_basis*r.quantity/v_quantity,10);v_basis:=v_basis-v_allocated;v_quantity:=v_quantity-r.quantity;
  end if;
 end loop;
 if p_quantity>v_quantity or v_quantity<=0 then raise exception 'Sale exceeds available quantity'; end if;
 v_net:=round(p_quantity*p_unit_price,10)-p_fee;
 v_pnl:=v_net-round(v_basis*p_quantity/v_quantity,10);
 if v_net<0 or v_net>=1000000000000 then raise exception 'Invalid settlement amount'; end if;
 if p_destination in ('wallet','both') and round(v_net,2)<=0 then raise exception 'Wallet proceeds too small'; end if;
 v_operation:=public.capital_record_operation(p_asset_id,'sell',p_quantity,p_unit_price,p_fee,p_occurred_on);
 if p_destination in ('wallet','both') then
  insert into public.wallet_transactions(user_id,date_key,time,title,amount,kind,currency,comment)
  values(v_user,p_occurred_on,to_char(now(),'HH24:MI'),left('Capital · '||v_asset.name,120),round(v_net,2),'income',v_asset.currency,'Capital sale proceeds, including returned cost basis; operation '||v_operation::text) returning id into v_wallet;
 end if;
 if p_destination in ('calendar','both') then
  insert into public.trades(user_id,date_key,time,instrument,direction,pnl,comment,platform,currency)
  values(v_user,p_occurred_on::text,to_char(now(),'HH24:MI'),left('CAPITAL · '||coalesce(nullif(v_asset.symbol,''),v_asset.name),60),case when v_pnl<0 then 'SHORT' else 'LONG' end,round(v_pnl,2),'Capital sale result after fees; proceeds '||v_net::text||' '||v_asset.currency||'; operation '||v_operation::text,'Manual',v_asset.currency) returning id into v_calendar;
 end if;
 insert into public.capital_sale_settlements(user_id,request_id,operation_id,asset_id,destination,quantity,unit_price,fee,occurred_on,proceeds,realized_pnl,wallet_transaction_id,calendar_record_id)
 values(v_user,p_request_id,v_operation,p_asset_id,p_destination,p_quantity,p_unit_price,p_fee,p_occurred_on,v_net,v_pnl,v_wallet,v_calendar);
 return jsonb_build_object('operation_id',v_operation,'proceeds',v_net::text,'realized_pnl',v_pnl::text);
end $$;
revoke all on function public.capital_sell_and_settle(uuid,numeric,numeric,numeric,date,text,uuid) from public,anon;
grant execute on function public.capital_sell_and_settle(uuid,numeric,numeric,numeric,date,text,uuid) to authenticated;
create or replace function public.capital_reverse_sale_settlement() returns trigger language plpgsql security definer set search_path='' as $$
declare s record;
begin
 for s in select * from public.capital_sale_settlements where operation_id=old.id and user_id=old.user_id loop
  delete from public.wallet_transactions where id=s.wallet_transaction_id and user_id=old.user_id;
  delete from public.trades where id=s.calendar_record_id and user_id=old.user_id;
  update public.capital_sale_settlements set cancelled_at=now() where id=s.id;
 end loop;
 return old;
end $$;
revoke all on function public.capital_reverse_sale_settlement() from public,anon,authenticated;
create trigger capital_reverse_sale_settlement before delete on public.capital_operations for each row execute function public.capital_reverse_sale_settlement();
notify pgrst,'reload schema';
commit;
