begin;

-- Preserve the original instant, including milliseconds and DST offsets.
-- It is private storage and is never returned by a public calendar RPC.
alter table public.bot_calendar_deals add column executed_at timestamptz;

create or replace function public.publish_bot_calendar(p_slug text,p_lease uuid,p_currency text,p_deals jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.bot_calendars; n integer;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled
    and lease_token=p_lease and lease_until>now() for update;
  if not found then raise exception 'LEASE_EXPIRED'; end if;
  if p_currency is null or p_currency !~ '^[A-Z0-9]{2,12}$'
    or jsonb_typeof(p_deals)<>'array' or p_deals is null then raise exception 'INVALID_SNAPSHOT'; end if;
  if exists(select 1 from jsonb_to_recordset(p_deals) as d(date_key date,currency text,executed_at timestamptz)
    where d.date_key<c.start_date or d.date_key is null or d.currency is distinct from p_currency
      or (d.executed_at is not null and (d.executed_at at time zone c.time_zone)::date<>d.date_key))
    then raise exception 'OUTSIDE_PUBLICATION'; end if;
  delete from public.bot_calendar_deals where calendar_slug=p_slug;
  insert into public.bot_calendar_deals(calendar_slug,deal_id,date_key,time,instrument,direction,pnl,currency,executed_at)
    select p_slug,d.deal_id,d.date_key,d.time,d.instrument,d.direction,d.pnl,d.currency,d.executed_at
    from jsonb_to_recordset(p_deals) as d(deal_id text,date_key date,time time,
      instrument text,direction text,pnl numeric,currency text,executed_at timestamptz);
  get diagnostics n=row_count;
  update public.bot_calendars set currency=p_currency,last_sync_at=now(),last_error=null,
    lease_token=null,lease_until=null where slug=p_slug;
  return n;
end $$;

create or replace function public.get_bot_calendar_analytics(p_slug text default 'bot',p_from date default null,p_to date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars; today date; from_day date; to_day date; result jsonb;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  today:=(now() at time zone c.time_zone)::date;
  from_day:=coalesce(p_from,c.start_date); to_day:=coalesce(p_to,today);
  if from_day<c.start_date or to_day>today or from_day>to_day then raise exception 'PERIOD_OUT_OF_RANGE'; end if;

  with scoped as (
    select deal_id,date_key,time,pnl,executed_at from public.bot_calendar_deals
      where calendar_slug=p_slug and date_key between from_day and to_day
  ), running as (
    select *,sum(pnl) over(order by coalesce(executed_at,(date_key+time) at time zone c.time_zone),deal_id::numeric rows unbounded preceding) as equity from scoped
  ), peaks as (
    select *,greatest(0,max(equity) over(order by coalesce(executed_at,(date_key+time) at time zone c.time_zone),deal_id::numeric rows unbounded preceding)) as peak from running
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
    'timestamp_precision',case when exists(select 1 from scoped where executed_at is null) then 'minute' else 'execution' end,
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


commit;
