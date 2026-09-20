-- Trades belong directly to Supabase Auth users. Some early deployments
-- created this constraint against a legacy public users table, which makes
-- valid Google-authenticated users fail with SQLSTATE 23503 on insert.
alter table public.trades
  drop constraint if exists trades_user_id_fkey;

alter table public.trades
  add constraint trades_user_id_fkey
  foreign key (user_id)
  references auth.users (id)
  on delete cascade
  not valid;
