begin;
create table public.social_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 1 and 60),
 handle text not null unique check(handle ~ '^[a-z0-9_]{3,24}$'),
 avatar_path text,discoverable boolean not null default false,updated_at timestamptz not null default now()
);
create table public.social_relationships (
 id uuid primary key default gen_random_uuid(),user_low uuid not null references auth.users(id) on delete cascade,
 user_high uuid not null references auth.users(id) on delete cascade,requested_by uuid not null references auth.users(id) on delete cascade,
 state text not null check(state in ('pending','accepted','declined','cancelled')),
 requested_at timestamptz not null default now(),responded_at timestamptz,
 unique(user_low,user_high),check(user_low<user_high),check(requested_by in (user_low,user_high))
);
create index social_relationships_low on public.social_relationships(user_low,state);
create index social_relationships_high on public.social_relationships(user_high,state);
create table public.social_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,blocked_id uuid not null references auth.users(id) on delete cascade,
 primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create table public.social_request_events (
 requester_id uuid not null references auth.users(id) on delete cascade,target_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index social_request_events_rate on public.social_request_events(requester_id,created_at);
alter table public.social_profiles enable row level security;
alter table public.social_relationships enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_request_events enable row level security;
revoke all on public.social_profiles,public.social_relationships,public.social_blocks,public.social_request_events from public,anon,authenticated;
grant all on public.social_profiles,public.social_relationships,public.social_blocks,public.social_request_events to service_role;

create function public.social_can_view(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  p_user_id=auth.uid()
  or (public.site_admin_session_allowed() and exists(select 1 from public.site_admins where user_id=auth.uid() and can_view_users))
  or (not exists(select 1 from public.social_blocks where (blocker_id=auth.uid() and blocked_id=p_user_id) or (blocker_id=p_user_id and blocked_id=auth.uid()))
    and (exists(select 1 from public.social_profiles where user_id=p_user_id and discoverable)
      or exists(select 1 from public.social_relationships where user_low=least(auth.uid(),p_user_id) and user_high=greatest(auth.uid(),p_user_id) and state in ('pending','accepted'))))
 );
$$;
revoke all on function public.social_can_view(uuid) from public,anon,authenticated;
create function public.social_profile(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,'handle',p.handle,'avatar_path',p.avatar_path)
 from public.social_profiles p where p.user_id=p_user_id and public.social_can_view(p.user_id);
$$;
create function public.social_own_profile() returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate text; profile_name text; attempt integer;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if not exists(select 1 from public.social_profiles where user_id=auth.uid()) then
  select left(coalesce(nullif(trim(raw_user_meta_data->>'nickname'),''),nullif(trim(raw_user_meta_data->>'full_name'),''),nullif(trim(raw_user_meta_data->>'name'),''),'DAYRIS'),60) into profile_name from auth.users where id=auth.uid();
  for attempt in 0..4 loop
   candidate:='dr_'||substr(md5(auth.uid()::text||attempt::text),1,12);
   insert into public.social_profiles(user_id,display_name,handle) values(auth.uid(),coalesce(profile_name,'DAYRIS'),candidate) on conflict do nothing;
   exit when exists(select 1 from public.social_profiles where user_id=auth.uid());
  end loop;
 end if;
 return (select to_jsonb(p) from public.social_profiles p where user_id=auth.uid());
end $$;
create function public.social_update_profile(p_display_name text,p_handle text,p_discoverable boolean,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if auth.uid() is distinct from p_owner then raise exception 'Profile owner changed' using errcode='42501'; end if;
 if p_display_name is null or length(trim(p_display_name)) not between 1 and 60 or p_handle is null or lower(trim(p_handle)) !~ '^[a-z0-9_]{3,24}$' or p_discoverable is null then raise exception 'Invalid social profile' using errcode='22023'; end if;
 perform public.social_own_profile();
 update public.social_profiles set display_name=trim(p_display_name),handle=lower(trim(p_handle)),discoverable=p_discoverable,updated_at=now() where user_id=auth.uid();
 return (select to_jsonb(p) from public.social_profiles p where user_id=auth.uid());
end $$;
create function public.social_set_avatar(p_path text,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if auth.uid() is distinct from p_owner then raise exception 'Profile owner changed' using errcode='42501'; end if;
 if p_path is not null and (p_path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$') or not exists(select 1 from storage.objects where bucket_id='profile-avatars' and name=p_path)) then raise exception 'Invalid avatar' using errcode='22023'; end if;
 perform public.social_own_profile();
 update public.social_profiles set avatar_path=p_path,updated_at=now() where user_id=auth.uid();
 return (select to_jsonb(p) from public.social_profiles p where user_id=auth.uid());
end $$;
create function public.social_avatar_readable(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (split_part(p_path,'/',1)=auth.uid()::text or exists(select 1 from public.social_profiles p where p.avatar_path=p_path and public.social_can_view(p.user_id)));
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('profile-avatars','profile-avatars',false,2097152,array['image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];
create policy social_avatar_read on storage.objects for select to authenticated using(bucket_id='profile-avatars' and public.social_avatar_readable(name));
create policy social_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$'));
create policy social_avatar_delete on storage.objects for delete to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create function public.social_find(p_handle text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid; result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_handle is null or length(trim(p_handle)) not between 3 and 25 then return null; end if;
 select user_id into target from public.social_profiles where handle=lower(ltrim(trim(p_handle),'@')) and discoverable and user_id<>auth.uid();
 if target is null or not public.social_can_view(target) then return null; end if;
 result:=public.social_profile(target);
 return result||jsonb_build_object('viewer_id',auth.uid(),'relationship',(select state from public.social_relationships where user_low=least(target,auth.uid()) and user_high=greatest(target,auth.uid())),'requested_by',(select requested_by from public.social_relationships where user_low=least(target,auth.uid()) and user_high=greatest(target,auth.uid())));
end $$;
create function public.social_friends() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 with related as (
  select r.id as relationship_id,r.requested_by,r.state,r.requested_at,p.user_id,p.display_name,p.handle,p.avatar_path
  from public.social_relationships r join public.social_profiles p on p.user_id=case when r.user_low=auth.uid() then r.user_high else r.user_low end
  where auth.uid() in (r.user_low,r.user_high) and r.state in ('pending','accepted') and public.social_can_view(p.user_id)
 )
 select jsonb_build_object('owner_id',auth.uid(),
  'friends',coalesce((select jsonb_agg(to_jsonb(r) order by r.display_name,r.user_id) from related r where state='accepted'),'[]'::jsonb),
  'incoming',coalesce((select jsonb_agg(to_jsonb(r) order by requested_at desc) from related r where state='pending' and requested_by<>auth.uid()),'[]'::jsonb),
  'outgoing',coalesce((select jsonb_agg(to_jsonb(r) order by requested_at desc) from related r where state='pending' and requested_by=auth.uid()),'[]'::jsonb),
  'blocked',coalesce((select jsonb_agg(jsonb_build_object('user_id',b.blocked_id,'display_name',coalesce(p.display_name,'DAYRIS'),'handle',p.handle)) from public.social_blocks b left join public.social_profiles p on p.user_id=b.blocked_id where b.blocker_id=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end $$;
create function public.social_friend_count() returns bigint
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 return (select count(*) from public.social_relationships where auth.uid() in (user_low,user_high) and state='pending' and requested_by<>auth.uid());
end $$;
create function public.social_friend_action(p_user_id uuid,p_action text,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rel public.social_relationships%rowtype; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if actor is distinct from p_owner then raise exception 'Profile owner changed' using errcode='42501'; end if;
 if p_user_id is null or p_user_id=actor or p_action is null or p_action not in ('request','accept','decline','cancel','remove','block','unblock') then raise exception 'Invalid friend action' using errcode='22023'; end if;
 perform id from auth.users where id in (actor,p_user_id) order by id for update;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Profile unavailable' using errcode='P0002'; end if;
 select * into rel from public.social_relationships where user_low=least(actor,p_user_id) and user_high=greatest(actor,p_user_id) for update;
 if p_action='block' then
  insert into public.social_blocks(blocker_id,blocked_id) values(actor,p_user_id) on conflict do nothing;
  update public.social_relationships set state='cancelled',responded_at=now() where id=rel.id;
 elsif p_action='unblock' then
  delete from public.social_blocks where blocker_id=actor and blocked_id=p_user_id;
 elsif p_action='request' then
  if exists(select 1 from public.social_blocks where (blocker_id=actor and blocked_id=p_user_id) or (blocker_id=p_user_id and blocked_id=actor)) or not exists(select 1 from public.social_profiles where user_id=p_user_id and discoverable) then raise exception 'Profile unavailable' using errcode='42501'; end if;
  if rel.state='accepted' or (rel.state='pending' and rel.requested_by=actor) then return public.social_friends(); end if;
  if rel.state='pending' then raise exception 'Respond to incoming request first' using errcode='22023'; end if;
  if rel.state='declined' and rel.requested_by=actor and rel.responded_at>now()-interval '1 day' then raise exception 'Friend request cooldown' using errcode='54000'; end if;
  if (select count(*) from public.social_request_events where requester_id=actor and created_at>now()-interval '1 day')>=20 then raise exception 'Friend request rate limit' using errcode='54000'; end if;
  perform public.social_own_profile();
  insert into public.social_relationships(user_low,user_high,requested_by,state) values(least(actor,p_user_id),greatest(actor,p_user_id),actor,'pending')
   on conflict(user_low,user_high) do update set requested_by=actor,state='pending',requested_at=now(),responded_at=null;
  insert into public.social_request_events(requester_id,target_id) values(actor,p_user_id);
 elsif p_action in ('accept','decline') then
  if rel.id is null or rel.state<>'pending' or rel.requested_by=actor then raise exception 'Incoming request required' using errcode='42501'; end if;
  if exists(select 1 from public.social_blocks where (blocker_id=actor and blocked_id=p_user_id) or (blocker_id=p_user_id and blocked_id=actor)) then raise exception 'Profile unavailable' using errcode='42501'; end if;
  update public.social_relationships set state=case when p_action='accept' then 'accepted' else 'declined' end,responded_at=now() where id=rel.id;
 elsif p_action='cancel' then
  if rel.id is null or rel.state<>'pending' or rel.requested_by<>actor then raise exception 'Outgoing request required' using errcode='42501'; end if;
  update public.social_relationships set state='cancelled',responded_at=now() where id=rel.id;
 elsif p_action='remove' then
  if rel.id is null or rel.state<>'accepted' then raise exception 'Friend required' using errcode='42501'; end if;
  update public.social_relationships set state='cancelled',responded_at=now() where id=rel.id;
 end if;
 return public.social_friends();
end $$;
revoke all on function public.social_profile(uuid),public.social_own_profile(),public.social_update_profile(text,text,boolean,uuid),public.social_set_avatar(text,uuid),public.social_avatar_readable(text),public.social_find(text),public.social_friends(),public.social_friend_count(),public.social_friend_action(uuid,text,uuid) from public,anon;
grant execute on function public.social_profile(uuid),public.social_own_profile(),public.social_update_profile(text,text,boolean,uuid),public.social_set_avatar(text,uuid),public.social_avatar_readable(text),public.social_find(text),public.social_friends(),public.social_friend_count(),public.social_friend_action(uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
