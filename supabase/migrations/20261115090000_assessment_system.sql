-- ---------------------------------------------------------------------------
-- Phase 3a: assessment system
-- ---------------------------------------------------------------------------
-- Adds the append-only assessment audit log, closes the documented
-- hidden-results hole on public.attempts, and introduces the server-side
-- functions used by the teacher builder, the timed student attempt flow and
-- the results screens.
--
-- Nothing here changes resource-management behaviour.

-- 1. Audit log --------------------------------------------------------------

create table public.assessment_admin_events (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately no foreign key: the history must survive assessment deletion.
  assessment_id uuid,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (
    action in (
      'created',
      'updated',
      'published',
      'unpublished',
      'deleted',
      'section_created',
      'section_updated',
      'section_deleted',
      'sections_reordered',
      'question_created',
      'question_updated',
      'question_deleted',
      'questions_reordered',
      'attempt_graded'
    )
  ),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index assessment_admin_events_assessment_idx
  on public.assessment_admin_events (assessment_id, created_at desc);
create index assessment_admin_events_actor_idx
  on public.assessment_admin_events (actor_id, created_at desc);

alter table public.assessment_admin_events enable row level security;

create policy assessment_admin_events_teacher_read
  on public.assessment_admin_events
  for select to authenticated
  using (public.is_teacher());

create policy assessment_admin_events_teacher_insert
  on public.assessment_admin_events
  for insert to authenticated
  with check (public.is_teacher() and actor_id = (select auth.uid()));

-- No update or delete policy: the log is append-only.

comment on table public.assessment_admin_events is
  'Append-only audit log for assessment authoring and grading. Intentionally has no update or delete policy.';

-- 2. Hidden-results fix -----------------------------------------------------
-- RLS can hide rows but not columns, so a student could read score/percentage
-- from their own submitted attempt even when results are hidden. Students now
-- see only their in-progress attempt rows; every post-submission read goes
-- through the sanitized functions below.

drop policy if exists attempts_student_read_own on public.attempts;

create policy attempts_student_read_own_in_progress on public.attempts
  for select to authenticated
  using (
    student_id = (select auth.uid())
    and status = 'in_progress'
  );

create index if not exists attempts_student_assessment_idx
  on public.attempts (student_id, assessment_id, attempt_number desc);

-- 3. Submission file paths --------------------------------------------------
-- Answer file paths must live under the caller's own attempt folder, matching
-- the assessment-submissions storage policy.

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

  if new.file_path is not null
     and new.file_path not like ((select auth.uid())::text || '/' || v_attempt_id::text || '/%') then
    raise exception 'invalid_file_path';
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

-- 4. Student overview -------------------------------------------------------
-- One row per published assessment for the caller's grade, with attempt counts
-- and the last result only when results_visibility allows it.

create or replace function public.student_assessment_overview()
returns table (
  id uuid,
  type public.assessment_type,
  title_en text,
  title_ar text,
  instructions_en text,
  instructions_ar text,
  time_limit_minutes integer,
  results_visibility public.results_visibility,
  grading_mode public.grading_mode,
  allow_retakes boolean,
  max_attempts integer,
  available_from timestamptz,
  available_until timestamptz,
  attempts_used integer,
  in_progress_attempt_id uuid,
  in_progress_expires_at timestamptz,
  last_attempt_id uuid,
  last_attempt_status public.attempt_status,
  last_submitted_at timestamptz,
  last_score numeric,
  last_max_score numeric,
  last_percentage numeric,
  result_visible boolean,
  manual_review_status public.manual_review_status
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_grade uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select p.grade_id into v_grade
  from public.profiles p
  where p.id = v_uid
    and p.role = 'student'
    and p.is_active = true;

  if v_grade is null then
    raise exception 'profile_not_ready';
  end if;

  return query
  select
    a.id,
    a.type,
    a.title_en,
    a.title_ar,
    a.instructions_en,
    a.instructions_ar,
    a.time_limit_minutes,
    a.results_visibility,
    a.grading_mode,
    a.allow_retakes,
    a.max_attempts,
    a.available_from,
    a.available_until,
    coalesce(stats.attempts_used, 0)::integer,
    stats.in_progress_attempt_id,
    stats.in_progress_expires_at,
    last_attempt.id,
    last_attempt.status,
    last_attempt.submitted_at,
    case when visible.result_visible then last_attempt.score end,
    case when visible.result_visible then last_attempt.max_score end,
    case when visible.result_visible then last_attempt.percentage end,
    coalesce(visible.result_visible, false),
    last_attempt.manual_review_status
  from public.assessments a
  left join lateral (
    select
      count(*)::integer as attempts_used,
      (array_agg(t.id order by t.attempt_number desc)
        filter (where t.status = 'in_progress'))[1] as in_progress_attempt_id,
      (array_agg(t.expires_at order by t.attempt_number desc)
        filter (where t.status = 'in_progress'))[1] as in_progress_expires_at
    from public.attempts t
    where t.assessment_id = a.id
      and t.student_id = v_uid
  ) stats on true
  left join lateral (
    select t.id, t.status, t.submitted_at, t.score, t.max_score,
           t.percentage, t.manual_review_status
    from public.attempts t
    where t.assessment_id = a.id
      and t.student_id = v_uid
    order by t.attempt_number desc
    limit 1
  ) last_attempt on true
  cross join lateral (
    select case
      when last_attempt.id is null then false
      when a.results_visibility = 'immediately'
        then last_attempt.status in ('submitted', 'grading', 'graded')
      when a.results_visibility = 'after_review'
        then last_attempt.status = 'graded'
      else false
    end as result_visible
  ) visible
  where a.is_published = true
    and a.grade_id = v_grade
  order by a.created_at desc;
end;
$$;

-- 5. Start (or resume) an attempt ------------------------------------------
-- Retake rules, publication, grade and the availability window are all checked
-- here; the attempts trigger repeats them for direct REST inserts.

create or replace function public.student_start_attempt(p_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_grade uuid;
  v_assessment public.assessments%rowtype;
  v_attempt public.attempts%rowtype;
  v_count integer;
  v_last integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select p.grade_id into v_grade
  from public.profiles p
  where p.id = v_uid
    and p.role = 'student'
    and p.is_active = true;

  if v_grade is null then
    raise exception 'profile_not_ready';
  end if;

  select * into v_assessment
  from public.assessments a
  where a.id = p_assessment_id
    and a.is_published = true
    and a.grade_id = v_grade
    and (a.available_from is null or now() >= a.available_from)
    and (a.available_until is null or now() <= a.available_until);

  if not found then
    raise exception 'assessment_not_available';
  end if;

  select * into v_attempt
  from public.attempts t
  where t.assessment_id = p_assessment_id
    and t.student_id = v_uid
    and t.status = 'in_progress'
  order by t.attempt_number desc
  limit 1;

  if found then
    return jsonb_build_object(
      'attempt_id', v_attempt.id,
      'attempt_number', v_attempt.attempt_number,
      'started_at', v_attempt.started_at,
      'expires_at', v_attempt.expires_at,
      'resumed', true,
      'server_time', now()
    );
  end if;

  select count(*)::integer, coalesce(max(t.attempt_number), 0)::integer
  into v_count, v_last
  from public.attempts t
  where t.assessment_id = p_assessment_id
    and t.student_id = v_uid;

  if not v_assessment.allow_retakes and v_count > 0 then
    raise exception 'retakes_not_allowed';
  end if;

  if v_assessment.allow_retakes and v_count >= v_assessment.max_attempts then
    raise exception 'max_attempts_reached';
  end if;

  insert into public.attempts (
    assessment_id,
    student_id,
    attempt_number,
    status,
    started_at,
    expires_at
  )
  values (
    p_assessment_id,
    v_uid,
    v_last + 1,
    'in_progress',
    now(),
    now() + make_interval(mins => v_assessment.time_limit_minutes)
  )
  returning * into v_attempt;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'attempt_number', v_attempt.attempt_number,
    'started_at', v_attempt.started_at,
    'expires_at', v_attempt.expires_at,
    'resumed', false,
    'server_time', now()
  );
end;
$$;

-- 6. Attempt payload for the runner ----------------------------------------
-- Reuses the sanitized assessment shape and adds the student's saved responses.
-- Only the owning student, and only while the attempt is in progress.

create or replace function public.student_attempt_payload(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_attempt public.attempts%rowtype;
  v_payload jsonb;
  v_saved jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_attempt
  from public.attempts t
  where t.id = p_attempt_id
    and t.student_id = v_uid;

  if not found then
    raise exception 'attempt_not_found';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt_closed';
  end if;

  v_payload := public.get_student_assessment_payload(v_attempt.assessment_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question_id', ans.question_id,
        'response', ans.response,
        'file_path', ans.file_path
      )
    ),
    '[]'::jsonb
  )
  into v_saved
  from public.answers ans
  where ans.attempt_id = p_attempt_id;

  return v_payload || jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'number', v_attempt.attempt_number,
      'started_at', v_attempt.started_at,
      'expires_at', v_attempt.expires_at,
      'submitted_at', v_attempt.submitted_at
    ),
    'answers', v_saved,
    'server_time', now()
  );
