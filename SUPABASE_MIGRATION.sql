-- Run once in Supabase SQL Editor ONLY if the trades table does not yet have
-- a currency column. Existing USD rows remain valid.
alter table public.trades
  add column if not exists currency text not null default 'USD';
