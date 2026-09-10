-- Personal day journal. Independent of trades and cTrader connections.
begin;
create table public.trading_day_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  note text not null default '' check (char_length(note) <= 2000),
  tags text[] not null default '{}' check (
    cardinality(tags) <= 4 and array_position(tags, null) is null
    and tags <@ array['plan', 'rushed', 'tired', 'broke_rules']::text[]
  ),
  primary key (user_id, date_key)
);
alter table public.trading_day_notes enable row level security;
revoke all on public.trading_day_notes from anon, public;
grant select, insert, update on public.trading_day_notes to authenticated;
create policy day_notes_select on public.trading_day_notes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy day_notes_insert on public.trading_day_notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy day_notes_update on public.trading_day_notes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
