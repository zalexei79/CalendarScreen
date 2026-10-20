begin;

-- Internal canonical snapshot: also used for optimistic concurrency checks.
create function public.site_admin_pro_snapshot(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('grants',(select coalesce(jsonb_agg(to_jsonb(e) order by to_jsonb(e)::text),'[]'::jsonb)
  from public.pro_entitlements e where e.user_id=p_user_id),'subscriptions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'provider',s.provider,'status',s.status,'ends_at',s.ends_at,'trial_ends_at',s.trial_ends_at,'renews_at',s.renews_at) order by s.id),'[]'::jsonb) from public.pro_subscriptions s where s.user_id=p_user_id));
$$;
revoke all on function public.site_admin_pro_snapshot(uuid) from public,anon,authenticated;

create function public.admin_list_pro(p_search text default '',p_filter text default 'active',p_limit integer default 30,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.site_admin_require();
  if p_search is null or length(p_search)>200 or p_filter is null or p_filter not in ('active','all') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 then
    raise exception 'Invalid filter or pagination' using errcode='22023';
  end if;
  with matched as (
    select u.id,u.email,
      coalesce(nullif(u.raw_user_meta_data->>'nickname',''),u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.email,u.id::text) as name,
      coalesce(u.raw_app_meta_data->'providers','[]'::jsonb) as providers,
      greatest((select max(e.ends_at) from public.pro_entitlements e where e.user_id=u.id and e.starts_at<=now() and e.ends_at>now()),
        (select max(case when s.status='cancelled' then s.ends_at else coalesce(s.ends_at,s.trial_ends_at,s.renews_at) end) from public.pro_subscriptions s where s.user_id=u.id and s.provider='lemon_squeezy' and (s.status in ('active','on_trial') or (s.status='cancelled' and s.ends_at>now())))) as active_until,
      exists(select 1 from public.pro_subscriptions s where s.user_id=u.id and s.provider='lemon_squeezy' and (s.status in ('active','on_trial') or (s.status='cancelled' and s.ends_at>now()))) as subscription_active
    from auth.users u
    where (p_search='' or position(lower(p_search) in lower(coalesce(u.email,'')||' '||u.id::text||' '||coalesce(u.raw_user_meta_data::text,'')))>0)
      and (p_filter='all' or exists(select 1 from public.pro_entitlements e where e.user_id=u.id and e.starts_at<=now() and e.ends_at>now()) or exists(select 1 from public.pro_subscriptions s where s.user_id=u.id and s.provider='lemon_squeezy' and (s.status in ('active','on_trial') or (s.status='cancelled' and s.ends_at>now()))))
  ) select jsonb_build_object('total',(select count(*) from matched),'users',coalesce((
    select jsonb_agg(to_jsonb(page) order by page.active_until asc nulls last,page.id)
    from (select * from matched order by active_until asc nulls last,id limit p_limit offset p_offset) page
  ),'[]'::jsonb),'server_now',now()) into result;
  insert into public.site_admin_audit(actor_id,action,dataset) values(auth.uid(),'pro.list','pro_entitlements');
  return result;
end $$;

create function public.admin_pro_state(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.site_admin_require();
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found' using errcode='P0002'; end if;
  result:=public.site_admin_pro_snapshot(p_user_id);
  insert into public.site_admin_audit(actor_id,subject_id,action,dataset) values(auth.uid(),p_user_id,'pro.view','pro_entitlements');
  return result||jsonb_build_object('server_now',now());
end $$;

create function public.admin_change_pro(p_user_id uuid,p_action text,p_amount integer,p_unit text,p_expected jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous jsonb; updated jsonb; until_date timestamptz; duration interval;
begin
  perform public.site_admin_require(true);
  if p_action is null or p_action not in ('extend','revoke') or p_reason is null or length(trim(p_reason)) not between 5 and 500 or p_expected is null or jsonb_typeof(p_expected)<>'object' then
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
    values(auth.uid(),p_user_id,'pro.'||p_action,'pro_entitlements',trim(p_reason),previous,updated);
  return updated||jsonb_build_object('server_now',now());
end $$;

revoke all on function public.admin_list_pro(text,text,integer,integer),public.admin_pro_state(uuid),public.admin_change_pro(uuid,text,integer,text,jsonb,text) from public,anon;
grant execute on function public.admin_list_pro(text,text,integer,integer),public.admin_pro_state(uuid),public.admin_change_pro(uuid,text,integer,text,jsonb,text) to authenticated;
commit;
