begin;

-- Only public device keys and encrypted key packets leave the browser.
create table public.friend_chat_devices(
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 public_key text not null check(public_key ~ '^[A-Za-z0-9_-]{87}$'),
 created_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),revoked_at timestamptz
);
create index friend_chat_devices_owner on public.friend_chat_devices(owner_id) where revoked_at is null;
create table public.friend_chat_key_epochs(
 id uuid primary key,user_low uuid not null references auth.users(id) on delete cascade,user_high uuid not null references auth.users(id) on delete cascade,
 created_by uuid not null references public.friend_chat_devices(id),created_at timestamptz not null default now(),check(user_low<user_high)
);
create index friend_chat_key_epochs_pair on public.friend_chat_key_epochs(user_low,user_high,created_at desc);
create table public.friend_chat_key_packets(
 epoch_id uuid not null references public.friend_chat_key_epochs(id) on delete cascade,
 recipient_device uuid not null references public.friend_chat_devices(id),sender_device uuid not null references public.friend_chat_devices(id),
 wrapped_key text not null check(wrapped_key ~ '^[A-Za-z0-9_-]{54}$'),created_at timestamptz not null default now(),primary key(epoch_id,recipient_device)
);
alter table public.friend_chat_devices enable row level security;
alter table public.friend_chat_key_epochs enable row level security;
alter table public.friend_chat_key_packets enable row level security;
revoke all on public.friend_chat_devices,public.friend_chat_key_epochs,public.friend_chat_key_packets from public,anon,authenticated;
grant all on public.friend_chat_devices,public.friend_chat_key_epochs,public.friend_chat_key_packets to service_role;

