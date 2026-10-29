begin;
lock table auth.users in share row exclusive mode;
lock table public.social_account_numbers in access exclusive mode;
create temporary table social_positive_number_map on commit drop as select id as user_id,row_number() over(order by (id='c22282af-a1e9-44ee-b0ab-e966ceefcba1'::uuid) desc,created_at,id) as number from auth.users;
do $$begin if not exists(select 1 from social_positive_number_map where user_id='c22282af-a1e9-44ee-b0ab-e966ceefcba1'::uuid) then raise exception 'Owner account not found';end if;end$$;
delete from public.social_account_numbers;
insert into public.social_account_numbers(number,user_id) overriding system value select number,user_id from social_positive_number_map order by number;
select setval(pg_get_serial_sequence('public.social_account_numbers','number'),(select max(number) from public.social_account_numbers),true);
alter table public.social_profiles disable trigger social_handle_immutable;
alter table public.social_profiles drop constraint social_profiles_handle_check;
update public.social_profiles p set handle=n.number::text from public.social_account_numbers n where n.user_id=p.user_id;
alter table public.social_profiles add constraint social_profiles_handle_check check(handle ~ '^[1-9][0-9]*$');
alter table public.social_profiles enable trigger social_handle_immutable;
create or replace function public.social_own_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare code text; profile_name text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 insert into public.social_account_numbers(user_id) select auth.uid() where not exists(select 1 from public.social_account_numbers where user_id=auth.uid()) on conflict(user_id) do nothing;
 select number::text into code from public.social_account_numbers where user_id=auth.uid();
 select left(coalesce(nullif(trim(raw_user_meta_data->>'nickname'),''),nullif(trim(raw_user_meta_data->>'full_name'),''),nullif(trim(raw_user_meta_data->>'name'),''),'DAYRIS'),60) into profile_name from auth.users where id=auth.uid();
 insert into public.social_profiles(user_id,display_name,handle) values(auth.uid(),profile_name,code) on conflict(user_id) do nothing;
 return(select to_jsonb(p) from public.social_profiles p where user_id=auth.uid());
end$$;
create or replace function public.social_find(p_handle text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target uuid; code text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 code:=regexp_replace(trim(p_handle),'^[-#@]+','');if code is null or code !~ '^[1-9][0-9]{0,18}$' then return null;end if;
 select user_id into target from public.social_profiles where handle=code and discoverable and user_id<>auth.uid();
 if target is null or not public.social_can_view(target) then return null;end if;
 return public.social_profile(target)||jsonb_build_object('viewer_id',auth.uid(),'relationship',(select state from public.social_relationships where user_low=least(target,auth.uid()) and user_high=greatest(target,auth.uid())),'requested_by',(select requested_by from public.social_relationships where user_low=least(target,auth.uid()) and user_high=greatest(target,auth.uid())));
end$$;
notify pgrst,'reload schema';
commit;
