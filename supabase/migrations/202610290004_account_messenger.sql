begin;
alter table public.creator_campaigns add column kind text not null default 'notice' check(kind in ('notice','chat'));
alter table public.creator_campaigns add column chat_request_id uuid unique;
alter table public.creator_replies alter column message_id drop not null;
create index creator_campaigns_chat_actor on public.creator_campaigns(actor_id,created_at) where kind='chat';

-- A single timeline over existing data; no copies or history backfill.
create view public.site_chat_entries as
 select 'm:'||m.id::text as entry_key,m.id,m.user_id,'admin'::text as direction,c.kind,c.title,c.body,c.card,m.pro_until,m.read_at,c.sent_at as created_at
 from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where c.status='sent'
 union all
 select 'r:'||r.id::text,r.id,r.user_id,'user'::text,'chat'::text,''::text,r.body,'{}'::jsonb,null::timestamptz,r.read_at,r.created_at from public.creator_replies r;
revoke all on public.site_chat_entries from public,anon,authenticated;

create function public.site_chat_thread(p_user_id uuid,p_before_at timestamptz,p_before_key text,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 or ((p_before_at is null)<>(p_before_key is null)) or length(p_before_key)>40 then raise exception 'Invalid chat cursor' using errcode='22023'; end if;
 with matching as (select * from public.site_chat_entries e where e.user_id=p_user_id and (p_before_at is null or (e.created_at,e.entry_key)<(p_before_at,p_before_key)) order by e.created_at desc,e.entry_key desc limit p_limit+1),
 page as (select * from matching order by created_at desc,entry_key desc limit p_limit)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page) order by created_at,entry_key) from page),'[]'::jsonb),'has_more',(select count(*)>p_limit from matching)) into result;
 return result;
