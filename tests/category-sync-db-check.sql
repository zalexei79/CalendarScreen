-- All verification writes are rolled back; no user library is changed.
begin;
do $$
declare owners uuid[]; a uuid; b uuid; denied boolean:=false;
begin
 select array_agg(id) into owners from (select id from auth.users order by id limit 2) users_to_verify;
 a:=owners[1];b:=owners[2];
 if a is null or b is null then raise exception 'Two existing accounts required for isolation verification';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.set_money_category(a,'_dayris_sync_check_','Sync verification',false);
 perform public.import_money_categories(a,'[{"key":"_dayris_sync_check_","name":"Old device","deleted":true}]');
 if not exists(select 1 from public.money_category_library where user_id=a and category_key='_dayris_sync_check_' and not deleted) then raise exception 'Import overwrote existing category';end if;
 perform public.set_money_category(a,'_dayris_sync_check_','Sync verification',true);
 perform public.import_money_categories(a,'[{"key":"_dayris_sync_check_","name":"Old device","deleted":false}]');
 if not exists(select 1 from public.money_category_library where user_id=a and category_key='_dayris_sync_check_' and deleted) then raise exception 'Old device resurrected deletion';end if;
 begin perform public.set_money_category(b,'_dayris_sync_check_','Wrong owner',false);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-account write allowed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.set_money_category(b,'_dayris_sync_check_','Other account',false);
 perform set_config('request.jwt.claim.sub',a::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.money_category_library where user_id=b) then raise exception 'Cross-account read allowed';end if;
 if not exists(select 1 from public.money_category_library where user_id=a and category_key='_dayris_sync_check_') then raise exception 'Own library unreadable';end if;
 execute 'reset role';
 if has_table_privilege('anon','public.money_category_library','select') or has_table_privilege('authenticated','public.money_category_library','insert') then raise exception 'Unexpected direct access';end if;
end $$;
rollback;
