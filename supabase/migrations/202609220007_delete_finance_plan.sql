-- A plan must only disappear from the UI after the server has actually cancelled it.
create or replace function public.dayris_delete_finance_plan(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  affected integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  update public.reminders
  set status = 'cancelled', outcome = 'cancelled', resolved_at = now()
  where id = p_id
    and user_id = auth.uid()
    and status = 'active'
    and outcome = 'planned';

  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'PLAN_NOT_FOUND'; end if;

  update public.reminder_deliveries
  set status = 'cancelled'
  where reminder_id = p_id
    and user_id = auth.uid()
    and status = 'pending';

  return true;
end $$;

revoke all on function public.dayris_delete_finance_plan(uuid) from public, anon, authenticated;
grant execute on function public.dayris_delete_finance_plan(uuid) to authenticated;
