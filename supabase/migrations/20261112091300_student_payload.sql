-- ---------------------------------------------------------------------------
-- Migration 4 of 4: sanitized student assessment payload
-- ---------------------------------------------------------------------------
-- Questions, options and matching pairs are teacher-only tables. This
-- function is the single read path students will use when taking an
-- assessment. It validates grade + publication server-side and strips answer
-- keys before returning JSON.

create or replace function public.get_student_assessment_payload(p_assessment_id uuid)
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
      'results_visibility', a.results_visibility
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
                          order by o.position
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
                  order by q.position
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

revoke all on function public.get_student_assessment_payload(uuid) from public;
revoke all on function public.get_student_assessment_payload(uuid) from anon;
grant execute on function public.get_student_assessment_payload(uuid) to authenticated;

comment on function public.get_student_assessment_payload(uuid) is
  'Sanitized assessment payload for the signed-in student. Never returns correct answers or option flags.';
