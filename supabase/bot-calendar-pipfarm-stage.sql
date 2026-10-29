-- Owner-confirmed transition: 30 October 2026, 08:00 Europe/Bucharest.
-- The 1,000 USD figure is an available risk budget, not the broker balance.
begin;
do $$
declare c public.bot_calendars; account uuid; candidates integer; copied integer;
begin
  select * into c from public.bot_calendars where slug='bot' for update;
  if c.broker_account_id='49362144' and c.starts_at=timestamptz '2026-10-30 08:00 Europe/Bucharest'
    and c.initial_budget=1000 then return; end if;
  if c.broker_account_id<>'47484897' or c.start_date<>date '2026-10-05'
    or c.lease_until>now() then raise exception 'Unexpected source or worker still running'; end if;
  select count(*),(array_agg(a.id))[1] into candidates,account from public.ctrader_accounts a
    where a.account_id='49362144' and a.is_live and a.is_active
    and exists(select 1 from public.site_admins s where s.user_id=a.user_id)
    and exists(select 1 from public.ctrader_tokens t where t.user_id=a.user_id);
  if candidates<>1 then raise exception 'Expected unique active administrator Live connection'; end if;

  insert into public.bot_calendars(slug,title,broker_account_id,is_live,source_account_id,start_date,
    time_zone,enabled,currency,last_sync_at,last_error,end_date,stage_title)
  values('bot-stage-1',c.title,c.broker_account_id,c.is_live,c.source_account_id,c.start_date,
    c.time_zone,true,c.currency,c.last_sync_at,null,'2026-10-29','5–29 октября 2026');
  insert into public.bot_calendar_deals(calendar_slug,deal_id,date_key,time,instrument,direction,pnl,currency,executed_at)
    select 'bot-stage-1',deal_id,date_key,time,instrument,direction,pnl,currency,executed_at
    from public.bot_calendar_deals where calendar_slug='bot';
  get diagnostics copied=row_count;
  if copied<>(select count(*) from public.bot_calendar_deals where calendar_slug='bot')
    or exists(select 1 from public.bot_calendar_deals where calendar_slug='bot-stage-1' and date_key>'2026-10-29')
    then raise exception 'Archive snapshot mismatch'; end if;
  delete from public.bot_calendar_deals where calendar_slug='bot';
  update public.bot_calendars set broker_account_id='49362144',is_live=true,source_account_id=account,
    start_date='2026-10-30',starts_at=timestamptz '2026-10-30 08:00 Europe/Bucharest',end_date=null,
    stage_title='Новый этап · с 30 октября',initial_budget=1000,currency='USD',
    last_sync_at=null,last_error=null,lease_token=null,lease_until=null where slug='bot';
end $$;
commit;
