begin;
create table public.mt5_cloud_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_id text,
  transaction_id text not null default replace(gen_random_uuid()::text, '-', ''),
  login text not null,
  server text not null,
  created_at timestamptz not null default now()
);
alter table public.mt5_cloud_connections enable row level security;
-- Access only through the authenticated Edge function. No browser access to provider IDs.
revoke all on public.mt5_cloud_connections from anon, authenticated;
grant all on public.mt5_cloud_connections to service_role;
commit;
