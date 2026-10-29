begin;
create or replace function public.social_day_summary(p_day date,p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Day owner changed' using errcode='42501'; end if;
 if p_day is null or p_day<date '1900-01-01' or p_day>date '2200-12-31' then raise exception 'Invalid day' using errcode='22023'; end if;
 with own as (select coalesce(t.currency,'—') as currency,coalesce(t.pnl,0) as amount from public.trades t where t.user_id=auth.uid() and t.date_key::text=to_char(p_day,'YYYY-MM-DD')),
 totals as (select currency,sum(amount) as amount from own group by currency)
 select jsonb_build_object('owner_id',auth.uid(),'day',p_day,'entries',(select count(*) from own),'totals',coalesce((select jsonb_agg(to_jsonb(totals) order by currency) from totals),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.social_day_summary(date,uuid) from public,anon;
grant execute on function public.social_day_summary(date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
