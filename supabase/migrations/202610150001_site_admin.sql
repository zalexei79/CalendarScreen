begin;

-- Membership can only be managed by a database owner / trusted server.
create table public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from public, anon, authenticated;

create function public.is_site_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.site_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

create table public.site_config_draft (
  id integer primary key check (id = 1),
  config jsonb not null default '{"schema":1,"mobile":{"global":{},"elements":{}},"desktop":{"global":{},"elements":{}}}',
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table public.site_live_config (
  id integer primary key check (id = 1),
  config jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.site_config_releases (
  id bigint generated always as identity primary key,
  config jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null
);
insert into public.site_config_draft(id) values (1);
insert into public.site_live_config(id, config) select id, config from public.site_config_draft;
insert into public.site_config_releases(config) select config from public.site_live_config;

alter table public.site_config_draft enable row level security;
alter table public.site_live_config enable row level security;
alter table public.site_config_releases enable row level security;
revoke all on public.site_config_draft, public.site_live_config, public.site_config_releases from public, anon, authenticated;
grant select on public.site_live_config to anon, authenticated;
grant select on public.site_config_draft, public.site_config_releases to authenticated;
create policy site_live_read on public.site_live_config for select to anon, authenticated using (true);
create policy site_draft_read on public.site_config_draft for select to authenticated using ((select public.is_site_admin()));
create policy site_releases_read on public.site_config_releases for select to authenticated using ((select public.is_site_admin()));

create function public.save_site_config(p_config jsonb, p_version integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare current_version integer;
begin
  if not public.is_site_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_config is null or jsonb_typeof(p_config) is distinct from 'object'
    or (p_config->>'schema') is distinct from '1'
    or jsonb_typeof(p_config->'mobile') is distinct from 'object'
    or jsonb_typeof(p_config->'desktop') is distinct from 'object'
    or octet_length(p_config::text) > 65536 then
    raise exception 'Invalid site configuration';
  end if;
  select version into current_version from public.site_config_draft where id = 1 for update;
  if p_version is distinct from current_version then raise exception 'Configuration changed. Reload the editor.' using errcode = '40001'; end if;
  update public.site_config_draft set config = p_config, version = version + 1, updated_at = now(), updated_by = auth.uid() where id = 1;
  return current_version + 1;
end;
$$;

create function public.publish_site_config(p_version integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare draft public.site_config_draft%rowtype; release_id bigint;
begin
  if not public.is_site_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into draft from public.site_config_draft where id = 1 for update;
  if p_version is distinct from draft.version then raise exception 'Configuration changed. Reload the editor.' using errcode = '40001'; end if;
  insert into public.site_config_releases(config, published_by) values (draft.config, auth.uid()) returning id into release_id;
  update public.site_live_config set config = draft.config, version = version + 1, updated_at = now() where id = 1;
  -- Advancing the draft also detects publishing from another browser/tab.
  update public.site_config_draft set version = version + 1, updated_at = now(), updated_by = auth.uid() where id = 1;
  return draft.version + 1;
end;
$$;
revoke all on function public.save_site_config(jsonb, integer), public.publish_site_config(integer) from public, anon;
grant execute on function public.save_site_config(jsonb, integer), public.publish_site_config(integer) to authenticated;
commit;
