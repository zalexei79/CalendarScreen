begin;

-- A private publication source and a separate broker-only snapshot. Personal trades
-- and their RLS never participate in public reads.
create table public.bot_calendars (
  slug text primary key check (slug ~ '^[a-z0-9-]{1,60}$'),
  title text not null,
  broker_account_id text not null,
  is_live boolean not null,
  source_account_id uuid references public.ctrader_accounts(id),
  start_date date not null,
  time_zone text not null default 'Europe/Bucharest',
  enabled boolean not null default true,
  currency text not null default 'USD',
  last_sync_at timestamptz,
  last_error text,
  lease_token uuid,
  lease_until timestamptz
);
create table public.bot_calendar_deals (
  calendar_slug text not null references public.bot_calendars(slug) on delete cascade,
  deal_id text not null check (deal_id ~ '^[0-9]+$'),
  date_key date not null,
  time time not null,
  instrument text not null,
  direction text not null check (direction in ('LONG','SHORT')),
  pnl numeric not null,
  currency text not null,
  primary key(calendar_slug,deal_id)
);
create index bot_calendar_deals_date on public.bot_calendar_deals(calendar_slug,date_key);
alter table public.bot_calendars enable row level security;
alter table public.bot_calendar_deals enable row level security;
revoke all on public.bot_calendars,public.bot_calendar_deals from public,anon,authenticated;
grant all on public.bot_calendars,public.bot_calendar_deals to service_role;

insert into public.bot_calendars(slug,title,broker_account_id,is_live,start_date)
values ('bot','Календарь бота','47484897',false,'2026-10-05');

