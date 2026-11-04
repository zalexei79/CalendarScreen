begin;
-- Keep the existing exclusions as private import tombstones, so a full broker
-- snapshot cannot resurrect the two explicitly cancelled public records.
lock table public.bot_calendar_deals in share row exclusive mode;
create function public.bot_skip_cancelled_deal() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.bot_calendar_adjustments a
    where a.calendar_slug=new.calendar_slug and a.deal_id=new.deal_id) then return null; end if;
  return new;
end $$;
revoke all on function public.bot_skip_cancelled_deal() from public,anon,authenticated;
create trigger bot_skip_cancelled_deal before insert on public.bot_calendar_deals
  for each row execute function public.bot_skip_cancelled_deal();

-- A private audit is the only retained copy; public snapshot and RPC responses
-- no longer contain these cancelled trades. Assert published results stay equal.
do $$ declare before_totals jsonb; after_totals jsonb;
begin
  select jsonb_agg(to_jsonb(x) order by calendar_slug) into before_totals from (
    select calendar_slug,count(*) as count,sum(pnl) as pnl from public.bot_calendar_performance_deals group by calendar_slug) x;
  with removed as (
    delete from public.bot_calendar_deals d where d.calendar_slug='bot'
      and d.deal_id in ('10196271','10201698')
      and exists(select 1 from public.bot_calendar_adjustments a where a.calendar_slug=d.calendar_slug and a.deal_id=d.deal_id)
    returning d.*
  ) insert into public.site_admin_audit(action,dataset,record_key,reason,before_data)
    select 'bot_cancelled_deal_delete','bot_calendar_deals',calendar_slug||':'||deal_id,
      'Owner requested removal of cancelled setup-error trades from public calendar',to_jsonb(r) from removed r;
  select jsonb_agg(to_jsonb(x) order by calendar_slug) into after_totals from (
    select calendar_slug,count(*) as count,sum(pnl) as pnl from public.bot_calendar_performance_deals group by calendar_slug) x;
  if before_totals is distinct from after_totals then raise exception 'PUBLIC_RESULTS_CHANGED'; end if;
end $$;

-- Legacy wrappers still request this key; return no cancelled-record payload.
create or replace function public.bot_adjustment_summary(p_slug text,p_from date default null,p_to date default null) returns jsonb
language sql stable security definer set search_path='' as $$ select null::jsonb $$;
revoke all on function public.bot_adjustment_summary(text,date,date) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
