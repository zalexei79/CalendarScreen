begin;
create table public.dayris_account_events(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('verified','verification_removed','pro')),
 source_key text not null,payload jsonb not null default '{}',created_at timestamptz not null default now(),
 read_at timestamptz,announced_at timestamptz,unique(user_id,source_key)
);
create index dayris_account_events_owner on public.dayris_account_events(user_id,created_at desc);
create table public.dayris_notification_hidden(user_id uuid not null references auth.users(id) on delete cascade,entry_key text not null,primary key(user_id,entry_key));
alter table public.dayris_account_events enable row level security;
alter table public.dayris_notification_hidden enable row level security;
revoke all on public.dayris_account_events,public.dayris_notification_hidden from public,anon,authenticated;
grant all on public.dayris_account_events,public.dayris_notification_hidden to service_role;

create function public.dayris_verification_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.dayris_account_events(user_id,kind,source_key,payload,created_at)
  values(new.user_id,'verified','verified:'||new.verified_at::text,jsonb_build_object('verified_at',new.verified_at),new.verified_at) on conflict do nothing;
  return new;
 else
  insert into public.dayris_account_events(user_id,kind,source_key) select old.user_id,'verification_removed','removed:'||old.verified_at::text where exists(select 1 from auth.users where id=old.user_id) on conflict do nothing;
  return old;
 end if;
end $$;
revoke all on function public.dayris_verification_event() from public,anon,authenticated;
create trigger dayris_verification_notification after insert or delete on public.social_verifications for each row execute function public.dayris_verification_event();
insert into public.dayris_account_events(user_id,kind,source_key,payload,created_at)
 select user_id,'verified','verified:'||verified_at::text,jsonb_build_object('verified_at',verified_at),verified_at from public.social_verifications on conflict do nothing;

-- Paid subscriptions already have their own billing lifecycle. Observe it without changing access.
create function public.dayris_subscription_event(p_row jsonb) returns void language plpgsql security definer set search_path='' as $$
declare expiry text:=coalesce(p_row->>'ends_at',p_row->>'trial_ends_at',p_row->>'renews_at','');
begin
 if p_row->>'status' not in ('active','on_trial') or p_row->>'user_id' is null then return;end if;
 insert into public.dayris_account_events(user_id,kind,source_key,payload)
 values((p_row->>'user_id')::uuid,'pro','subscription:'||coalesce(p_row->>'id',md5(p_row->>'user_id'||coalesce(p_row->>'provider','')))||':'||expiry,jsonb_build_object('ends_at',nullif(expiry,''))) on conflict do nothing;
end $$;
create function public.dayris_subscription_event_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.dayris_subscription_event(to_jsonb(new));return new;end $$;
revoke all on function public.dayris_subscription_event(jsonb),public.dayris_subscription_event_trigger() from public,anon,authenticated;
do $$declare item jsonb;begin
 if to_regclass('public.pro_subscriptions') is not null then
  execute 'create trigger dayris_subscription_notification after insert or update on public.pro_subscriptions for each row execute function public.dayris_subscription_event_trigger()';
  for item in execute 'select to_jsonb(s) from public.pro_subscriptions s' loop perform public.dayris_subscription_event(item);end loop;
 end if;
end $$;

create view public.dayris_notification_entries as
 select 'creator:'||m.id::text as entry_key,m.id,m.user_id,
 case when m.pro_until is not null then 'gift' when c.kind='chat' then 'chat' else 'message' end as kind,
 c.title,c.body,jsonb_build_object('ends_at',m.pro_until) as payload,c.sent_at as created_at,m.read_at
 from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where c.status='sent'
 union all
 select 'pro:'||p.id::text,p.id,p.user_id,'pro','','',jsonb_build_object('ends_at',p.ends_at),p.created_at,p.seen_at
 from public.pro_notifications p where p.creator_message_id is null and p.starts_at<=now()
 union all
 select 'event:'||e.id::text,e.id,e.user_id,e.kind,'','',e.payload,e.created_at,e.read_at from public.dayris_account_events e;
revoke all on public.dayris_notification_entries from public,anon,authenticated;

create function public.dayris_notification_feed(p_owner uuid,p_unread boolean default false,p_limit integer default 20,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Account changed' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset not between 0 and 100000 or p_unread is null then raise exception 'Invalid notification page' using errcode='22023';end if;
 with own as (select n.* from public.dayris_notification_entries n where n.user_id=auth.uid() and not exists(select 1 from public.dayris_notification_hidden h where h.user_id=auth.uid() and h.entry_key=n.entry_key)),
 filtered as (select * from own where not p_unread or read_at is null),
 page as (select * from filtered order by created_at desc,entry_key desc limit p_limit offset p_offset)
 select jsonb_build_object('owner_id',auth.uid(),'unread_count',(select count(*) from own where read_at is null),'total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,entry_key desc) from page),'[]'::jsonb),
 'celebration',(select to_jsonb(n) from own n join public.dayris_account_events e on e.id=n.id join public.social_verifications v on v.user_id=e.user_id and v.verified_at=e.created_at where n.kind='verified' and e.announced_at is null and e.read_at is null order by e.created_at desc limit 1)) into result;
 return result;
end $$;

create function public.dayris_notification_action(p_owner uuid,p_key text,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare item record;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Account changed' using errcode='42501';end if;
 if p_action is null or p_action not in ('read','read_all','delete','presented') or (p_action<>'read_all' and (p_key is null or length(p_key)>100)) then raise exception 'Invalid notification action' using errcode='22023';end if;
 perform id from auth.users where id=auth.uid() for update;
 for item in select n.* from public.dayris_notification_entries n where n.user_id=auth.uid() and (p_action='read_all' and n.read_at is null or n.entry_key=p_key) and not exists(select 1 from public.dayris_notification_hidden h where h.user_id=auth.uid() and h.entry_key=n.entry_key) loop
  if p_action='presented' then
   update public.dayris_account_events set announced_at=coalesce(announced_at,now()) where id=item.id and user_id=auth.uid();
  else
   if item.entry_key like 'creator:%' then
    update public.creator_messages set read_at=coalesce(read_at,now()) where id=item.id and user_id=auth.uid();
    update public.pro_notifications set seen_at=coalesce(seen_at,now()) where creator_message_id=item.id and user_id=auth.uid();
   elsif item.entry_key like 'pro:%' then update public.pro_notifications set seen_at=coalesce(seen_at,now()) where id=item.id and user_id=auth.uid();
   else update public.dayris_account_events set read_at=coalesce(read_at,now()),announced_at=coalesce(announced_at,now()) where id=item.id and user_id=auth.uid();end if;
   if p_action='delete' then insert into public.dayris_notification_hidden(user_id,entry_key) values(auth.uid(),item.entry_key) on conflict do nothing;end if;
  end if;
 end loop;
end $$;
revoke all on function public.dayris_notification_feed(uuid,boolean,integer,integer),public.dayris_notification_action(uuid,text,text) from public,anon;
grant execute on function public.dayris_notification_feed(uuid,boolean,integer,integer),public.dayris_notification_action(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
