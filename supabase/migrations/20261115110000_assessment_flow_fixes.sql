-- ---------------------------------------------------------------------------
-- Phase 3c: assessment flow fixes
-- ---------------------------------------------------------------------------
-- Two defects surfaced by the hosted RLS suite:
--
--   1. finalize_attempt / teacher_grade_attempt assigned a text CASE result to
--      enum columns, so every submission failed with
--      "column \"status\" is of type attempt_status but expression is of type text".
--   2. the answers INSERT policy joined questions and assessment_sections
--      directly. Those tables are teacher-only, so the policy could never be
--      satisfied by a student and saving answers failed with
--      "new row violates row-level security policy for table \"answers\"".
--
-- Fix 1 casts the CASE results explicitly.
-- Fix 2 moves the checks into small security-definer helpers, which is also
-- more consistent with the rest of the schema (attempts/assessments already
-- use public.current_grade_id()/is_teacher()).
--
-- Resource-management behaviour is untouched.

-- 1. Answer write/read helpers ----------------------------------------------

create or replace function public.student_owns_open_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts a
    where a.id = p_attempt_id
      and a.student_id = (select auth.uid())
      and a.status = 'in_progress'
  );
$$;

create or replace function public.student_can_write_answer(
  p_attempt_id uuid,
  p_question_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts a
    join public.assessment_sections s on s.assessment_id = a.assessment_id
    join public.questions q on q.section_id = s.id
    where a.id = p_attempt_id
      and a.student_id = (select auth.uid())
      and a.status = 'in_progress'
      and q.id = p_question_id
  );
$$;

create or replace function public.student_can_read_answers(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts a
    join public.assessments asm on asm.id = a.assessment_id
    where a.id = p_attempt_id
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
  );
$$;

revoke all on function public.student_owns_open_attempt(uuid) from public, anon;
revoke all on function public.student_can_write_answer(uuid, uuid) from public, anon;
revoke all on function public.student_can_read_answers(uuid) from public, anon;

grant execute on function public.student_owns_open_attempt(uuid)
  to authenticated, service_role;
grant execute on function public.student_can_write_answer(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.student_can_read_answers(uuid)
  to authenticated, service_role;

-- 2. Answer policies ---------------------------------------------------------

drop policy if exists answers_student_read_own on public.answers;

create policy answers_student_read_own on public.answers
  for select to authenticated
  using (public.student_can_read_answers(attempt_id));

drop policy if exists answers_student_insert_own on public.answers;

create policy answers_student_insert_own on public.answers
  for insert to authenticated
  with check (public.student_can_write_answer(attempt_id, question_id));

drop policy if exists answers_student_update_own on public.answers;

create policy answers_student_update_own on public.answers
  for update to authenticated
  using (public.student_owns_open_attempt(attempt_id))
  with check (public.student_owns_open_attempt(attempt_id));

-- 3. finalize_attempt with enum casts ---------------------------------------

create or replace function public.finalize_attempt(p_attempt_id uuid, p_results jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_assessment public.assessments%rowtype;
  v_item jsonb;
  v_question_id uuid;
  v_marks numeric(6, 2);
  v_correct boolean;
  v_max_marks numeric(6, 2);
  v_score numeric(7, 2);
  v_max_score numeric(7, 2);
  v_pending boolean;
begin
  if not public.is_privileged() then
    raise exception 'not_authorized';
  end if;

  select * into v_attempt from public.attempts where id = p_attempt_id;
  if not found then
    raise exception 'attempt_not_found';
  end if;

  -- Submitting twice is harmless: return the stored result instead of
  -- recomputing or reopening the attempt.
  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'attempt_id', v_attempt.id,
      'status', v_attempt.status,
      'score', v_attempt.score,
      'max_score', v_attempt.max_score,
      'percentage', v_attempt.percentage,
      'pending_review', v_attempt.status = 'grading'
    );
  end if;

  select * into v_assessment
  from public.assessments
  where id = v_attempt.assessment_id;

  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    raise exception 'invalid_results';
  end if;

  for v_item in select value from jsonb_array_elements(p_results) loop
    v_question_id := (v_item ->> 'question_id')::uuid;
    v_marks := (v_item ->> 'marks_awarded')::numeric;
    v_correct := (v_item ->> 'is_correct')::boolean;

    select q.marks into v_max_marks
    from public.questions q
    join public.assessment_sections s on s.id = q.section_id
    where q.id = v_question_id
      and s.assessment_id = v_attempt.assessment_id;

    if v_max_marks is null then
      raise exception 'question_not_in_attempt';
    end if;

    if v_marks < 0 or v_marks > v_max_marks then
      raise exception 'invalid_marks';
    end if;

    update public.answers
    set marks_awarded = v_marks,
        is_correct = v_correct,
        graded_at = now()
    where attempt_id = p_attempt_id
      and question_id = v_question_id;
  end loop;

  select coalesce(sum(q.marks), 0)::numeric(7, 2)
  into v_max_score
  from public.questions q
  join public.assessment_sections s on s.id = q.section_id
  where s.assessment_id = v_attempt.assessment_id;

  if v_max_score <= 0 then
    raise exception 'assessment_has_no_marks';
  end if;

  select coalesce(sum(a.marks_awarded), 0)::numeric(7, 2)
  into v_score
  from public.answers a
  where a.attempt_id = p_attempt_id;

  -- Only answered questions can await a human. A skipped manual question is
  -- worth zero and must not keep the attempt in 'grading' forever.
  select exists (
    select 1
    from public.questions q
    join public.assessment_sections s on s.id = q.section_id
    where s.assessment_id = v_attempt.assessment_id
      and (q.grading_method = 'manual' or v_assessment.grading_mode = 'manual')
      and exists (
        select 1
        from public.answers a
        where a.attempt_id = p_attempt_id
          and a.question_id = q.id
      )
      and not exists (
        select 1
        from public.answers a
        where a.attempt_id = p_attempt_id
          and a.question_id = q.id
          and a.marks_awarded is not null
      )
  )
  into v_pending;

  update public.attempts
  set status = (case when v_pending then 'grading' else 'graded' end)::public.attempt_status,
      manual_review_status = (case when v_pending then 'pending' else 'not_required' end)::public.manual_review_status,
      submitted_at = coalesce(submitted_at, now()),
      score = v_score,
      max_score = v_max_score,
      percentage = round((v_score / v_max_score) * 100, 2),
      graded_at = case when v_pending then null else now() end,
      graded_by = case when v_pending then null else (select auth.uid()) end
  where id = p_attempt_id;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'status', case when v_pending then 'grading' else 'graded' end,
    'score', v_score,
    'max_score', v_max_score,
    'percentage', round((v_score / v_max_score) * 100, 2),
    'pending_review', v_pending
  );
