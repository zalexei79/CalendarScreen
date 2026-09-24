-- PRO wallet transfers. Transfers move money between the main account and wallet;
-- they are never income, expense, trade or PnL.
begin;

create table if not exists public.wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  from_account text not null check (from_account in ('main','wallet')),
  to_account text not null check (to_account in ('main','wallet')),
  comment text not null default '' check (length(comment) <= 2000),
  created_at timestamptz not null default now(),
  check (from_account <> to_account),
  unique(user_id, id)
);

create index if not exists wallet_transfers_user_date_idx
  on public.wallet_transfers(user_id, date_key desc, id desc);

alter table public.wallet_transfers enable row level security;
revoke all on public.wallet_transfers from public, anon;
grant select, insert, delete on public.wallet_transfers to authenticated;
create policy wallet_transfers_select_own on public.wallet_transfers for select to authenticated using ((select auth.uid()) = user_id);
create policy wallet_transfers_insert_own on public.wallet_transfers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy wallet_transfers_delete_own on public.wallet_transfers for delete to authenticated using ((select auth.uid()) = user_id);

commit;
