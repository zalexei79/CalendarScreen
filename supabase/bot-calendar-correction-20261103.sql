begin;
do $$ declare matches integer; begin
  select count(*) into matches from public.bot_calendar_deals where calendar_slug='bot' and date_key='2026-11-03'
    and ((pnl=-136.24 and direction='SHORT' and time>='15:06' and time<'15:07')
      or (pnl=-20.20 and direction='LONG' and time>='17:27' and time<'17:28'));
  if matches<>2 then raise exception 'Expected exactly the two owner-selected deals'; end if;
  insert into public.bot_calendar_adjustments(calendar_slug,deal_id,reason)
    select calendar_slug,deal_id,'Корректировка владельца: ошибка настройки cBot'
    from public.bot_calendar_deals where calendar_slug='bot' and date_key='2026-11-03'
    and ((pnl=-136.24 and direction='SHORT' and time>='15:06' and time<'15:07')
      or (pnl=-20.20 and direction='LONG' and time>='17:27' and time<'17:28'))
    on conflict(calendar_slug,deal_id) do nothing;
end $$;
commit;
