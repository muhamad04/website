-- ---------------------------------------------------------------------------
-- Security hardening (audit follow-up)
-- ---------------------------------------------------------------------------
-- This migration is additive and is NOT applied automatically. It:
--   1. blocks students from forging an attempt status transition;
--   2. enforces heartbeat staleness on answer writes and attempt payloads;
--   3. requires an owned, open, unexpired attempt before a submission upload;
--   4. aligns the submission bucket limit with the application constant;
--   5. adds a service-role-only login throttle store and RPCs.
--
-- The teacher role remains intentionally global: teachers and administrators
-- are trusted staff and may read/write every grade. See docs/security.md.

-- 1. Students may not write attempts directly --------------------------------
-- Every legitimate student write (start, heartbeat) goes through a
-- security-definer RPC. The policy below still lets the owning student update
-- an open attempt so the heartbeat RPC works even if a future deployment makes
-- the function owner subject to RLS. The trigger then rejects every meaningful
-- direct change: status, heartbeat and the suspicious-event counters. A direct
-- PostgREST PATCH can therefore neither submit an attempt nor forge a fresh
-- heartbeat.

drop policy if exists attempts_student_update_own on public.attempts;

create policy attempts_student_update_own on public.attempts
  for update to authenticated
  using (
    student_id = (select auth.uid())
    and status = 'in_progress'
  )
  with check (
    student_id = (select auth.uid())
    and status = 'in_progress'
  );

create or replace function public.block_student_attempt_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged() or (select auth.uid()) is null then
    return new;
  end if;

  if coalesce(current_setting('app.attempt_server_write', true), '') = 'on' then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'attempt_already_submitted';
  end if;

  if new.last_heartbeat_at is distinct from old.last_heartbeat_at
     or new.tab_hidden_count is distinct from old.tab_hidden_count
     or new.focus_loss_count is distinct from old.focus_loss_count
     or new.signal_count is distinct from old.signal_count
     or new.started_at is distinct from old.started_at
     or new.expires_at is distinct from old.expires_at
     or new.submitted_at is distinct from old.submitted_at
     or new.assessment_id is distinct from old.assessment_id
     or new.student_id is distinct from old.student_id
     or new.attempt_number is distinct from old.attempt_number then
    raise exception 'attempt_direct_write_forbidden';
  end if;

  return new;
end;
$$;

drop trigger if exists attempts_block_status_forgery on public.attempts;

create trigger attempts_block_status_forgery
  before update on public.attempts
  for each row execute function public.block_student_attempt_status_change();

comment on function public.block_student_attempt_status_change() is
  'Students may not change attempts.status, heartbeat or counters directly. Only trusted RPCs and service-role finalisation may write them.';

-- 2. Heartbeat staleness on answer writes -----------------------------------
-- A strict attempt with connection-loss resume disabled is no longer writable
-- once its last heartbeat is older than the configured timeout. The server
-- action performs the same check; this is the database authority.

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
    join public.assessments asm on asm.id = a.assessment_id
    where a.id = p_attempt_id
      and a.student_id = (select auth.uid())
      and a.status = 'in_progress'
      and a.expires_at > now()
      and not (
        asm.strict_exam_mode
        and not asm.allow_resume_after_connection_loss
        and coalesce(a.last_heartbeat_at, a.started_at)
          < now() - make_interval(secs => asm.heartbeat_timeout_seconds)
      )
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
    join public.assessments asm on asm.id = a.assessment_id
    join public.assessment_sections s on s.assessment_id = a.assessment_id
    join public.questions q on q.section_id = s.id
    where a.id = p_attempt_id
      and a.student_id = (select auth.uid())
      and a.status = 'in_progress'
      and a.expires_at > now()
      and not (
        asm.strict_exam_mode
        and not asm.allow_resume_after_connection_loss
        and coalesce(a.last_heartbeat_at, a.started_at)
          < now() - make_interval(secs => asm.heartbeat_timeout_seconds)
      )
      and q.id = p_question_id
  );
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
  v_last_heartbeat_at timestamptz;
  v_started_at timestamptz;
  v_strict boolean;
  v_allow_resume boolean;
  v_heartbeat_timeout integer;
begin
  if public.is_privileged() or (select auth.uid()) is null then
    return new;
  end if;

  v_attempt_id := case when tg_op = 'UPDATE' then old.attempt_id else new.attempt_id end;

  select a.expires_at,
         a.last_heartbeat_at,
         a.started_at,
         asm.strict_exam_mode,
         asm.allow_resume_after_connection_loss,
         asm.heartbeat_timeout_seconds
  into v_expires_at,
       v_last_heartbeat_at,
       v_started_at,
       v_strict,
       v_allow_resume,
       v_heartbeat_timeout
  from public.attempts a
  join public.assessments asm on asm.id = a.assessment_id
  where a.id = v_attempt_id
    and a.student_id = (select auth.uid())
    and a.status = 'in_progress';

  if v_expires_at is null then
    raise exception 'attempt_not_writable';
  end if;

  if now() > v_expires_at then
    raise exception 'attempt_expired';
  end if;

  if v_strict
     and not v_allow_resume
     and coalesce(v_last_heartbeat_at, v_started_at)
       < now() - make_interval(secs => v_heartbeat_timeout) then
    raise exception 'attempt_stale';
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

