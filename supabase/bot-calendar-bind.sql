-- Bind only the unique active connection owned by a DAYRIS administrator.
-- This prevents a duplicate, inactive personal connection from being selected.
do $$
declare account uuid; candidates integer;
begin
  select count(*),(array_agg(a.id))[1] into candidates,account
    from public.ctrader_accounts a
    where a.account_id='47484897' and not a.is_live and a.is_active
      and exists(select 1 from public.site_admins s where s.user_id=a.user_id)
      and exists(select 1 from public.ctrader_tokens t where t.user_id=a.user_id);
  if candidates<>1 then raise exception 'Expected exactly one active administrator connection'; end if;
  update public.bot_calendars set source_account_id=account where slug='bot'
    and broker_account_id='47484897' and not is_live and start_date='2026-10-05'
    and (source_account_id is null or source_account_id=account);
  if not found then raise exception 'Publication missing or bound to a different source'; end if;
end $$;
