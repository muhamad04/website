-- ---------------------------------------------------------------------------
-- Bilingual teaching resources & assessment platform
-- Migration 1 of 4: core schema
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

-- Enums ---------------------------------------------------------------------

create type public.user_role as enum ('teacher', 'admin', 'student');
create type public.resource_type as enum ('pdf', 'image', 'youtube');
create type public.assessment_type as enum ('quiz', 'exam');
create type public.grading_mode as enum ('automatic', 'manual', 'mixed');
create type public.grading_method as enum ('automatic', 'manual');
create type public.results_visibility as enum ('immediately', 'after_review', 'hidden');
create type public.question_type as enum (
  'multiple_choice',
  'true_false',
  'matching',
  'short_answer',
  'essay',
  'file_upload',
  'rewrite',
  'find_the_mistake'
);
create type public.attempt_status as enum (
  'in_progress',
  'submitted',
  'grading',
  'graded',
  'expired'
);
create type public.manual_review_status as enum ('not_required', 'pending', 'completed');
create type public.sync_status as enum ('pending', 'synced', 'failed', 'skipped');

-- Shared updated_at trigger -------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Grades & classes ----------------------------------------------------------

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description_en text,
  description_ar text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grades_name_en_unique unique (name_en)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades (id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  academic_year text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_grade_name_unique unique (grade_id, name_en, academic_year),
  -- Composite key lets profiles reference a class and its grade together.
  constraint classes_id_grade_unique unique (id, grade_id)
);

-- Profiles mirror auth.users and hold the role / grade assignment. ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'student',
  full_name_en text not null check (length(trim(full_name_en)) between 1 and 120),
  full_name_ar text,
  email text not null,
  username text check (username is null or username ~ '^[A-Za-z0-9._-]{3,40}$'),
  grade_id uuid references public.grades (id) on delete restrict,
  class_id uuid,
  student_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_class_grade_fk
    foreign key (class_id, grade_id)
    references public.classes (id, grade_id)
    on delete set null (class_id),
  constraint profiles_class_requires_grade check (class_id is null or grade_id is not null)
);

create unique index profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;
create index profiles_email_idx on public.profiles (lower(email));
create index profiles_grade_idx on public.profiles (grade_id);
create index profiles_class_idx on public.profiles (class_id);
create index profiles_role_active_idx on public.profiles (role, is_active);

-- Resource taxonomy ---------------------------------------------------------

create table public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description_en text,
  description_ar text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades (id) on delete restrict,
  category_id uuid references public.resource_categories (id) on delete set null,
  type public.resource_type not null,
  title_en text not null,
  title_ar text not null,
  description_en text,
  description_ar text,
  -- Private Supabase Storage object path for PDFs / images.
  storage_path text,
  -- External URL for YouTube videos.
  external_url text,
  thumbnail_url text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_source_check check (
    (type in ('pdf', 'image') and storage_path is not null and external_url is null)
    or
    (type = 'youtube' and external_url is not null and storage_path is null)
  )
);

create unique index resources_storage_path_unique
  on public.resources (storage_path)
  where storage_path is not null;
create index resources_grade_published_idx on public.resources (grade_id, is_published);
create index resources_category_idx on public.resources (category_id);

-- Assessments ---------------------------------------------------------------

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades (id) on delete restrict,
  type public.assessment_type not null,
  title_en text not null,
  title_ar text not null,
  instructions_en text,
  instructions_ar text,
  time_limit_minutes integer not null default 30
    check (time_limit_minutes between 1 and 600),
  results_visibility public.results_visibility not null default 'after_review',
  grading_mode public.grading_mode not null default 'automatic',
  allow_retakes boolean not null default false,
  max_attempts integer not null default 1,
  is_published boolean not null default false,
  available_from timestamptz,
  available_until timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_attempt_rules_check check (
    (allow_retakes = false and max_attempts = 1)
    or
    (allow_retakes = true and max_attempts between 2 and 10)
  ),
  constraint assessments_availability_check check (
    available_from is null
    or available_until is null
    or available_until > available_from
  )
);

create index assessments_grade_published_idx
  on public.assessments (grade_id, is_published);
create index assessments_type_idx on public.assessments (type);

create table public.assessment_sections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  instructions_en text,
  instructions_ar text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deferrable so the teacher can reorder sections inside one transaction.
  constraint assessment_sections_position_unique unique (assessment_id, position)
    deferrable initially deferred
);

create index assessment_sections_assessment_idx
  on public.assessment_sections (assessment_id, position);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.assessment_sections (id) on delete cascade,
  type public.question_type not null,
  prompt_en text not null,
  prompt_ar text,
  help_text_en text,
  help_text_ar text,
  marks numeric(6, 2) not null default 1 check (marks > 0 and marks <= 100),
  is_required boolean not null default true,
  position integer not null default 0 check (position >= 0),
  -- Answer key for objective/text questions, e.g. {"value": true} or
  -- {"accepted": ["answer"], "caseSensitive": false}. Never exposed to students.
  correct_answer jsonb,
  grading_method public.grading_method not null default 'automatic',
  explanation_en text,
  explanation_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_position_unique unique (section_id, position)
    deferrable initially deferred
);

