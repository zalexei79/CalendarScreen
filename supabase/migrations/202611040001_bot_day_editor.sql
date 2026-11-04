begin;
-- Public editorial snapshots survive broker imports; raw broker rows stay intact.
create table public.bot_calendar_day_edits (
  calendar_slug text not null references public.bot_calendars(slug),
  date_key date not null,
  note text not null default '' check(length(note)<=3000),
  trades jsonb not null check(jsonb_typeof(trades)='array' and jsonb_array_length(trades)<=5000),
  revision bigint not null,
  primary key(calendar_slug,date_key)
);
alter table public.bot_calendar_day_edits enable row level security;
revoke all on public.bot_calendar_day_edits from public,anon,authenticated;
create sequence public.bot_editor_revision;
revoke all on sequence public.bot_editor_revision from public,anon,authenticated;

create or replace view public.bot_calendar_performance_deals as
select d.* from public.bot_calendar_deals d
where not exists(select 1 from public.bot_calendar_adjustments a where a.calendar_slug=d.calendar_slug and a.deal_id=d.deal_id)
  and not exists(select 1 from public.bot_calendar_day_edits e where e.calendar_slug=d.calendar_slug and e.date_key=d.date_key)
union all
select e.calendar_slug,t.deal_id,e.date_key,t.time,t.instrument,t.direction,t.pnl,c.currency,
  (e.date_key+t.time) at time zone c.time_zone as executed_at
from public.bot_calendar_day_edits e join public.bot_calendars c on c.slug=e.calendar_slug
cross join lateral jsonb_to_recordset(e.trades) as t(deal_id text,time time,instrument text,direction text,pnl numeric,comment text);

