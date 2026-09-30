-- Requires the existing pro_entitlements(user_id, source, starts_at, ends_at).
begin;
create table public.pro_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique(user_id,source,starts_at,ends_at)
);
create table public.pro_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.pro_notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sending','accepted','failed','uncertain')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  error_code text,
  unique(notification_id,subscription_id)
);
alter table public.pro_notifications enable row level security;
alter table public.pro_notification_deliveries enable row level security;
revoke all on public.pro_notifications,public.pro_notification_deliveries from public,anon,authenticated;
grant select on public.pro_notifications to authenticated;
grant all on public.pro_notifications,public.pro_notification_deliveries to service_role;
create policy pro_notifications_own_read on public.pro_notifications for select to authenticated using ((select auth.uid())=user_id);
create index pro_notifications_unread on public.pro_notifications(user_id) where seen_at is null;
create index pro_notification_deliveries_pending on public.pro_notification_deliveries(next_attempt_at) where status='pending';

create function public.dayris_notify_pro_grant() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.ends_at <= old.ends_at and new.starts_at is not distinct from old.starts_at
       and new.user_id is not distinct from old.user_id then return new; end if;
  end if;
  if new.ends_at > now() then
    insert into public.pro_notifications(user_id,source,starts_at,ends_at)
    values(new.user_id,coalesce(new.source::text,'unknown'),new.starts_at,new.ends_at)
    on conflict(user_id,source,starts_at,ends_at) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.dayris_notify_pro_grant() from public,anon,authenticated;
create trigger dayris_pro_granted after insert or update on public.pro_entitlements
for each row execute function public.dayris_notify_pro_grant();

-- Include existing grants so current PRO users also get a welcome message.
insert into public.pro_notifications(user_id,source,starts_at,ends_at)
select user_id,coalesce(source::text,'unknown'),starts_at,ends_at
from public.pro_entitlements where ends_at>now()
on conflict(user_id,source,starts_at,ends_at) do nothing;

create function public.dayris_get_pro_notifications()
returns table(id uuid,ends_at timestamptz)
language sql security definer set search_path='' as $$
  select n.id,n.ends_at from public.pro_notifications n
  where n.user_id=auth.uid() and n.seen_at is null and n.starts_at<=now() and n.ends_at>now()
    and exists(select 1 from public.pro_entitlements e where e.user_id=n.user_id
      and coalesce(e.source::text,'unknown')=n.source and e.starts_at=n.starts_at and e.ends_at=n.ends_at)
  order by n.created_at desc limit 100;
$$;
create function public.dayris_ack_pro_notifications(p_ids uuid[]) returns void
language sql security definer set search_path='' as $$
  update public.pro_notifications set seen_at=now()
  where user_id=auth.uid() and id=any(p_ids) and seen_at is null;
$$;
revoke all on function public.dayris_get_pro_notifications(),public.dayris_ack_pro_notifications(uuid[]) from public,anon,authenticated;
grant execute on function public.dayris_get_pro_notifications(),public.dayris_ack_pro_notifications(uuid[]) to authenticated;

create function public.dayris_claim_pro_notifications()
returns table(delivery_id uuid,token uuid,endpoint text,p256dh text,auth text,notification_id uuid,ends_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  update public.pro_notification_deliveries set status='uncertain',error_code='WORKER_INTERRUPTED'
  where status='sending' and lease_until<now();
  -- Enqueue each registered device once, including devices registered shortly after the grant.
  insert into public.pro_notification_deliveries(notification_id,subscription_id)
  select n.id,s.id from public.pro_notifications n join public.push_subscriptions s on s.user_id=n.user_id and s.active
  where n.starts_at<=now() and n.ends_at>now() and greatest(n.created_at,n.starts_at)>now()-interval '1 day'
    and n.seen_at is null
    and exists(select 1 from public.pro_entitlements e where e.user_id=n.user_id
      and coalesce(e.source::text,'unknown')=n.source and e.starts_at=n.starts_at and e.ends_at=n.ends_at)
  on conflict do nothing;
  update public.pro_notification_deliveries d set status='failed',error_code='EXPIRED_OR_DISABLED'
  from public.pro_notifications n,public.push_subscriptions s
  where d.notification_id=n.id and d.subscription_id=s.id and d.status='pending'
    and (not s.active or n.seen_at is not null or n.ends_at<=now()
      or greatest(n.created_at,n.starts_at)<=now()-interval '1 day'
      or not exists(select 1 from public.pro_entitlements e where e.user_id=n.user_id
        and coalesce(e.source::text,'unknown')=n.source and e.starts_at=n.starts_at and e.ends_at=n.ends_at));
  return query with picked as (
    select d.id from public.pro_notification_deliveries d
    where d.status='pending' and d.next_attempt_at<=now() and d.attempts<4
    order by d.next_attempt_at,d.id limit 10 for update skip locked
  ), claimed as (
    update public.pro_notification_deliveries d set status='sending',attempts=d.attempts+1,
      lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
    from picked where d.id=picked.id returning d.*
  ) select c.id,c.lease_token,s.endpoint,s.p256dh,s.auth,n.id,n.ends_at
  from claimed c join public.push_subscriptions s on s.id=c.subscription_id
    join public.pro_notifications n on n.id=c.notification_id;
end $$;
create function public.dayris_finish_pro_notification(p_id uuid,p_token uuid,p_result text,p_code text)
returns void language plpgsql security definer set search_path='' as $$
declare d public.pro_notification_deliveries;
begin
  select * into d from public.pro_notification_deliveries where id=p_id and lease_token=p_token and status='sending' for update;
  if not found then return; end if;
  if p_result='gone' then update public.push_subscriptions set active=false where id=d.subscription_id; end if;
  update public.pro_notification_deliveries set
    status=case when p_result='retry' and d.attempts<4 then 'pending'
      when p_result='accepted' then 'accepted' when p_result='uncertain' then 'uncertain' else 'failed' end,
    next_attempt_at=now()+interval '5 minutes',lease_token=null,lease_until=null,error_code=left(p_code,80)
  where id=d.id;
end $$;
revoke all on function public.dayris_claim_pro_notifications(),public.dayris_finish_pro_notification(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.dayris_claim_pro_notifications(),public.dayris_finish_pro_notification(uuid,uuid,text,text) to service_role;
commit;
