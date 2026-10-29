begin;

-- Budget is a loss allowance, never broker balance/deposit. Real PnL is not scaled.
alter table public.bot_calendars
  add column end_date date,
  add column starts_at timestamptz,
  add column stage_title text not null default 'Первый этап',
  add column initial_budget numeric check(initial_budget>0),
  add constraint bot_stage_dates check(end_date is null or end_date>=start_date);

create function public.bot_stage_context(p_slug text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars; net numeric;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  select coalesce(sum(pnl),0) into net from public.bot_calendar_deals
    where calendar_slug=p_slug and date_key between c.start_date and least(coalesce(c.end_date,(now() at time zone c.time_zone)::date),(now() at time zone c.time_zone)::date);
  return jsonb_build_object('stage_title',c.stage_title,'end_date',c.end_date,'starts_at',c.starts_at,
    'archived',c.end_date is not null,'real_account',c.is_live and c.last_sync_at is not null,
    'accounting',case when c.initial_budget is not null then jsonb_build_object(
      'basis','risk_budget','initial_budget',c.initial_budget,'budget_with_result',c.initial_budget+net,
      'pnl',net,'return_percent',net/c.initial_budget*100) else null end,
    'periods',(select jsonb_agg(jsonb_build_object('slug',slug,'title',stage_title,
      'start_date',start_date,'end_date',end_date,'archived',end_date is not null)
      order by (slug='bot') desc,start_date desc) from public.bot_calendars where enabled));
end $$;
revoke all on function public.bot_stage_context(text) from public,anon,authenticated;

-- Core implementations stay private; wrappers enforce archive boundaries.
alter function public.get_bot_calendar(text,date) rename to bot_calendar_raw;
alter function public.get_bot_calendar_history(text,date,date,integer) rename to bot_history_raw;
alter function public.get_bot_calendar_analytics(text,date,date) rename to bot_analytics_raw;
alter function public.get_bot_calendar_day(text,date,integer) rename to bot_day_raw;
revoke all on function public.bot_calendar_raw(text,date),public.bot_history_raw(text,date,date,integer),
  public.bot_analytics_raw(text,date,date),public.bot_day_raw(text,date,integer) from public,anon,authenticated;

create function public.get_bot_calendar(p_slug text default 'bot',p_month date default current_date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; c public.bot_calendars;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  if c.end_date is not null and date_trunc('month',p_month)>date_trunc('month',c.end_date) then raise exception 'MONTH_OUT_OF_RANGE'; end if;
  result:=public.bot_calendar_raw(p_slug,p_month);
  if c.end_date is not null then result:=jsonb_set(result,'{status}','"archived"'); end if;
  if c.starts_at>now() then result:=jsonb_set(result,'{status}','"scheduled"'); end if;
  return result||public.bot_stage_context(p_slug);
end $$;

create function public.get_bot_calendar_history(p_slug text default 'bot',p_from date default null,p_to date default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  if p_to>c.end_date then raise exception 'PERIOD_OUT_OF_RANGE'; end if;
  return public.bot_history_raw(p_slug,p_from,coalesce(p_to,c.end_date),p_offset)||public.bot_stage_context(p_slug);
end $$;

create function public.get_bot_calendar_day(p_slug text,p_day date,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  if p_day>c.end_date then raise exception 'DAY_OUT_OF_RANGE'; end if;
  return public.bot_day_raw(p_slug,p_day,p_offset);
end $$;

create function public.get_bot_calendar_analytics(p_slug text default 'bot',p_from date default null,p_to date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; c public.bot_calendars;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  if p_to>c.end_date then raise exception 'PERIOD_OUT_OF_RANGE'; end if;
  if c.start_date>(now() at time zone c.time_zone)::date then
    result:=jsonb_build_object('from',c.start_date,'to',c.start_date,'currency',c.currency,
      'timestamp_precision','execution','stats',jsonb_build_object('total',0,'wins',0,'losses',0,'breakeven',0,'pnl',0,
      'gross_profit',0,'gross_loss',0,'avg_trade',0,'avg_win',null,'avg_loss',null,'best_trade',null,'worst_trade',null,
      'max_drawdown',0,'win_rate',null,'profit_factor',null,'active_days',0,'positive_days',0),'curve','[]'::jsonb);
  else result:=public.bot_analytics_raw(p_slug,p_from,coalesce(p_to,c.end_date)); end if;
  if c.initial_budget is not null then
    result:=result||jsonb_build_object('period_return_percent',(result->'stats'->>'pnl')::numeric/c.initial_budget*100);
  end if;
  return result||public.bot_stage_context(p_slug);
end $$;

revoke all on function public.get_bot_calendar(text,date),public.get_bot_calendar_history(text,date,date,integer),
  public.get_bot_calendar_analytics(text,date,date),public.get_bot_calendar_day(text,date,integer) from public,anon,authenticated;
grant execute on function public.get_bot_calendar(text,date),public.get_bot_calendar_history(text,date,date,integer),
  public.get_bot_calendar_analytics(text,date,date),public.get_bot_calendar_day(text,date,integer) to anon,authenticated;

alter function public.claim_bot_calendar(text) rename to claim_bot_calendar_raw;
revoke all on function public.claim_bot_calendar_raw(text) from public,anon,authenticated,service_role;
create function public.claim_bot_calendar(p_slug text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; c public.bot_calendars;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled and end_date is null for update;
  if not found then return null; end if;
  result:=public.claim_bot_calendar_raw(p_slug);
  return result||jsonb_build_object('starts_at',c.starts_at);
end $$;
revoke all on function public.claim_bot_calendar(text) from public,anon,authenticated;
grant execute on function public.claim_bot_calendar(text) to service_role;

-- Check the exact opening instant as well as the original local-date cutoff.
alter function public.publish_bot_calendar(text,uuid,text,jsonb) rename to publish_bot_calendar_raw;
revoke all on function public.publish_bot_calendar_raw(text,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.publish_bot_calendar(p_slug text,p_lease uuid,p_currency text,p_deals jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.bot_calendars;
begin
  select * into c from public.bot_calendars where slug=p_slug and end_date is null for update;
  if not found then raise exception 'ARCHIVED_STAGE'; end if;
  if c.starts_at is not null and exists(select 1 from jsonb_to_recordset(p_deals) as d(executed_at timestamptz)
    where d.executed_at is null or d.executed_at<c.starts_at) then raise exception 'OUTSIDE_PUBLICATION'; end if;
  return public.publish_bot_calendar_raw(p_slug,p_lease,p_currency,p_deals);
end $$;
revoke all on function public.publish_bot_calendar(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.publish_bot_calendar(text,uuid,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
