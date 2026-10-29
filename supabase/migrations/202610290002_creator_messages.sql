begin;
create table public.creator_campaigns (
 id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id) on delete set null,
 audience text not null check(audience in ('all','single')),title text not null check(length(trim(title)) between 1 and 80),
 body text not null check(length(trim(body)) between 1 and 4000),push_title text not null check(length(push_title)<=80),push_body text not null check(length(push_body)<=160),
 send_push boolean not null default false,pro_amount integer not null default 0,pro_unit text not null default 'days' check(pro_unit in ('days','years')),
 status text not null default 'draft' check(status in ('draft','sent')),recipient_count integer not null default 0,
 created_at timestamptz not null default now(),sent_at timestamptz,
 check(pro_amount>=0 and ((pro_unit='days' and pro_amount<=36525) or (pro_unit='years' and pro_amount<=100)))
);
create table public.creator_messages (
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.creator_campaigns(id),
 user_id uuid not null references auth.users(id) on delete cascade,pro_until timestamptz,read_at timestamptz,
 unique(campaign_id,user_id)
);
create index creator_messages_owner on public.creator_messages(user_id,campaign_id);
create table public.creator_message_deliveries (
 id uuid primary key default gen_random_uuid(),message_id uuid not null references public.creator_messages(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','accepted','failed','uncertain')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,error_code text,
 unique(message_id,subscription_id)
);
create index creator_deliveries_pending on public.creator_message_deliveries(next_attempt_at) where status='pending';
alter table public.creator_campaigns enable row level security;
alter table public.creator_messages enable row level security;
alter table public.creator_message_deliveries enable row level security;
revoke all on public.creator_campaigns,public.creator_messages,public.creator_message_deliveries from public,anon,authenticated;
grant all on public.creator_campaigns,public.creator_messages,public.creator_message_deliveries to service_role;
alter table public.pro_notifications add column creator_message_id uuid references public.creator_messages(id) on delete set null;

create function public.site_admin_campaign_info(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(c)||jsonb_build_object(
  'read_count',(select count(*) from public.creator_messages m where m.campaign_id=c.id and m.read_at is not null),
  'push_devices',(select count(*) from public.creator_messages m join public.push_subscriptions s on s.user_id=m.user_id and s.active where m.campaign_id=c.id),
  'push_users',(select count(distinct m.user_id) from public.creator_messages m join public.push_subscriptions s on s.user_id=m.user_id and s.active where m.campaign_id=c.id),
  'push_accepted',(select count(*) from public.creator_message_deliveries d join public.creator_messages m on m.id=d.message_id where m.campaign_id=c.id and d.status='accepted'),
  'push_pending',(select count(*) from public.creator_message_deliveries d join public.creator_messages m on m.id=d.message_id where m.campaign_id=c.id and d.status in ('pending','sending')),
  'push_failed',(select count(*) from public.creator_message_deliveries d join public.creator_messages m on m.id=d.message_id where m.campaign_id=c.id and d.status in ('failed','uncertain')),
  'sample_users',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (select u.id,u.email,coalesce(u.raw_user_meta_data->>'name',u.email,u.id::text) as name from public.creator_messages m join auth.users u on u.id=m.user_id where m.campaign_id=c.id order by u.id limit 5) r))
 from public.creator_campaigns c where c.id=p_id;
$$;
revoke all on function public.site_admin_campaign_info(uuid) from public,anon,authenticated;

create function public.admin_prepare_campaign(p_audience text,p_user_id uuid,p_title text,p_body text,p_send_push boolean,p_push_title text,p_push_body text,p_pro_amount integer,p_pro_unit text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare campaign_id uuid; recipients integer;
begin
 perform public.site_admin_require(true);
 if p_audience is null or p_audience not in ('all','single') or (p_audience='single' and p_user_id is null) or (p_audience='all' and p_user_id is not null)
  or p_title is null or length(trim(p_title)) not between 1 and 80 or p_body is null or length(trim(p_body)) not between 1 and 4000
  or p_send_push is null or p_push_title is null or length(p_push_title)>80 or p_push_body is null or length(p_push_body)>160
  or (p_send_push and (trim(p_push_title)='' or trim(p_push_body)=''))
  or p_pro_unit is null or p_pro_unit not in ('days','years') or p_pro_amount is null or p_pro_amount<0 or (p_pro_unit='days' and p_pro_amount>36525) or (p_pro_unit='years' and p_pro_amount>100)
 then raise exception 'Invalid campaign' using errcode='22023'; end if;
 if (select count(*) from public.creator_campaigns where actor_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Campaign preparation rate limit' using errcode='54000'; end if;
 select count(*) into recipients from auth.users where p_audience='all' or id=p_user_id;
 if recipients<1 or recipients>5000 then raise exception 'Campaign recipient limit (1-5000)' using errcode='22023'; end if;
 insert into public.creator_campaigns(actor_id,audience,title,body,send_push,push_title,push_body,pro_amount,pro_unit)
 values(auth.uid(),p_audience,trim(p_title),trim(p_body),p_send_push,trim(p_push_title),trim(p_push_body),p_pro_amount,p_pro_unit) returning id into campaign_id;
 insert into public.creator_messages(campaign_id,user_id) select campaign_id,id from auth.users where p_audience='all' or id=p_user_id;
 get diagnostics recipients=row_count;
 if recipients<1 or recipients>5000 then raise exception 'Campaign recipient limit (1-5000)' using errcode='22023'; end if;
 update public.creator_campaigns set recipient_count=recipients where id=campaign_id;
 insert into public.site_admin_audit(actor_id,action,dataset,record_key) values(auth.uid(),'campaign.prepare','creator_campaigns',campaign_id::text);
 return public.site_admin_campaign_info(campaign_id);
end $$;

create function public.admin_send_campaign(p_id uuid,p_expected_count integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.creator_campaigns%rowtype; m record; grant_state jsonb; until_date timestamptz; base_date timestamptz;
begin
 perform public.site_admin_require(true);
 select * into c from public.creator_campaigns where id=p_id for update;
 if not found then raise exception 'Campaign not found' using errcode='P0002'; end if;
 if c.actor_id is distinct from auth.uid() then raise exception 'Campaign owner required' using errcode='42501'; end if;
 if p_expected_count is distinct from c.recipient_count then raise exception 'Recipient count changed' using errcode='40001'; end if;
 if c.status='sent' then return public.site_admin_campaign_info(c.id); end if;
 if c.created_at<now()-interval '1 hour' then raise exception 'Campaign preview expired' using errcode='22023'; end if;
 if (select count(*) from public.creator_messages where campaign_id=c.id)<>c.recipient_count then raise exception 'Recipients changed; prepare again' using errcode='40001'; end if;
 if c.pro_amount>0 then
  lock table public.pro_entitlements in share row exclusive mode;
  lock table public.pro_subscriptions in share row exclusive mode;
 end if;
 for m in select id,user_id from public.creator_messages where campaign_id=c.id order by user_id loop
  if c.pro_amount>0 then
   select greatest(now(),max(ends_at)) into base_date from public.pro_entitlements where user_id=m.user_id;
   select greatest(base_date,max(coalesce(ends_at,trial_ends_at,renews_at))) into base_date from public.pro_subscriptions where user_id=m.user_id and provider='lemon_squeezy' and (status in ('active','on_trial') or (status='cancelled' and ends_at>now()));
   if isfinite(base_date) then
    grant_state:=public.admin_change_pro(m.user_id,'extend',c.pro_amount,c.pro_unit,public.site_admin_pro_snapshot(m.user_id),'Подарок PRO: рассылка '||c.id::text);
    select max(ends_at) into until_date from public.pro_entitlements where user_id=m.user_id;
   else until_date:='infinity'::timestamptz;
   end if;
   update public.creator_messages set pro_until=until_date where id=m.id;
   update public.pro_notifications set creator_message_id=m.id where user_id=m.user_id and source='admin' and starts_at=now() and ends_at=until_date;
  end if;
 end loop;
 update public.creator_campaigns set status='sent',sent_at=now() where id=c.id;
 if c.send_push then
  insert into public.creator_message_deliveries(message_id,subscription_id)
   select cm.id,s.id from public.creator_messages cm join public.push_subscriptions s on s.user_id=cm.user_id and s.active where cm.campaign_id=c.id on conflict do nothing;
 end if;
 insert into public.site_admin_audit(actor_id,action,dataset,record_key,after_data) values(auth.uid(),'campaign.send','creator_campaigns',c.id::text,jsonb_build_object('recipients',c.recipient_count,'pro_amount',c.pro_amount,'pro_unit',c.pro_unit,'push',c.send_push));
 return public.site_admin_campaign_info(c.id);
end $$;

create function public.admin_campaign_history(p_limit integer default 20,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.site_admin_require();
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 select jsonb_build_object('total',(select count(*) from public.creator_campaigns),'rows',coalesce((select jsonb_agg(public.site_admin_campaign_info(r.id)) from (select id from public.creator_campaigns order by created_at desc,id limit p_limit offset p_offset) r),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.creator_inbox(p_limit integer default 20,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 with own as (select m.id,c.title,c.body,m.pro_until,c.pro_amount,c.pro_unit,m.read_at,c.sent_at as created_at from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where m.user_id=auth.uid() and c.status='sent'),
 page as (select * from own order by created_at desc,id limit p_limit offset p_offset)
 select jsonb_build_object('total',(select count(*) from own),'unread_count',(select count(*) from own where read_at is null),'messages',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.creator_ack_message(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 update public.creator_messages m set read_at=coalesce(m.read_at,now()) where m.id=p_id and m.user_id=auth.uid() and exists(select 1 from public.creator_campaigns c where c.id=m.campaign_id and c.status='sent');
end $$;
create function public.creator_message(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',m.id,'title',c.title,'body',c.body,'pro_until',m.pro_until,'read_at',m.read_at,'created_at',c.sent_at)
 from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where m.id=p_id and m.user_id=auth.uid() and c.status='sent';
$$;
create function public.creator_latest_gift() returns jsonb
language sql stable security definer set search_path='' as $$
 select public.creator_message(m.id) from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where m.user_id=auth.uid() and c.status='sent' and m.pro_until is not null order by c.sent_at desc,m.id limit 1;
$$;
revoke all on function public.creator_message(uuid),public.creator_latest_gift() from public,anon;
grant execute on function public.creator_message(uuid),public.creator_latest_gift() to authenticated;
revoke all on function public.admin_prepare_campaign(text,uuid,text,text,boolean,text,text,integer,text),public.admin_send_campaign(uuid,integer),public.admin_campaign_history(integer,integer),public.creator_inbox(integer,integer),public.creator_ack_message(uuid) from public,anon;
grant execute on function public.admin_prepare_campaign(text,uuid,text,text,boolean,text,text,integer,text),public.admin_send_campaign(uuid,integer),public.admin_campaign_history(integer,integer),public.creator_inbox(integer,integer),public.creator_ack_message(uuid) to authenticated;

create function public.dayris_claim_creator_messages()
returns table(delivery_id uuid,token uuid,endpoint text,p256dh text,auth text,message_id uuid,push_title text,push_body text)
language plpgsql security definer set search_path='' as $$
begin
 update public.creator_message_deliveries set status='uncertain',error_code='WORKER_INTERRUPTED' where status='sending' and lease_until<now();
 insert into public.creator_message_deliveries(message_id,subscription_id)
 select m.id,s.id from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id join public.push_subscriptions s on s.user_id=m.user_id and s.active where c.status='sent' and c.send_push and c.sent_at>now()-interval '1 day' and m.read_at is null on conflict do nothing;
 update public.creator_message_deliveries d set status='failed',error_code='READ_OR_DISABLED_OR_EXPIRED' from public.creator_messages m,public.creator_campaigns c,public.push_subscriptions s
 where d.message_id=m.id and c.id=m.campaign_id and s.id=d.subscription_id and d.status='pending' and (m.read_at is not null or not s.active or c.sent_at<=now()-interval '1 day');
 return query with picked as (select d.id from public.creator_message_deliveries d where d.status='pending' and d.next_attempt_at<=now() and d.attempts<4 order by d.next_attempt_at,d.id limit 10 for update skip locked),
 claimed as (update public.creator_message_deliveries d set status='sending',attempts=d.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes' from picked p where d.id=p.id returning d.*)
 select d.id,d.lease_token,s.endpoint,s.p256dh,s.auth,m.id,c.push_title,c.push_body from claimed d join public.push_subscriptions s on s.id=d.subscription_id join public.creator_messages m on m.id=d.message_id join public.creator_campaigns c on c.id=m.campaign_id;
end $$;
create function public.dayris_finish_creator_message(p_id uuid,p_token uuid,p_result text,p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare d public.creator_message_deliveries%rowtype;
begin
 select * into d from public.creator_message_deliveries where id=p_id and lease_token=p_token and status='sending' for update;
 if not found then return; end if;
 if p_result='gone' then update public.push_subscriptions set active=false where id=d.subscription_id; end if;
 update public.creator_message_deliveries set status=case when p_result='retry' and d.attempts<4 then 'pending' when p_result='accepted' then 'accepted' when p_result='uncertain' then 'uncertain' else 'failed' end,
 next_attempt_at=now()+interval '5 minutes',lease_token=null,lease_until=null,error_code=left(p_code,80) where id=d.id;
end $$;
revoke all on function public.dayris_claim_creator_messages(),public.dayris_finish_creator_message(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.dayris_claim_creator_messages(),public.dayris_finish_creator_message(uuid,uuid,text,text) to service_role;
create or replace function public.dayris_get_pro_notifications()
returns table(id uuid,ends_at timestamptz)
language sql security definer set search_path='' as $$
  select n.id,n.ends_at from public.pro_notifications n
  where n.creator_message_id is null and n.user_id=auth.uid() and n.seen_at is null and n.starts_at<=now() and n.ends_at>now()
    and exists(select 1 from public.pro_entitlements e where e.user_id=n.user_id
      and coalesce(e.source::text,'unknown')=n.source and e.starts_at=n.starts_at and e.ends_at=n.ends_at)
  order by n.created_at desc limit 100;
$$;

create or replace function public.dayris_claim_pro_notifications()
returns table(delivery_id uuid,token uuid,endpoint text,p256dh text,auth text,notification_id uuid,ends_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  update public.pro_notification_deliveries set status='uncertain',error_code='WORKER_INTERRUPTED'
  where status='sending' and lease_until<now();
  -- Enqueue each registered device once, including devices registered shortly after the grant.
  insert into public.pro_notification_deliveries(notification_id,subscription_id)
  select n.id,s.id from public.pro_notifications n join public.push_subscriptions s on s.user_id=n.user_id and s.active
  where n.creator_message_id is null and n.starts_at<=now() and n.ends_at>now() and greatest(n.created_at,n.starts_at)>now()-interval '1 day'
    and n.seen_at is null
    and exists(select 1 from public.pro_entitlements e where e.user_id=n.user_id
      and coalesce(e.source::text,'unknown')=n.source and e.starts_at=n.starts_at and e.ends_at=n.ends_at)
  on conflict do nothing;
  update public.pro_notification_deliveries d set status='failed',error_code='EXPIRED_OR_DISABLED'
  from public.pro_notifications n,public.push_subscriptions s
  where d.notification_id=n.id and d.subscription_id=s.id and d.status='pending'
    and (n.creator_message_id is not null or not s.active or n.seen_at is not null or n.ends_at<=now()
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

notify pgrst,'reload schema';
commit;
