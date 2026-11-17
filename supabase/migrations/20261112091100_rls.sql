-- ---------------------------------------------------------------------------
-- Migration 2 of 4: access helpers, row level security, integrity triggers
-- ---------------------------------------------------------------------------

-- Security-definer helpers avoid recursive RLS checks on public.profiles. ----

create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and is_active = true;
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('teacher', 'admin'), false);
$$;

create or replace function public.current_grade_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select grade_id
  from public.profiles
  where id = (select auth.uid())
    and is_active = true
    and role = 'student';
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active = true
  );
$$;

-- Service-role and teacher requests may write grading fields. --------------

create or replace function public.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_teacher() or coalesce(auth.role(), '') = 'service_role';
$$;

-- Enable RLS ----------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.grades enable row level security;
alter table public.classes enable row level security;
alter table public.resource_categories enable row level security;
alter table public.resources enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_sections enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.matching_pairs enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;
alter table public.manual_grades enable row level security;
alter table public.google_sheet_sync_logs enable row level security;

-- Profiles ------------------------------------------------------------------

create policy profiles_teacher_all on public.profiles
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Grades --------------------------------------------------------------------

create policy grades_teacher_all on public.grades
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy grades_student_read_own on public.grades
  for select to authenticated
  using (id = public.current_grade_id());

-- Classes -------------------------------------------------------------------

create policy classes_teacher_all on public.classes
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy classes_student_read_own_grade on public.classes
  for select to authenticated
  using (grade_id = public.current_grade_id());

-- Resource categories -------------------------------------------------------

create policy resource_categories_teacher_all on public.resource_categories
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- Categories only contain names/slugs; they are shared across grades.
create policy resource_categories_student_read on public.resource_categories
  for select to authenticated
  using (is_active = true and public.current_grade_id() is not null);

-- Resources -----------------------------------------------------------------

create policy resources_teacher_all on public.resources
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy resources_student_read_published on public.resources
  for select to authenticated
  using (
    is_published = true
    and grade_id = public.current_grade_id()
  );

-- Assessments ---------------------------------------------------------------

create policy assessments_teacher_all on public.assessments
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy assessments_student_read_published on public.assessments
  for select to authenticated
  using (
    is_published = true
    and grade_id = public.current_grade_id()
  );

-- Sections, questions, options and pairs are teacher-only through the API.
-- Students receive a sanitized payload from a security-definer function.

create policy assessment_sections_teacher_all on public.assessment_sections
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy questions_teacher_all on public.questions
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy question_options_teacher_all on public.question_options
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy matching_pairs_teacher_all on public.matching_pairs
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- Attempts ------------------------------------------------------------------

create policy attempts_teacher_all on public.attempts
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy attempts_student_read_own on public.attempts
  for select to authenticated
  using (student_id = (select auth.uid()));

create policy attempts_student_insert_own on public.attempts
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'in_progress'
    and exists (
      select 1
      from public.assessments a
      where a.id = assessment_id
        and a.is_published = true
        and a.grade_id = public.current_grade_id()
        and (a.available_from is null or now() >= a.available_from)
        and (a.available_until is null or now() <= a.available_until)
    )
  );

create policy attempts_student_update_own on public.attempts
  for update to authenticated
  using (
    student_id = (select auth.uid())
    and status = 'in_progress'
  )
  with check (
    student_id = (select auth.uid())
    and status in ('in_progress', 'submitted')
  );

-- Answers -------------------------------------------------------------------

create policy answers_teacher_all on public.answers
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- While an attempt is open the student can re-read saved answers to resume.
-- After submission, graded answers are readable only when the assessment's
-- results_visibility allows it.
create policy answers_student_read_own on public.answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.attempts a
      join public.assessments asm on asm.id = a.assessment_id
      where a.id = attempt_id
        and a.student_id = (select auth.uid())
        and (
          a.status = 'in_progress'
          or (
            asm.results_visibility = 'immediately'
            and a.status in ('submitted', 'grading', 'graded')
          )
          or (
            asm.results_visibility = 'after_review'
            and a.status = 'graded'
          )
        )
    )
  );

create policy answers_student_insert_own on public.answers
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.attempts a
      join public.assessment_sections s on s.assessment_id = a.assessment_id
      join public.questions q on q.section_id = s.id
      where a.id = attempt_id
        and a.student_id = (select auth.uid())
        and a.status = 'in_progress'
        and q.id = question_id
    )
  );

create policy answers_student_update_own on public.answers
  for update to authenticated
  using (
    exists (
      select 1
      from public.attempts a
      where a.id = attempt_id
        and a.student_id = (select auth.uid())
        and a.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1
      from public.attempts a
      where a.id = attempt_id
        and a.student_id = (select auth.uid())
        and a.status = 'in_progress'
    )
  );

-- Manual grades -------------------------------------------------------------

create policy manual_grades_teacher_all on public.manual_grades
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy manual_grades_student_read_own on public.manual_grades
  for select to authenticated
  using (
    exists (
      select 1
      from public.answers ans
      join public.attempts a on a.id = ans.attempt_id
      join public.assessments asm on asm.id = a.assessment_id
      where ans.id = answer_id
        and a.student_id = (select auth.uid())
        and a.status = 'graded'
        and asm.results_visibility <> 'hidden'
    )
  );

