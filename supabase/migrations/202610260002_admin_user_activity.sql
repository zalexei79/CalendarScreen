begin;
-- Fixed projection only. Calendar dates are not used as creation timestamps.
create function public.site_admin_activity_rows()
returns table(user_id uuid,dataset text,record_key text,event_at timestamptz,record_date text,title text,amount numeric,currency text,platform text)
language plpgsql stable security definer set search_path='' as $$
declare dataset_name text;
begin
  foreach dataset_name in array array['trades','wallet_transactions','reminders','trading_day_notes'] loop
    if to_regclass(format('public.%I',dataset_name)) is not null then
      return query execute format($sql$
        select r.user_id,%L::text,coalesce(j->>'id',j->>'date_key'),
          coalesce((j->>'updated_at')::timestamptz,(j->>'created_at')::timestamptz),
          coalesce(j->>'date_key',j->>'local_at'),left(coalesce(j->>'instrument',j->>'title',j->>'note','Запись'),160),
          case when %L='trades' then (j->>'pnl')::numeric when %L='trading_day_notes' then null else (case when j->>'kind'='expense' then -1 else 1 end)*(j->>'amount')::numeric end,
          j->>'currency',j->>'platform'
        from public.%I r cross join lateral (select to_jsonb(r) as j) value
      $sql$,dataset_name,dataset_name,dataset_name,dataset_name);
    end if;
  end loop;
end $$;
revoke all on function public.site_admin_activity_rows() from public,anon,authenticated;

