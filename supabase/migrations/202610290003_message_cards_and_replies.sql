begin;
alter table public.creator_campaigns add column card jsonb not null default '{}'::jsonb check(jsonb_typeof(card)='object');

create function public.admin_prepare_card_campaign(p_audience text,p_user_id uuid,p_title text,p_body text,p_send_push boolean,p_push_title text,p_push_body text,p_pro_amount integer,p_pro_unit text,p_card jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item record; prepared jsonb; campaign_id uuid;
begin
 perform public.site_admin_require(true);
 if p_card is null or jsonb_typeof(p_card)<>'object' or octet_length(p_card::text)>8000 then raise exception 'Invalid message card' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_card) loop
  if item.key in ('sender','button','giftButton','replyButton','footer','giftLine','foreverLine','closeLabel','historyLabel','replyTitle','replyPlaceholder','sendReplyLabel','replySentLabel','replyErrorLabel','backLabel','savingLabel') then
   if jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>200 then raise exception 'Invalid card text' using errcode='22023'; end if;
   if item.key in ('button','giftButton','replyButton','closeLabel','sendReplyLabel','backLabel','historyLabel','replyTitle','replySentLabel','replyErrorLabel','savingLabel') and length(trim(item.value#>>'{}'))=0 then raise exception 'Empty card action' using errcode='22023'; end if;
   if item.key in ('button','giftButton','replyButton','closeLabel','sendReplyLabel','backLabel') and length(item.value#>>'{}')>60 then raise exception 'Card action too long' using errcode='22023'; end if;
  elsif item.key in ('allowReply','showExpiry') then
   if jsonb_typeof(item.value)<>'boolean' then raise exception 'Invalid card flag' using errcode='22023'; end if;
  elsif item.key='icon' then
   if jsonb_typeof(item.value)<>'string' or item.value#>>'{}' not in ('auto','gift','mail','none') then raise exception 'Invalid card icon' using errcode='22023'; end if;
  elsif item.key='theme' then
   if jsonb_typeof(item.value)<>'string' or item.value#>>'{}' not in ('auto','dark','light') then raise exception 'Invalid card theme' using errcode='22023'; end if;
  elsif item.key='accent' then
   if jsonb_typeof(item.value)<>'string' or item.value#>>'{}' not in ('neutral','gold','blue') then raise exception 'Invalid card accent' using errcode='22023'; end if;
  elsif item.key='version' then
   if item.value<>'1'::jsonb then raise exception 'Invalid card version' using errcode='22023'; end if;
  else raise exception 'Unknown card field' using errcode='22023'; end if;
 end loop;
 prepared:=public.admin_prepare_campaign(p_audience,p_user_id,p_title,p_body,p_send_push,p_push_title,p_push_body,p_pro_amount,p_pro_unit);
 campaign_id:=(prepared->>'id')::uuid;
 update public.creator_campaigns set card=p_card where id=campaign_id and status='draft';
 return public.site_admin_campaign_info(campaign_id);
end $$;
revoke all on function public.admin_prepare_card_campaign(text,uuid,text,text,boolean,text,text,integer,text,jsonb) from public,anon;
grant execute on function public.admin_prepare_card_campaign(text,uuid,text,text,boolean,text,text,integer,text,jsonb) to authenticated;

create or replace function public.creator_inbox(p_limit integer default 20,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 with own as (select m.id,c.title,c.body,c.card,m.pro_until,c.pro_amount,c.pro_unit,m.read_at,c.sent_at as created_at from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where m.user_id=auth.uid() and c.status='sent'),
 page as (select * from own order by created_at desc,id limit p_limit offset p_offset)
 select jsonb_build_object('total',(select count(*) from own),'unread_count',(select count(*) from own where read_at is null),'messages',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function public.creator_message(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',m.id,'title',c.title,'body',c.body,'card',c.card,'pro_until',m.pro_until,'read_at',m.read_at,'created_at',c.sent_at)
 from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where m.id=p_id and m.user_id=auth.uid() and c.status='sent';
$$;

create table public.creator_replies (
 id uuid primary key,message_id uuid not null references public.creator_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),read_at timestamptz
);
create index creator_replies_inbox on public.creator_replies(created_at desc,id);
create index creator_replies_owner on public.creator_replies(user_id,created_at desc);
create index creator_replies_message on public.creator_replies(message_id,created_at);
alter table public.creator_replies enable row level security;
revoke all on public.creator_replies from public,anon,authenticated;
grant all on public.creator_replies to service_role;

create function public.creator_reply(p_id uuid,p_body text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.creator_replies%rowtype; result public.creator_replies%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_request_id is null or p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'Invalid reply' using errcode='22023'; end if;
 perform 1 from auth.users where id=auth.uid() for update;
 select * into existing from public.creator_replies where id=p_request_id;
 if found then
  if existing.user_id is distinct from auth.uid() or existing.message_id is distinct from p_id or existing.body is distinct from trim(p_body) then raise exception 'Reply request changed' using errcode='40001'; end if;
  return jsonb_build_object('id',existing.id,'body',existing.body,'created_at',existing.created_at);
 end if;
 if not exists(select 1 from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where m.id=p_id and m.user_id=auth.uid() and c.status='sent' and coalesce((c.card->>'allowReply')::boolean,true)) then raise exception 'Message unavailable for reply' using errcode='42501'; end if;
 if (select count(*) from public.creator_replies where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Reply rate limit' using errcode='54000'; end if;
 insert into public.creator_replies(id,message_id,user_id,body) values(p_request_id,p_id,auth.uid(),trim(p_body)) returning * into result;
 perform public.creator_ack_message(p_id);
 return jsonb_build_object('id',result.id,'body',result.body,'created_at',result.created_at);
end $$;
create function public.creator_own_replies(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r)) from (select id,body,created_at from public.creator_replies where message_id=p_id and user_id=auth.uid() order by created_at desc,id limit 50) r),'[]'::jsonb);
end $$;
create function public.admin_reply_inbox(p_unread boolean default false,p_limit integer default 20,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.site_admin_require();
 if p_unread is null or p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 with matching as (select r.id,r.message_id,r.user_id,r.body,r.created_at,r.read_at,u.email,coalesce(u.raw_user_meta_data->>'name',u.raw_user_meta_data->>'nickname',u.email,u.id::text) as name,c.title as message_title,c.body as message_body
 from public.creator_replies r join auth.users u on u.id=r.user_id join public.creator_messages m on m.id=r.message_id join public.creator_campaigns c on c.id=m.campaign_id where not p_unread or r.read_at is null),
 page as (select * from matching order by created_at desc,id limit p_limit offset p_offset)
 select jsonb_build_object('total',(select count(*) from matching),'unread_count',(select count(*) from public.creator_replies where read_at is null),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.admin_reply_unread() returns bigint
language plpgsql security definer set search_path='' as $$
begin
 perform public.site_admin_require();
 return (select count(*) from public.creator_replies where read_at is null);
end $$;
create function public.admin_ack_reply(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.site_admin_require(true);
 update public.creator_replies set read_at=coalesce(read_at,now()) where id=p_id;
 if not found then raise exception 'Reply not found' using errcode='P0002'; end if;
 insert into public.site_admin_audit(actor_id,action,dataset,record_key) values(auth.uid(),'reply.read','creator_replies',p_id::text);
end $$;
revoke all on function public.creator_reply(uuid,text,uuid),public.creator_own_replies(uuid),public.admin_reply_inbox(boolean,integer,integer),public.admin_reply_unread(),public.admin_ack_reply(uuid) from public,anon;
grant execute on function public.creator_reply(uuid,text,uuid),public.creator_own_replies(uuid),public.admin_reply_inbox(boolean,integer,integer),public.admin_reply_unread(),public.admin_ack_reply(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
