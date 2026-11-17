-- ---------------------------------------------------------------------------
-- Migration 15: admin-only staff management
-- ---------------------------------------------------------------------------
-- Adds the append-only staff audit trail and the database guards that keep the
-- admin-only staff surface safe even if a request bypasses the UI:
--
--   1. public.staff_admin_events: admin-only, append-only audit history.
--   2. public.protect_staff_privileges(): rejects self-demotion,
--      self-deactivation and removal of the last active administrator.
--
-- Existing student, resource, assessment, grading, storage, reporting and RLS
-- behaviour is untouched. The existing protect_profile_privileges() trigger
-- still owns the "only admins may edit staff profiles" rule; this migration
-- adds the last-admin and self-protection rules on top of it.
-- ---------------------------------------------------------------------------

-- 1. Staff audit trail -------------------------------------------------------

create table public.staff_admin_events (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (
    action in (
      'created',
      'updated',
      'role_changed',
      'activated',
      'deactivated',
      'access_reset'
    )
  ),
  -- Non-sensitive summary only. Never store passwords, tokens or links here.
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index staff_admin_events_staff_idx
  on public.staff_admin_events (staff_id, created_at desc);

create index staff_admin_events_created_idx
  on public.staff_admin_events (created_at desc);

alter table public.staff_admin_events enable row level security;

create policy staff_admin_events_admin_read on public.staff_admin_events
  for select to authenticated
  using (public.is_admin());

create policy staff_admin_events_admin_insert on public.staff_admin_events
  for insert to authenticated
  with check (public.is_admin() and actor_id = (select auth.uid()));

-- Append-only is enforced by the absence of update/delete policies. These
-- revokes add a second layer so an accidental future policy cannot widen it.
revoke all on public.staff_admin_events from anon;
revoke update, delete on public.staff_admin_events from authenticated;
grant select, insert on public.staff_admin_events to authenticated;

comment on table public.staff_admin_events is
  'Append-only audit log for staff administration. Only active admins may read or append. Intentionally has no update or delete policy.';

-- 2. Last-admin and self-protection ------------------------------------------

create or replace function public.protect_staff_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  actor_is_admin boolean;
  other_active_admins integer;
begin
  -- Service role, migrations and definer-context auth triggers (no end user).
  if actor is null or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = actor and p.role = 'admin' and p.is_active
  )
  into actor_is_admin;

  -- Defensive duplicate of protect_profile_privileges(): teachers must never
  -- create, promote or edit staff accounts through any path.
  if not actor_is_admin and (
    old.role in ('teacher', 'admin') or new.role in ('teacher', 'admin')
  ) then
    raise exception 'profile_staff_update_forbidden' using errcode = '42501';
  end if;

  if old.role = 'admin' and old.is_active then
    if new.role is distinct from 'admin' or new.is_active is false then
      -- An administrator can never demote or deactivate their own account.
      if actor = old.id then
        raise exception 'profile_self_admin_change_forbidden'
          using errcode = '42501';
      end if;

      -- Never remove the final active administrator.
      select count(*)
      into other_active_admins
      from public.profiles p
      where p.role = 'admin'
        and p.is_active
        and p.id <> old.id;

      if other_active_admins = 0 then
        raise exception 'last_admin_protected' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_protect_staff
  before update on public.profiles
  for each row execute function public.protect_staff_privileges();

comment on function public.protect_staff_privileges() is
  'Prevents staff self-promotion, admin self-demotion/deactivation and removal of the last active administrator.';
