-- ---------------------------------------------------------------------------
-- Local development seed data
-- ---------------------------------------------------------------------------
-- Run with: npx supabase db reset
--
-- Demo accounts (local only):
--   Teacher: teacher@example.com / Teacher123!
--   Student: Student ID G10-001 / Student123!  (Grade 10, Sara Ahmed)
--   Student: Student ID G11-001 / Student123!  (Grade 11, Omar Hassan)
--   Inactive student: Student ID G10-002 / Student123! (Mona Ali)
--
-- Student Auth users use private @accounts.internal addresses derived from the
-- Student ID. The real e-mail in contact_email is optional and for contact only.
-- The auth trigger creates matching public.profiles rows.
-- ---------------------------------------------------------------------------

insert into public.grades (id, name_en, name_ar, slug, description_en, description_ar, sort_order)
values
  (
    '11000000-0000-4000-8000-000000000001',
    'Grade 10',
    'الصف العاشر',
    'grade-10',
    'First secondary year',
    'الصف الأول الثانوي',
    10
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    'Grade 11',
    'الصف الحادي عشر',
    'grade-11',
    'Second secondary year',
    'الصف الثاني الثانوي',
    11
  )
on conflict (id) do nothing;

insert into public.classes (id, grade_id, name_en, name_ar, academic_year)
values
  (
    '12000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Class 10-A',
    'فصل ١٠-أ',
    '2026/2027'
  ),
  (
    '12000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000002',
    'Class 11-A',
    'فصل ١١-أ',
    '2026/2027'
  )
on conflict (id) do nothing;

-- Auth users ---------------------------------------------------------------

do $$
declare
  seed_user record;
begin
  for seed_user in
    select *
    from (
      values
        (
          '10000000-0000-4000-8000-000000000001'::uuid,
          'teacher@example.com',
          'Teacher123!',
          '{"full_name_en":"Nour Hassan","full_name_ar":"نور حسن"}'::jsonb,
          '{"provider":"email","providers":["email"],"app_role":"teacher"}'::jsonb
        ),
        (
          '10000000-0000-4000-8000-000000000002'::uuid,
          'student-g10-001@accounts.internal',
          'Student123!',
          jsonb_build_object(
            'full_name_en', 'Sara Ahmed',
            'full_name_ar', 'سارة أحمد',
            'username', 'sara.ahmed'
          ),
          jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'app_role', 'student',
            'grade_id', '11000000-0000-4000-8000-000000000001',
            'class_id', '12000000-0000-4000-8000-000000000001',
            'student_number', 'G10-001',
            'contact_email', 'sara@example.com',
            'is_active', true
          )
        ),
        (
          '10000000-0000-4000-8000-000000000003'::uuid,
          'student-g11-001@accounts.internal',
          'Student123!',
          jsonb_build_object(
            'full_name_en', 'Omar Hassan',
            'full_name_ar', 'عمر حسن',
            'username', 'omar.hassan'
          ),
          jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'app_role', 'student',
            'grade_id', '11000000-0000-4000-8000-000000000002',
            'class_id', '12000000-0000-4000-8000-000000000002',
            'student_number', 'G11-001',
            'contact_email', 'omar@example.com',
            'is_active', true
          )
        ),
        (
          '10000000-0000-4000-8000-000000000004'::uuid,
          'student-g10-002@accounts.internal',
          'Student123!',
          jsonb_build_object(
            'full_name_en', 'Mona Ali',
            'full_name_ar', 'منى علي',
            'username', 'mona.ali'
          ),
          jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'app_role', 'student',
            'grade_id', '11000000-0000-4000-8000-000000000001',
            'class_id', '12000000-0000-4000-8000-000000000001',
            'student_number', 'G10-002',
            'contact_email', 'mona@example.com',
            'is_active', false
          )
        )
    ) as u (id, email, password, user_meta, app_meta)
  loop
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      seed_user.id,
      'authenticated',
      'authenticated',
      seed_user.email,
      extensions.crypt(seed_user.password, extensions.gen_salt('bf')),
      now(),
      seed_user.app_meta,
      seed_user.user_meta,
      now(),
      now()
    )
    on conflict (id) do nothing;

    if not exists (
      select 1
      from auth.identities
      where user_id = seed_user.id
        and provider = 'email'
    ) then
      insert into auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        seed_user.id,
        seed_user.id::text,
        jsonb_build_object(
          'sub', seed_user.id::text,
          'email', seed_user.email,
          'email_verified', true
        ),
        'email',
        now(),
        now(),
        now()
      );
    end if;
  end loop;
end;
$$;

-- Resource categories ------------------------------------------------------

insert into public.resource_categories (id, name_en, name_ar, slug, sort_order)
values
  ('20000000-0000-4000-8000-000000000001', 'Grammar', 'القواعد', 'grammar', 1),
  ('20000000-0000-4000-8000-000000000002', 'Reading', 'القراءة', 'reading', 2),
  ('20000000-0000-4000-8000-000000000003', 'Listening', 'الاستماع', 'listening', 3),
  ('20000000-0000-4000-8000-000000000004', 'Vocabulary', 'المفردات', 'vocabulary', 4)
