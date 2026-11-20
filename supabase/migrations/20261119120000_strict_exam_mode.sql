-- ---------------------------------------------------------------------------
-- Strict Exam Mode
-- ---------------------------------------------------------------------------
-- Additive hardening for timed assessments:
--   * per-assessment strict settings (tab-hidden / navigation / heartbeat)
--   * server-side heartbeat and suspicious-event counters on attempts
--   * an explicit submission reason on every closed attempt
--   * idempotent stale-attempt sweep used by server code and a cron route
--   * optional deterministic question/option randomisation in the student
--     payload
--
-- The server remains authoritative: browser events only tell the server which
-- signal happened, and the server decides whether to close the attempt.
-- Nothing here weakens hidden-result or answer-key isolation.

-- 1. Submission reasons ------------------------------------------------------

create type public.attempt_submission_reason as enum (
  'student_submitted',
  'time_expired',
  'left_assessment',
  'tab_hidden',
  'page_unloaded',
  'heartbeat_expired',
  'connection_lost'
);

-- 2. Assessment strict settings ---------------------------------------------
-- Columns start nullable so a BEFORE trigger can apply the type-aware default
-- (exams strict, quizzes optional) even for direct REST inserts that omit them.

alter table public.assessments
  add column strict_exam_mode boolean,
  add column submit_on_tab_hidden boolean not null default true,
  add column submit_on_navigation boolean not null default true,
  add column heartbeat_timeout_seconds integer not null default 60,
  add column allow_resume_after_connection_loss boolean,
  add column randomize_question_order boolean not null default false,
  add column randomize_option_order boolean not null default false;

update public.assessments
set strict_exam_mode = (type = 'exam'),
    allow_resume_after_connection_loss = (type <> 'exam')
where strict_exam_mode is null
   or allow_resume_after_connection_loss is null;

alter table public.assessments
  alter column strict_exam_mode set not null,
  alter column allow_resume_after_connection_loss set not null,
  add constraint assessments_heartbeat_timeout_check
    check (heartbeat_timeout_seconds between 15 and 600);

create or replace function public.apply_assessment_strict_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.strict_exam_mode is null then
    new.strict_exam_mode := (new.type = 'exam');
  end if;

  if new.allow_resume_after_connection_loss is null then
    new.allow_resume_after_connection_loss := (new.type <> 'exam');
  end if;

  return new;
end;
$$;

create trigger assessments_apply_strict_defaults
  before insert or update on public.assessments
  for each row execute function public.apply_assessment_strict_defaults();

comment on column public.assessments.strict_exam_mode is
  'When true, browser signals and heartbeat timeouts can submit the attempt. Defaults to true for exams.';
comment on column public.assessments.allow_resume_after_connection_loss is
  'When false, a strict attempt is finalised after a missed heartbeat. Defaults to false for exams.';

-- 3. Attempt heartbeat, reason and suspicious-event counters ----------------

alter table public.attempts
  add column submission_reason public.attempt_submission_reason,
  add column last_heartbeat_at timestamptz,
  add column tab_hidden_count integer not null default 0,
  add column focus_loss_count integer not null default 0,
  add column signal_count integer not null default 0;

alter table public.attempts
  add constraint attempts_tab_hidden_count_check check (tab_hidden_count >= 0),
  add constraint attempts_focus_loss_count_check check (focus_loss_count >= 0),
  add constraint attempts_signal_count_check check (signal_count >= 0);

update public.attempts
set last_heartbeat_at = case
  when status = 'in_progress' then now()
  else coalesce(submitted_at, started_at, created_at, now())
end
where last_heartbeat_at is null;

create index attempts_heartbeat_idx
  on public.attempts (status, last_heartbeat_at);

-- 4. Audit action for automatic submission ----------------------------------

alter table public.assessment_admin_events
  drop constraint assessment_admin_events_action_check;

alter table public.assessment_admin_events
  add constraint assessment_admin_events_action_check check (
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
      'attempt_graded',
      'attempt_auto_submitted',
      'import_started',
      'import_draft_created',
      'import_draft_edited',
      'import_published'
    )
  );

