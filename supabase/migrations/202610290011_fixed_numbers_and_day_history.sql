begin;
create table public.social_account_numbers(number bigint generated always as identity primary key,user_id uuid not null unique references auth.users(id) on delete cascade);
alter table public.social_account_numbers enable row level security;
revoke all on public.social_account_numbers from public,anon,authenticated;
insert into public.social_account_numbers(user_id) select id from auth.users order by created_at,id;
create function public.social_number_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.social_account_numbers(user_id) values(new.id) on conflict(user_id) do nothing;return new;end$$;
revoke all on function public.social_number_new_user() from public,anon,authenticated;
create trigger social_number_signup after insert on auth.users for each row execute function public.social_number_new_user();
alter table public.social_profiles drop constraint social_profiles_handle_check;
update public.social_profiles p set handle='-'||n.number::text from public.social_account_numbers n where n.user_id=p.user_id;
alter table public.social_profiles add constraint social_profiles_handle_check check(handle ~ '^-[1-9][0-9]*$');
create function public.social_fixed_handle() returns trigger language plpgsql security definer set search_path='' as $$begin if new.handle is distinct from old.handle or new.user_id is distinct from old.user_id then raise exception 'Account number is immutable' using errcode='42501';end if;return new;end$$;
revoke all on function public.social_fixed_handle() from public,anon,authenticated;
create trigger social_handle_immutable before update on public.social_profiles for each row execute function public.social_fixed_handle();
create or replace function public.social_own_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare code text; profile_name text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 insert into public.social_account_numbers(user_id) select auth.uid() where not exists(select 1 from public.social_account_numbers where user_id=auth.uid()) on conflict(user_id) do nothing;
 select '-'||number::text into code from public.social_account_numbers where user_id=auth.uid();
 select left(coalesce(nullif(trim(raw_user_meta_data->>'nickname'),''),nullif(trim(raw_user_meta_data->>'full_name'),''),nullif(trim(raw_user_meta_data->>'name'),''),'DAYRIS'),60) into profile_name from auth.users where id=auth.uid();
 insert into public.social_profiles(user_id,display_name,handle) values(auth.uid(),profile_name,code) on conflict(user_id) do nothing;
 return(select to_jsonb(p) from public.social_profiles p where user_id=auth.uid());
end$$;
create or replace function public.social_update_profile(p_display_name text,p_handle text,p_discoverable boolean,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Profile owner changed' using errcode='42501';end if;
 if p_display_name is null or length(trim(p_display_name)) not between 1 and 60 or p_discoverable is null then raise exception 'Invalid profile' using errcode='22023';end if;
 perform public.social_own_profile();
 update public.social_profiles set display_name=trim(p_display_name),discoverable=p_discoverable,updated_at=now() where user_id=auth.uid();
 return(select to_jsonb(p) from public.social_profiles p where user_id=auth.uid());
end$$;
create or replace function public.social_find(p_handle text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target uuid; code text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 code:=regexp_replace(trim(p_handle),'^[-#@]+','');if code is null or code !~ '^[1-9][0-9]{0,18}$' then return null;end if;
 select user_id into target from public.social_profiles where handle='-'||code and discoverable and user_id<>auth.uid();
 if target is null or not public.social_can_view(target) then return null;end if;
 return public.social_profile(target)||jsonb_build_object('viewer_id',auth.uid(),'relationship',(select state from public.social_relationships where user_low=least(target,auth.uid()) and user_high=greatest(target,auth.uid())),'requested_by',(select requested_by from public.social_relationships where user_low=least(target,auth.uid()) and user_high=greatest(target,auth.uid())));
end$$;
alter table public.friend_chat_messages add column day_share jsonb;
create function public.social_day_history(p_day date,p_owner uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Day owner changed' using errcode='42501';end if;
 if p_day is null or p_day<date '1900-01-01' or p_day>date '2200-12-31' then raise exception 'Invalid day' using errcode='22023';end if;
 with own as(select t.id,t.time,t.instrument,t.direction,t.pnl,t.currency,t.comment,t.platform from public.trades t where t.user_id=auth.uid() and t.date_key::text=to_char(p_day,'YYYY-MM-DD')),
 totals as(select coalesce(currency,'—') as currency,sum(coalesce(pnl,0)) as amount from own group by currency)
 select jsonb_build_object('owner_id',auth.uid(),'day',p_day,'entries',(select count(*) from own),'records',coalesce((select jsonb_agg(to_jsonb(own) order by time nulls last,id) from own),'[]'::jsonb),'totals',coalesce((select jsonb_agg(to_jsonb(totals) order by currency) from totals),'[]'::jsonb)) into result;
 if octet_length(result::text)>2097152 then raise exception 'Day history too large' using errcode='54000';end if;return result;
end$$;
create function public.friend_chat_share_day(p_peer uuid,p_day date,p_request_id uuid,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare sent jsonb; snapshot jsonb;
begin
 sent:=public.friend_chat_send(p_peer,'DAYRIS · '||to_char(p_day,'YYYY-MM-DD'),p_request_id,p_owner);
 if exists(select 1 from public.friend_chat_messages where id=p_request_id and day_share is not null) then return sent;end if;
 snapshot:=public.social_day_history(p_day,p_owner);
 update public.friend_chat_messages set day_share=snapshot-'owner_id' where id=p_request_id and sender_id=auth.uid() and recipient_id=p_peer;
 return sent;
end$$;
revoke all on function public.social_day_history(date,uuid),public.friend_chat_share_day(uuid,date,uuid,uuid) from public,anon;
grant execute on function public.social_day_history(date,uuid),public.friend_chat_share_day(uuid,date,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