create function public.admin_list_users_activity(p_search text default '',p_days integer default 0,p_sort text default 'records',p_limit integer default 30,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.site_admin_require();
  if p_search is null or length(p_search)>200 or p_days is null or p_days not in (-1,0,1,7,30) or p_sort is null or p_sort not in ('records','login','registered') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 then raise exception 'Invalid activity filters' using errcode='22023'; end if;
  with activity as (select user_id,max(event_at) as last_entry_at,count(*) as entry_count from public.site_admin_activity_rows() group by user_id),
  matched as (
    select u.id,u.email,u.created_at,u.last_sign_in_at,
      coalesce(nullif(u.raw_user_meta_data->>'nickname',''),u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.email,u.id::text) as name,
      a.last_entry_at,coalesce(a.entry_count,0) as entry_count
    from auth.users u left join activity a on a.user_id=u.id
    where (p_search='' or position(lower(p_search) in lower(coalesce(u.email,'')||' '||u.id::text||' '||coalesce(u.raw_user_meta_data->>'nickname','')||' '||coalesce(u.raw_user_meta_data->>'full_name','')||' '||coalesce(u.raw_user_meta_data->>'name','')))>0)
      and (p_days=0 or (p_days=-1 and a.user_id is null) or (p_days>0 and a.last_entry_at>=now()-make_interval(days=>p_days)))
  ), page as (select * from matched order by
    case p_sort when 'records' then last_entry_at when 'login' then last_sign_in_at else created_at end desc nulls last,created_at desc,id limit p_limit offset p_offset)
  select jsonb_build_object('total',(select count(*) from matched),'users',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'server_now',now()) into result;
  insert into public.site_admin_audit(actor_id,action) values(auth.uid(),'users.activity');
  return result;
end $$;

create function public.admin_recent_entries(p_user_id uuid default null,p_days integer default 0,p_dataset text default 'all',p_limit integer default 20,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.site_admin_require();
  if p_days is null or p_days not in (0,1,7,30) or p_dataset is null or p_dataset not in ('all','trades','wallet_transactions','reminders','trading_day_notes') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 then raise exception 'Invalid activity filters' using errcode='22023'; end if;
  with matched as (
    select e.*,u.email,coalesce(nullif(u.raw_user_meta_data->>'nickname',''),u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.email,u.id::text) as name
    from public.site_admin_activity_rows() e join auth.users u on u.id=e.user_id
    where (p_user_id is null or e.user_id=p_user_id) and (p_dataset='all' or e.dataset=p_dataset)
      and (p_days=0 or e.event_at>=now()-make_interval(days=>p_days))
  ),page as (select * from matched order by event_at desc nulls last,user_id,dataset,record_key limit p_limit offset p_offset)
  select jsonb_build_object('total',(select count(*) from matched),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'server_now',now()) into result;
  insert into public.site_admin_audit(actor_id,subject_id,action) values(auth.uid(),p_user_id,'entries.recent');
  return result;
end $$;
revoke all on function public.admin_list_users_activity(text,integer,text,integer,integer),public.admin_recent_entries(uuid,integer,text,integer,integer) from public,anon;
grant execute on function public.admin_list_users_activity(text,integer,text,integer,integer),public.admin_recent_entries(uuid,integer,text,integer,integer) to authenticated;
create or replace function public.admin_change_pro(p_user_id uuid,p_action text,p_amount integer,p_unit text,p_expected jsonb,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous jsonb; updated jsonb; until_date timestamptz; duration interval;
begin
  perform public.site_admin_require(true);
  if p_action is null or p_action not in ('extend','revoke') or length(coalesce(trim(p_reason),''))>500 or (p_action='revoke' and length(coalesce(trim(p_reason),''))<5) or p_expected is null or jsonb_typeof(p_expected)<>'object' then
    raise exception 'Invalid action, snapshot or reason' using errcode='22023';
  end if;
  if p_action='extend' then
    if p_unit is null or p_unit not in ('days','years') or p_amount is null or p_amount<1 or (p_unit='days' and p_amount>36525) or (p_unit='years' and p_amount>100) then
      raise exception 'Invalid duration' using errcode='22023';
    end if;
    duration:=case when p_unit='years' then make_interval(years=>p_amount) else make_interval(days=>p_amount) end;
  end if;
  -- Short transaction serializes entitlement writers, including payment callbacks.
  -- A grant arriving after the confirmation was opened must not be silently revoked.
  lock table public.pro_entitlements in share row exclusive mode;
  lock table public.pro_subscriptions in share row exclusive mode;
  perform 1 from auth.users where id=p_user_id for update;
  if not found then raise exception 'User not found' using errcode='P0002'; end if;
  previous:=public.site_admin_pro_snapshot(p_user_id);
  if p_expected is distinct from previous then raise exception 'PRO changed; reload before editing' using errcode='40001'; end if;
  if p_action='extend' then
    select greatest(now(),coalesce(max(ends_at),now())) into until_date from public.pro_entitlements where user_id=p_user_id;
    select greatest(until_date,max(case when status='cancelled' then ends_at else coalesce(ends_at,trial_ends_at,renews_at) end)) into until_date from public.pro_subscriptions where user_id=p_user_id and provider='lemon_squeezy' and (status in ('active','on_trial') or (status='cancelled' and ends_at>now()));
    if not isfinite(until_date) then raise exception 'PRO already has unlimited duration' using errcode='22023'; end if;
    insert into public.pro_entitlements(user_id,source,starts_at,ends_at) values(p_user_id,'admin',now(),until_date+duration);
  else
    -- Expire every source, including scheduled grants. Keep records and audit history.
    update public.pro_entitlements set ends_at=now(),starts_at=least(starts_at,now()-interval '1 microsecond') where user_id=p_user_id and ends_at>now();
    -- Local access status only: no provider API call, cancellation or refund.
    update public.pro_subscriptions set status='expired',ends_at=now(),updated_at=now() where user_id=p_user_id and provider='lemon_squeezy' and (status in ('active','on_trial') or (status='cancelled' and ends_at>now()));
  end if;
  updated:=public.site_admin_pro_snapshot(p_user_id);
  insert into public.site_admin_audit(actor_id,subject_id,action,dataset,reason,before_data,after_data)
    values(auth.uid(),p_user_id,'pro.'||p_action,'pro_entitlements',nullif(trim(p_reason),''),previous,updated);
  return updated||jsonb_build_object('server_now',now());
end $$;

commit;
