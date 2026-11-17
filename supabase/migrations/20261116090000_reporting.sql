-- ---------------------------------------------------------------------------
-- Phase 4: dashboards and Google Sheets reporting
-- ---------------------------------------------------------------------------
-- Adds the small amount of database state the reporting layer needs:
--
--   1. public.is_admin() so admin-only surfaces do not rely on UI checks.
--   2. public.reporting_settings: one non-secret row (sync on/off, mock mode,
--      sheet tab name). Credentials stay in server environment variables and
--      are never stored in the database.
--   3. public.reporting_admin_events: append-only audit trail for manual sync,
--      retries and configuration changes.
--
-- Existing resource/assessment tables, policies, RPCs and triggers are not
-- touched. google_sheet_sync_logs already exists with a teacher-read policy
-- and a unique attempt_id, which the sync service uses for idempotency.

-- 1. Admin helper ------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

comment on function public.is_admin() is
  'True when the signed-in user is an active administrator.';

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- 2. Reporting settings ------------------------------------------------------
-- A single row (id = 1). No credentials: the service account email, private
-- key and spreadsheet ID live only in server environment variables.

create table public.reporting_settings (
  id smallint primary key default 1 check (id = 1),
  sync_enabled boolean not null default true,
  mock_mode boolean not null default true,
  sheet_name text not null default 'Results'
    check (length(btrim(sheet_name)) between 1 and 100),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.reporting_settings (id) values (1);

alter table public.reporting_settings enable row level security;

create policy reporting_settings_admin_read on public.reporting_settings
  for select to authenticated
  using (public.is_admin());

create policy reporting_settings_admin_update on public.reporting_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert or delete policy: the singleton row is created above, and the
-- service role (which bypasses RLS) is the only writer outside the admin form.

create trigger reporting_settings_set_updated_at
  before update on public.reporting_settings
  for each row execute function public.set_updated_at();

comment on table public.reporting_settings is
  'One row of non-secret reporting switches. Google credentials are environment variables only.';

-- 3. Reporting audit log -----------------------------------------------------

create table public.reporting_admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (
    action in (
      'sync_manual',
      'sync_retry',
      'settings_updated',
      'connectivity_checked'
    )
  ),
  -- Deliberately no foreign key: history must survive attempt deletion.
  attempt_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index reporting_admin_events_created_idx
  on public.reporting_admin_events (created_at desc);
create index reporting_admin_events_actor_idx
  on public.reporting_admin_events (actor_id, created_at desc);

alter table public.reporting_admin_events enable row level security;

create policy reporting_admin_events_staff_read
  on public.reporting_admin_events
  for select to authenticated
  using (public.is_teacher());

create policy reporting_admin_events_staff_insert
  on public.reporting_admin_events
  for insert to authenticated
  with check (
    public.is_teacher()
    and actor_id = (select auth.uid())
  );

-- No update or delete policy: the log is append-only.
comment on table public.reporting_admin_events is
  'Append-only audit trail for Google Sheets sync, retries and reporting settings.';

comment on column public.google_sheet_sync_logs.payload is
  'Frozen row snapshot used for idempotent retries; never contains essay answers or files.';
