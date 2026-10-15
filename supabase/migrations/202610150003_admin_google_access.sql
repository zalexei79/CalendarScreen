begin;

alter table public.site_admins add column google_only boolean not null default true;

-- JWT claims come from Supabase's verified token, never user-editable metadata.
-- Requiring Google as the sole identity also prevents a linked alternate OAuth
-- provider from reusing a Google-created account's initial provider metadata.
create function public.site_admin_session_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.site_admins a join auth.users u on u.id=a.user_id
    where a.user_id=(select auth.uid()) and (
      not a.google_only or (
        u.email_confirmed_at is not null
        and (auth.jwt()->'app_metadata'->>'provider')='google'
        and (auth.jwt()->'amr') @> '[{"method":"oauth"}]'::jsonb
        and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google'
          and lower(i.identity_data->>'email')=lower(u.email))
        and not exists(select 1 from auth.identities i where i.user_id=u.id and i.provider<>'google')
      )
    )
  );
$$;
revoke all on function public.site_admin_session_allowed() from public,anon,authenticated;

create or replace function public.is_site_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.site_admin_session_allowed();
$$;

create or replace function public.site_admin_require(p_write boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.site_admin_session_allowed() or not exists(
    select 1 from public.site_admins where user_id=auth.uid() and can_view_users and (not p_write or can_edit_users)
  ) then raise exception 'User administration permission required' using errcode='42501'; end if;
end;
$$;

create or replace function public.admin_capabilities() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('design',true,'viewUsers',can_view_users,'editUsers',can_view_users and can_edit_users)
    from public.site_admins where user_id=auth.uid() and public.site_admin_session_allowed()),
    '{"design":false,"viewUsers":false,"editUsers":false}'::jsonb);
$$;

revoke all on function public.is_site_admin(),public.admin_capabilities() from public,anon;
grant execute on function public.is_site_admin(),public.admin_capabilities() to authenticated;
revoke all on function public.site_admin_require(boolean) from public,anon,authenticated;
commit;