create function public.friend_chat_register_device(p_device uuid,p_public_key text,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.friend_chat_devices%rowtype;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Device owner changed' using errcode='42501'; end if;
 if p_device is null or p_public_key is null or p_public_key !~ '^[A-Za-z0-9_-]{87}$' then raise exception 'Invalid public device key' using errcode='22023'; end if;
 perform id from auth.users where id=auth.uid() for update;
 select * into existing from public.friend_chat_devices where id=p_device;
 if found then
  if existing.owner_id<>auth.uid() or existing.public_key<>p_public_key or existing.revoked_at is not null then raise exception 'Device identity cannot be replaced' using errcode='42501'; end if;
  update public.friend_chat_devices set last_seen_at=now() where id=p_device;
 else
  if (select count(*) from public.friend_chat_devices where owner_id=auth.uid() and revoked_at is null)>=32 then raise exception 'Too many devices' using errcode='54000'; end if;
  insert into public.friend_chat_devices(id,owner_id,public_key) values(p_device,auth.uid(),p_public_key);
 end if;
 return jsonb_build_object('owner_id',auth.uid(),'device_id',p_device);
end $$;

create function public.friend_chat_keyring(p_peer uuid,p_device uuid,p_owner uuid,p_epochs uuid[] default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner or not public.friend_chat_allowed(p_peer)
 or not exists(select 1 from public.friend_chat_devices where id=p_device and owner_id=auth.uid() and revoked_at is null) then raise exception 'Friend keys unavailable' using errcode='42501'; end if;
 if coalesce(cardinality(p_epochs),0)>100 then raise exception 'Too many key epochs' using errcode='22023'; end if;
 with epochs as(select e.* from public.friend_chat_key_epochs e where e.user_low=least(auth.uid(),p_peer) and e.user_high=greatest(auth.uid(),p_peer)
 and (p_epochs is null or e.id=any(p_epochs)) order by e.created_at desc,e.id desc limit 100)
 select jsonb_build_object('owner_id',auth.uid(),'devices',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'owner_id',d.owner_id,'public_key',d.public_key) order by d.id) from public.friend_chat_devices d where d.owner_id in(auth.uid(),p_peer) and d.revoked_at is null),'[]'::jsonb),
 'epochs',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'delivered',coalesce((select jsonb_agg(p.recipient_device) from public.friend_chat_key_packets p where p.epoch_id=e.id),'[]'::jsonb))) from epochs e),'[]'::jsonb),
 'packets',coalesce((select jsonb_agg(jsonb_build_object('epoch_id',p.epoch_id,'recipient_device',p.recipient_device,'sender_device',p.sender_device,'public_key',s.public_key,'wrapped_key',p.wrapped_key)) from public.friend_chat_key_packets p join epochs e on e.id=p.epoch_id join public.friend_chat_devices s on s.id=p.sender_device where p.recipient_device=p_device),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.friend_chat_publish_keys(p_peer uuid,p_device uuid,p_epoch uuid,p_packets jsonb,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare epoch public.friend_chat_key_epochs%rowtype;packet jsonb;target public.friend_chat_devices%rowtype;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner or not public.friend_chat_allowed(p_peer)
 or not exists(select 1 from public.friend_chat_devices where id=p_device and owner_id=auth.uid() and revoked_at is null) then raise exception 'Friend keys unavailable' using errcode='42501'; end if;
 if p_epoch is null or p_packets is null or jsonb_typeof(p_packets)<>'array' or jsonb_array_length(p_packets) not between 1 and 64 then raise exception 'Invalid key packets' using errcode='22023'; end if;
 perform id from auth.users where id in(auth.uid(),p_peer) order by id for update;
 if not public.friend_chat_allowed(p_peer) then raise exception 'Friend keys unavailable' using errcode='42501'; end if;
 perform id from public.social_relationships where user_low=least(auth.uid(),p_peer) and user_high=greatest(auth.uid(),p_peer) and state='accepted' for share;
 select * into epoch from public.friend_chat_key_epochs where id=p_epoch;
 if found then
  if epoch.user_low<>least(auth.uid(),p_peer) or epoch.user_high<>greatest(auth.uid(),p_peer)
  or (epoch.created_by<>p_device and not exists(select 1 from public.friend_chat_key_packets where epoch_id=p_epoch and recipient_device=p_device)) then raise exception 'Key epoch unavailable' using errcode='42501'; end if;
 else
  insert into public.friend_chat_key_epochs(id,user_low,user_high,created_by) values(p_epoch,least(auth.uid(),p_peer),greatest(auth.uid(),p_peer),p_device);
 end if;
 for packet in select value from jsonb_array_elements(p_packets) loop
  if jsonb_typeof(packet)<>'object' or packet->>'recipient_device' is null or packet->>'wrapped_key' is null or packet->>'wrapped_key' !~ '^[A-Za-z0-9_-]{54}$' then raise exception 'Invalid key packet' using errcode='22023'; end if;
  select * into target from public.friend_chat_devices where id=(packet->>'recipient_device')::uuid and owner_id in(auth.uid(),p_peer) and revoked_at is null;
  if not found then raise exception 'Recipient device unavailable' using errcode='42501'; end if;
  insert into public.friend_chat_key_packets(epoch_id,recipient_device,sender_device,wrapped_key) values(p_epoch,target.id,p_device,packet->>'wrapped_key') on conflict do nothing;
 end loop;
 return jsonb_build_object('owner_id',auth.uid(),'epoch_id',p_epoch);
end $$;

-- Preserve the ordinary-message limit, while allowing UTF-8/base64 overhead for
-- encrypted 2,000-character messages and their bounded reply quotes.
create function public.friend_chat_body_valid(p_body text) returns boolean language sql immutable set search_path='' as $$
 select length(trim(p_body)) between 1 and 2000 or (length(p_body)<=12000 and p_body ~ E'^DAYRIS_AUTO_V1\n[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\n[A-Za-z0-9_-]{39,}$');
$$;
alter table public.friend_chat_messages drop constraint friend_chat_messages_body_check;
alter table public.friend_chat_messages add constraint friend_chat_messages_body_check check(public.friend_chat_body_valid(body));

create or replace function public.friend_chat_send(p_peer uuid,p_body text,p_request_id uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.friend_chat_messages%rowtype;epoch uuid;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Chat owner changed' using errcode='42501'; end if;
 if p_request_id is null or p_body is null or not public.friend_chat_body_valid(p_body) then raise exception 'Invalid chat message' using errcode='22023'; end if;
 perform id from auth.users where id in(auth.uid(),p_peer) order by id for update;
 if not public.friend_chat_allowed(p_peer) then raise exception 'Friend chat unavailable' using errcode='42501'; end if;
 perform id from public.social_relationships where user_low=least(auth.uid(),p_peer) and user_high=greatest(auth.uid(),p_peer) and state='accepted' for share;
 select * into existing from public.friend_chat_messages where id=p_request_id;
 if found then
  if existing.sender_id is distinct from auth.uid() or existing.recipient_id is distinct from p_peer or existing.body is distinct from trim(p_body) then raise exception 'Chat request changed' using errcode='40001'; end if;
  return jsonb_build_object('id',existing.id);
 end if;
 if starts_with(p_body,E'DAYRIS_AUTO_V1\n') then
  begin epoch:=split_part(p_body,chr(10),2)::uuid;exception when invalid_text_representation then raise exception 'Invalid encryption epoch' using errcode='22023';end;
  if not exists(select 1 from public.friend_chat_key_epochs e where e.id=epoch and e.user_low=least(auth.uid(),p_peer) and e.user_high=greatest(auth.uid(),p_peer))
  or not exists(select 1 from public.friend_chat_key_packets p join public.friend_chat_devices d on d.id=p.recipient_device where p.epoch_id=epoch and d.owner_id=p_peer and d.revoked_at is null) then raise exception 'Peer encryption is not ready' using errcode='55000'; end if;
 end if;
 if (select count(*) from public.friend_chat_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Chat rate limit' using errcode='54000'; end if;
 insert into public.friend_chat_messages(id,sender_id,recipient_id,body) values(p_request_id,auth.uid(),p_peer,trim(p_body));
 return jsonb_build_object('id',p_request_id);
end $$;

revoke all on function public.friend_chat_register_device(uuid,text,uuid),public.friend_chat_keyring(uuid,uuid,uuid,uuid[]),public.friend_chat_publish_keys(uuid,uuid,uuid,jsonb,uuid),public.friend_chat_body_valid(text) from public,anon;
grant execute on function public.friend_chat_register_device(uuid,text,uuid),public.friend_chat_keyring(uuid,uuid,uuid,uuid[]),public.friend_chat_publish_keys(uuid,uuid,uuid,jsonb,uuid),public.friend_chat_body_valid(text) to authenticated;
notify pgrst,'reload schema';
commit;
