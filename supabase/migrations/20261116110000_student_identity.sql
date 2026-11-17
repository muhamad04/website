-- ---------------------------------------------------------------------------
-- Migration 12: Student ID identity refactor
-- ---------------------------------------------------------------------------
-- Students sign in with a globally unique Student ID plus password. Supabase
-- Auth still needs an e-mail-shaped identifier, so the application derives a
-- private address (`student-<normalised-id>@accounts.internal`) on the server.
-- That address is never stored in public.profiles and never shown to anyone.
--
-- Additive and non-destructive:
--   * student contact e-mail becomes optional;
--   * Student IDs become required, format-checked and globally unique;
--   * a generated normalised column supports login lookups and duplicates;
--   * existing Auth/profile rows, foreign keys and RLS policies are untouched;
--   * the audit constraint is widened only, so history remains valid.
-- ---------------------------------------------------------------------------

-- 1. Contact e-mail is optional for students, but can never be blank ----------
alter table public.profiles
  alter column email drop not null;

alter table public.profiles
  add constraint profiles_email_not_blank
    check (email is null or length(btrim(email)) > 0),
  -- Defence in depth: the private Auth identity must never be copied here.
  add constraint profiles_email_not_internal
    check (email is null or lower(btrim(email)) not like '%@accounts.internal');

-- 2. Normalised Student ID ----------------------------------------------------
-- Matches src/lib/validation/student-id.ts: trim, then lower-case. The
-- application also applies Unicode NFKC normalisation before writing.
alter table public.profiles
  add column student_number_normalized text
  generated always as (nullif(lower(btrim(student_number)), '')) stored;

comment on column public.profiles.student_number_normalized is
  'Generated lower-case Student ID used for login lookup and global uniqueness.';

-- 3. Student IDs are globally unique, not merely unique inside a grade ---------
drop index if exists public.profiles_grade_student_number_unique;

create unique index profiles_student_number_unique
  on public.profiles (student_number_normalized)
  where student_number_normalized is not null;

-- 4. Required, bounded and e-mail-safe Student ID format ----------------------
alter table public.profiles
  add constraint profiles_student_number_format
    check (
      student_number is null
      or (
        char_length(student_number) between 2 and 40
        and student_number ~ '^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$'
        and student_number !~ '\.\.'
      )
    ),
  add constraint profiles_student_number_required
    check (role <> 'student' or student_number_normalized is not null);

-- 5. Keep the Auth trigger in sync with the new identity model ----------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Authorization fields come only from app_metadata, which users cannot
  -- edit. user_metadata is used solely for display names and usernames.
  app_meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  user_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  selected_role public.user_role := 'student';
  selected_grade uuid;
  selected_class uuid;
  selected_contact_email text;
  selected_name text;
begin
  if app_meta ->> 'app_role' in ('teacher', 'admin', 'student') then
    selected_role := (app_meta ->> 'app_role')::public.user_role;
  end if;

  if (app_meta ->> 'grade_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    selected_grade := (app_meta ->> 'grade_id')::uuid;
  end if;

  if (app_meta ->> 'class_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    selected_class := (app_meta ->> 'class_id')::uuid;
  end if;

  if selected_role = 'student' then
    -- The student's contact e-mail is optional and separate from the private
    -- Auth address. Never fall back to an @accounts.internal address.
    selected_contact_email := nullif(
      btrim(coalesce(app_meta ->> 'contact_email', user_meta ->> 'contact_email', '')),
      ''
    );

    if selected_contact_email is null
      and new.email is not null
      and lower(new.email) not like '%@accounts.internal' then
      selected_contact_email := nullif(btrim(new.email), '');
    end if;

    selected_name := coalesce(
      nullif(trim(user_meta ->> 'full_name_en'), ''),
      'Student'
    );
  else
    selected_contact_email := nullif(btrim(coalesce(new.email, '')), '');
    selected_name := coalesce(
      nullif(trim(user_meta ->> 'full_name_en'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    );
  end if;

  insert into public.profiles (
    id, role, full_name_en, full_name_ar, email, username,
    grade_id, class_id, student_number, is_active
  )
  values (
    new.id,
    selected_role,
    selected_name,
    nullif(trim(user_meta ->> 'full_name_ar'), ''),
    selected_contact_email,
    nullif(trim(user_meta ->> 'username'), ''),
    selected_grade,
    selected_class,
    nullif(trim(app_meta ->> 'student_number'), ''),
    coalesce((app_meta ->> 'is_active')::boolean, true)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 6. Auth e-mail changes only mirror staff profiles ---------------------------
-- When a teacher changes a student ID, the private Auth address changes too.
-- That must never overwrite the student's optional contact e-mail.
create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = nullif(btrim(coalesce(new.email, '')), '')
  where id = new.id
    and role <> 'student';

  return new;
end;
$$;

-- 7. Audit new identity events without invalidating existing history ----------
alter table public.student_admin_events
  drop constraint if exists student_admin_events_action_check;

alter table public.student_admin_events
  add constraint student_admin_events_action_check
  check (
    action in (
      'created',
      'invited',
      'invite_resent',
      'access_reset',
      'password_reset',
      'student_id_changed',
      'updated',
      'activated',
      'deactivated'
    )
  );
