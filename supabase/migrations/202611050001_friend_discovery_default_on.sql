begin;

-- Keep signup and the existing-account backfill in the same rollout.
lock table auth.users in share row exclusive mode;
alter table public.social_profiles alter column discoverable set default true;

-- One-time switch to the new default for existing accounts. Later opt-outs
-- are saved normally and are never reset by profile loading or sign-in.
update public.social_profiles set discoverable=true,updated_at=now() where not discoverable;

insert into public.social_profiles(user_id,display_name,handle)
select u.id,
 left(coalesce(nullif(trim(u.raw_user_meta_data->>'nickname'),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(trim(u.raw_user_meta_data->>'name'),''),'DAYRIS'),60),
 n.number::text
from auth.users u join public.social_account_numbers n on n.user_id=u.id
on conflict(user_id) do nothing;

-- A new account is findable by its assigned number before it opens Friends.
create or replace function public.social_number_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare account_number bigint;
begin
 insert into public.social_account_numbers(user_id) values(new.id)
  on conflict(user_id) do nothing returning number into account_number;
 if account_number is null then
  select number into account_number from public.social_account_numbers where user_id=new.id;
 end if;
 insert into public.social_profiles(user_id,display_name,handle)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'nickname'),''),nullif(trim(new.raw_user_meta_data->>'full_name'),''),nullif(trim(new.raw_user_meta_data->>'name'),''),'DAYRIS'),60),account_number::text)
 on conflict(user_id) do nothing;
 return new;
end $$;
revoke all on function public.social_number_new_user() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