end;
$$;

-- 7. Finalize an attempt ----------------------------------------------------
-- Called by trusted server code (service role) after it has computed the
-- automatic marks. Teachers may also call it. Students never receive the keys.

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

  select exists (
    select 1
    from public.questions q
    join public.assessment_sections s on s.id = q.section_id
    where s.assessment_id = v_attempt.assessment_id
      and (q.grading_method = 'manual' or v_assessment.grading_mode = 'manual')
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

-- 8. Manual grading ---------------------------------------------------------

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

-- 9. Student result ---------------------------------------------------------
-- The only post-submission read path. Returns no answer keys, ever.

create or replace function public.student_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_attempt public.attempts%rowtype;
  v_assessment public.assessments%rowtype;
  v_visible boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_attempt
  from public.attempts t
  where t.id = p_attempt_id
    and t.student_id = v_uid;

  if not found then
    raise exception 'attempt_not_found';
  end if;

  select * into v_assessment
  from public.assessments
  where id = v_attempt.assessment_id;

  v_visible := case
    when v_assessment.results_visibility = 'immediately'
      then v_attempt.status in ('submitted', 'grading', 'graded')
    when v_assessment.results_visibility = 'after_review'
      then v_attempt.status = 'graded'
    else false
  end;

  if not v_visible then
    return jsonb_build_object(
      'attempt_id', v_attempt.id,
      'attempt_number', v_attempt.attempt_number,
      'assessment_id', v_assessment.id,
      'title_en', v_assessment.title_en,
      'title_ar', v_assessment.title_ar,
      'type', v_assessment.type,
      'status', v_attempt.status,
      'results_visibility', v_assessment.results_visibility,
      'visible', false,
      'submitted_at', v_attempt.submitted_at,
      'server_time', now()
    );
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'attempt_number', v_attempt.attempt_number,
    'assessment_id', v_assessment.id,
    'title_en', v_assessment.title_en,
    'title_ar', v_assessment.title_ar,
    'type', v_assessment.type,
    'status', v_attempt.status,
    'results_visibility', v_assessment.results_visibility,
    'visible', true,
    'score', v_attempt.score,
    'max_score', v_attempt.max_score,
    'percentage', v_attempt.percentage,
    'manual_review_status', v_attempt.manual_review_status,
    'submitted_at', v_attempt.submitted_at,
    'graded_at', v_attempt.graded_at,
    'server_time', now(),
    'sections', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'title_en', s.title_en,
            'title_ar', s.title_ar,
            'position', s.position,
            'questions', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', q.id,
                    'type', q.type,
                    'prompt_en', q.prompt_en,
                    'prompt_ar', q.prompt_ar,
                    'marks', q.marks,
                    'position', q.position,
                    'grading_method', q.grading_method,
                    'answer', case
                      when a.id is null then null
                      else jsonb_build_object(
                        'response', a.response,
                        'file_path', a.file_path,
                        'marks_awarded', a.marks_awarded,
                        'is_correct', a.is_correct,
                        'feedback_en', a.feedback_en,
                        'feedback_ar', a.feedback_ar
                      )
                    end
                  )
                  order by q.position
                )
                from public.questions q
                left join public.answers a
                  on a.question_id = q.id
                 and a.attempt_id = v_attempt.id
                where q.section_id = s.id
              ),
              '[]'::jsonb
            )
          )
          order by s.position
        )
        from public.assessment_sections s
        where s.assessment_id = v_assessment.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- 10. Permissions -----------------------------------------------------------

revoke all on function public.student_assessment_overview() from public, anon;
revoke all on function public.student_start_attempt(uuid) from public, anon;
revoke all on function public.student_attempt_payload(uuid) from public, anon;
revoke all on function public.student_attempt_result(uuid) from public, anon;
revoke all on function public.finalize_attempt(uuid, jsonb) from public, anon;
revoke all on function public.teacher_grade_attempt(uuid, jsonb) from public, anon;

grant execute on function public.student_assessment_overview() to authenticated, service_role;
grant execute on function public.student_start_attempt(uuid) to authenticated, service_role;
grant execute on function public.student_attempt_payload(uuid) to authenticated, service_role;
grant execute on function public.student_attempt_result(uuid) to authenticated, service_role;
grant execute on function public.finalize_attempt(uuid, jsonb) to authenticated, service_role;
grant execute on function public.teacher_grade_attempt(uuid, jsonb) to authenticated, service_role;

comment on function public.student_attempt_result(uuid) is
  'Visibility-gated, answer-key-free result for the owning student.';
comment on function public.finalize_attempt(uuid, jsonb) is
  'Applies pre-computed automatic marks and finalises the attempt. Service role or staff only.';
