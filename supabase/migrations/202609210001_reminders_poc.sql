-- DAYRIS Web Push PoC. Additive; does not alter trades/auth/cTrader/PRO.
begin;
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 20 and 4096),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id,id)
);
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  amount numeric(18,2) check (amount >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  kind text not null default 'custom' check (kind in ('custom','expense','income')),
  local_at timestamp not null,
  timezone text not null,
  scheduled_at timestamptz not null,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  unique(user_id,id),
  check ((amount is null and currency is null) or (amount is not null and currency is not null))
);
create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid not null,
  subscription_id uuid not null,
  status text not null default 'pending' check (status in ('pending','sending','accepted','failed','uncertain','cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  accepted_at timestamptz,
  error_code text,
  foreign key(user_id,reminder_id) references public.reminders(user_id,id) on delete cascade,
  foreign key(user_id,subscription_id) references public.push_subscriptions(user_id,id) on delete cascade,
  unique(reminder_id,subscription_id)
);
create index dayris_reminders_due on public.reminders(scheduled_at) where status='active';
create index dayris_deliveries_pending on public.reminder_deliveries(next_attempt_at) where status='pending';
alter table public.push_subscriptions enable row level security;
alter table public.reminders enable row level security;
alter table public.reminder_deliveries enable row level security;
revoke all on public.push_subscriptions, public.reminders, public.reminder_deliveries from public, anon, authenticated;
grant select,delete on public.push_subscriptions to authenticated;
grant select on public.reminders,public.reminder_deliveries to authenticated;
grant all on public.push_subscriptions,public.reminders,public.reminder_deliveries to service_role;
create policy push_own_select on public.push_subscriptions for select to authenticated using ((select auth.uid())=user_id);
create policy push_own_delete on public.push_subscriptions for delete to authenticated using ((select auth.uid())=user_id);
create policy reminders_own_read on public.reminders for select to authenticated using ((select auth.uid())=user_id);
create policy deliveries_own_read on public.reminder_deliveries for select to authenticated using ((select auth.uid())=user_id);

create function public.dayris_register_push(p_endpoint text,p_p256dh text,p_auth text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result uuid;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if (select count(*) from public.push_subscriptions where user_id=u)>=10
     and not exists(select 1 from public.push_subscriptions where user_id=u and endpoint=p_endpoint)
  then raise exception 'DEVICE_LIMIT'; end if;
  if p_endpoint !~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)/[^[:space:]]+$'
  then raise exception 'UNSUPPORTED_PUSH_ENDPOINT'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth)
  values(u,p_endpoint,p_p256dh,p_auth)
  on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,active=true
  where push_subscriptions.user_id=u
  returning id into result;
  if result is null then raise exception 'SUBSCRIPTION_OTHER_ACCOUNT'; end if;
  return result;
end $$;

create function public.dayris_create_reminder(p_id uuid,p_title text,p_local_at timestamp,p_timezone text,p_scheduled_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if exists(select 1 from public.reminders where id=p_id and user_id=u) then return p_id; end if;
  if p_scheduled_at <= now() or p_scheduled_at > now()+interval '31 days' then raise exception 'TIME_OUT_OF_RANGE'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'INVALID_TIMEZONE'; end if;
  if p_local_at <> (p_scheduled_at at time zone p_timezone) then raise exception 'LOCAL_TIME_MISMATCH'; end if;
  if (select count(*) from public.reminders where user_id=u and status='active' and scheduled_at>now())>=20 then raise exception 'POC_LIMIT'; end if;
  if not exists(select 1 from public.push_subscriptions where user_id=u and active) then raise exception 'NO_PUSH_DEVICE'; end if;
  insert into public.reminders(id,user_id,title,local_at,timezone,scheduled_at) values(p_id,u,p_title,p_local_at,p_timezone,p_scheduled_at);
  insert into public.reminder_deliveries(user_id,reminder_id,subscription_id) select u,p_id,id from public.push_subscriptions where user_id=u and active;
  return p_id;
end $$;

create function public.dayris_cancel_reminder(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.reminders set status='cancelled' where id=p_id and user_id=auth.uid();
  update public.reminder_deliveries set status='cancelled' where reminder_id=p_id and user_id=auth.uid() and status='pending';
end $$;

create function public.dayris_claim_reminders()
returns table(delivery_id uuid,token uuid,endpoint text,p256dh text,auth text,reminder_id uuid)
language plpgsql security definer set search_path='' as $$
begin
  update public.reminder_deliveries set status='uncertain',error_code='WORKER_INTERRUPTED' where status='sending' and lease_until<now();
  update public.reminder_deliveries d set status='failed',error_code='EXPIRED_OR_DISABLED'
    from public.reminders r,public.push_subscriptions s
    where d.reminder_id=r.id and d.subscription_id=s.id and d.status='pending' and (r.scheduled_at<now()-interval '1 hour' or r.status<>'active' or not s.active);
  return query
  with picked as (
    select d.id from public.reminder_deliveries d join public.reminders r on r.id=d.reminder_id join public.push_subscriptions s on s.id=d.subscription_id
    where d.status='pending' and d.next_attempt_at<=now() and d.attempts<4 and r.status='active' and r.scheduled_at<=now() and r.scheduled_at>=now()-interval '1 hour' and s.active
    order by r.scheduled_at,d.id limit 10 for update of d skip locked
  ), claimed as (
    update public.reminder_deliveries d set status='sending',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
    from picked where d.id=picked.id returning d.*
  ) select c.id,c.lease_token,s.endpoint,s.p256dh,s.auth,c.reminder_id from claimed c join public.push_subscriptions s on s.id=c.subscription_id;
end $$;

create function public.dayris_finish_delivery(p_id uuid,p_token uuid,p_result text,p_code text)
returns void language plpgsql security definer set search_path='' as $$
declare d public.reminder_deliveries;
begin
  select * into d from public.reminder_deliveries where id=p_id and lease_token=p_token and status='sending' for update;
  if not found then return; end if;
  if p_result not in ('accepted','failed','uncertain','retry','gone') then raise exception 'INVALID_RESULT'; end if;
  if p_result='gone' then update public.push_subscriptions set active=false where id=d.subscription_id; end if;
  update public.reminder_deliveries set status=case when p_result='retry' and attempts<4 then 'pending' when p_result in ('retry','gone') then 'failed' else p_result end,
    next_attempt_at=now()+interval '5 minutes',lease_until=null,accepted_at=case when p_result='accepted' then now() else null end,error_code=left(p_code,80) where id=d.id;
end $$;

revoke all on function public.dayris_register_push(text,text,text),public.dayris_create_reminder(uuid,text,timestamp,text,timestamptz),public.dayris_cancel_reminder(uuid),public.dayris_claim_reminders(),public.dayris_finish_delivery(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.dayris_register_push(text,text,text),public.dayris_create_reminder(uuid,text,timestamp,text,timestamptz),public.dayris_cancel_reminder(uuid) to authenticated;
grant execute on function public.dayris_claim_reminders(),public.dayris_finish_delivery(uuid,uuid,text,text) to service_role;
commit;
