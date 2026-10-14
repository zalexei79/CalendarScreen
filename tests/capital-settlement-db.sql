-- Explicit integration check: all data mutations roll back.
begin;
do $$ declare u uuid; begin
 select user_id into u from public.pro_entitlements where starts_at<=now() and ends_at>now() order by ends_at desc limit 1;
 if u is null then raise exception 'No active PRO account available for rollback verification'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$ declare a uuid; request uuid:=gen_random_uuid(); result jsonb; op uuid; w uuid; c uuid; count_before integer; rejected boolean;
begin
 a:=public.capital_create_asset('ROLLBACK Capital settlement test','TEST','other','USD','manual',120,2,100,2,current_date);
 result:=public.capital_sell_and_settle(a,1,120,2,current_date,'both',request);op:=(result->>'operation_id')::uuid;
 if (result->>'proceeds')::numeric<>118 or (result->>'realized_pnl')::numeric<>17 then raise exception 'Settlement arithmetic failed';end if;
 select wallet_transaction_id,calendar_record_id into w,c from public.capital_sale_settlements where request_id=request;
 if not exists(select 1 from public.wallet_transactions where id=w and amount=118 and currency='USD') then raise exception 'Wallet credit failed';end if;
 if not exists(select 1 from public.trades where id=c and pnl=17 and currency='USD') then raise exception 'Calendar profit failed';end if;
 perform public.capital_sell_and_settle(a,1,120,2,current_date,'both',request);
 if (select count(*) from public.capital_operations where asset_id=a and operation='sell')<>1 then raise exception 'Duplicate sale recorded';end if;
 rejected:=false;begin perform public.capital_sell_and_settle(a,1,121,2,current_date,'both',request);exception when others then rejected:=true;end;if not rejected then raise exception 'Changed replay accepted';end if;
 count_before:=(select count(*) from public.capital_operations where asset_id=a);
 rejected:=false;begin perform public.capital_sell_and_settle(a,0.000000000001,1,0,current_date,'wallet',gen_random_uuid());exception when others then rejected:=true;end;
 if not rejected or (select count(*) from public.capital_operations where asset_id=a)<>count_before then raise exception 'Failed settlement changed position';end if;
 perform public.capital_delete_latest_operation(op);
 if exists(select 1 from public.wallet_transactions where id=w) or exists(select 1 from public.trades where id=c) then raise exception 'Cancellation left a linked entry';end if;
 rejected:=false;begin perform public.capital_sell_and_settle(a,1,120,2,current_date,'both',request);exception when others then rejected:=true;end;if not rejected then raise exception 'Cancelled replay accepted';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from public.capital_sale_settlements) then raise exception 'RLS exposed another owner settlement';end if;
 rejected:=false;begin perform public.capital_sell_and_settle(a,1,120,2,current_date,'both',gen_random_uuid());exception when others then rejected:=true;end;if not rejected then raise exception 'Missing PRO allowed settlement';end if;
end $$;
rollback;
select 'PASS: sale, exact arithmetic, wallet, calendar, replay, cancellation, RLS and PRO; test writes rolled back' as verification;
