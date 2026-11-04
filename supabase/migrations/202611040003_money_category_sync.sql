begin;
create table if not exists public.money_category_library (
 user_id uuid not null references auth.users(id) on delete cascade,
 category_key text not null check(length(category_key) between 1 and 60),
 name text not null check(length(trim(name)) between 1 and 60),
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,category_key)
);
alter table public.money_category_library enable row level security;
revoke all on public.money_category_library from anon,authenticated;
grant select on public.money_category_library to authenticated;
drop policy if exists money_category_owner_read on public.money_category_library;
create policy money_category_owner_read on public.money_category_library for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.set_money_category(p_owner uuid,p_key text,p_name text,p_deleted boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_key is null or length(trim(p_key)) not between 1 and 60 or p_name is null or length(trim(p_name)) not between 1 and 60 or p_deleted is null then raise exception 'Invalid category'; end if;
 insert into public.money_category_library(user_id,category_key,name,deleted) values(p_owner,p_key,trim(p_name),p_deleted)
 on conflict(user_id,category_key) do update set name=excluded.name,deleted=excluded.deleted,updated_at=now();
end; $$;
-- Import old device libraries without overwriting a newer deletion or edit.
create or replace function public.import_money_categories(p_owner uuid,p_entries jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Unauthorized' using errcode='42501'; end if;
 if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries)>500 then raise exception 'Invalid library'; end if;
 for item in select * from jsonb_array_elements(p_entries) loop
  if length(trim(item->>'key')) between 1 and 60 and length(trim(item->>'name')) between 1 and 60 and jsonb_typeof(item->'deleted')='boolean' then
   insert into public.money_category_library(user_id,category_key,name,deleted) values(p_owner,item->>'key',trim(item->>'name'),(item->>'deleted')::boolean) on conflict do nothing;
  end if;
 end loop;
end; $$;
revoke all on function public.set_money_category(uuid,text,text,boolean) from public,anon;
revoke all on function public.import_money_categories(uuid,jsonb) from public,anon;
grant execute on function public.set_money_category(uuid,text,text,boolean) to authenticated;
grant execute on function public.import_money_categories(uuid,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='money_category_library') then
  alter publication supabase_realtime add table public.money_category_library;
 end if;
end $$;
commit;