-- 5. Attempt integrity trigger ----------------------------------------------
-- Direct student writes may not forge a heartbeat, a reason or the counters.
-- Trusted RPCs set a transaction-local flag after proving ownership and state.

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
  if public.is_privileged() or (select auth.uid()) is null then
    return new;
  end if;

  if coalesce(current_setting('app.attempt_server_write', true), '') = 'on' then
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
    new.submission_reason := null;
    new.last_heartbeat_at := now();
    new.tab_hidden_count := 0;
    new.focus_loss_count := 0;
    new.signal_count := 0;
    return new;
  end if;

  if old.status <> 'in_progress' then
    raise exception 'attempt_already_submitted';
  end if;

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
  new.last_heartbeat_at := old.last_heartbeat_at;
  new.tab_hidden_count := old.tab_hidden_count;
  new.focus_loss_count := old.focus_loss_count;
  new.signal_count := old.signal_count;
  new.submission_reason := case
    when new.status = 'submitted' then coalesce(old.submission_reason, 'student_submitted')
    else null
  end;
  new.submitted_at := case
    when new.status = 'submitted' then coalesce(old.submitted_at, now())
    else null
  end;

  return new;
end;
$$;

-- 6. Student overview with strict settings ----------------------------------
-- The return type changes, so the function must be recreated.

drop function if exists public.student_assessment_overview();

create function public.student_assessment_overview()
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
  manual_review_status public.manual_review_status,
  strict_exam_mode boolean,
  submit_on_tab_hidden boolean,
  submit_on_navigation boolean,
  heartbeat_timeout_seconds integer,
  allow_resume_after_connection_loss boolean,
  randomize_question_order boolean,
  randomize_option_order boolean
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
    last_attempt.manual_review_status,
    a.strict_exam_mode,
    a.submit_on_tab_hidden,
    a.submit_on_navigation,
    a.heartbeat_timeout_seconds,
    a.allow_resume_after_connection_loss,
    a.randomize_question_order,
    a.randomize_option_order
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

-- 7. Sanitized student payload with optional randomisation -------------------
-- `p_seed` is the attempt id, so a student sees a stable order until the
-- attempt is finalised. Answer keys are still never returned.

drop function if exists public.get_student_assessment_payload(uuid);

create function public.get_student_assessment_payload(
  p_assessment_id uuid,
  p_seed text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_grade uuid;
  v_payload jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;

  select grade_id into v_grade
  from public.profiles
  where id = (select auth.uid())
    and is_active = true
    and role = 'student';

  if v_grade is null then
    raise exception 'profile_not_ready';
  end if;

  select jsonb_build_object(
    'assessment', jsonb_build_object(
      'id', a.id,
      'type', a.type,
      'title_en', a.title_en,
      'title_ar', a.title_ar,
      'instructions_en', a.instructions_en,
      'instructions_ar', a.instructions_ar,
      'time_limit_minutes', a.time_limit_minutes,
      'allow_retakes', a.allow_retakes,
      'max_attempts', a.max_attempts,
      'results_visibility', a.results_visibility,
      'strict_exam_mode', a.strict_exam_mode,
      'submit_on_tab_hidden', a.submit_on_tab_hidden,
      'submit_on_navigation', a.submit_on_navigation,
      'heartbeat_timeout_seconds', a.heartbeat_timeout_seconds,
      'allow_resume_after_connection_loss', a.allow_resume_after_connection_loss,
      'randomize_question_order', a.randomize_question_order,
      'randomize_option_order', a.randomize_option_order
    ),
    'server_time', now(),
    'sections', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'title_en', s.title_en,
            'title_ar', s.title_ar,
            'instructions_en', s.instructions_en,
            'instructions_ar', s.instructions_ar,
            'position', s.position,
            'questions', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', q.id,
                    'type', q.type,
                    'prompt_en', q.prompt_en,
                    'prompt_ar', q.prompt_ar,
                    'help_text_en', q.help_text_en,
                    'help_text_ar', q.help_text_ar,
                    'marks', q.marks,
                    'is_required', q.is_required,
                    'position', q.position,
                    'options', coalesce(
                      (
                        select jsonb_agg(
                          jsonb_build_object(
                            'id', o.id,
                            'label', o.label,
                            'text_en', o.text_en,
                            'text_ar', o.text_ar
                          )
                          order by case
                            when a.randomize_option_order
                              then md5(o.id::text || coalesce(p_seed, ''))
                            else lpad(o.position::text, 8, '0')
                          end
                        )
                        from public.question_options o
                        where o.question_id = q.id
                      ),
                      '[]'::jsonb
                    ),
                    'left_items', coalesce(
                      (
                        select jsonb_agg(
                          jsonb_build_object(
                            'id', mp.id,
                            'text_en', mp.left_text_en,
                            'text_ar', mp.left_text_ar
                          )
                          order by mp.position
                        )
                        from public.matching_pairs mp
                        where mp.question_id = q.id
                      ),
                      '[]'::jsonb
                    ),
                    'right_items', coalesce(
                      (
                        select jsonb_agg(
                          jsonb_build_object(
                            'id', mp.right_key,
                            'text_en', mp.right_text_en,
                            'text_ar', mp.right_text_ar
                          )
                          order by mp.right_key
                        )
                        from public.matching_pairs mp
                        where mp.question_id = q.id
                      ),
                      '[]'::jsonb
                    )
                  )
                  order by case
                    when a.randomize_question_order
                      then md5(q.id::text || coalesce(p_seed, ''))
                    else lpad(q.position::text, 8, '0')
                  end
                )
                from public.questions q
                where q.section_id = s.id
              ),
              '[]'::jsonb
            )
          )
          order by s.position
        )
        from public.assessment_sections s
        where s.assessment_id = a.id
      ),
      '[]'::jsonb
    )
  )
  into v_payload
  from public.assessments a
  where a.id = p_assessment_id
    and a.is_published = true
    and a.grade_id = v_grade
    and (a.available_from is null or now() >= a.available_from)
    and (a.available_until is null or now() <= a.available_until);

  if v_payload is null then
    raise exception 'assessment_not_available';
  end if;

  return v_payload;
