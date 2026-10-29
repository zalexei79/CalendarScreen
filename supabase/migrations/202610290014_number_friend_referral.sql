begin;
create function public.social_number_request_referral() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; code text;
begin
 if new.state<>'pending' or auth.uid() is null or new.requested_by<>auth.uid() then return new;end if;
 if exists(select 1 from public.referrals where referred_id=auth.uid()) then return new;end if;
 target:=case when new.user_low=auth.uid() then new.user_high else new.user_low end;
 select referral_code into code from public.referral_profiles where user_id=target;
 if code is null then return new;end if;
 begin perform public.claim_referral(code);
 exception when others then
  if sqlerrm like '%REFERRAL_TOO_LATE%' or sqlerrm like '%SELF_REFERRAL_NOT_ALLOWED%' then return new;else raise;end if;
 end;
 return new;
end$$;
revoke all on function public.social_number_request_referral() from public,anon,authenticated;
create trigger social_number_referral after insert or update on public.social_relationships for each row execute function public.social_number_request_referral();
update public.social_profiles set discoverable=true where user_id='c22282af-a1e9-44ee-b0ab-e966ceefcba1'::uuid;
commit;