create index questions_section_idx on public.questions (section_id, position);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null,
  text_en text not null,
  text_ar text,
  is_correct boolean not null default false,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_options_position_unique unique (question_id, position)
    deferrable initially deferred,
  constraint question_options_label_unique unique (question_id, label)
);

create index question_options_question_idx
  on public.question_options (question_id, position);

create table public.matching_pairs (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  left_text_en text not null,
  left_text_ar text,
  right_text_en text not null,
  right_text_ar text,
  -- Opaque key returned to students with the shuffled right-hand items.
  right_key uuid not null default gen_random_uuid(),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matching_pairs_position_unique unique (question_id, position)
    deferrable initially deferred,
  constraint matching_pairs_right_key_unique unique (question_id, right_key)
);

create index matching_pairs_question_idx
  on public.matching_pairs (question_id, position);

-- Attempts & grading --------------------------------------------------------

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number > 0),
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score numeric(7, 2) check (score >= 0),
  max_score numeric(7, 2) check (max_score > 0),
  percentage numeric(5, 2) check (percentage between 0 and 100),
  manual_review_status public.manual_review_status not null default 'not_required',
  last_saved_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attempts_number_unique unique (assessment_id, student_id, attempt_number),
  constraint attempts_time_check check (expires_at > started_at),
  constraint attempts_submission_check check (
    submitted_at is null or submitted_at >= started_at
  )
);

create index attempts_student_idx on public.attempts (student_id, created_at desc);
create index attempts_assessment_idx on public.attempts (assessment_id, submitted_at desc);
create index attempts_status_idx on public.attempts (status, submitted_at desc);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  -- Structured response: {"selectedOptionId": "..."}, {"text": "..."},
  -- {"pairs": {"<left pair id>": "<right key>"}}, etc.
  response jsonb not null default '{}'::jsonb,
  file_path text,
  marks_awarded numeric(6, 2) check (marks_awarded >= 0),
  is_correct boolean,
  feedback_en text,
  feedback_ar text,
  graded_by uuid references public.profiles (id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint answers_attempt_question_unique unique (attempt_id, question_id)
);

create index answers_attempt_idx on public.answers (attempt_id);
create index answers_question_idx on public.answers (question_id);

create table public.manual_grades (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null unique references public.answers (id) on delete cascade,
  reviewer_id uuid references public.profiles (id) on delete set null,
  score numeric(6, 2) not null check (score >= 0),
  max_score numeric(6, 2) not null check (max_score > 0),
  feedback_en text,
  feedback_ar text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Named distinctly from the inline checks above; Postgres auto-names those
  -- manual_grades_score_check / manual_grades_max_score_check.
  constraint manual_grades_score_within_max_check check (score <= max_score)
);

create index manual_grades_reviewer_idx on public.manual_grades (reviewer_id);

-- Google Sheets reporting ---------------------------------------------------

create table public.google_sheet_sync_logs (
  id uuid primary key default gen_random_uuid(),
  -- One row per attempt guarantees idempotent retries.
  attempt_id uuid not null unique references public.attempts (id) on delete cascade,
  status public.sync_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  spreadsheet_id text,
  sheet_name text,
  row_reference text,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  last_attempted_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index google_sheet_sync_logs_status_idx
  on public.google_sheet_sync_logs (status, updated_at desc);

-- updated_at triggers -------------------------------------------------------

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'grades', 'classes', 'profiles', 'resource_categories', 'resources',
    'assessments', 'assessment_sections', 'questions', 'question_options',
    'matching_pairs', 'attempts', 'answers', 'manual_grades',
    'google_sheet_sync_logs'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function public.set_updated_at()',
      target_table || '_set_updated_at',
      target_table
    );
  end loop;
end;
$$;

-- Keep profiles in sync with new Supabase Auth users ------------------------

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

  insert into public.profiles (
    id, role, full_name_en, full_name_ar, email, username,
    grade_id, class_id, student_number, is_active
  )
  values (
    new.id,
    selected_role,
    coalesce(nullif(trim(user_meta ->> 'full_name_en'), ''), split_part(coalesce(new.email, 'student'), '@', 1)),
    nullif(trim(user_meta ->> 'full_name_ar'), ''),
    coalesce(new.email, ''),
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = coalesce(new.email, profiles.email)
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_updated();

comment on table public.profiles is
  'Application profile for each Supabase Auth user. Role and grade live here, never in client-controlled metadata.';
comment on table public.questions is
  'Answer keys stay server-side. Students read a sanitized payload through public.get_student_assessment_payload().';
comment on table public.google_sheet_sync_logs is
  'Idempotency ledger for Google Sheets export. One row per attempt.';