-- Google Sheets sync logs ---------------------------------------------------

create policy google_sheet_sync_logs_teacher_read on public.google_sheet_sync_logs
  for select to authenticated
  using (public.is_teacher());

-- Integrity triggers --------------------------------------------------------
-- RLS controls which rows can be written. These triggers additionally stop
-- students from forging timers, scores or answer keys in the same row.

create or replace function public.protect_attempt_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_time_limit integer;
  v_allow_retakes boolean;
  v_max_attempts integer;
  v_attempt_count integer;
  v_last_number integer;
begin
  if public.is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select time_limit_minutes, allow_retakes, max_attempts
    into v_time_limit, v_allow_retakes, v_max_attempts
    from public.assessments
    where id = new.assessment_id
      and is_published = true
      and grade_id = public.current_grade_id()
      and (available_from is null or now() >= available_from)
      and (available_until is null or now() <= available_until);

    if v_time_limit is null then
      raise exception 'assessment_not_available';
    end if;

    if exists (
      select 1
      from public.attempts
      where assessment_id = new.assessment_id
        and student_id = (select auth.uid())
        and status = 'in_progress'
        and expires_at > now()
    ) then
      raise exception 'attempt_already_in_progress';
    end if;

    select count(*)::integer, coalesce(max(attempt_number), 0)::integer
    into v_attempt_count, v_last_number
    from public.attempts
    where assessment_id = new.assessment_id
      and student_id = (select auth.uid());

    if not v_allow_retakes and v_attempt_count > 0 then
      raise exception 'retakes_not_allowed';
    end if;

    if v_allow_retakes and v_attempt_count >= v_max_attempts then
      raise exception 'max_attempts_reached';
    end if;

    new.student_id := (select auth.uid());
    new.attempt_number := v_last_number + 1;
    new.status := 'in_progress';
    new.started_at := now();
    new.expires_at := now() + make_interval(mins => v_time_limit);
    new.submitted_at := null;
    new.score := null;
    new.max_score := null;
    new.percentage := null;
    new.manual_review_status := 'not_required';
    new.graded_at := null;
    new.graded_by := null;
    return new;
  end if;

  if old.status <> 'in_progress' then
    raise exception 'attempt_already_submitted';
  end if;

  -- The timer is authoritative. Direct student writes stop at expiry; the
  -- Phase 3 server action will finalise expired attempts with the admin client.
  if now() > old.expires_at then
    raise exception 'attempt_expired';
  end if;

  if new.status not in ('in_progress', 'submitted') then
    raise exception 'invalid_attempt_transition';
  end if;

  new.student_id := old.student_id;
  new.assessment_id := old.assessment_id;
  new.attempt_number := old.attempt_number;
  new.started_at := old.started_at;
  new.expires_at := old.expires_at;
  new.score := old.score;
  new.max_score := old.max_score;
  new.percentage := old.percentage;
  new.manual_review_status := old.manual_review_status;
  new.graded_at := old.graded_at;
  new.graded_by := old.graded_by;
  new.submitted_at := case
    when new.status = 'submitted' then coalesce(old.submitted_at, now())
    else null
  end;

  return new;
end;
$$;

create trigger attempts_protect_integrity
  before insert or update on public.attempts
  for each row execute function public.protect_attempt_integrity();

create or replace function public.protect_answer_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
  v_expires_at timestamptz;
begin
  if public.is_privileged() then
    return new;
  end if;

  -- Use the stored attempt id on update so a client cannot point the check at
  -- a different attempt. RLS already requires the parent attempt to be the
  -- student's own and in progress.
  v_attempt_id := case when tg_op = 'UPDATE' then old.attempt_id else new.attempt_id end;

  select expires_at into v_expires_at
  from public.attempts
  where id = v_attempt_id
    and student_id = (select auth.uid())
    and status = 'in_progress';

  if v_expires_at is null then
    raise exception 'attempt_not_writable';
  end if;

  if now() > v_expires_at then
    raise exception 'attempt_expired';
  end if;

  if tg_op = 'INSERT' then
    new.attempt_id := v_attempt_id;
    new.marks_awarded := null;
    new.is_correct := null;
    new.feedback_en := null;
    new.feedback_ar := null;
    new.graded_by := null;
    new.graded_at := null;
    return new;
  end if;

  new.attempt_id := old.attempt_id;
  new.question_id := old.question_id;
  new.marks_awarded := old.marks_awarded;
  new.is_correct := old.is_correct;
  new.feedback_en := old.feedback_en;
  new.feedback_ar := old.feedback_ar;
  new.graded_by := old.graded_by;
  new.graded_at := old.graded_at;

  return new;
end;
$$;

create trigger answers_protect_integrity
  before insert or update on public.answers
  for each row execute function public.protect_answer_integrity();

-- Helpful column comments ---------------------------------------------------

comment on function public.is_teacher() is
  'True for active teacher/admin profiles. Used by RLS policies.';
comment on function public.current_grade_id() is
  'Grade assigned to the active student, or null. Used to scope student reads.';
