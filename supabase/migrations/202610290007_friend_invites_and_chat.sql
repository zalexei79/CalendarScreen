begin;
create table public.social_invite_tokens(user_id uuid primary key references auth.users(id) on delete cascade,token uuid not null unique default gen_random_uuid());
create table public.friend_chat_messages(
 id uuid primary key,sender_id uuid not null references auth.users(id) on delete cascade,recipient_id uuid not null references auth.users(id) on delete cascade,
 user_low uuid generated always as (least(sender_id,recipient_id)) stored,user_high uuid generated always as (greatest(sender_id,recipient_id)) stored,
 body text not null check(length(trim(body)) between 1 and 2000),created_at timestamptz not null default now(),read_at timestamptz,check(sender_id<>recipient_id)
);
create index friend_chat_pair on public.friend_chat_messages(user_low,user_high,created_at desc,id desc);
create index friend_chat_unread on public.friend_chat_messages(recipient_id,sender_id) where read_at is null;
create index friend_chat_rate on public.friend_chat_messages(sender_id,created_at);
alter table public.social_invite_tokens enable row level security;
alter table public.friend_chat_messages enable row level security;
revoke all on public.social_invite_tokens,public.friend_chat_messages from public,anon,authenticated;
grant all on public.social_invite_tokens,public.friend_chat_messages to service_role;