create function public.admin_bot_day(p_slug text,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars; e public.bot_calendar_day_edits;
begin
  perform public.site_admin_require(true);
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found or p_day is null or p_day<c.start_date or p_day>least(coalesce(c.end_date,current_date),(now() at time zone c.time_zone)::date) then raise exception 'DAY_OUT_OF_RANGE'; end if;
  select * into e from public.bot_calendar_day_edits where calendar_slug=p_slug and date_key=p_day;
  return jsonb_build_object('revision',coalesce(e.revision,0),'edited',e.revision is not null,'note',coalesce(e.note,''),'currency',c.currency,
    'trades',coalesce(e.trades,(select jsonb_agg(jsonb_build_object('deal_id',d.deal_id,'time',d.time,'instrument',d.instrument,'direction',d.direction,'pnl',d.pnl,'comment','') order by d.time,d.deal_id)
      from public.bot_calendar_performance_deals d where d.calendar_slug=p_slug and d.date_key=p_day),'[]'::jsonb));
end $$;

create function public.admin_bot_day_save(p_slug text,p_day date,p_revision bigint,p_note text,p_trades jsonb,p_restore boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare c public.bot_calendars; old public.bot_calendar_day_edits; rows jsonb;
begin
  perform public.site_admin_require(true);
  select * into c from public.bot_calendars where slug=p_slug and enabled for update;
  if not found or p_day is null or p_day<c.start_date or p_day>least(coalesce(c.end_date,current_date),(now() at time zone c.time_zone)::date) then raise exception 'DAY_OUT_OF_RANGE'; end if;
  select * into old from public.bot_calendar_day_edits where calendar_slug=p_slug and date_key=p_day;
  if p_revision is distinct from coalesce(old.revision,0) then raise exception 'DAY_CHANGED_RELOAD'; end if;
  if p_restore is null then raise exception 'INVALID_EDIT'; end if;
  if p_restore then
    delete from public.bot_calendar_day_edits where calendar_slug=p_slug and date_key=p_day;
  else
    if p_note is null or length(p_note)>3000 or p_trades is null or jsonb_typeof(p_trades)<>'array' or jsonb_array_length(p_trades)>5000 or pg_column_size(p_trades)>2097152 then raise exception 'INVALID_EDIT'; end if;
    if exists(select 1 from jsonb_to_recordset(p_trades) as t(time time,instrument text,direction text,pnl numeric,comment text)
      where t.time is null or t.instrument is null or length(trim(t.instrument)) not between 1 and 120 or t.direction is null or t.direction not in ('LONG','SHORT') or t.pnl is null or t.pnl::text in ('NaN','Infinity','-Infinity') or abs(t.pnl)>1000000000 or length(coalesce(t.comment,''))>2000) then raise exception 'INVALID_TRADE'; end if;
    -- IDs allocated per saved snapshot, numeric for existing analytics ordering.
    select coalesce(jsonb_agg(jsonb_build_object('deal_id',(900000000000000000000::numeric+nextval('public.bot_editor_revision'))::text,
      'time',t.time,'instrument',trim(t.instrument),'direction',t.direction,'pnl',t.pnl,'comment',coalesce(t.comment,''))), '[]'::jsonb)
      into rows from jsonb_to_recordset(p_trades) as t(time time,instrument text,direction text,pnl numeric,comment text);
    insert into public.bot_calendar_day_edits values(p_slug,p_day,p_note,rows,nextval('public.bot_editor_revision'))
      on conflict(calendar_slug,date_key) do update set note=excluded.note,trades=excluded.trades,revision=excluded.revision;
  end if;
  insert into public.site_admin_audit(actor_id,action,dataset,record_key,before_data,after_data)
    values(auth.uid(),case when p_restore then 'bot_day_restore' else 'bot_day_edit' end,'bot_calendar_day_edits',p_slug||':'||p_day,to_jsonb(old),
      (select to_jsonb(e) from public.bot_calendar_day_edits e where calendar_slug=p_slug and date_key=p_day));
end $$;
revoke all on function public.admin_bot_day(text,date),public.admin_bot_day_save(text,date,bigint,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.admin_bot_day(text,date),public.admin_bot_day_save(text,date,bigint,text,jsonb,boolean) to authenticated;

-- Only explicitly published editorial text is added to the public response.
alter function public.bot_stage_context(text) rename to bot_stage_context_before_editor;
create function public.bot_stage_context(p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
  select public.bot_stage_context_before_editor(p_slug)||jsonb_build_object('editor_days',coalesce((
    select jsonb_agg(jsonb_build_object('date_key',date_key,'note',note) order by date_key)
    from public.bot_calendar_day_edits where calendar_slug=p_slug),'[]'::jsonb));
$$;
revoke all on function public.bot_stage_context(text) from public,anon,authenticated;

-- Keep correction totals consistent with the same effective projection.
alter function public.bot_adjustment_summary(text,date,date) rename to bot_adjustment_summary_before_editor;
create function public.bot_adjustment_summary(p_slug text,p_from date default null,p_to date default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select public.bot_adjustment_summary_before_editor(p_slug,p_from,p_to)||jsonb_build_object('adjusted_pnl',coalesce((
    select sum(d.pnl) from public.bot_calendar_performance_deals d join public.bot_calendars c on c.slug=d.calendar_slug
    where d.calendar_slug=p_slug and d.date_key between coalesce(p_from,c.start_date) and coalesce(p_to,c.end_date,(now() at time zone c.time_zone)::date)),0));
$$;
revoke all on function public.bot_adjustment_summary(text,date,date) from public,anon,authenticated;

create function public.bot_editor_comments(p_slug text,p_result jsonb) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_set(p_result,'{trades}',coalesce((select jsonb_agg(x.value||jsonb_build_object('comment',coalesce(t.comment,'')) order by x.ordinality)
    from jsonb_array_elements(p_result->'trades') with ordinality x(value,ordinality)
    left join (select t.deal_id,t.comment from public.bot_calendar_day_edits e
      cross join lateral jsonb_to_recordset(e.trades) as t(deal_id text,comment text) where e.calendar_slug=p_slug) t on t.deal_id=x.value->>'deal_id'),'[]'::jsonb));
$$;
revoke all on function public.bot_editor_comments(text,jsonb) from public,anon,authenticated;
do $$ declare f regprocedure; begin
  foreach f in array array['public.get_bot_calendar_history(text,date,date,integer)'::regprocedure,'public.get_bot_calendar_day(text,date,integer)'::regprocedure] loop
    execute replace(replace(pg_get_functiondef(f),'return public.bot_history_raw(p_slug,p_from,coalesce(p_to,c.end_date),p_offset)',
      'return public.bot_editor_comments(p_slug,public.bot_history_raw(p_slug,p_from,coalesce(p_to,c.end_date),p_offset))'),
      'return public.bot_day_raw(p_slug,p_day,p_offset)','return public.bot_editor_comments(p_slug,public.bot_day_raw(p_slug,p_day,p_offset))');
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