end;
$$;

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

  v_payload := public.get_student_assessment_payload(
    v_attempt.assessment_id,
    p_attempt_id::text
  );

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

-- 8. Finalize with a submission reason --------------------------------------
-- Idempotent: a closed attempt is never re-opened or re-graded. Automatic
-- reasons also append an audit event, without question or answer content.

drop function if exists public.finalize_attempt(uuid, jsonb);

create function public.finalize_attempt(
  p_attempt_id uuid,
  p_results jsonb,
  p_reason public.attempt_submission_reason default 'student_submitted'
)
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
  v_reason public.attempt_submission_reason := coalesce(p_reason, 'student_submitted');
begin
  if not public.is_privileged() then
    raise exception 'not_authorized';
  end if;

  -- Lock the row so two concurrent finalisations cannot both pass the
  -- in-progress check and append duplicate audit events.
  select * into v_attempt
  from public.attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt_not_found';
  end if;

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'attempt_id', v_attempt.id,
      'status', v_attempt.status,
      'score', v_attempt.score,
      'max_score', v_attempt.max_score,
      'percentage', v_attempt.percentage,
      'submission_reason', v_attempt.submission_reason,
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
      submission_reason = v_reason,
      last_heartbeat_at = coalesce(last_heartbeat_at, now()),
      score = v_score,
      max_score = v_max_score,
      percentage = round((v_score / v_max_score) * 100, 2),
      graded_at = case when v_pending then null else now() end,
      graded_by = case when v_pending then null else (select auth.uid()) end
  where id = p_attempt_id;

  if v_reason <> 'student_submitted' then
    insert into public.assessment_admin_events (
      assessment_id,
      actor_id,
      action,
      detail
    )
    values (
      v_attempt.assessment_id,
      (select auth.uid()),
      'attempt_auto_submitted',
      jsonb_build_object(
        'attempt_id', p_attempt_id,
        'student_id', v_attempt.student_id,
        'reason', v_reason
      )
    );
  end if;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'status', case when v_pending then 'grading' else 'graded' end,
    'score', v_score,
    'max_score', v_max_score,
    'percentage', round((v_score / v_max_score) * 100, 2),
    'submission_reason', v_reason,
    'pending_review', v_pending
  );
end;
$$;

-- 9. Student heartbeat -------------------------------------------------------
-- Records a server timestamp and suspicious-event counts. It never finalises
-- by itself; the server action/route decides based on the assessment settings.

