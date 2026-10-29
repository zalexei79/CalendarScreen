begin;
create table public.friend_chat_deliveries(
 id uuid primary key default gen_random_uuid(),message_id uuid not null references public.friend_chat_messages(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,status text not null default 'pending' check(status in ('pending','sending','accepted','failed','uncertain')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,error_code text,unique(message_id,subscription_id)
);
create index friend_chat_deliveries_pending on public.friend_chat_deliveries(next_attempt_at) where status='pending';
alter table public.friend_chat_deliveries enable row level security;
revoke all on public.friend_chat_deliveries from public,anon,authenticated;
grant all on public.friend_chat_deliveries to service_role;
create function public.friend_chat_queue_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.friend_chat_deliveries(message_id,subscription_id) select new.id,s.id from public.push_subscriptions s where s.user_id=new.recipient_id and s.active on conflict do nothing;
 return new;
end $$;
revoke all on function public.friend_chat_queue_push() from public,anon,authenticated;
create trigger friend_chat_push after insert on public.friend_chat_messages for each row execute function public.friend_chat_queue_push();
create function public.dayris_claim_friend_messages()
returns table(delivery_id uuid,token uuid,endpoint text,p256dh text,auth text,message_id uuid,sender_id uuid,push_title text,push_body text)
language plpgsql security definer set search_path='' as $$
begin
 update public.friend_chat_deliveries set status='uncertain',error_code='WORKER_INTERRUPTED' where status='sending' and lease_until<now();
 insert into public.friend_chat_deliveries(message_id,subscription_id)
 select m.id,s.id from public.friend_chat_messages m join public.push_subscriptions s on s.user_id=m.recipient_id and s.active where m.created_at>now()-interval '1 day' and m.read_at is null
 and exists(select 1 from public.social_relationships r where r.user_low=m.user_low and r.user_high=m.user_high and r.state='accepted')
 and not exists(select 1 from public.social_blocks b where (b.blocker_id=m.sender_id and b.blocked_id=m.recipient_id) or (b.blocker_id=m.recipient_id and b.blocked_id=m.sender_id)) on conflict do nothing;
 update public.friend_chat_deliveries d set status='failed',error_code='READ_DISABLED_EXPIRED_OR_NOT_FRIENDS' from public.friend_chat_messages m,public.push_subscriptions s
 where d.message_id=m.id and d.subscription_id=s.id and d.status='pending' and (m.read_at is not null or not s.active or m.created_at<=now()-interval '1 day'
 or not exists(select 1 from public.social_relationships r where r.user_low=m.user_low and r.user_high=m.user_high and r.state='accepted')
 or exists(select 1 from public.social_blocks b where (b.blocker_id=m.sender_id and b.blocked_id=m.recipient_id) or (b.blocker_id=m.recipient_id and b.blocked_id=m.sender_id)));
 return query with picked as (select d.id from public.friend_chat_deliveries d where d.status='pending' and d.next_attempt_at<=now() and d.attempts<4 order by d.next_attempt_at,d.id limit 10 for update skip locked),
 claimed as (update public.friend_chat_deliveries d set status='sending',attempts=d.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes' from picked p where d.id=p.id returning d.*)
 select d.id,d.lease_token,s.endpoint,s.p256dh,s.auth,m.id,m.sender_id,coalesce(p.display_name,'DAYRIS'),left(m.body,160) from claimed d join public.push_subscriptions s on s.id=d.subscription_id join public.friend_chat_messages m on m.id=d.message_id left join public.social_profiles p on p.user_id=m.sender_id;
end $$;
create function public.dayris_finish_friend_message(p_id uuid,p_token uuid,p_result text,p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare delivery public.friend_chat_deliveries%rowtype;
begin
 select * into delivery from public.friend_chat_deliveries where id=p_id and lease_token=p_token and status='sending' for update;
 if not found then return; end if;
 if p_result='gone' then update public.push_subscriptions set active=false where id=delivery.subscription_id; end if;
 update public.friend_chat_deliveries set status=case when p_result='retry' and delivery.attempts<4 then 'pending' when p_result='accepted' then 'accepted' when p_result='uncertain' then 'uncertain' else 'failed' end,next_attempt_at=now()+interval '5 minutes',lease_token=null,lease_until=null,error_code=left(p_code,80) where id=delivery.id;
end $$;
revoke all on function public.dayris_claim_friend_messages(),public.dayris_finish_friend_message(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.dayris_claim_friend_messages(),public.dayris_finish_friend_message(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