-- Private account binding is pinned once. Ambiguous or missing accounts never
-- silently select another source. Also works if the owner connects after rollout.
create function public.claim_bot_calendar(p_slug text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.bot_calendars; a public.ctrader_accounts; candidates integer; token uuid;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled for update;
  if not found or c.lease_until>now() then return null; end if;
  if c.source_account_id is null then
    select count(*) into candidates from public.ctrader_accounts
      where account_id::text=c.broker_account_id and is_live=c.is_live;
    if candidates<>1 then
      update public.bot_calendars set last_error='SOURCE_NOT_CONNECTED' where slug=p_slug;
      return null;
    end if;
    select * into a from public.ctrader_accounts
      where account_id::text=c.broker_account_id and is_live=c.is_live;
    c.source_account_id:=a.id;
  else
    select * into a from public.ctrader_accounts where id=c.source_account_id
      and account_id::text=c.broker_account_id and is_live=c.is_live;
    if not found then raise exception 'SOURCE_MISMATCH'; end if;
  end if;
  token:=gen_random_uuid();
  update public.bot_calendars set source_account_id=c.source_account_id,
    lease_token=token,lease_until=now()+interval '5 minutes' where slug=p_slug;
  return jsonb_build_object('slug',c.slug,'account_id',c.broker_account_id,
    'source_account_id',c.source_account_id,'user_id',a.user_id,'is_live',c.is_live,
    'start_date',c.start_date,'time_zone',c.time_zone,'lease_token',token);
end $$;

-- Publish a COMPLETE snapshot atomically: readers see either the previous verified
-- history or the new verified history. A timeout never exposes half an import.
create function public.publish_bot_calendar(p_slug text,p_lease uuid,p_currency text,p_deals jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.bot_calendars; n integer;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled
    and lease_token=p_lease and lease_until>now() for update;
  if not found then raise exception 'LEASE_EXPIRED'; end if;
  if p_currency is null or p_currency !~ '^[A-Z0-9]{2,12}$'
    or jsonb_typeof(p_deals)<>'array' or p_deals is null then raise exception 'INVALID_SNAPSHOT'; end if;
  if exists(select 1 from jsonb_to_recordset(p_deals) as d(date_key date,currency text)
    where d.date_key<c.start_date or d.date_key is null or d.currency is distinct from p_currency)
    then raise exception 'OUTSIDE_PUBLICATION'; end if;
  delete from public.bot_calendar_deals where calendar_slug=p_slug;
  insert into public.bot_calendar_deals
    select p_slug,d.deal_id,d.date_key,d.time,d.instrument,d.direction,d.pnl,d.currency
    from jsonb_to_recordset(p_deals) as d(deal_id text,date_key date,time time,
      instrument text,direction text,pnl numeric,currency text);
  get diagnostics n=row_count;
  update public.bot_calendars set currency=p_currency,last_sync_at=now(),last_error=null,
    lease_token=null,lease_until=null where slug=p_slug;
  return n;
end $$;

create function public.fail_bot_calendar(p_slug text,p_lease uuid,p_code text) returns void
language sql security definer set search_path='' as $$
  update public.bot_calendars set last_error=left(p_code,80),lease_token=null,lease_until=null
    where slug=p_slug and lease_token=p_lease;
$$;

-- Anonymous access is a bounded, whitelisted RPC, never direct access to tokens,
-- user IDs, comments, private balances, other accounts or personal journal rows.
create function public.get_bot_calendar(p_slug text default 'bot',p_month date default current_date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars; first_day date; today date;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  today:=(now() at time zone c.time_zone)::date;
  first_day:=date_trunc('month',coalesce(p_month,today))::date;
  if first_day<date_trunc('month',c.start_date)::date or first_day>date_trunc('month',today)::date
    then raise exception 'MONTH_OUT_OF_RANGE'; end if;
  return jsonb_build_object('slug',c.slug,'title',c.title,'broker','Spotware',
    'account_number',c.broker_account_id,'is_live',c.is_live,'start_date',c.start_date,
    'time_zone',c.time_zone,'currency',c.currency,'today',today,
    'last_sync_at',c.last_sync_at,'status',case when c.last_sync_at is null then 'pending'
      when c.last_error is not null or c.last_sync_at<now()-interval '30 hours' then 'delayed' else 'ready' end,
    'days',coalesce((select jsonb_agg(x order by x.date_key) from (
      select date_key,sum(pnl) as pnl,count(*) as count from public.bot_calendar_deals
      where calendar_slug=p_slug and date_key>=greatest(c.start_date,first_day)
        and date_key<first_day+interval '1 month' and date_key<=today group by date_key
    ) x),'[]'::jsonb));
end $$;

create function public.get_bot_calendar_day(p_slug text,p_day date,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.bot_calendars;
begin
  select * into c from public.bot_calendars where slug=p_slug and enabled;
  if not found then return null; end if;
  if p_day<c.start_date or p_day>(now() at time zone c.time_zone)::date
    or p_day is null or p_offset<0 or p_offset is null or p_offset>1000000
    then raise exception 'DAY_OUT_OF_RANGE'; end if;
  return jsonb_build_object('total',(select count(*) from public.bot_calendar_deals
    where calendar_slug=p_slug and date_key=p_day),
    'trades',coalesce((select jsonb_agg(x order by x.time desc,x.deal_id desc) from (
      select deal_id,time,instrument,direction,pnl,currency from public.bot_calendar_deals
      where calendar_slug=p_slug and date_key=p_day order by time desc,deal_id desc limit 100 offset p_offset
    ) x),'[]'::jsonb));
end $$;

revoke all on function public.claim_bot_calendar(text),public.publish_bot_calendar(text,uuid,text,jsonb),
  public.fail_bot_calendar(text,uuid,text),public.get_bot_calendar(text,date),
  public.get_bot_calendar_day(text,date,integer) from public,anon,authenticated;
grant execute on function public.claim_bot_calendar(text),public.publish_bot_calendar(text,uuid,text,jsonb),
  public.fail_bot_calendar(text,uuid,text) to service_role;
grant execute on function public.get_bot_calendar(text,date),public.get_bot_calendar_day(text,date,integer) to anon,authenticated;
commit;
