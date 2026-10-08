begin;
create table public.voice_widget_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 secret_hash text not null unique check (length(secret_hash)=64),
 settings jsonb not null default '{}'::jsonb,
 conversation jsonb,
 revision bigint not null default 0,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '90 days',
 revoked_at timestamptz
);
create table public.voice_widget_turns (
 device_id uuid not null references public.voice_widget_devices(id) on delete cascade,
 request_id uuid not null,
 fingerprint text not null,
 response jsonb not null,
 created_at timestamptz not null default now(),
 primary key(device_id,request_id)
);
alter table public.voice_widget_devices enable row level security;
create index voice_widget_devices_owner on public.voice_widget_devices(user_id);
create index voice_widget_turns_recent on public.voice_widget_turns(device_id,created_at);
alter table public.voice_widget_turns enable row level security;
revoke all on public.voice_widget_devices,public.voice_widget_turns from anon,authenticated;
grant all on public.voice_widget_devices,public.voice_widget_turns to service_role;
grant select(id,created_at,expires_at,revoked_at) on public.voice_widget_devices to authenticated;
grant update(revoked_at) on public.voice_widget_devices to authenticated;
create policy widget_own_read on public.voice_widget_devices for select to authenticated using (user_id=auth.uid());
create policy widget_own_revoke on public.voice_widget_devices for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Serializes concurrent turns and commits all purchases + response atomically.
-- Retrying the same request after a lost response cannot duplicate a purchase.
create function public.commit_voice_widget_turn(p_device uuid,p_request uuid,p_fingerprint text,p_revision bigint,p_context jsonb,p_response jsonb,p_entries jsonb,p_today date,p_time text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare device public.voice_widget_devices; cached public.voice_widget_turns; entry jsonb; amount numeric; day date;
begin
 select * into device from public.voice_widget_devices where id=p_device for update;
 if not found or device.revoked_at is not null or device.expires_at<=now() then raise exception 'DEVICE_EXPIRED'; end if;
 select * into cached from public.voice_widget_turns where device_id=p_device and request_id=p_request;
 if found then
  if cached.fingerprint<>p_fingerprint then raise exception 'REQUEST_CONFLICT'; end if;
  return cached.response;
 end if;
 if device.revision<>p_revision then raise exception 'TURN_CONFLICT'; end if;
 if (select count(*) from public.voice_widget_turns where device_id=p_device and created_at>now()-interval '1 hour')>=120 then raise exception 'RATE_LIMITED'; end if;
 if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>10 or length(p_response::text)>20000 or length(coalesce(p_context::text,''))>30000 then raise exception 'INVALID_ENTRY'; end if;
 if p_today<current_date-1 or p_today>current_date+1 or p_time!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'INVALID_DATE'; end if;
 for entry in select value from jsonb_array_elements(p_entries) loop
  if jsonb_typeof(entry)<>'object' or not (entry ?& array['amount','dateKey','sign','currency','category','destination']) or entry->>'amount' is null or entry->>'dateKey' is null or entry->>'sign' is null or entry->>'currency' is null or entry->>'category' is null or entry->>'destination' is null then raise exception 'INVALID_ENTRY'; end if;
  amount=(entry->>'amount')::numeric; day=(entry->>'dateKey')::date;
  if amount<=0 or amount>=1000000000000 or amount::text in ('NaN','Infinity','-Infinity') or day>p_today or day<'1900-01-01' or entry->>'destination'<>'main' or entry->>'sign' not in ('minus','plus') or entry->>'currency' not in ('MDL','USD','EUR','RUB','CNY') or length(trim(entry->>'category')) not between 1 and 60 then raise exception 'INVALID_ENTRY'; end if;
  insert into public.trades(user_id,date_key,time,instrument,direction,pnl,comment,platform,currency)
   select row.user_id,row.date_key,row.time,row.instrument,row.direction,row.pnl,row.comment,row.platform,row.currency
   from jsonb_populate_record(null::public.trades,jsonb_build_object('user_id',device.user_id,'date_key',day::text,'time',p_time,'instrument',upper(trim(entry->>'category')),'direction',case when entry->>'sign'='minus' then 'SHORT' else 'LONG' end,'pnl',case when entry->>'sign'='minus' then -amount else amount end,'comment','','platform','Manual','currency',entry->>'currency')) as row;
 end loop;
 update public.voice_widget_devices set conversation=p_context,revision=revision+1 where id=p_device;
 insert into public.voice_widget_turns(device_id,request_id,fingerprint,response) values(p_device,p_request,p_fingerprint,p_response);
 delete from public.voice_widget_turns where device_id=p_device and created_at<now()-interval '2 days';
 return p_response;
end $$;
revoke all on function public.commit_voice_widget_turn(uuid,uuid,text,bigint,jsonb,jsonb,jsonb,date,text) from public,anon,authenticated;
grant execute on function public.commit_voice_widget_turn(uuid,uuid,text,bigint,jsonb,jsonb,jsonb,date,text) to service_role;
commit;