create or replace function public.attempt_heartbeat(
  p_attempt_id uuid,
  p_tab_hidden boolean default false,
  p_focus_lost boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_attempt public.attempts%rowtype;
  v_assessment public.assessments%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_attempt
  from public.attempts a
  where a.id = p_attempt_id
    and a.student_id = v_uid;

  if not found then
    raise exception 'attempt_not_found';
  end if;

  select * into v_assessment
  from public.assessments
  where id = v_attempt.assessment_id;

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'status', v_attempt.status,
      'submission_reason', v_attempt.submission_reason,
      'server_time', now(),
      'expires_at', v_attempt.expires_at
    );
  end if;

  if now() > v_attempt.expires_at then
    return jsonb_build_object(
      'status', 'expired',
      'submission_reason', null,
      'server_time', now(),
      'expires_at', v_attempt.expires_at
    );
  end if;

  -- A reconnect must not silently revive an attempt that was offline for
  -- longer than the configured heartbeat timeout. Strict attempts without
  -- connection-loss resume are reported as stale; the caller finalises them.
  if v_assessment.strict_exam_mode
    and not v_assessment.allow_resume_after_connection_loss
    and coalesce(v_attempt.last_heartbeat_at, v_attempt.started_at)
      < now() - make_interval(secs => v_assessment.heartbeat_timeout_seconds) then
    return jsonb_build_object(
      'status', 'stale',
      'submission_reason', 'heartbeat_expired'::public.attempt_submission_reason,
      'server_time', now(),
      'expires_at', v_attempt.expires_at
    );
  end if;

  perform set_config('app.attempt_server_write', 'on', true);

  update public.attempts
  set last_heartbeat_at = now(),
      tab_hidden_count = tab_hidden_count
        + case when coalesce(p_tab_hidden, false) then 1 else 0 end,
      focus_loss_count = focus_loss_count
        + case when coalesce(p_focus_lost, false) then 1 else 0 end,
      signal_count = signal_count
        + case
            when coalesce(p_tab_hidden, false)
              or coalesce(p_focus_lost, false) then 1
            else 0
          end
  where id = p_attempt_id;

  return jsonb_build_object(
    'status', 'in_progress',
    'submission_reason', null,
    'server_time', now(),
    'expires_at', v_attempt.expires_at,
    'strict_exam_mode', v_assessment.strict_exam_mode,
    'heartbeat_timeout_seconds', v_assessment.heartbeat_timeout_seconds,
    'submit_on_tab_hidden', v_assessment.submit_on_tab_hidden,
    'submit_on_navigation', v_assessment.submit_on_navigation,
    'allow_resume_after_connection_loss', v_assessment.allow_resume_after_connection_loss
  );
end;
$$;

-- 10. Start/resume guard ----------------------------------------------------
-- A stale attempt must not be resumed through a direct RPC call either. The
-- student action sweeps first; this is defence in depth.

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
    if now() > v_attempt.expires_at
      or (
        v_assessment.strict_exam_mode
        and not v_assessment.allow_resume_after_connection_loss
        and coalesce(v_attempt.last_heartbeat_at, v_attempt.started_at)
          < now() - make_interval(secs => v_assessment.heartbeat_timeout_seconds)
      ) then
      raise exception 'attempt_stale';
    end if;

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

-- 11. Stale-attempt sweep ----------------------------------------------------
-- Trusted code calls this, then finalises each returned attempt through
-- finalize_attempt so automatic marks are still computed in one place.

create or replace function public.finalize_stale_attempts(p_limit integer default 25)
returns table (
  attempt_id uuid,
  assessment_id uuid,
  student_id uuid,
  reason public.attempt_submission_reason
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_privileged() then
    raise exception 'not_authorized';
  end if;

  return query
  select
    a.id,
    a.assessment_id,
    a.student_id,
    case
      when now() > a.expires_at then 'time_expired'::public.attempt_submission_reason
      else 'heartbeat_expired'::public.attempt_submission_reason
    end
  from public.attempts a
  join public.assessments asm on asm.id = a.assessment_id
  where a.status = 'in_progress'
    and (
      now() > a.expires_at
      or (
        asm.strict_exam_mode
        and not asm.allow_resume_after_connection_loss
        and coalesce(a.last_heartbeat_at, a.started_at)
          < now() - make_interval(secs => asm.heartbeat_timeout_seconds)
      )
    )
  order by a.started_at
  limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$$;

-- 12. Permissions and comments ----------------------------------------------

revoke all on function public.student_assessment_overview() from public, anon;
revoke all on function public.get_student_assessment_payload(uuid, text) from public, anon;
revoke all on function public.finalize_attempt(uuid, jsonb, public.attempt_submission_reason) from public, anon;
revoke all on function public.attempt_heartbeat(uuid, boolean, boolean) from public, anon;
revoke all on function public.finalize_stale_attempts(integer) from public, anon;

grant execute on function public.student_assessment_overview()
  to authenticated, service_role;
grant execute on function public.get_student_assessment_payload(uuid, text)
  to authenticated, service_role;
grant execute on function public.finalize_attempt(uuid, jsonb, public.attempt_submission_reason)
  to authenticated, service_role;
grant execute on function public.attempt_heartbeat(uuid, boolean, boolean)
  to authenticated, service_role;
grant execute on function public.finalize_stale_attempts(integer)
  to authenticated, service_role;

comment on function public.attempt_heartbeat(uuid, boolean, boolean) is
  'Records the server heartbeat and suspicious-event counts for the owning student.';
comment on function public.finalize_stale_attempts(integer) is
  'Returns expired or heartbeat-stale attempts for idempotent finalisation by trusted code.';
comment on function public.finalize_attempt(uuid, jsonb, public.attempt_submission_reason) is
  'Applies pre-computed marks, records the submission reason and appends an audit event for automatic closes.';
comment on function public.get_student_assessment_payload(uuid, text) is
  'Sanitized assessment payload for the signed-in student. Optional seed randomises order without exposing answer keys.';
