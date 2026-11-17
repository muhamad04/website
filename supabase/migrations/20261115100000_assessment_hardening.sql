-- ---------------------------------------------------------------------------
-- Phase 3b: assessment flow hardening
-- ---------------------------------------------------------------------------
-- Small, additive follow-up to 20261115090000_assessment_system.sql:
--   * finalize_attempt becomes idempotent and never re-opens a closed attempt
--   * unanswered manual questions no longer block an attempt forever
--   * manual grading only accepts submitted attempts
--   * section/question reordering happens atomically server-side
--
-- Resource-management behaviour is untouched.

-- 1. Idempotent finalization ------------------------------------------------

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
  set status = case when v_pending then 'grading' else 'graded' end,
      manual_review_status = case when v_pending then 'pending' else 'not_required' end,
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

-- 2. Manual grading ---------------------------------------------------------

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
  set status = case when v_pending then 'grading' else 'graded' end,
      manual_review_status = case when v_pending then 'pending' else 'completed' end,
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

-- 3. Atomic reordering ------------------------------------------------------
-- The position columns are uniquely constrained, so a swap in two browser
-- requests would trip the constraint. These helpers move every row inside one
-- transaction after proving the caller supplied the complete, matching set.

create or replace function public.reorder_assessment_sections(
  p_assessment_id uuid,
  p_section_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_supplied integer;
begin
  if not public.is_teacher() then
    raise exception 'not_authorized';
  end if;

  select count(*)::integer into v_count
  from public.assessment_sections
  where assessment_id = p_assessment_id;

  v_supplied := coalesce(array_length(p_section_ids, 1), 0);

  if v_count = 0 or v_supplied <> v_count then
    raise exception 'invalid_order';
  end if;

  if exists (
    select 1
    from unnest(p_section_ids) as incoming(id)
    where not exists (
      select 1
      from public.assessment_sections s
      where s.id = incoming.id
        and s.assessment_id = p_assessment_id
    )
  ) then
    raise exception 'invalid_order';
  end if;

  if (select count(distinct id) from unnest(p_section_ids) as ids(id)) <> v_supplied then
    raise exception 'invalid_order';
  end if;

  update public.assessment_sections
  set position = position + 100000
  where assessment_id = p_assessment_id;

  update public.assessment_sections s
  set position = ordered.position
  from (
    select id, (ordinality - 1)::integer as position
    from unnest(p_section_ids) with ordinality as ids(id, ordinality)
  ) as ordered
  where s.id = ordered.id
    and s.assessment_id = p_assessment_id;
end;
$$;

create or replace function public.reorder_section_questions(
  p_section_id uuid,
  p_question_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_supplied integer;
begin
  if not public.is_teacher() then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1 from public.assessment_sections where id = p_section_id
  ) then
    raise exception 'invalid_order';
  end if;

  select count(*)::integer into v_count
  from public.questions
  where section_id = p_section_id;

  v_supplied := coalesce(array_length(p_question_ids, 1), 0);

  if v_count = 0 or v_supplied <> v_count then
    raise exception 'invalid_order';
  end if;

  if exists (
    select 1
    from unnest(p_question_ids) as incoming(id)
    where not exists (
      select 1
      from public.questions q
      where q.id = incoming.id
        and q.section_id = p_section_id
    )
  ) then
    raise exception 'invalid_order';
  end if;

  if (select count(distinct id) from unnest(p_question_ids) as ids(id)) <> v_supplied then
    raise exception 'invalid_order';
  end if;

  update public.questions
  set position = position + 100000
  where section_id = p_section_id;

  update public.questions q
  set position = ordered.position
  from (
    select id, (ordinality - 1)::integer as position
    from unnest(p_question_ids) with ordinality as ids(id, ordinality)
  ) as ordered
  where q.id = ordered.id
    and q.section_id = p_section_id;
end;
$$;

-- 4. Permissions ------------------------------------------------------------

revoke all on function public.finalize_attempt(uuid, jsonb) from public, anon;
revoke all on function public.teacher_grade_attempt(uuid, jsonb) from public, anon;
revoke all on function public.reorder_assessment_sections(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_section_questions(uuid, uuid[]) from public, anon;

grant execute on function public.finalize_attempt(uuid, jsonb) to authenticated, service_role;
grant execute on function public.teacher_grade_attempt(uuid, jsonb) to authenticated, service_role;
grant execute on function public.reorder_assessment_sections(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reorder_section_questions(uuid, uuid[]) to authenticated, service_role;

comment on function public.reorder_assessment_sections(uuid, uuid[]) is
  'Moves all sections of an assessment to the supplied order in one transaction. Staff only.';
comment on function public.reorder_section_questions(uuid, uuid[]) is
  'Moves all questions of a section to the supplied order in one transaction. Staff only.';
