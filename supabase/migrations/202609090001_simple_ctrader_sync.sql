-- Simple cTrader sync: identity only, no sync-state or token changes.
-- Run in Supabase SQL Editor before deploying the updated kalendar function.
-- Existing rows remain unchanged and are NOT automatically matched to cTrader.
begin;

alter table public.trades
  add column if not exists ctrader_account_id uuid,
  add column if not exists ctrader_deal_id text;

-- The composite FK prevents a trade from referencing another user's account.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ctrader_accounts'::regclass
      and conname = 'ctrader_accounts_user_id_id_key'
  ) then
    alter table public.ctrader_accounts
      add constraint ctrader_accounts_user_id_id_key unique (user_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.trades'::regclass
      and conname = 'trades_ctrader_account_owner_fkey'
  ) then
    alter table public.trades
      add constraint trades_ctrader_account_owner_fkey
      foreign key (user_id, ctrader_account_id)
      references public.ctrader_accounts (user_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.trades'::regclass
      and conname = 'trades_ctrader_identity_check'
  ) then
    alter table public.trades
      add constraint trades_ctrader_identity_check check (
        (ctrader_account_id is null and ctrader_deal_id is null)
        or (ctrader_account_id is not null and ctrader_deal_id is not null
            and length(trim(ctrader_deal_id)) > 0 and platform = 'cTrader')
      );
  end if;
end;
$$;

-- Full unique index also supports PostgREST onConflict with ignoreDuplicates.
-- NULL identity on manual/legacy rows does not make those rows conflict.
create unique index if not exists trades_ctrader_deal_unique
  on public.trades (user_id, ctrader_account_id, ctrader_deal_id);

commit;

-- Backend contract:
-- ctrader_account_id is public.ctrader_accounts.id, NOT the broker account ID.
-- ctrader_deal_id is the original dealId as a lossless decimal string.
-- Insert with onConflict: 'user_id,ctrader_account_id,ctrader_deal_id'
-- and ignoreDuplicates: true. Do not overwrite existing trades on conflict.
-- Re-importing a deleted trade recreates it intentionally in this simple version.