end;
$$;

-- 4. teacher_grade_attempt with enum casts ----------------------------------

create or replace function public.teacher_grade_attempt(p_attempt_id uuid, p_grades jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_attempt public.attempts%rowtype;
  v_assessment public.assessments%rowtype;
  v_item jsonb;
  v_answer_id uuid;
  v_marks numeric(6, 2);
  v_max_marks numeric(6, 2);
  v_score numeric(7, 2);
  v_max_score numeric(7, 2);
  v_pending boolean;
begin
  if not public.is_teacher() then
    raise exception 'not_authorized';
  end if;

  select * into v_attempt from public.attempts where id = p_attempt_id;
  if not found then
    raise exception 'attempt_not_found';
  end if;

  if v_attempt.status not in ('grading', 'graded') then
    raise exception 'attempt_not_submitted';
  end if;

  select * into v_assessment
  from public.assessments
  where id = v_attempt.assessment_id;

  if p_grades is null or jsonb_typeof(p_grades) <> 'array' then
    raise exception 'invalid_results';
  end if;

  for v_item in select value from jsonb_array_elements(p_grades) loop
    v_answer_id := (v_item ->> 'answer_id')::uuid;
    v_marks := (v_item ->> 'marks_awarded')::numeric;

    select q.marks into v_max_marks
    from public.answers a
    join public.questions q on q.id = a.question_id
    where a.id = v_answer_id
      and a.attempt_id = p_attempt_id;

    if v_max_marks is null then
      raise exception 'answer_not_in_attempt';
    end if;

    if v_marks < 0 or v_marks > v_max_marks then
      raise exception 'invalid_marks';
    end if;

    update public.answers
    set marks_awarded = v_marks,
        feedback_en = nullif(v_item ->> 'feedback_en', ''),
        feedback_ar = nullif(v_item ->> 'feedback_ar', ''),
        is_correct = case
          when v_marks >= v_max_marks then true
          when v_marks = 0 then false
          else null
        end,
        graded_by = v_uid,
        graded_at = now()
    where id = v_answer_id;
  end loop;

  select coalesce(sum(q.marks), 0)::numeric(7, 2)
  into v_max_score
  from public.questions q
  join public.assessment_sections s on s.id = q.section_id
  where s.assessment_id = v_attempt.assessment_id;

  if v_max_score <= 0 then
    raise exception 'assessment_has_no_marks';
  end if;

  select coalesce(sum(a.marks_awarded), 0)::numeric(7, 2)
  into v_score
  from public.answers a
  where a.attempt_id = p_attempt_id;

  select exists (
    select 1
    from public.questions q
    join public.assessment_sections s on s.id = q.section_id
    where s.assessment_id = v_attempt.assessment_id
      and (q.grading_method = 'manual' or v_assessment.grading_mode = 'manual')
      and exists (
        select 1
        from public.answers a
        where a.attempt_id = p_attempt_id
          and a.question_id = q.id
      )
      and not exists (
        select 1
        from public.answers a
        where a.attempt_id = p_attempt_id
          and a.question_id = q.id
          and a.marks_awarded is not null
      )
  )
  into v_pending;

  update public.attempts
  set status = (case when v_pending then 'grading' else 'graded' end)::public.attempt_status,
      manual_review_status = (case when v_pending then 'pending' else 'completed' end)::public.manual_review_status,
      submitted_at = coalesce(submitted_at, now()),
      score = v_score,
      max_score = v_max_score,
      percentage = round((v_score / v_max_score) * 100, 2),
      graded_at = case when v_pending then null else now() end,
      graded_by = case when v_pending then null else v_uid end
  where id = p_attempt_id;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'status', case when v_pending then 'grading' else 'graded' end,
    'score', v_score,
    'max_score', v_max_score,
    'percentage', round((v_score / v_max_score) * 100, 2),
    'pending_review', v_pending
  );
end;
$$;

-- 5. Permissions -------------------------------------------------------------

revoke all on function public.finalize_attempt(uuid, jsonb) from public, anon;
revoke all on function public.teacher_grade_attempt(uuid, jsonb) from public, anon;

grant execute on function public.finalize_attempt(uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.teacher_grade_attempt(uuid, jsonb)
  to authenticated, service_role;

comment on function public.student_can_write_answer(uuid, uuid) is
  'True when the signed-in student owns an open attempt that contains the question.';
comment on function public.student_can_read_answers(uuid) is
  'Answers are readable for own open attempts, or when results_visibility allows them.';
