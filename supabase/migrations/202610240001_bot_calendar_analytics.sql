begin;

-- Statistics always cover the complete requested range, never a history page.
-- Input records are the private broker snapshot, already net of trading costs.
create function public.get_bot_calendar_analytics(p_slug text default 'bot',p_from date default null,p_to date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars; today date; from_day date; to_day date; result jsonb;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  today:=(now() at time zone c.time_zone)::date;
  from_day:=coalesce(p_from,c.start_date); to_day:=coalesce(p_to,today);
  if from_day<c.start_date or to_day>today or from_day>to_day then raise exception 'PERIOD_OUT_OF_RANGE'; end if;

  with scoped as (
    select deal_id,date_key,time,pnl from public.bot_calendar_deals
      where calendar_slug=p_slug and date_key between from_day and to_day
  ), running as (
    select *,sum(pnl) over(order by date_key,time,deal_id rows unbounded preceding) as equity from scoped
  ), peaks as (
    select *,greatest(0,max(equity) over(order by date_key,time,deal_id rows unbounded preceding)) as peak from running
  ), risk as (
    select *,peak-equity as drawdown from peaks
  ), daily as (
    select date_key,sum(pnl) as pnl,count(*) as trades,max(drawdown) as max_drawdown,max(peak) as max_peak
      from risk group by date_key
  ), calendar as (
    select day::date as date_key,coalesce(d.pnl,0) as pnl,coalesce(d.trades,0) as trades,
      coalesce(d.max_drawdown,0) as day_drawdown,coalesce(d.max_peak,0) as day_peak
      from pg_catalog.generate_series(from_day::timestamp,to_day::timestamp,interval '1 day') day
      left join daily d on d.date_key=day::date
  ), curve as (
    select *,sum(pnl) over(order by date_key) as total,max(day_peak) over(order by date_key) as peak from calendar
  ), stats as (
    select count(*) as total,count(*) filter(where pnl>0) as wins,count(*) filter(where pnl<0) as losses,
      count(*) filter(where pnl=0) as breakeven,coalesce(sum(pnl),0) as pnl,
      coalesce(sum(pnl) filter(where pnl>0),0) as gross_profit,
      -coalesce(sum(pnl) filter(where pnl<0),0) as gross_loss,
      coalesce(avg(pnl),0) as avg_trade,avg(pnl) filter(where pnl>0) as avg_win,
      -avg(pnl) filter(where pnl<0) as avg_loss,max(pnl) as best_trade,min(pnl) as worst_trade,
      coalesce(max(drawdown),0) as max_drawdown from risk
  )
  select jsonb_build_object('from',from_day,'to',to_day,'currency',c.currency,
    'stats',jsonb_build_object('total',s.total,'wins',s.wins,'losses',s.losses,'breakeven',s.breakeven,
      'pnl',s.pnl,'gross_profit',s.gross_profit,'gross_loss',s.gross_loss,
      'win_rate',case when s.total>0 then round(s.wins*100.0/s.total,2) else null end,
      'profit_factor',case when s.gross_loss>0 then s.gross_profit/s.gross_loss else null end,
      'avg_trade',s.avg_trade,'avg_win',s.avg_win,'avg_loss',s.avg_loss,
      'best_trade',s.best_trade,'worst_trade',s.worst_trade,'max_drawdown',s.max_drawdown,
      'recovery',case when s.max_drawdown>0 then s.pnl/s.max_drawdown else null end,
      'active_days',(select count(*) from daily),'positive_days',(select count(*) from daily where pnl>0),
      'best_day',(select max(pnl) from daily),'worst_day',(select min(pnl) from daily)),
    'curve',coalesce((select jsonb_agg(jsonb_build_object('date_key',date_key,'pnl',pnl,'total',total,
      'trades',trades,'drawdown',greatest(day_drawdown,peak-total)) order by date_key) from curve),'[]'::jsonb))
    into result from stats s;
  return result;
end $$;

revoke all on function public.get_bot_calendar_analytics(text,date,date) from public,anon,authenticated;
grant execute on function public.get_bot_calendar_analytics(text,date,date) to anon,authenticated;
commit;