create function public.friend_chat_allowed(p_peer uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and p_peer<>auth.uid()
  and exists(select 1 from public.social_relationships where user_low=least(auth.uid(),p_peer) and user_high=greatest(auth.uid(),p_peer) and state='accepted')
  and not exists(select 1 from public.social_blocks where (blocker_id=auth.uid() and blocked_id=p_peer) or (blocker_id=p_peer and blocked_id=auth.uid()));
$$;
revoke all on function public.friend_chat_allowed(uuid) from public,anon,authenticated;
create function public.social_friend_invite(p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invite_token uuid; referral text;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Invite owner changed' using errcode='42501'; end if;
 perform id from auth.users where id=auth.uid() for update;
 perform public.social_own_profile();
 select referral_code into referral from public.referral_profiles where user_id=auth.uid();
 if referral is null then raise exception 'Referral profile missing' using errcode='P0002'; end if;
 insert into public.social_invite_tokens(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select token into invite_token from public.social_invite_tokens where user_id=auth.uid();
 return public.social_profile(auth.uid())||jsonb_build_object('owner_id',auth.uid(),'token',invite_token,'referral_code',referral);
end $$;
create function public.social_invite_lookup(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid; result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select user_id into target from public.social_invite_tokens where token=p_token;
 if target is null or exists(select 1 from public.social_blocks where (blocker_id=auth.uid() and blocked_id=target) or (blocker_id=target and blocked_id=auth.uid())) then raise exception 'Invite unavailable' using errcode='P0002'; end if;
 select jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,'handle',p.handle,'avatar_path',p.avatar_path,'viewer_id',auth.uid(),'self',target=auth.uid(),'referral_code',(select referral_code from public.referral_profiles where user_id=target),
 'relationship',(select state from public.social_relationships where user_low=least(target,auth.uid()) and user_high=greatest(target,auth.uid())),
 'requested_by',(select requested_by from public.social_relationships where user_low=least(target,auth.uid()) and user_high=greatest(target,auth.uid()))) into result from public.social_profiles p where p.user_id=target;
 return result;
end $$;
create function public.social_invite_claim(p_token uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; referral text; existing public.referrals%rowtype; claimed jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Invite owner changed' using errcode='42501'; end if;
 select user_id into target from public.social_invite_tokens where token=p_token;
 if target is null then raise exception 'Invite unavailable' using errcode='P0002'; end if;
 if target=auth.uid() then return jsonb_build_object('eligible',false,'reason','self'); end if;
 perform id from auth.users where id in (auth.uid(),target) order by id for update;
 perform public.social_invite_lookup(p_token);
 select * into existing from public.referrals where referred_id=auth.uid();
 if existing.id is not null then return jsonb_build_object('eligible',existing.referrer_id=target,'status',existing.status,'reason',case when existing.referrer_id<>target then 'already_claimed' else null end); end if;
 select referral_code into referral from public.referral_profiles where user_id=target;
 begin
  claimed:=public.claim_referral(referral);
 exception when others then
  if sqlerrm like '%REFERRAL_TOO_LATE%' then return jsonb_build_object('eligible',false,'reason','too_late');
  elsif sqlerrm like '%SELF_REFERRAL_NOT_ALLOWED%' then return jsonb_build_object('eligible',false,'reason','self');
  else raise; end if;
 end;
 return jsonb_build_object('eligible',true,'status',claimed->>'status');
end $$;
create function public.social_invite_request(p_token uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; rel public.social_relationships%rowtype; reward jsonb; actor uuid:=auth.uid();
begin
 if actor is null or actor is distinct from p_owner then raise exception 'Invite owner changed' using errcode='42501'; end if;
 select user_id into target from public.social_invite_tokens where token=p_token;
 if target is null or target=actor then raise exception 'Invite unavailable' using errcode='22023'; end if;
 perform id from auth.users where id in (actor,target) order by id for update;
 perform public.social_invite_lookup(p_token);
 reward:=public.social_invite_claim(p_token,p_owner);
 select * into rel from public.social_relationships where user_low=least(actor,target) and user_high=greatest(actor,target) for update;
 if rel.state='accepted' or (rel.state='pending' and rel.requested_by=actor) then return jsonb_build_object('state',rel.state,'referral',reward); end if;
 if rel.state='pending' then raise exception 'Incoming request requires acceptance' using errcode='22023'; end if;
 if rel.state='declined' and rel.requested_by=actor and rel.responded_at>now()-interval '1 day' then raise exception 'Friend request cooldown' using errcode='54000'; end if;
 if (select count(*) from public.social_request_events where requester_id=actor and created_at>now()-interval '1 day')>=20 then raise exception 'Friend request rate limit' using errcode='54000'; end if;
 perform public.social_own_profile();
 insert into public.social_relationships(user_low,user_high,requested_by,state) values(least(actor,target),greatest(actor,target),actor,'pending') on conflict(user_low,user_high) do update set requested_by=actor,state='pending',requested_at=now(),responded_at=null;
 insert into public.social_request_events(requester_id,target_id) values(actor,target);
 return jsonb_build_object('state','pending','referral',reward);
end $$;
create function public.friend_chat_peer(p_peer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.friend_chat_allowed(p_peer) then raise exception 'Friend chat unavailable' using errcode='42501'; end if;
 return public.social_profile(p_peer);
end $$;
create function public.friend_chat_thread(p_peer uuid,p_before_at timestamptz default null,p_before_key text default null,p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.friend_chat_allowed(p_peer) then raise exception 'Friend chat unavailable' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 100 or ((p_before_at is null)<>(p_before_key is null)) or length(p_before_key)>40 then raise exception 'Invalid chat cursor' using errcode='22023'; end if;
 with matching as (select 'f:'||m.id::text as entry_key,m.id,m.sender_id,case when m.sender_id=auth.uid() then 'self' else 'peer' end as direction,'chat'::text as kind,m.body,m.created_at,m.read_at
 from public.friend_chat_messages m where m.user_low=least(auth.uid(),p_peer) and m.user_high=greatest(auth.uid(),p_peer) and (p_before_at is null or (m.created_at,'f:'||m.id::text)<(p_before_at,p_before_key)) order by m.created_at desc,m.id desc limit p_limit+1),
 page as (select * from matching order by created_at desc,entry_key desc limit p_limit)
 select jsonb_build_object('owner_id',auth.uid(),'rows',coalesce((select jsonb_agg(to_jsonb(page) order by created_at,entry_key) from page),'[]'::jsonb),'has_more',(select count(*)>p_limit from matching)) into result;
 return result;
end $$;
create function public.friend_chat_send(p_peer uuid,p_body text,p_request_id uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.friend_chat_messages%rowtype;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Chat owner changed' using errcode='42501'; end if;
 if p_request_id is null or p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'Invalid chat message' using errcode='22023'; end if;
 perform id from auth.users where id in (auth.uid(),p_peer) order by id for update;
 if not public.friend_chat_allowed(p_peer) then raise exception 'Friend chat unavailable' using errcode='42501'; end if;
 perform id from public.social_relationships where user_low=least(auth.uid(),p_peer) and user_high=greatest(auth.uid(),p_peer) and state='accepted' for share;
 select * into existing from public.friend_chat_messages where id=p_request_id;
 if found then
  if existing.sender_id is distinct from auth.uid() or existing.recipient_id is distinct from p_peer or existing.body is distinct from trim(p_body) then raise exception 'Chat request changed' using errcode='40001'; end if;
  return jsonb_build_object('id',existing.id);
 end if;
 if (select count(*) from public.friend_chat_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Chat rate limit' using errcode='54000'; end if;
 insert into public.friend_chat_messages(id,sender_id,recipient_id,body) values(p_request_id,auth.uid(),p_peer,trim(p_body));
 return jsonb_build_object('id',p_request_id);
end $$;
create function public.friend_chat_read(p_peer uuid,p_ids uuid[],p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Chat owner changed' using errcode='42501'; end if;
 if p_ids is null or cardinality(p_ids)>100 then raise exception 'Invalid message batch' using errcode='22023'; end if;
 perform id from auth.users where id in (auth.uid(),p_peer) order by id for update;
 if not public.friend_chat_allowed(p_peer) then raise exception 'Friend chat unavailable' using errcode='42501'; end if;
 update public.friend_chat_messages set read_at=coalesce(read_at,now()) where sender_id=p_peer and recipient_id=auth.uid() and id=any(p_ids);
end $$;
create or replace function public.social_friends() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 with related as (
 select r.id as relationship_id,r.requested_by,r.state,r.requested_at,p.user_id,p.display_name,p.handle,p.avatar_path,
 (select count(*) from public.friend_chat_messages m where r.state='accepted' and m.sender_id=p.user_id and m.recipient_id=auth.uid() and m.read_at is null) as unread_count,
 (select m.body from public.friend_chat_messages m where r.state='accepted' and m.user_low=least(auth.uid(),p.user_id) and m.user_high=greatest(auth.uid(),p.user_id) order by m.created_at desc,m.id desc limit 1) as last_message,
 (select max(m.created_at) from public.friend_chat_messages m where r.state='accepted' and m.user_low=least(auth.uid(),p.user_id) and m.user_high=greatest(auth.uid(),p.user_id)) as last_at
 from public.social_relationships r join public.social_profiles p on p.user_id=case when r.user_low=auth.uid() then r.user_high else r.user_low end
 where auth.uid() in (r.user_low,r.user_high) and r.state in ('pending','accepted') and public.social_can_view(p.user_id))
 select jsonb_build_object('owner_id',auth.uid(),
 'friends',coalesce((select jsonb_agg(to_jsonb(r) order by r.last_at desc nulls last,r.display_name,r.user_id) from related r where state='accepted'),'[]'::jsonb),
 'incoming',coalesce((select jsonb_agg(to_jsonb(r) order by requested_at desc) from related r where state='pending' and requested_by<>auth.uid()),'[]'::jsonb),
 'outgoing',coalesce((select jsonb_agg(to_jsonb(r) order by requested_at desc) from related r where state='pending' and requested_by=auth.uid()),'[]'::jsonb),
 'blocked',coalesce((select jsonb_agg(jsonb_build_object('user_id',b.blocked_id,'display_name',coalesce(p.display_name,'DAYRIS'),'handle',p.handle)) from public.social_blocks b left join public.social_profiles p on p.user_id=b.blocked_id where b.blocker_id=auth.uid()),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function public.social_friend_count() returns bigint
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 return (select count(*) from public.social_relationships where auth.uid() in (user_low,user_high) and state='pending' and requested_by<>auth.uid())
 +(select count(*) from public.friend_chat_messages where recipient_id=auth.uid() and read_at is null and public.friend_chat_allowed(sender_id));
end $$;
revoke all on function public.social_friend_invite(uuid),public.social_invite_lookup(uuid),public.social_invite_claim(uuid,uuid),public.social_invite_request(uuid,uuid),public.friend_chat_peer(uuid),public.friend_chat_thread(uuid,timestamptz,text,integer),public.friend_chat_send(uuid,text,uuid,uuid),public.friend_chat_read(uuid,uuid[],uuid) from public,anon;
grant execute on function public.social_friend_invite(uuid),public.social_invite_lookup(uuid),public.social_invite_claim(uuid,uuid),public.social_invite_request(uuid,uuid),public.friend_chat_peer(uuid),public.friend_chat_thread(uuid,timestamptz,text,integer),public.friend_chat_send(uuid,text,uuid,uuid),public.friend_chat_read(uuid,uuid[],uuid) to authenticated;
notify pgrst,'reload schema';
commit;
