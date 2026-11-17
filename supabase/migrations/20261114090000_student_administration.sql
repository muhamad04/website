-- ---------------------------------------------------------------------------
-- Migration 5: teacher-managed student & class administration (Phase 2)
-- ---------------------------------------------------------------------------
-- Additive only: no table, column or policy from Phase 1 is removed, and no
-- student-facing policy is widened. Grade isolation is untouched.
-- ---------------------------------------------------------------------------

-- 1. Provisioning state ------------------------------------------------------
-- Lets the teacher list show when access was last issued without reading
-- auth.users from the client.
alter table public.profiles
  add column invitation_sent_at timestamptz,
  add column access_reset_at timestamptz;

comment on column public.profiles.invitation_sent_at is
  'Last time a teacher issued an activation link or invite email for this student.';
comment on column public.profiles.access_reset_at is
  'Last time a teacher issued a password recovery link or temporary password.';

-- 2. Student numbers are unique inside a grade -------------------------------
-- Partial index so students without a number, or without a grade, do not clash.
create unique index profiles_grade_student_number_unique
  on public.profiles (grade_id, lower(student_number))
  where student_number is not null and grade_id is not null;

-- 3. Audit trail -------------------------------------------------------------
create table public.student_admin_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (
    action in (
      'created',
      'invited',
      'invite_resent',
      'access_reset',
      'updated',
      'activated',
      'deactivated'
    )
  ),
  -- Non-sensitive summary only; never store passwords or tokens here.
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index student_admin_events_student_idx
  on public.student_admin_events (student_id, created_at desc);

alter table public.student_admin_events enable row level security;

create policy student_admin_events_staff_read on public.student_admin_events
  for select to authenticated
  using (public.is_teacher());

create policy student_admin_events_staff_insert on public.student_admin_events
  for insert to authenticated
  with check (public.is_teacher() and actor_id = (select auth.uid()));

comment on table public.student_admin_events is
  'Append-only audit log for student administration. Intentionally has no update or delete policy.';

-- 4. Privilege guard ---------------------------------------------------------
-- A teacher may administer student profiles, but may not change any role and
-- may not touch teacher/admin profiles. Only admins (and service-role jobs) can.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  actor_is_admin boolean;
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

  if old.role is distinct from new.role and not actor_is_admin then
    raise exception 'profile_role_change_forbidden' using errcode = '42501';
  end if;

  if old.role in ('teacher', 'admin') and not actor_is_admin then
    raise exception 'profile_staff_update_forbidden' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

comment on function public.protect_profile_privileges() is
  'Stops non-admin staff from changing roles or editing staff profiles.';

-- 5. Convenience for the administration list ---------------------------------
-- Search covers English/Arabic names, email and student number. A plain btree
-- index still helps the common "order by name" scan.
create index if not exists profiles_role_name_idx
  on public.profiles (role, full_name_en);