on conflict (id) do nothing;

-- Sample YouTube resources -------------------------------------------------

insert into public.resources (
  id,
  grade_id,
  category_id,
  type,
  title_en,
  title_ar,
  description_en,
  description_ar,
  external_url,
  thumbnail_url,
  is_published,
  created_by
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    'youtube',
    'Listening practice: The power of body language',
    'تدريب الاستماع: قوة لغة الجسد',
    'Watch the talk once for the main idea, then again for details.',
    'شاهد الحديث مرة لفهم الفكرة العامة، ثم مرة أخرى للتفاصيل.',
    'https://www.youtube.com/watch?v=Ks-_Mh1QhMc',
    'https://i.ytimg.com/vi/Ks-_Mh1QhMc/hqdefault.jpg',
    true,
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    'youtube',
    'Study skills: Beating procrastination',
    'مهارات الدراسة: التغلب على التأجيل',
    'A short listening task about study habits and time management.',
    'مهمة استماع قصيرة عن عادات الدراسة وإدارة الوقت.',
    'https://www.youtube.com/watch?v=arj7oStGLkU',
    'https://i.ytimg.com/vi/arj7oStGLkU/hqdefault.jpg',
    true,
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '11000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    'youtube',
    'Listening practice: What makes a good life?',
    'تدريب الاستماع: ما الذي يجعل الحياة جيدة؟',
    'Listen for the speaker''s main argument and supporting examples.',
    'استمع إلى الفكرة الرئيسية للمتحدث والأمثلة الداعمة.',
    'https://www.youtube.com/watch?v=8KkKuTCFvzI',
    'https://i.ytimg.com/vi/8KkKuTCFvzI/hqdefault.jpg',
    true,
    '10000000-0000-4000-8000-000000000001'
  )
on conflict (id) do nothing;

-- Sample quiz for Grade 10 ------------------------------------------------

insert into public.assessments (
  id,
  grade_id,
  type,
  title_en,
  title_ar,
  instructions_en,
  instructions_ar,
  time_limit_minutes,
  results_visibility,
  grading_mode,
  allow_retakes,
  max_attempts,
  is_published,
  created_by
)
values (
  '40000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  'quiz',
  'Reading & Vocabulary Check 1',
  'اختبار القراءة والمفردات ١',
  'Answer all questions. The quiz closes automatically when the timer ends.',
  'أجب عن جميع الأسئلة. يُغلق الاختبار تلقائيًا عند انتهاء الوقت.',
  20,
  'immediately',
  'automatic',
  true,
  3,
  true,
  '10000000-0000-4000-8000-000000000001'
)
on conflict (id) do nothing;

insert into public.assessment_sections (
  id, assessment_id, title_en, title_ar, instructions_en, instructions_ar, position
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'Vocabulary',
    'المفردات',
    'Choose the best answer for each item.',
    'اختر أفضل إجابة لكل بند.',
    0
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'Grammar & Writing',
    'القواعد والكتابة',
    'Read each question carefully and write complete answers.',
    'اقرأ كل سؤال بعناية واكتب إجابات كاملة.',
    1
  )
on conflict (id) do nothing;

insert into public.questions (
  id, section_id, type, prompt_en, prompt_ar, marks, is_required, position,
  correct_answer, grading_method
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'multiple_choice',
    'Choose the synonym of "happy".',
    'اختر مرادف كلمة "happy".',
    1,
    true,
    0,
    null,
    'automatic'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    'true_false',
    'The past tense of "go" is "goed".',
    'الماضي من الفعل "go" هو "goed".',
    1,
    true,
    1,
    '{"value": false}'::jsonb,
    'automatic'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000001',
    'matching',
    'Match each word with its meaning.',
    'طابق كل كلمة مع معناها.',
    3,
    true,
    2,
    null,
    'automatic'
  ),
  (
    '60000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000002',
    'short_answer',
    'Write one sentence using the present perfect tense.',
    'اكتب جملة واحدة باستخدام المضارع التام.',
    3,
    true,
    0,
    null,
    'manual'
  )
on conflict (id) do nothing;

insert into public.question_options (
  id, question_id, label, text_en, text_ar, is_correct, position
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'A', 'glad', 'سعيد', true, 0
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    'B', 'angry', 'غاضب', false, 1
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000001',
    'C', 'tired', 'متعب', false, 2
  ),
  (
    '70000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000001',
    'D', 'slow', 'بطيء', false, 3
  )
on conflict (id) do nothing;

insert into public.matching_pairs (
  id, question_id, left_text_en, left_text_ar, right_text_en, right_text_ar, position
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000003',
    'big', 'كبير', 'large', 'ضخم', 0
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000003',
    'fast', 'سريع', 'quick', 'سريع جدًا', 1
  ),
  (
    '80000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000003',
    'happy', 'سعيد', 'glad', 'مسرور', 2
  )
on conflict (id) do nothing;
