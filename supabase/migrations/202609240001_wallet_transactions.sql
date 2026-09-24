-- DAYRIS wallet: a separate financial space, intentionally independent from trades.
begin;

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  time text not null default '00:00',
  title text not null check (length(trim(title)) between 1 and 120),
  amount numeric(18,2) not null check (amount >= 0),
  kind text not null check (kind in ('income', 'expense')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  comment text not null default '' check (length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, id)
);

create index if not exists wallet_transactions_user_date_idx
  on public.wallet_transactions(user_id, date_key desc, id desc);

alter table public.wallet_transactions enable row level security;
revoke all on public.wallet_transactions from public, anon;
grant select, insert, update, delete on public.wallet_transactions to authenticated;

drop policy if exists wallet_transactions_select_own on public.wallet_transactions;
create policy wallet_transactions_select_own on public.wallet_transactions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists wallet_transactions_insert_own on public.wallet_transactions;
create policy wallet_transactions_insert_own on public.wallet_transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists wallet_transactions_update_own on public.wallet_transactions;
create policy wallet_transactions_update_own on public.wallet_transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists wallet_transactions_delete_own on public.wallet_transactions;
create policy wallet_transactions_delete_own on public.wallet_transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.wallet_transactions_set_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists wallet_transactions_updated_at on public.wallet_transactions;
create trigger wallet_transactions_updated_at
before update on public.wallet_transactions
for each row execute function public.wallet_transactions_set_updated_at();

commit;