comment on function public.student_owns_open_attempt(uuid) is
  'True only for an owned, unexpired, non-stale open attempt.';
comment on function public.student_can_write_answer(uuid, uuid) is
  'True only while the attempt is open, unexpired and not heartbeat-stale.';
comment on function public.protect_answer_integrity() is
  'Student answer rules, including strict-exam heartbeat staleness.';

revoke all on function public.student_owns_open_attempt(uuid) from public, anon;
revoke all on function public.student_can_write_answer(uuid, uuid) from public, anon;

grant execute on function public.student_owns_open_attempt(uuid)
  to authenticated, service_role;
grant execute on function public.student_can_write_answer(uuid, uuid)
  to authenticated, service_role;

-- 3. Attempt payload refuses a stale attempt --------------------------------

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
  v_assessment public.assessments%rowtype;
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

  select * into v_assessment
  from public.assessments
  where id = v_attempt.assessment_id;

  if v_assessment.strict_exam_mode
     and not v_assessment.allow_resume_after_connection_loss
     and coalesce(v_attempt.last_heartbeat_at, v_attempt.started_at)
       < now() - make_interval(secs => v_assessment.heartbeat_timeout_seconds) then
    raise exception 'attempt_stale';
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

comment on function public.student_attempt_payload(uuid) is
  'Sanitized payload for an owned open attempt; refuses heartbeat-stale attempts.';

-- 4. Submission uploads require an owned open attempt ------------------------

drop policy if exists storage_submissions_student_insert on storage.objects;

create policy storage_submissions_student_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assessment-submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.attempts a
      join public.assessments asm on asm.id = a.assessment_id
      where a.id::text = (storage.foldername(name))[2]
        and a.student_id = (select auth.uid())
        and a.status = 'in_progress'
        and a.expires_at > now()
        and not (
          asm.strict_exam_mode
          and not asm.allow_resume_after_connection_loss
          and coalesce(a.last_heartbeat_at, a.started_at)
            < now() - make_interval(secs => asm.heartbeat_timeout_seconds)
        )
    )
  );

comment on policy storage_submissions_student_insert on storage.objects is
  'Students may upload only into their own <student>/<attempt>/ folder while that attempt is open and not stale.';

-- 5. One submission size limit ----------------------------------------------
-- The application uses 25 MiB (ASSESSMENT_MAX_FILE_BYTES); the bucket must
-- enforce the same value. Keeping the bucket lower silently rejected valid
-- files before the server-side check could run.

update storage.buckets
set file_size_limit = 26214400
where id = 'assessment-submissions';

-- 6. Login throttle (service-role only) -------------------------------------
-- The server action hashes the Student ID/e-mail and the client IP, then calls
-- these RPCs with the service-role client. Clients cannot read or write the
-- table, so a known Student ID cannot be locked out by calling the RPCs
-- directly. The window and cap keep the lockout temporary.

create table if not exists public.login_throttle_events (
  id bigserial primary key,
  key_hash text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists login_throttle_events_key_time_idx
  on public.login_throttle_events (key_hash, created_at desc);

alter table public.login_throttle_events enable row level security;

revoke all on table public.login_throttle_events from public, anon, authenticated;

create or replace function public.login_throttle_retry_after(
  p_key text,
  p_threshold integer default 5,
  p_window_seconds integer default 900,
  p_cap_seconds integer default 300
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_failures integer;
  v_threshold integer := greatest(1, coalesce(p_threshold, 5));
  v_window integer := greatest(60, coalesce(p_window_seconds, 900));
  v_cap integer := greatest(1, coalesce(p_cap_seconds, 300));
begin
  if p_key is null or length(p_key) < 16 then
    return 0;
  end if;

  select count(*)::integer
  into v_failures
  from public.login_throttle_events e
  where e.key_hash = p_key
    and e.succeeded = false
    and e.created_at > now() - make_interval(secs => v_window);

  if v_failures < v_threshold then
    return 0;
  end if;

  -- 2s, 4s, 8s, ... capped. Temporary by construction: the window slides and a
  -- successful sign-in deletes the key's failures.
  return least(
    v_cap,
    power(2, least(20, v_failures - v_threshold + 1))::integer
  );
end;
$$;

create or replace function public.login_throttle_record(
  p_key text,
  p_succeeded boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or length(p_key) < 16 then
    return;
  end if;

  if coalesce(p_succeeded, false) then
    delete from public.login_throttle_events where key_hash = p_key;
    return;
  end if;

  insert into public.login_throttle_events (key_hash, succeeded)
  values (p_key, false);

  -- Opportunistic retention: the table only needs the current sliding window.
  delete from public.login_throttle_events
  where created_at < now() - interval '1 day';
end;
$$;

revoke all on function public.login_throttle_retry_after(text, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.login_throttle_record(text, boolean)
  from public, anon, authenticated;

grant execute on function public.login_throttle_retry_after(text, integer, integer, integer)
  to service_role;
grant execute on function public.login_throttle_record(text, boolean)
  to service_role;

comment on function public.login_throttle_retry_after(text, integer, integer, integer) is
  'Service-role-only exponential backoff for a hashed login key. Returns seconds to wait.';
comment on function public.login_throttle_record(text, boolean) is
  'Service-role-only login outcome recorder. Success clears the key; failure appends an event.';
