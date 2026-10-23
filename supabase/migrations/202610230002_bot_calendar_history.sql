begin;

-- Broker identity and environment remain private configuration. Public readers
-- need calendar dates and results, not the owner's connected-account metadata.
create or replace function public.get_bot_calendar(p_slug text default 'bot',p_month date default current_date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars; first_day date; today date;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  today:=(now() at time zone c.time_zone)::date;
  first_day:=date_trunc('month',coalesce(p_month,today))::date;
  if first_day<date_trunc('month',c.start_date)::date or first_day>date_trunc('month',today)::date
    then raise exception 'MONTH_OUT_OF_RANGE'; end if;
  return jsonb_build_object('slug',c.slug,'title',c.title,'start_date',c.start_date,
    'time_zone',c.time_zone,'currency',c.currency,'today',today,
    'last_sync_at',c.last_sync_at,'status',case when c.last_sync_at is null then 'pending'
      when c.last_error is not null or c.last_sync_at<now()-interval '30 hours' then 'delayed' else 'ready' end,
    'days',coalesce((select jsonb_agg(x order by x.date_key) from (
      select date_key,sum(pnl) as pnl,count(*) as count from public.bot_calendar_deals
      where calendar_slug=p_slug and date_key>=greatest(c.start_date,first_day)
        and date_key<first_day+interval '1 month' and date_key<=today group by date_key
    ) x),'[]'::jsonb));
end $$;

create index bot_calendar_history_order on public.bot_calendar_deals(calendar_slug,date_key desc,time desc,deal_id desc);

-- One fixed publication, all history or an inclusive date range. Aggregate
-- totals cover the ENTIRE selected range, independently of the 100-row page.
create function public.get_bot_calendar_history(p_slug text default 'bot',p_from date default null,
  p_to date default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars; today date; from_day date; to_day date;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  today:=(now() at time zone c.time_zone)::date;
  from_day:=coalesce(p_from,c.start_date); to_day:=coalesce(p_to,today);
  if from_day<c.start_date or to_day>today or from_day>to_day
    or p_offset is null or p_offset<0 or p_offset>1000000
    then raise exception 'PERIOD_OUT_OF_RANGE'; end if;
  return jsonb_build_object('from',from_day,'to',to_day,'currency',c.currency,
    'all_total',(select count(*) from public.bot_calendar_deals
      where calendar_slug=p_slug and date_key between c.start_date and today),
    'total',(select count(*) from public.bot_calendar_deals
      where calendar_slug=p_slug and date_key between from_day and to_day),
    'pnl',coalesce((select sum(pnl) from public.bot_calendar_deals
      where calendar_slug=p_slug and date_key between from_day and to_day),0),
    'trades',coalesce((select jsonb_agg(x order by x.date_key desc,x.time desc,x.deal_id desc) from (
      select deal_id,date_key,time,instrument,direction,pnl,currency from public.bot_calendar_deals
      where calendar_slug=p_slug and date_key between from_day and to_day
      order by date_key desc,time desc,deal_id desc limit 100 offset p_offset
    ) x),'[]'::jsonb));
end $$;

revoke all on function public.get_bot_calendar_history(text,date,date,integer) from public,anon,authenticated;
grant execute on function public.get_bot_calendar_history(text,date,date,integer) to anon,authenticated;
commit;
