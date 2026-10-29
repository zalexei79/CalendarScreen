begin;
alter table public.account_activity_streaks add column admin_adjusted_at timestamptz;

create function public.site_admin_streak_state(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('user_id',u.id,'snapshot',case when s.user_id is null then null else to_jsonb(s) end,
    'current_days',case when s.user_id is null or d.today-s.last_active_date>=3 then 0 else s.current_streak end,
    'stored_days',coalesce(s.current_streak,0),'server_date',d.today,'time_zone',coalesce(s.time_zone,'UTC'),
    'last_active_date',s.last_active_date,'last_entry_date',s.last_entry_date,
    'completed_today',coalesce(s.last_entry_date=d.today,false),'expired',coalesce(d.today-s.last_active_date>=3,false),
    'admin_adjusted_at',s.admin_adjusted_at)
  from auth.users u left join public.account_activity_streaks s on s.user_id=u.id
  cross join lateral (select (now() at time zone coalesce(s.time_zone,'UTC'))::date as today) d where u.id=p_user_id;
$$;
revoke all on function public.site_admin_streak_state(uuid) from public,anon,authenticated;

create function public.admin_streak_state(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.site_admin_require();
  result:=public.site_admin_streak_state(p_user_id);
  if result is null then raise exception 'User not found' using errcode='P0002'; end if;
  insert into public.site_admin_audit(actor_id,subject_id,action,dataset) values(auth.uid(),p_user_id,'streak.view','account_activity_streaks');
  return result;
end $$;

create function public.admin_change_streak(p_user_id uuid,p_action text,p_value integer,p_expected jsonb,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous jsonb; updated jsonb; next_count integer; today date;
begin
  perform public.site_admin_require(true);
  if p_action is null or p_action not in ('adjust','set','preserve') or p_expected is null or jsonb_typeof(p_expected)<>'object' or octet_length(p_expected::text)>10000 or length(coalesce(p_note,''))>500 then raise exception 'Invalid streak change' using errcode='22023'; end if;
  if p_action='adjust' and (p_value is null or p_value=0 or p_value not between -36500 and 36500) or p_action='set' and (p_value is null or p_value not between 0 and 36500) then raise exception 'Invalid streak value' using errcode='22023'; end if;
  perform 1 from auth.users where id=p_user_id for update;
  if not found then raise exception 'User not found' using errcode='P0002'; end if;
  perform 1 from public.account_activity_streaks where user_id=p_user_id for update;
  previous:=public.site_admin_streak_state(p_user_id);
  -- Includes server-local date, so a midnight/expiry change requires review too.
  if p_expected is distinct from previous then raise exception 'Streak changed; reload before editing' using errcode='40001'; end if;
  today:=(previous->>'server_date')::date;
  next_count:=case p_action when 'set' then p_value when 'preserve' then greatest(1,(previous->>'stored_days')::integer) else (previous->>'current_days')::integer+p_value end;
  if next_count not between 0 and 36500 then raise exception 'Streak outside allowed range' using errcode='22023'; end if;
  insert into public.account_activity_streaks(user_id,current_streak,last_active_date,time_zone,paused,admin_adjusted_at)
    values(p_user_id,next_count,today,previous->>'time_zone',true,now())
  on conflict(user_id) do update set current_streak=excluded.current_streak,last_active_date=excluded.last_active_date,
    paused=public.account_activity_streaks.last_entry_date is distinct from today,admin_adjusted_at=now(),updated_at=now();
  -- last_entry_date and no-spend marks are not awarded or erased by admin edits.
  updated:=public.site_admin_streak_state(p_user_id);
  insert into public.site_admin_audit(actor_id,subject_id,action,dataset,reason,before_data,after_data)
    values(auth.uid(),p_user_id,'streak.'||p_action,'account_activity_streaks',nullif(trim(p_note),''),previous,updated);
  return updated;
end $$;
revoke all on function public.admin_streak_state(uuid),public.admin_change_streak(uuid,text,integer,jsonb,text) from public,anon;
grant execute on function public.admin_streak_state(uuid),public.admin_change_streak(uuid,text,integer,jsonb,text) to authenticated;
create or replace function public.admin_list_users_activity(p_search text default '',p_days integer default 0,p_sort text default 'records',p_limit integer default 30,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.site_admin_require();
  if p_search is null or length(p_search)>200 or p_days is null or p_days not in (-1,0,1,7,30) or p_sort is null or p_sort not in ('records','login','registered','streak') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 then raise exception 'Invalid activity filters' using errcode='22023'; end if;
  with activity as (select user_id,max(event_at) as last_entry_at,count(*) as entry_count from public.site_admin_activity_rows() group by user_id),
  matched as (
    select u.id,u.email,u.created_at,u.last_sign_in_at,
      coalesce(nullif(u.raw_user_meta_data->>'nickname',''),u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.email,u.id::text) as name,
      a.last_entry_at,coalesce(a.entry_count,0) as entry_count,
      case when s.user_id is null or (now() at time zone s.time_zone)::date-s.last_active_date>=3 then 0 else s.current_streak end as streak_days,
      s.admin_adjusted_at as streak_admin_adjusted_at
    from auth.users u left join activity a on a.user_id=u.id left join public.account_activity_streaks s on s.user_id=u.id
    where (p_search='' or position(lower(p_search) in lower(coalesce(u.email,'')||' '||u.id::text||' '||coalesce(u.raw_user_meta_data->>'nickname','')||' '||coalesce(u.raw_user_meta_data->>'full_name','')||' '||coalesce(u.raw_user_meta_data->>'name','')))>0)
      and (p_days=0 or (p_days=-1 and a.user_id is null) or (p_days>0 and a.last_entry_at>=now()-make_interval(days=>p_days)))
  ), page as (select * from matched order by
    case when p_sort='streak' then streak_days end desc nulls last,
    case p_sort when 'records' then last_entry_at when 'login' then last_sign_in_at else created_at end desc nulls last,created_at desc,id limit p_limit offset p_offset)
  select jsonb_build_object('total',(select count(*) from matched),'users',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'server_now',now()) into result;
  insert into public.site_admin_audit(actor_id,action) values(auth.uid(),'users.activity');
  return result;
end $$;

notify pgrst,'reload schema';
commit;
