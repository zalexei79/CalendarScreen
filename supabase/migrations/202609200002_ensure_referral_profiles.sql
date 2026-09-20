-- Existing accounts may predate referral_profiles. Give every authenticated
-- user an idempotent way to create and recover their personal referral code.
create or replace function public.ensure_referral_profile()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_code text;
  generated_code text;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select referral_code
    into existing_code
    from public.referral_profiles
   where user_id = current_user_id;

  if existing_code is not null then
    return existing_code;
  end if;

  for attempt in 1..10 loop
    generated_code := upper(substr(md5(current_user_id::text || clock_timestamp()::text || random()::text), 1, 10));
    begin
      insert into public.referral_profiles (user_id, referral_code)
      values (current_user_id, generated_code)
      on conflict (user_id) do update
        set user_id = excluded.user_id
      returning referral_code into existing_code;

      return existing_code;
    exception when unique_violation then
      -- Extremely unlikely code collision; generate another value.
    end;
  end loop;

  raise exception 'REFERRAL_CODE_GENERATION_FAILED';
end;
$$;

revoke all on function public.ensure_referral_profile() from public;
grant execute on function public.ensure_referral_profile() to authenticated;

-- Backfill accounts created before the referral system was introduced.
insert into public.referral_profiles (user_id, referral_code)
select id, upper(substr(md5(id::text), 1, 10))
from auth.users
on conflict (user_id) do nothing;
