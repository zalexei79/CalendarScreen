begin;
-- Owner-attributed corrections never delete or change broker source records.
create table public.bot_calendar_adjustments (
  calendar_slug text not null references public.bot_calendars(slug),
  deal_id text not null,
  reason text not null check(length(reason) between 1 and 300),
  created_at timestamptz not null default now(),
  primary key(calendar_slug,deal_id)
);
alter table public.bot_calendar_adjustments enable row level security;
revoke all on public.bot_calendar_adjustments from public,anon,authenticated;

create view public.bot_calendar_performance_deals as
  select d.* from public.bot_calendar_deals d where not exists(
    select 1 from public.bot_calendar_adjustments a where a.calendar_slug=d.calendar_slug and a.deal_id=d.deal_id);
revoke all on public.bot_calendar_performance_deals from public,anon,authenticated;

-- The existing read-only computations (including drawdown chronology) use the
-- filtered projection. Publish/import functions continue using the raw table.
do $$ declare f regprocedure; begin
  foreach f in array array['public.bot_calendar_raw(text,date)'::regprocedure,
    'public.bot_history_raw(text,date,date,integer)'::regprocedure,
    'public.bot_analytics_raw(text,date,date)'::regprocedure,
    'public.bot_day_raw(text,date,integer)'::regprocedure,
    'public.bot_stage_context(text)'::regprocedure] loop
    execute replace(pg_get_functiondef(f),'public.bot_calendar_deals','public.bot_calendar_performance_deals');
  end loop;
end $$;

create function public.bot_adjustment_summary(p_slug text,p_from date default null,p_to date default null)
returns jsonb language sql stable security definer set search_path='' as $$
  with scoped as (
    select d.*,a.reason from public.bot_calendar_deals d
      join public.bot_calendars c on c.slug=d.calendar_slug
      left join public.bot_calendar_adjustments a on a.calendar_slug=d.calendar_slug and a.deal_id=d.deal_id
      where c.enabled and d.calendar_slug=p_slug
        and d.date_key between coalesce(p_from,c.start_date) and coalesce(p_to,c.end_date,(now() at time zone c.time_zone)::date)
  ) select jsonb_build_object('count',count(*) filter(where reason is not null),
    'original_count',count(*),'original_pnl',coalesce(sum(pnl),0),
    'excluded_pnl',coalesce(sum(pnl) filter(where reason is not null),0),
    'adjusted_pnl',coalesce(sum(pnl) filter(where reason is null),0),
    'trades',coalesce((select jsonb_agg(jsonb_build_object('deal_id',deal_id,'date_key',date_key,'time',time,
      'instrument',instrument,'direction',direction,'pnl',pnl,'reason',reason) order by date_key desc,time desc,deal_id desc)
      from (select * from scoped where reason is not null order by date_key desc,time desc,deal_id desc limit 100) a),'[]'::jsonb)) from scoped;
$$;
revoke all on function public.bot_adjustment_summary(text,date,date) from public,anon,authenticated;

alter function public.bot_stage_context(text) rename to bot_stage_context_base;
create function public.bot_stage_context(p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
  select public.bot_stage_context_base(p_slug)||jsonb_build_object('adjustments',public.bot_adjustment_summary(p_slug));
$$;
revoke all on function public.bot_stage_context(text) from public,anon,authenticated;

-- History and analytics disclose original and adjusted totals for the same
-- selected period. Calendar context discloses all corrections in this stage.
do $$ declare f regprocedure; begin
  foreach f in array array['public.get_bot_calendar_history(text,date,date,integer)'::regprocedure,
    'public.get_bot_calendar_analytics(text,date,date)'::regprocedure] loop
    execute replace(pg_get_functiondef(f),'public.bot_stage_context(p_slug)',
      'public.bot_stage_context(p_slug)||jsonb_build_object(''adjustments'',public.bot_adjustment_summary(p_slug,p_from,coalesce(p_to,c.end_date)))');
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
