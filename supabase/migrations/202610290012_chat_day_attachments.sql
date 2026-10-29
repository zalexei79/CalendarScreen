begin;
create or replace function public.friend_chat_thread(p_peer uuid,p_before_at timestamptz default null,p_before_key text default null,p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.friend_chat_allowed(p_peer) then raise exception 'Friend chat unavailable' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 100 or ((p_before_at is null)<>(p_before_key is null)) or length(p_before_key)>40 then raise exception 'Invalid chat cursor' using errcode='22023'; end if;
 with matching as (select 'f:'||m.id::text as entry_key,m.id,m.sender_id,case when m.sender_id=auth.uid() then 'self' else 'peer' end as direction,'chat'::text as kind,m.body,m.day_share,m.created_at,m.read_at
 from public.friend_chat_messages m where m.user_low=least(auth.uid(),p_peer) and m.user_high=greatest(auth.uid(),p_peer) and (p_before_at is null or (m.created_at,'f:'||m.id::text)<(p_before_at,p_before_key)) order by m.created_at desc,m.id desc limit p_limit+1),
 page as (select * from matching order by created_at desc,entry_key desc limit p_limit)
 select jsonb_build_object('owner_id',auth.uid(),'rows',coalesce((select jsonb_agg(to_jsonb(page) order by created_at,entry_key) from page),'[]'::jsonb),'has_more',(select count(*)>p_limit from matching)) into result;
 return result;
end $$;
notify pgrst,'reload schema';
commit;

