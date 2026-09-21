-- The original Web Push table required amount and currency to be both null or
-- both present. Finance plans intentionally allow a currency-only placeholder
-- until the user confirms the real amount, so remove that legacy constraint.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.reminders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%amount is null%'
      and pg_get_constraintdef(oid) ilike '%currency is null%'
  loop
    execute format('alter table public.reminders drop constraint if exists %I', constraint_row.conname);
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reminders'::regclass
      and conname = 'reminders_amount_currency_format'
  ) then
    alter table public.reminders
      add constraint reminders_amount_currency_format
      check (amount is null or (amount >= 0 and currency ~ '^[A-Z]{3}$'));
  end if;
end;
$$;
