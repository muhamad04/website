-- ---------------------------------------------------------------------------
-- Migration 14: explicit NULL handling in the auth trigger guard
-- ---------------------------------------------------------------------------
-- `not (null in (...))` evaluates to NULL, which PL/pgSQL treats as false, so
-- migration 13's guard fell through when app_role was absent and inserted a
-- NULL role. Make the missing-role case unambiguous.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app_meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  user_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  meta_role text := app_meta ->> 'app_role';
  selected_role public.user_role;
  selected_grade uuid;
  selected_class uuid;
  selected_contact_email text;
  selected_name text;
begin
  -- GoTrue's admin create-user endpoint persists app_metadata only after the
  -- insert, so this trigger usually sees no role there. Skipping is safe: the
  -- caller's service-role provisioning upserts the profile immediately, and
  -- unprovisioned users simply have no profile (they land on /account-pending).
  if meta_role is null
    or meta_role not in ('teacher', 'admin', 'student') then
    return new;
  end if;

  selected_role := meta_role::public.user_role;

  if (app_meta ->> 'grade_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    selected_grade := (app_meta ->> 'grade_id')::uuid;
  end if;

  if (app_meta ->> 'class_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    selected_class := (app_meta ->> 'class_id')::uuid;
  end if;

  if selected_role = 'student' then
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
