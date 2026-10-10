begin;

alter table public.capital_assets
  drop constraint if exists capital_assets_category_check;

alter table public.capital_assets
  add constraint capital_assets_category_check
  check (category in ('stock','etf','crypto','metal','commodity','real_estate','bond','deposit','other'));

commit;
