begin;

alter table public.site_admins
  add column can_view_users boolean not null default false,
  add column can_edit_users boolean not null default false;

create table public.site_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  subject_id uuid references auth.users(id) on delete set null,
  action text not null,
  dataset text,
  record_key text,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index site_admin_audit_subject on public.site_admin_audit(subject_id, id desc);
alter table public.site_admin_audit enable row level security;
revoke all on public.site_admin_audit from public, anon, authenticated;

create function public.site_admin_require(p_write boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.site_admins where user_id = auth.uid()
    and can_view_users and (not p_write or can_edit_users)) then
    raise exception 'User administration permission required' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.site_admin_require(boolean) from public, anon, authenticated;

create function public.admin_capabilities() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('design', true, 'viewUsers', can_view_users,
    'editUsers', can_view_users and can_edit_users) from public.site_admins where user_id = auth.uid()),
    '{"design":false,"viewUsers":false,"editUsers":false}'::jsonb);
$$;

-- Private, fixed registry. No caller-supplied table or column names reach SQL.
create function public.site_admin_dataset_spec(p_dataset text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare spec jsonb;
begin
  spec := case p_dataset
    when 'trades' then '{"table":"trades","date":"date_key"}'
    when 'wallet_transactions' then '{"table":"wallet_transactions","date":"date_key"}'
    when 'wallet_transfers' then '{"table":"wallet_transfers","date":"date_key"}'
    when 'reminders' then '{"table":"reminders","date":"local_at"}'
    when 'trading_day_notes' then '{"table":"trading_day_notes","date":"date_key"}'
    when 'capital_assets' then '{"table":"capital_assets"}'
    when 'capital_operations' then '{"table":"capital_operations","date":"occurred_on"}'
    when 'capital_valuation_snapshots' then '{"table":"capital_valuation_snapshots","date":"sampled_on"}'
    when 'capital_sale_settlements' then '{"table":"capital_sale_settlements"}'
    when 'capital_chart_preferences' then '{"table":"capital_chart_preferences"}'
    when 'capital_alert_preferences' then '{"table":"capital_alert_preferences"}'
    when 'capital_price_alerts' then '{"table":"capital_price_alerts"}'
    when 'capital_alert_events' then '{"table":"capital_alert_events"}'
    when 'pro_entitlements' then '{"table":"pro_entitlements"}'
    when 'pro_notifications' then '{"table":"pro_notifications"}'
    when 'pro_notification_deliveries' then '{"table":"pro_notification_deliveries","proDeliveries":true,"columns":["id","notification_id","status","attempts","next_attempt_at","error_code"]}'
    when 'referral_profiles' then '{"table":"referral_profiles"}'
    when 'referrals' then '{"table":"referrals","referrals":true}'
    when 'ctrader_accounts' then '{"table":"ctrader_accounts","columns":["id","user_id","account_id","account_number","broker_name","is_live","created_at","updated_at","last_sync_at","status"]}'
    when 'mt5_cloud_connections' then '{"table":"mt5_cloud_connections","columns":["user_id","login","server","created_at"]}'
    when 'voice_widget_devices' then '{"table":"voice_widget_devices","columns":["id","user_id","settings","conversation","revision","created_at","expires_at","revoked_at"]}'
    when 'voice_widget_turns' then '{"table":"voice_widget_turns","voiceTurns":true,"columns":["device_id","request_id","response","created_at"]}'
    when 'push_subscriptions' then '{"table":"push_subscriptions","columns":["id","user_id","active","created_at"]}'
    when 'reminder_deliveries' then '{"table":"reminder_deliveries","columns":["id","user_id","reminder_id","status","attempts","accepted_at","error_code","next_attempt_at"]}'
    else null end;
  if spec is null then raise exception 'Unknown dataset' using errcode = '22023'; end if;
  return spec;
end;
$$;
revoke all on function public.site_admin_dataset_spec(text) from public, anon, authenticated;

create function public.admin_list_users(p_search text default '', p_limit integer default 30, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.site_admin_require();
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 or length(p_search) > 200 then raise exception 'Invalid pagination'; end if;
  with matched as (
    select id, email, created_at, last_sign_in_at,
      coalesce(nullif(raw_user_meta_data->>'nickname',''), raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email, id::text) as name
    from auth.users where coalesce(p_search,'') = '' or
      position(lower(p_search) in lower(coalesce(email,'') || ' ' || id::text || ' ' || coalesce(raw_user_meta_data->>'nickname','') || ' ' || coalesce(raw_user_meta_data->>'full_name','') || ' ' || coalesce(raw_user_meta_data->>'name',''))) > 0
  ) select jsonb_build_object('total',(select count(*) from matched),'users',coalesce(
    (select jsonb_agg(to_jsonb(page)) from (select * from matched order by created_at desc,id limit p_limit offset p_offset) page),'[]'::jsonb)) into result;
  insert into public.site_admin_audit(actor_id,action) values(auth.uid(),'users.list');
  return result;
end;
$$;

create function public.admin_user_profile(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.site_admin_require();
  select jsonb_build_object('id',id,'email',email,'phone',phone,'created_at',created_at,'last_sign_in_at',last_sign_in_at,
    'email_confirmed_at',email_confirmed_at,'phone_confirmed_at',phone_confirmed_at,
    'profile',jsonb_build_object('nickname',raw_user_meta_data->>'nickname','name',raw_user_meta_data->>'name',
      'full_name',raw_user_meta_data->>'full_name','preferred_username',raw_user_meta_data->>'preferred_username',
      'avatar_url',raw_user_meta_data->>'avatar_url','birthday',raw_user_meta_data->>'birthday'),
    'providers',raw_app_meta_data->'providers') into result from auth.users where id=p_user_id;
  if result is null then raise exception 'User not found' using errcode = 'P0002'; end if;
  insert into public.site_admin_audit(actor_id,subject_id,action) values(auth.uid(),p_user_id,'user.view');
  return result;
end;
$$;

create function public.admin_user_data(p_user_id uuid,p_dataset text,p_from date default null,p_to date default null,p_limit integer default 100,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare spec jsonb; owner_filter text; date_filter text := ''; projection text := 'to_jsonb(r)'; result jsonb;
begin
  perform public.site_admin_require();
  if p_limit is null or p_limit not between 1 and 500 or p_offset is null or p_offset < 0 or (p_from is not null and p_to is not null and p_to < p_from) then raise exception 'Invalid pagination or dates'; end if;
  spec := public.site_admin_dataset_spec(p_dataset);
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found'; end if;
  if to_regclass(format('public.%I',spec->>'table')) is null then
    return jsonb_build_object('rows','[]'::jsonb,'total',0,'available',false);
  end if;
  owner_filter := case when spec ? 'referrals' then '(r.referrer_id=$1 or r.referred_id=$1)'
    when spec ? 'voiceTurns' then 'r.device_id in (select d.id from public.voice_widget_devices d where d.user_id=$1)'
    when spec ? 'proDeliveries' then 'r.notification_id in (select n.id from public.pro_notifications n where n.user_id=$1)'
    else 'r.user_id=$1' end;
  if spec ? 'date' then date_filter := format(' and ($2::date is null or left(to_jsonb(r)->>%L,10)::date >= $2) and ($3::date is null or left(to_jsonb(r)->>%L,10)::date <= $3)',spec->>'date',spec->>'date'); end if;
  if spec ? 'columns' then projection := format('(select coalesce(jsonb_object_agg(key,value),''{}''::jsonb) from jsonb_each(to_jsonb(r)) where key in (select jsonb_array_elements_text(%L::jsonb)))',spec->'columns'); end if;
  execute format('select jsonb_build_object(''rows'',coalesce((select jsonb_agg(page.data) from (select %s as data from public.%I r where %s %s order by coalesce(to_jsonb(r)->>''date_key'',to_jsonb(r)->>''occurred_on'',to_jsonb(r)->>''local_at'',to_jsonb(r)->>''created_at'','''') desc,to_jsonb(r)::text limit $4 offset $5) page),''[]''::jsonb),''total'',(select count(*) from public.%I r where %s %s),''available'',true)',
    projection,spec->>'table',owner_filter,date_filter,spec->>'table',owner_filter,date_filter)
    into result using p_user_id,p_from,p_to,p_limit,p_offset;
  insert into public.site_admin_audit(actor_id,subject_id,action,dataset) values(auth.uid(),p_user_id,'data.view',p_dataset);
  return result;
end;
$$;

create function public.admin_user_calendar(p_user_id uuid,p_month date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare first_day date; last_day date; result jsonb;
begin
  perform public.site_admin_require();
  if p_month is null then raise exception 'Month required'; end if;
  first_day := date_trunc('month',p_month)::date;
  last_day := (first_day + interval '1 month')::date;
  with entries as (
    select date_key::date as day,'trades'::text as dataset,currency,sum(pnl) as amount,count(*) as count
      from public.trades where user_id=p_user_id and date_key::date >= first_day and date_key::date < last_day group by date_key,currency
    union all
    select date_key,'wallet_transactions',currency,sum(case when kind='income' then amount else -amount end),count(*)
      from public.wallet_transactions where user_id=p_user_id and date_key >= first_day and date_key < last_day group by date_key,currency
    union all
    select local_at::date,'reminders',coalesce(currency,'—'),sum(case when kind='expense' then -coalesce(amount,0) else coalesce(amount,0) end),count(*)
      from public.reminders where user_id=p_user_id and local_at::date >= first_day and local_at::date < last_day and outcome='planned' and status='active' group by local_at::date,currency
  ) select coalesce(jsonb_agg(to_jsonb(entries) order by day,dataset,currency),'[]'::jsonb) into result from entries;
  insert into public.site_admin_audit(actor_id,subject_id,action) values(auth.uid(),p_user_id,'calendar.view');
  return result;
end;
$$;

create function public.admin_update_user_record(p_user_id uuid,p_dataset text,p_key text,p_expected jsonb,p_changes jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare spec jsonb; allowed text[]; key_column text := 'id'; previous jsonb; updated jsonb; assignments text; field text;
begin
  perform public.site_admin_require(true);
  if p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Reason required (5-500 characters)' using errcode='22023'; end if;
  if p_changes is null or jsonb_typeof(p_changes) is distinct from 'object' or p_changes='{}'::jsonb or octet_length(p_changes::text)>10000 then raise exception 'Invalid changes'; end if;
  case p_dataset
    when 'trades' then allowed := array['date_key','time','instrument','direction','pnl','currency','comment'];
    when 'wallet_transactions' then allowed := array['date_key','time','title','amount','kind','currency','comment'];
    when 'trading_day_notes' then allowed := array['note','tags']; key_column := 'date_key';
    else raise exception 'Dataset is read only' using errcode='42501';
  end case;
  spec := public.site_admin_dataset_spec(p_dataset);
  for field in select jsonb_object_keys(p_changes) loop
    if not field = any(allowed) then raise exception 'Field is read only' using errcode='42501'; end if;
    if p_changes->field = 'null'::jsonb then raise exception 'Null changes are not allowed'; end if;
  end loop;
  if p_changes ? 'instrument' and length(trim(p_changes->>'instrument')) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if p_changes ? 'comment' and length(p_changes->>'comment') > 2000 then raise exception 'Comment too long'; end if;
  if p_changes ? 'currency' and (p_changes->>'currency') !~ '^[A-Z]{3}$' then raise exception 'Invalid currency'; end if;
  if p_changes ? 'pnl' and jsonb_typeof(p_changes->'pnl') <> 'number' then raise exception 'Invalid amount'; end if;
  if p_changes ? 'amount' and (jsonb_typeof(p_changes->'amount') <> 'number' or (p_changes->>'amount')::numeric < 0) then raise exception 'Invalid amount'; end if;
  execute format('select to_jsonb(r) from public.%I r where r.user_id=$1 and r.%I::text=$2 for update',spec->>'table',key_column) into previous using p_user_id,p_key;
  if previous is null then raise exception 'Record not found' using errcode='P0002'; end if;
  if p_expected is distinct from previous then raise exception 'Record changed. Reload before editing.' using errcode='40001'; end if;
  -- Imported trades and capital settlements retain their financial source of truth.
  if p_dataset='trades' and lower(coalesce(previous->>'platform','')) <> 'manual' and (p_changes - 'comment') <> '{}'::jsonb then raise exception 'Imported financial data is read only' using errcode='42501'; end if;
  if p_dataset in ('trades','wallet_transactions') and (p_changes - 'comment') <> '{}'::jsonb and to_regclass('public.capital_sale_settlements') is not null then
    if exists(select 1 from public.capital_sale_settlements s where
      to_jsonb(s)->>(case when p_dataset='trades' then 'calendar_record_id' else 'wallet_transaction_id' end)=p_key and s.user_id=p_user_id) then
      raise exception 'Capital settlement data is read only' using errcode='42501';
    end if;
  end if;
  select string_agg(format('%I = v.%I',key,key),',') into assignments from jsonb_object_keys(p_changes) key;
  execute format('update public.%I r set %s from jsonb_populate_record(null::public.%I,$1) v where r.user_id=$2 and r.%I::text=$3 returning to_jsonb(r)',spec->>'table',assignments,spec->>'table',key_column)
    into updated using previous || p_changes,p_user_id,p_key;
  insert into public.site_admin_audit(actor_id,subject_id,action,dataset,record_key,reason,before_data,after_data)
    values(auth.uid(),p_user_id,'record.update',p_dataset,p_key,trim(p_reason),previous,updated);
  return updated;
end;
$$;

create function public.admin_audit_log(p_user_id uuid default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.site_admin_require();
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then raise exception 'Invalid pagination'; end if;
  select jsonb_build_object('total',(select count(*) from public.site_admin_audit where p_user_id is null or subject_id=p_user_id),
    'rows',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from public.site_admin_audit where p_user_id is null or subject_id=p_user_id order by id desc limit p_limit offset p_offset) r),'[]'::jsonb)) into result;
  return result;
end;
$$;

revoke all on function public.admin_capabilities(),public.admin_list_users(text,integer,integer),public.admin_user_profile(uuid),public.admin_user_data(uuid,text,date,date,integer,integer),public.admin_user_calendar(uuid,date),public.admin_update_user_record(uuid,text,text,jsonb,jsonb,text),public.admin_audit_log(uuid,integer,integer) from public,anon;
grant execute on function public.admin_capabilities(),public.admin_list_users(text,integer,integer),public.admin_user_profile(uuid),public.admin_user_data(uuid,text,date,date,integer,integer),public.admin_user_calendar(uuid,date),public.admin_update_user_record(uuid,text,text,jsonb,jsonb,text),public.admin_audit_log(uuid,integer,integer) to authenticated;
commit;