end $$;
revoke all on function public.site_chat_thread(uuid,timestamptz,text,integer) from public,anon,authenticated;
create function public.chat_user_thread(p_before_at timestamptz default null,p_before_key text default null,p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 return public.site_chat_thread(auth.uid(),p_before_at,p_before_key,p_limit);
end $$;
create function public.chat_admin_thread(p_user_id uuid,p_before_at timestamptz default null,p_before_key text default null,p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.site_admin_require();
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found' using errcode='P0002'; end if;
 return public.site_chat_thread(p_user_id,p_before_at,p_before_key,p_limit);
end $$;
create function public.chat_user_send(p_body text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.creator_replies%rowtype; result public.creator_replies%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_request_id is null or p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'Invalid chat message' using errcode='22023'; end if;
 perform 1 from auth.users where id=auth.uid() for update;
 select * into existing from public.creator_replies where id=p_request_id;
 if found then
  if existing.user_id is distinct from auth.uid() or existing.body is distinct from trim(p_body) or existing.message_id is not null then raise exception 'Chat request changed' using errcode='40001'; end if;
  return jsonb_build_object('id',existing.id);
 end if;
 if (select count(*) from public.creator_replies where user_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Chat rate limit' using errcode='54000'; end if;
 insert into public.creator_replies(id,user_id,body) values(p_request_id,auth.uid(),trim(p_body)) returning * into result;
 return jsonb_build_object('id',result.id);
end $$;
create function public.chat_admin_send(p_user_id uuid,p_body text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.creator_campaigns%rowtype; campaign_id uuid; message_id uuid;
begin
 perform public.site_admin_require(true);
 if p_request_id is null or p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'Invalid chat message' using errcode='22023'; end if;
 perform 1 from auth.users where id=p_user_id for update;
 if not found then raise exception 'User not found' using errcode='P0002'; end if;
 select * into existing from public.creator_campaigns where chat_request_id=p_request_id;
 if found then
  if existing.actor_id is distinct from auth.uid() or existing.body is distinct from trim(p_body) or not exists(select 1 from public.creator_messages cm where cm.campaign_id=existing.id and cm.user_id=p_user_id) then raise exception 'Chat request changed' using errcode='40001'; end if;
  return jsonb_build_object('id',(select cm.id from public.creator_messages cm where cm.campaign_id=existing.id));
 end if;
 if (select count(*) from public.creator_campaigns where kind='chat' and actor_id=auth.uid() and created_at>now()-interval '1 minute')>=60 then raise exception 'Chat rate limit' using errcode='54000'; end if;
 insert into public.creator_campaigns(actor_id,audience,title,body,push_title,push_body,send_push,status,recipient_count,sent_at,kind,chat_request_id,card)
 values(auth.uid(),'single','Сообщение',trim(p_body),'DAYRIS',left(trim(p_body),160),true,'sent',1,now(),'chat',p_request_id,'{"version":1,"sender":"DAYRIS"}'::jsonb) returning id into campaign_id;
 insert into public.creator_messages(campaign_id,user_id) values(campaign_id,p_user_id) returning id into message_id;
 insert into public.creator_message_deliveries(message_id,subscription_id) select message_id,s.id from public.push_subscriptions s where s.user_id=p_user_id and s.active on conflict do nothing;
 insert into public.site_admin_audit(actor_id,subject_id,action,dataset,record_key) values(auth.uid(),p_user_id,'chat.send','creator_messages',message_id::text);
 return jsonb_build_object('id',message_id);
end $$;
create function public.chat_user_read(p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_ids is null or cardinality(p_ids)>100 then raise exception 'Invalid message batch' using errcode='22023'; end if;
 update public.creator_messages m set read_at=coalesce(read_at,now()) where m.user_id=auth.uid() and m.id=any(p_ids) and exists(select 1 from public.creator_campaigns c where c.id=m.campaign_id and c.status='sent');
end $$;
create function public.chat_admin_read(p_user_id uuid,p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.site_admin_require(true);
 if p_ids is null or cardinality(p_ids)>100 then raise exception 'Invalid message batch' using errcode='22023'; end if;
 update public.creator_replies set read_at=coalesce(read_at,now()) where user_id=p_user_id and id=any(p_ids);
end $$;
create function public.chat_user_unread() returns bigint
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 return (select count(*) from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where m.user_id=auth.uid() and m.read_at is null and c.status='sent');
end $$;
create function public.chat_admin_dialogs(p_search text default '',p_unread boolean default false,p_limit integer default 30,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.site_admin_require();
 if p_search is null or length(p_search)>200 or p_unread is null or p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 then raise exception 'Invalid dialog query' using errcode='22023'; end if;
 with matching as (
  select u.id,u.email,coalesce(u.raw_user_meta_data->>'name',u.raw_user_meta_data->>'nickname',u.email,u.id::text) as name,last.body as last_body,last.created_at as last_at,last.direction,
   (select count(*) from public.creator_replies r where r.user_id=u.id and r.read_at is null) as unread_count
  from auth.users u join lateral (select e.body,e.created_at,e.direction from public.site_chat_entries e where e.user_id=u.id order by e.created_at desc,e.entry_key desc limit 1) last on true
  where (p_search='' or u.id::text ilike '%'||p_search||'%' or u.email ilike '%'||p_search||'%' or coalesce(u.raw_user_meta_data->>'name',u.raw_user_meta_data->>'nickname','') ilike '%'||p_search||'%')
  and (not p_unread or exists(select 1 from public.creator_replies r where r.user_id=u.id and r.read_at is null))
 ),page as (select * from matching order by last_at desc,id limit p_limit offset p_offset)
 select jsonb_build_object('total',(select count(*) from matching),'rows',coalesce((select jsonb_agg(to_jsonb(page) order by last_at desc,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;

-- Keep broadcast preparation/history independent from everyday chat traffic.
create or replace function public.admin_prepare_campaign(p_audience text,p_user_id uuid,p_title text,p_body text,p_send_push boolean,p_push_title text,p_push_body text,p_pro_amount integer,p_pro_unit text)
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
 if (select count(*) from public.creator_campaigns where kind='notice' and actor_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Campaign preparation rate limit' using errcode='54000'; end if;
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
create or replace function public.admin_campaign_history(p_limit integer default 20,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.site_admin_require();
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 return jsonb_build_object('total',(select count(*) from public.creator_campaigns where kind='notice'),'rows',coalesce((select jsonb_agg(public.site_admin_campaign_info(r.id)) from (select id from public.creator_campaigns where kind='notice' order by created_at desc,id limit p_limit offset p_offset) r),'[]'::jsonb));
end $$;
create or replace function public.creator_inbox(p_limit integer default 20,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 with own as (select m.id,c.title,c.body,c.card,m.pro_until,c.pro_amount,c.pro_unit,m.read_at,c.sent_at as created_at from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where m.user_id=auth.uid() and c.status='sent' and c.kind='notice'),
 page as (select * from own order by created_at desc,id limit p_limit offset p_offset)
 select jsonb_build_object('total',(select count(*) from own),'unread_count',(select count(*) from own where read_at is null),'messages',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function public.creator_message(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',m.id,'kind',c.kind,'title',c.title,'body',c.body,'card',c.card,'pro_until',m.pro_until,'read_at',m.read_at,'created_at',c.sent_at)
 from public.creator_messages m join public.creator_campaigns c on c.id=m.campaign_id where m.id=p_id and m.user_id=auth.uid() and c.status='sent';
$$;
revoke all on function public.chat_user_thread(timestamptz,text,integer),public.chat_admin_thread(uuid,timestamptz,text,integer),public.chat_user_send(text,uuid),public.chat_admin_send(uuid,text,uuid),public.chat_user_read(uuid[]),public.chat_admin_read(uuid,uuid[]),public.chat_user_unread(),public.chat_admin_dialogs(text,boolean,integer,integer) from public,anon;
grant execute on function public.chat_user_thread(timestamptz,text,integer),public.chat_admin_thread(uuid,timestamptz,text,integer),public.chat_user_send(text,uuid),public.chat_admin_send(uuid,text,uuid),public.chat_user_read(uuid[]),public.chat_admin_read(uuid,uuid[]),public.chat_user_unread(),public.chat_admin_dialogs(text,boolean,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
