-- Reading-passage / dialogue content groups and essay / paragraph writing
-- questions.
--
-- Additive only: existing sections keep kind = 'standard', existing questions
-- keep NULL word limits, and no legacy Arabic column is dropped or rewritten.
-- Row-level security is unchanged because the new columns live on tables that
-- already have teacher-only authoring policies and answer-key-free student RPCs.

-- 1. Content groups ----------------------------------------------------------

alter table public.assessment_sections
  add column if not exists kind text not null default 'standard',
  add column if not exists passage_en text,
  add column if not exists vocabulary_en text,
  add column if not exists source_en text,
  add column if not exists dialogue_lines jsonb not null default '[]'::jsonb;

alter table public.assessment_sections
  drop constraint if exists assessment_sections_kind_check;

alter table public.assessment_sections
  add constraint assessment_sections_kind_check
  check (kind in ('standard', 'reading_passage', 'dialogue'));

alter table public.assessment_sections
  drop constraint if exists assessment_sections_dialogue_lines_check;

alter table public.assessment_sections
  add constraint assessment_sections_dialogue_lines_check
  check (jsonb_typeof(dialogue_lines) = 'array');

comment on column public.assessment_sections.kind is
  'standard = ordinary question group, reading_passage = shared reading text, dialogue = shared conversation.';
comment on column public.assessment_sections.dialogue_lines is
  'Array of {"speaker": text, "text": text} objects. Never contains answers.';

-- 2. Writing question fields -------------------------------------------------

alter table public.questions
  add column if not exists topic_en text,
  add column if not exists min_words integer,
  add column if not exists max_words integer,
  add column if not exists rubric_en text;

alter table public.questions
  drop constraint if exists questions_word_limits_check;

alter table public.questions
  add constraint questions_word_limits_check
  check (
    (min_words is null or min_words >= 1)
    and (max_words is null or max_words >= 1)
    and (min_words is null or max_words is null or max_words >= min_words)
  );

comment on column public.questions.min_words is
  'Optional minimum word count for essay / paragraph answers. Teacher guidance only.';
comment on column public.questions.max_words is
  'Optional maximum word count for essay / paragraph answers. Teacher guidance only.';
comment on column public.questions.rubric_en is
  'Optional English marking rubric shown to students and used by the teacher when grading manually.';

-- 3. Paragraph question type -------------------------------------------------
-- Adding an enum value is safe in a migration: no row uses it in this file, so
-- the new value is available to application writes after commit.

alter type public.question_type add value if not exists 'paragraph';

-- 3b. Audit action for moving a question between groups ----------------------

alter table public.assessment_admin_events
  drop constraint if exists assessment_admin_events_action_check;

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
      'question_moved',
      'questions_reordered',
      'attempt_graded',
      'attempt_auto_submitted',
      'import_started',
      'import_draft_created',
      'import_draft_edited',
      'import_published'
    )
  );

-- 4. Student payload ---------------------------------------------------------
-- Same visibility rules as before. The extra fields are content, never answer
-- keys. `correct_answer`, option correctness and matching right keys stay out
-- of every student-facing question object.

drop function if exists public.get_student_assessment_payload(uuid, text);

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
            'kind', s.kind,
            'title_en', s.title_en,
            'title_ar', s.title_ar,
            'instructions_en', s.instructions_en,
            'instructions_ar', s.instructions_ar,
            'passage_en', s.passage_en,
            'vocabulary_en', s.vocabulary_en,
            'source_en', s.source_en,
            'dialogue_lines', s.dialogue_lines,
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
                    'topic_en', q.topic_en,
                    'min_words', q.min_words,
                    'max_words', q.max_words,
                    'rubric_en', q.rubric_en,
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

-- 5. Student result ----------------------------------------------------------
-- Content is repeated after submission so a student can re-read the passage or
-- dialogue beside their answers. Answer keys remain absent.

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
            'kind', s.kind,
            'title_en', s.title_en,
            'title_ar', s.title_ar,
            'passage_en', s.passage_en,
            'vocabulary_en', s.vocabulary_en,
            'source_en', s.source_en,
            'dialogue_lines', s.dialogue_lines,
            'position', s.position,
            'questions', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', q.id,
                    'type', q.type,
                    'prompt_en', q.prompt_en,
                    'prompt_ar', q.prompt_ar,
                    'topic_en', q.topic_en,
                    'min_words', q.min_words,
                    'max_words', q.max_words,
                    'rubric_en', q.rubric_en,
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

-- 6. Permissions -------------------------------------------------------------
-- Re-declared because dropping/recreating a function resets its grants.

revoke all on function public.get_student_assessment_payload(uuid, text)
  from public, anon;
revoke all on function public.student_attempt_result(uuid) from public, anon;

grant execute on function public.get_student_assessment_payload(uuid, text)
  to authenticated, service_role;
grant execute on function public.student_attempt_result(uuid)
  to authenticated, service_role;
