begin;
-- Blocking must not become a way to discover an otherwise private profile.
create function public.social_guard_block() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return new; end if;
 if new.blocker_id is distinct from auth.uid() then raise exception 'Block owner changed' using errcode='42501'; end if;
 if not public.social_can_view(new.blocked_id)
  and not exists(select 1 from public.social_relationships where user_low=least(new.blocker_id,new.blocked_id) and user_high=greatest(new.blocker_id,new.blocked_id))
  and not exists(select 1 from public.social_blocks where blocker_id=new.blocker_id and blocked_id=new.blocked_id)
 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.social_guard_block() from public,anon,authenticated;
create trigger social_block_visibility before insert on public.social_blocks for each row execute function public.social_guard_block();
commit;
