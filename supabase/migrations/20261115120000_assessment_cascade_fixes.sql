-- ---------------------------------------------------------------------------
-- Phase 3d: assessment cascade fixes
-- ---------------------------------------------------------------------------
-- Deleting a staff account that has graded an attempt failed with
-- "Database error deleting user":
--
--   auth.users  ->  profiles (on delete cascade)
--               ->  attempts.graded_by / answers.graded_by (on delete set null)
--
-- The SET NULL cascade is an UPDATE, so it fires protect_attempt_integrity and
-- protect_answer_integrity. GoTrue deletes the user from an internal context
-- that has no end-user identity and no service_role claim, so is_privileged()
-- is false and the triggers raised attempt_already_submitted /
-- attempt_not_writable, aborting the whole delete.
--
-- Both triggers now treat identity-less updates as trusted. Direct browser
-- writes always carry the student's auth.uid(), so every student check is
-- unchanged; only cascades, seeds, migrations and internal jobs skip the
-- student-only rules. RLS still blocks anon and other users before the trigger
-- can run.
--
-- Resource-management behaviour is untouched.

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
  -- server action finalises expired attempts with the admin client.
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
  if public.is_privileged() or (select auth.uid()) is null then
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

comment on function public.protect_attempt_integrity() is
  'Student attempt rules. Identity-less updates (auth.uid() is null) are trusted cascades or internal jobs.';
comment on function public.protect_answer_integrity() is
  'Student answer rules. Identity-less updates (auth.uid() is null) are trusted cascades or internal jobs.';
