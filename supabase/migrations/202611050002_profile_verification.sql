begin;
create table public.social_verifications(
 user_id uuid primary key references auth.users(id) on delete cascade,
 verified_by uuid references auth.users(id) on delete set null,
 verified_at timestamptz not null default now()
);
alter table public.social_verifications enable row level security;
revoke all on public.social_verifications from public,anon,authenticated;
grant all on public.social_verifications to service_role;

create function public.social_verified_profiles(p_users uuid[],p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Account changed' using errcode='42501';end if;
 if p_users is null or cardinality(p_users)>100 then raise exception 'Invalid profile list' using errcode='22023';end if;
 return jsonb_build_object('owner_id',auth.uid(),'users',coalesce((select jsonb_agg(v.user_id) from public.social_verifications v where v.user_id=any(p_users) and public.social_can_view(v.user_id)),'[]'::jsonb));
end $$;
create function public.admin_user_verification(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.site_admin_require(false);
 return jsonb_build_object('user_id',p_user_id,'verified',exists(select 1 from public.social_verifications where user_id=p_user_id));
end $$;
create function public.admin_set_user_verification(p_user_id uuid,p_verified boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous boolean;
begin
 perform public.site_admin_require(true);
 if p_verified is null then raise exception 'Verification status required' using errcode='22023';end if;
 perform id from auth.users where id=p_user_id for update;
 if not found then raise exception 'User not found' using errcode='P0002';end if;
 select exists(select 1 from public.social_verifications where user_id=p_user_id) into previous;
 if previous is distinct from p_verified then
  if p_verified then insert into public.social_verifications(user_id,verified_by) values(p_user_id,auth.uid());
  else delete from public.social_verifications where user_id=p_user_id;end if;
  insert into public.site_admin_audit(actor_id,subject_id,action,dataset,before_data,after_data)
   values(auth.uid(),p_user_id,'profile_verification','social_verifications',jsonb_build_object('verified',previous),jsonb_build_object('verified',p_verified));
 end if;
 return public.admin_user_verification(p_user_id);
end $$;
revoke all on function public.social_verified_profiles(uuid[],uuid),public.admin_user_verification(uuid),public.admin_set_user_verification(uuid,boolean) from public,anon;
grant execute on function public.social_verified_profiles(uuid[],uuid),public.admin_user_verification(uuid),public.admin_set_user_verification(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
