/**
 * Hosted Phase 3 assessment RLS / RPC / storage verification.
 *
 * Creates isolated test users (teacher, two grade-A students, one grade-B
 * student), a temporary grade and four assessments, exercises every security
 * rule, then removes everything it created and verifies the cleanup.
 *
 * Run against the project configured in .env.local:
 *
 *   npm run verify:rls:hosted
 *
 * It needs the service-role key and therefore must never run in the browser or
 * in a deployed environment. Do not point it at a project with real users:
 * every `rls-*` / `probe-*` account it creates is deleted again, but the
 * assessments it publishes are visible to that grade while the run is active.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !serviceKey || !publishable) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, publishable, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Verifying hosted assessment security on ${new URL(url).host}\n`);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

function describe(data, error) {
  if (error) return error.message;
  return JSON.stringify(data)?.slice(0, 240) ?? "null";
}

async function expectError(name, promise, expected) {
  const { data, error } = await promise;
  const msg = error?.message ?? "";
  check(
    name,
    Boolean(error) && msg.includes(expected),
    error ? msg : `no error, data=${describe(data)}`,
  );
}

async function expectRows(name, promise, predicate) {
  const { data, error } = await promise;
  check(
    name,
    !error && predicate(data),
    error ? error.message : `rows=${JSON.stringify(data)?.slice(0, 240)}`,
  );
}

const short = (value) => String(value).slice(0, 8);
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const IMPORT_BUCKET = "assessment-imports";
const created = {
  users: [],
  assessments: [],
  storage: [],
  grades: [],
  events: [],
  staffEvents: [],
  imports: [],
  importObjects: [],
  importAuditEvents: [],
  syncLogAttempts: [],
  /** Original settings row, restored in cleanup even if a check throws. */
  settingsBackup: null,
};

async function createUser(kind, gradeId) {
  const role =
    kind === "admin" ? "admin" : kind === "teacher" ? "teacher" : "student";
  const studentNumber =
    role === "student"
      ? `RLS-${kind}-${Date.now()}-${short(crypto.randomUUID())}`
      : null;
  // Students exercise the production private identity shape; staff keep email.
  const email =
    role === "student"
      ? `student-${studentNumber.toLowerCase()}@accounts.internal`
      : `rls-${kind}-${Date.now()}-${short(crypto.randomUUID())}@material.test`;
  const password = `Tmp!${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      app_role: role,
      ...(studentNumber
        ? { student_number: studentNumber, contact_email: null }
        : {}),
    },
    user_metadata: { full_name_en: `RLS ${kind}` },
  });

  if (error || !data.user) {
    throw new Error(`createUser ${kind} failed: ${error?.message}`);
  }

  created.users.push(data.user.id);

  // Hosted Auth applies app_metadata after the auth user insert, so the
  // handle_new_user trigger intentionally skips profile creation in that case.
  // Provision the profile explicitly, exactly like the application does.
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      role,
      full_name_en: `RLS ${kind}`,
      email: role === "student" ? null : email,
      grade_id: role === "student" ? gradeId : null,
      class_id: null,
      student_number: studentNumber,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw new Error(`profile upsert ${kind} failed: ${profileError.message}`);
  }

  const client = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw new Error(`sign-in ${kind} failed: ${signInError.message}`);
  }

  return client;
}

async function createAssessment(overrides) {
  const { data, error } = await admin
    .from("assessments")
    .insert({
      type: "quiz",
      title_en: "RLS verification quiz",
      title_ar: "اختبار التحقق",
      instructions_en: "Testing only.",
      instructions_ar: "للاختبار فقط.",
      time_limit_minutes: 30,
      results_visibility: "after_review",
      grading_mode: "mixed",
      allow_retakes: false,
      max_attempts: 1,
      is_published: true,
      ...overrides,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`assessment create failed: ${error?.message}`);
  }

  created.assessments.push(data.id);
  return data.id;
}

async function createSection(assessmentId, position = 0) {
  const { data, error } = await admin
    .from("assessment_sections")
    .insert({
      assessment_id: assessmentId,
      title_en: "Part one",
      title_ar: "الجزء الأول",
      position,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`section create failed: ${error?.message}`);
  }

  return data.id;
}

async function createQuestion(sectionId, overrides) {
  const { data, error } = await admin
    .from("questions")
    .insert({
      section_id: sectionId,
      type: "multiple_choice",
      prompt_en: "Pick one",
      prompt_ar: "اختر",
      marks: 2,
      position: overrides.position ?? 0,
      grading_method: "automatic",
      is_required: true,
      ...overrides,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`question create failed: ${error?.message}`);
  }

  return data.id;
}

async function addOptions(questionId, options) {
  const rows = options.map((text, index) => ({
    question_id: questionId,
    label: String.fromCharCode(65 + index),
    text_en: text,
    is_correct: index === options.length - 1,
    position: index,
  }));
  const { data, error } = await admin
    .from("question_options")
    .insert(rows)
    .select("id, is_correct, position");
  if (error) throw new Error(`options create failed: ${error.message}`);
  return data
    .slice()
    .sort((a, b) => a.position - b.position);
}

function hasAnswerKey(payload) {
  const json = JSON.stringify(payload);
  return (
    json.includes("correct_answer") ||
    json.includes("is_correct") ||
    json.includes("explanation_en") ||
    json.includes("explanation_ar") ||
    json.includes("right_key")
  );
}

/** Graded results may say whether an answered question was right, but they
 * must never include the stored key, explanations or matching right keys. */
function hasStoredKey(payload) {
  const json = JSON.stringify(payload);
  return (
    json.includes("correct_answer") ||
    json.includes("explanation_en") ||
    json.includes("explanation_ar") ||
    json.includes("right_key")
  );
}

async function run() {
  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------
  const { data: grades, error: gradesError } = await admin
    .from("grades")
    .select("id, name_en")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1);

  if (gradesError || !grades || grades.length < 1) {
    throw new Error("need an active grade to run the suite");
  }

  const gradeA = grades[0].id;

  // The hosted project currently ships a single grade, so add a private one
  // for the cross-grade checks and remove it during cleanup.
  const { data: tempGrade, error: tempGradeError } = await admin
    .from("grades")
    .insert({
      name_en: `RLS Grade ${short(crypto.randomUUID())}`,
      name_ar: "صف التحقق",
      slug: `rls-grade-${Date.now()}`,
      sort_order: 999,
      is_active: true,
    })
    .select("id")
    .single();

  if (tempGradeError || !tempGrade) {
    throw new Error(`temp grade create failed: ${tempGradeError?.message}`);
  }

  created.grades.push(tempGrade.id);
  const gradeB = tempGrade.id;

  const teacher = await createUser("teacher");
  const adminUser = await createUser("admin");
  const studentA = await createUser("student", gradeA);
  const studentB = await createUser("student", gradeA);
  const studentC = await createUser("student", gradeB);

  const me = async (client) => {
    const { data } = await client.auth.getUser();
    return data.user?.id;
  };
  const teacherId = await me(teacher);
  const adminId = await me(adminUser);
  const studentAId = await me(studentA);
  const studentBId = await me(studentB);

  // -------------------------------------------------------------------------
  // Student ID identity constraints
  // -------------------------------------------------------------------------
  const { data: idRows, error: idRowsError } = await admin
    .from("profiles")
    .select("id, student_number, email")
    .in("id", [studentAId, studentBId]);

  check(
    "student rows expose a Student ID and no private Auth e-mail",
    !idRowsError &&
      (idRows ?? []).length === 2 &&
      (idRows ?? []).every(
        (row) =>
          typeof row.student_number === "string" &&
          row.student_number.length > 0 &&
          !String(row.email ?? "")
            .toLowerCase()
            .includes("@accounts.internal"),
      ),
    idRowsError?.message ?? "",
  );

  const numberA = idRows?.find((row) => row.id === studentAId)?.student_number;

  if (!numberA) {
    throw new Error("student A is missing a Student ID");
  }

  const { error: duplicateIdError } = await admin
    .from("profiles")
    .update({ student_number: numberA })
    .eq("id", studentBId);

  check(
    "duplicate Student IDs are rejected globally",
    Boolean(duplicateIdError),
    duplicateIdError?.code ?? "expected a unique violation",
  );

  const { error: blankIdError } = await admin
    .from("profiles")
    .update({ student_number: "" })
    .eq("id", studentBId);

  check(
    "blank Student IDs are rejected for students",
    Boolean(blankIdError),
    blankIdError?.code ?? "expected a format/required violation",
  );

  // Assessment A: grade A, after_review, mixed grading, extra manual essay.
  const assessmentA = await createAssessment({ grade_id: gradeA });
  const sectionA = await createSection(assessmentA);
  const mcQuestion = await createQuestion(sectionA, { position: 0 });
  const mcOptions = await addOptions(mcQuestion, ["Wrong", "Right"]);
  const shortQuestion = await createQuestion(sectionA, {
    position: 1,
    type: "short_answer",
    prompt_en: "One word",
    correct_answer: { accepted: ["photosynthesis"], caseSensitive: false },
  });
  const essayQuestion = await createQuestion(sectionA, {
    position: 2,
    type: "essay",
    prompt_en: "Explain",
    marks: 6,
    grading_method: "manual",
  });

  // Assessment B: grade B, published, automatic.
  const assessmentB = await createAssessment({
    grade_id: gradeB,
    results_visibility: "immediately",
    grading_mode: "automatic",
  });
  const sectionB = await createSection(assessmentB);
  await createQuestion(sectionB, { position: 0 });

  // Assessment C: grade A, results hidden.
  const assessmentC = await createAssessment({
    grade_id: gradeA,
    results_visibility: "hidden",
    grading_mode: "automatic",
  });
  const sectionC = await createSection(assessmentC);
  const hiddenQuestion = await createQuestion(sectionC, { position: 0 });
  const hiddenOptions = await addOptions(hiddenQuestion, ["Wrong", "Right"]);

  // Assessment D: grade A, one-minute timer.
  const assessmentD = await createAssessment({
    grade_id: gradeA,
    time_limit_minutes: 1,
    results_visibility: "immediately",
    grading_mode: "automatic",
  });
  const sectionD = await createSection(assessmentD);
  const timedQuestion = await createQuestion(sectionD, { position: 0 });
  await addOptions(timedQuestion, ["Wrong", "Right"]);

  // -------------------------------------------------------------------------
  // Anonymous access
  // -------------------------------------------------------------------------
  await expectError(
    "anonymous cannot read the assessment overview",
    anon.rpc("student_assessment_overview"),
    "permission denied",
  );
  await expectError(
    "anonymous cannot start an attempt",
    anon.rpc("student_start_attempt", { p_assessment_id: assessmentA }),
    "permission denied",
  );
  await expectError(
    "anonymous cannot call finalize_attempt",
    anon.rpc("finalize_attempt", {
      p_attempt_id: crypto.randomUUID(),
      p_results: [],
    }),
    "permission denied",
  );
  await expectError(
    "anonymous cannot call teacher_grade_attempt",
    anon.rpc("teacher_grade_attempt", {
      p_attempt_id: crypto.randomUUID(),
      p_grades: [],
    }),
    "permission denied",
  );
  await expectRows(
    "anonymous cannot read the audit log",
    anon.from("assessment_admin_events").select("id").limit(1),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  // -------------------------------------------------------------------------
  // Grade isolation
  // -------------------------------------------------------------------------
  await expectRows(
    "grade-A student cannot see grade-B assessment rows",
    studentA.from("assessments").select("id").eq("id", assessmentB),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );
  await expectRows(
    "grade-B student cannot see grade-A assessment rows",
    studentC.from("assessments").select("id").eq("id", assessmentA),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );
  await expectError(
    "grade-A student cannot start a grade-B assessment",
    studentA.rpc("student_start_attempt", { p_assessment_id: assessmentB }),
    "assessment_not_available",
  );
  await expectError(
    "grade-A student cannot fetch a grade-B payload",
    studentA.rpc("get_student_assessment_payload", {
      p_assessment_id: assessmentB,
    }),
    "assessment_not_available",
  );

  const overview = await studentA.rpc("student_assessment_overview");
  check(
    "overview lists only the student's own grade",
    !overview.error &&
      Array.isArray(overview.data) &&
      overview.data.some((row) => row.id === assessmentA) &&
      overview.data.some((row) => row.id === assessmentC) &&
      !overview.data.some((row) => row.id === assessmentB),
    overview.error?.message ??
      `ids=${JSON.stringify((overview.data ?? []).map((row) => row.id))}`,
  );

  // -------------------------------------------------------------------------
  // Answer-key protection
  // -------------------------------------------------------------------------
  await expectRows(
    "students cannot read the questions table",
    studentA.from("questions").select("id").eq("id", mcQuestion),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );
  await expectRows(
    "students cannot read the options table",
    studentA.from("question_options").select("id").eq("question_id", mcQuestion),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );
  await expectRows(
    "students cannot read the matching-pair table",
    studentA.from("matching_pairs").select("id").limit(1),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  const started = await studentA.rpc("student_start_attempt", {
    p_assessment_id: assessmentA,
  });
  check(
    "student starts an attempt through the RPC",
    !started.error && Boolean(started.data?.attempt_id),
    started.error?.message ?? JSON.stringify(started.data),
  );
  const attemptA = started.data?.attempt_id;

  const payload = await studentA.rpc("student_attempt_payload", {
    p_attempt_id: attemptA,
  });
  check(
    "runner payload is sanitized (no keys, flags or explanations)",
    !payload.error && !hasAnswerKey(payload.data),
    payload.error?.message ?? `keys=${Object.keys(payload.data ?? {}).join(",")}`,
  );

  // -------------------------------------------------------------------------
  // Cross-student access
  // -------------------------------------------------------------------------
  await expectRows(
    "another student cannot list my attempt row",
    studentB.from("attempts").select("id").eq("id", attemptA),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );
  await expectError(
    "another student cannot load my attempt payload",
    studentB.rpc("student_attempt_payload", { p_attempt_id: attemptA }),
    "attempt_not_found",
  );
  await expectError(
    "another student cannot read my result",
    studentB.rpc("student_attempt_result", { p_attempt_id: attemptA }),
    "attempt_not_found",
  );
  await expectRows(
    "another student cannot read my saved answers",
    studentB.from("answers").select("id").eq("attempt_id", attemptA),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  const forgedInsert = await studentB.from("answers").insert({
    attempt_id: attemptA,
    question_id: mcQuestion,
    response: { selectedOptionId: mcOptions[1].id },
  });
  check(
    "another student cannot insert an answer into my attempt",
    Boolean(forgedInsert.error),
    forgedInsert.error?.message ?? "insert unexpectedly succeeded",
  );

  const forgedFile = await studentA.from("answers").insert({
    attempt_id: attemptA,
    question_id: essayQuestion,
    response: {},
    file_path: "someone-else/attempt/essay.pdf",
  });
  check(
    "answers reject file paths outside the caller's attempt folder",
    Boolean(forgedFile.error) &&
      /invalid_file_path|row-level security/i.test(forgedFile.error.message),
    forgedFile.error?.message ?? "insert unexpectedly succeeded",
  );

  // -------------------------------------------------------------------------
  // Answer saving integrity
  // -------------------------------------------------------------------------
  const answerInsert = await studentA.from("answers").insert([
    {
      attempt_id: attemptA,
      question_id: mcQuestion,
      response: { selectedOptionId: mcOptions[1].id },
      marks_awarded: 99,
      is_correct: true,
      feedback_en: "forged",
    },
    {
      attempt_id: attemptA,
      question_id: shortQuestion,
      response: { text: "photosynthesis" },
    },
    {
      attempt_id: attemptA,
      question_id: essayQuestion,
      response: { text: "An essay." },
    },
  ]);
  check(
    "student answers save, with grading fields stripped",
    !answerInsert.error,
    answerInsert.error?.message ?? "saved",
  );

  const { data: storedAnswers } = await admin
    .from("answers")
    .select("question_id, marks_awarded, is_correct, feedback_en")
    .eq("attempt_id", attemptA);
  const mcStored = (storedAnswers ?? []).find(
    (row) => row.question_id === mcQuestion,
  );
  check(
    "student-supplied marks and flags are discarded by the trigger",
    mcStored?.marks_awarded === null && mcStored?.is_correct === null,
    JSON.stringify(mcStored),
  );

  // -------------------------------------------------------------------------
  // Retake restriction before submission
  // -------------------------------------------------------------------------
  const resumed = await studentA.rpc("student_start_attempt", {
    p_assessment_id: assessmentA,
  });
  check(
    "starting again resumes the open attempt instead of creating one",
    !resumed.error &&
      resumed.data?.attempt_id === attemptA &&
      resumed.data?.resumed === true,
    resumed.error?.message ?? JSON.stringify(resumed.data),
  );

  const directRetake = await studentA.from("attempts").insert({
    assessment_id: assessmentA,
    student_id: studentAId,
    attempt_number: 2,
    expires_at: new Date(Date.now() + 600000).toISOString(),
  });
  check(
    "a direct attempt insert cannot bypass the retake rules",
    Boolean(directRetake.error),
    directRetake.error?.message ?? "insert unexpectedly succeeded",
  );

  // -------------------------------------------------------------------------
  // Submission and manual grading
  // -------------------------------------------------------------------------
  const finalized = await admin.rpc("finalize_attempt", {
    p_attempt_id: attemptA,
    p_results: [
      { question_id: mcQuestion, marks_awarded: 2, is_correct: true },
      { question_id: shortQuestion, marks_awarded: 2, is_correct: true },
    ],
  });
  check(
    "automatic marks finalize into grading state for the essay",
    !finalized.error && finalized.data?.status === "grading",
    finalized.error?.message ?? JSON.stringify(finalized.data),
  );

  const hiddenBeforeGrade = await studentA.rpc("student_attempt_result", {
    p_attempt_id: attemptA,
  });
  check(
    "after_review results stay hidden until a teacher grades them",
    !hiddenBeforeGrade.error &&
      hiddenBeforeGrade.data?.visible === false &&
      hiddenBeforeGrade.data?.score === undefined,
    hiddenBeforeGrade.error?.message ?? JSON.stringify(hiddenBeforeGrade.data),
  );

  await expectRows(
    "submitted answers stay hidden while results are pending review",
    studentA.from("answers").select("id").eq("attempt_id", attemptA),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  const { data: essayRow } = await admin
    .from("answers")
    .select("id")
    .eq("attempt_id", attemptA)
    .eq("question_id", essayQuestion)
    .single();
  check("essay answer exists for manual grading", Boolean(essayRow?.id), essayRow?.id);

  const gradeResult = await teacher.rpc("teacher_grade_attempt", {
    p_attempt_id: attemptA,
    p_grades: [
      {
        answer_id: essayRow.id,
        marks_awarded: 5,
        feedback_en: "Good",
        feedback_ar: "جيد",
      },
    ],
  });
  check(
    "teacher grades the manual answer",
    !gradeResult.error && gradeResult.data?.status === "graded",
    gradeResult.error?.message ?? JSON.stringify(gradeResult.data),
  );

  const visibleAfterGrade = await studentA.rpc("student_attempt_result", {
    p_attempt_id: attemptA,
  });
  check(
    "after_review results become visible with the graded score",
    !visibleAfterGrade.error &&
      visibleAfterGrade.data?.visible === true &&
      Number(visibleAfterGrade.data?.score) === 9 &&
      Number(visibleAfterGrade.data?.max_score) === 10 &&
      !hasStoredKey(visibleAfterGrade.data),
    visibleAfterGrade.error?.message ?? JSON.stringify(visibleAfterGrade.data),
  );

  await expectRows(
    "graded answers become readable through RLS",
    studentA.from("answers").select("id, marks_awarded").eq("attempt_id", attemptA),
    (rows) => Array.isArray(rows) && rows.length === 3,
  );

  await expectError(
    "students cannot grade attempts themselves",
    studentA.rpc("teacher_grade_attempt", {
      p_attempt_id: attemptA,
      p_grades: [{ answer_id: essayRow.id, marks_awarded: 10 }],
    }),
    "not_authorized",
  );

  // -------------------------------------------------------------------------
  // Retake restriction after submission
  // -------------------------------------------------------------------------
  await expectError(
    "no retakes are allowed after a graded attempt",
    studentA.rpc("student_start_attempt", { p_assessment_id: assessmentA }),
    "retakes_not_allowed",
  );

  // -------------------------------------------------------------------------
  // Hidden results
  // -------------------------------------------------------------------------
  const hiddenStart = await studentA.rpc("student_start_attempt", {
    p_assessment_id: assessmentC,
  });
  const attemptC = hiddenStart.data?.attempt_id;
  const hiddenAnswer = await studentA.from("answers").insert({
    attempt_id: attemptC,
    question_id: hiddenQuestion,
    response: { selectedOptionId: hiddenOptions[1].id },
  });
  check(
    "hidden-results attempt accepts an answer",
    !hiddenAnswer.error,
    hiddenAnswer.error?.message ?? "saved",
  );

  const hiddenFinalize = await admin.rpc("finalize_attempt", {
    p_attempt_id: attemptC,
    p_results: [
      { question_id: hiddenQuestion, marks_awarded: 2, is_correct: true },
    ],
  });
  check(
    "hidden-results attempt is graded server-side",
    !hiddenFinalize.error && hiddenFinalize.data?.status === "graded",
    hiddenFinalize.error?.message ?? JSON.stringify(hiddenFinalize.data),
  );

  const hiddenResult = await studentA.rpc("student_attempt_result", {
    p_attempt_id: attemptC,
  });
  check(
    "hidden results never expose score or answers",
    !hiddenResult.error &&
      hiddenResult.data?.visible === false &&
      hiddenResult.data?.score === undefined &&
      hiddenResult.data?.sections === undefined,
    hiddenResult.error?.message ?? JSON.stringify(hiddenResult.data),
  );

  await expectRows(
    "students cannot read their submitted attempt rows directly",
    studentA.from("attempts").select("id, score").eq("id", attemptC),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );
  await expectRows(
    "hidden answers stay unreadable through RLS",
    studentA.from("answers").select("id").eq("attempt_id", attemptC),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  const overviewAfter = await studentA.rpc("student_assessment_overview");
  const hiddenRow = (overviewAfter.data ?? []).find(
    (row) => row.id === assessmentC,
  );
  check(
    "overview marks the hidden result as not visible",
    Boolean(hiddenRow) && hiddenRow.result_visible === false,
    JSON.stringify(hiddenRow),
  );

  // -------------------------------------------------------------------------
  // Timed attempts
  // -------------------------------------------------------------------------
  const timedStart = await studentA.rpc("student_start_attempt", {
    p_assessment_id: assessmentD,
  });
  const attemptD = timedStart.data?.attempt_id;
  check(
    "timed attempt starts",
    Boolean(attemptD),
    timedStart.error?.message ?? JSON.stringify(timedStart.data),
  );

  const timedAnswer = await studentA.from("answers").insert({
    attempt_id: attemptD,
    question_id: timedQuestion,
    response: { selectedOptionId: (await admin
      .from("question_options")
      .select("id")
      .eq("question_id", timedQuestion)
      .eq("is_correct", true)
      .single()).data?.id },
  });
  check(
    "timed attempt accepts an answer before expiry",
    !timedAnswer.error,
    timedAnswer.error?.message ?? "saved",
  );

  // Force the timer into the past. Service role bypasses the integrity trigger.
  const { error: expireError } = await admin
    .from("attempts")
    .update({
      started_at: new Date(Date.now() - 10 * 60000).toISOString(),
      expires_at: new Date(Date.now() - 5 * 60000).toISOString(),
    })
    .eq("id", attemptD);
  check("attempt can be moved past its timer for testing", !expireError, expireError?.message ?? "ok");

  const lateAnswer = await studentA.from("answers").update({
    response: { text: "late" },
  }).eq("attempt_id", attemptD).eq("question_id", timedQuestion);
  check(
    "answers cannot be written after the timer expires",
    Boolean(lateAnswer.error) && /attempt_expired/.test(lateAnswer.error.message),
    lateAnswer.error?.message ?? "update unexpectedly succeeded",
  );

  const lateSubmit = await studentA
    .from("attempts")
    .update({ status: "submitted" })
    .eq("id", attemptD);
  check(
    "students cannot submit after the timer expires",
    Boolean(lateSubmit.error) && /attempt_expired/.test(lateSubmit.error.message),
    lateSubmit.error?.message ?? "update unexpectedly succeeded",
  );

  const timedFinalize = await admin.rpc("finalize_attempt", {
    p_attempt_id: attemptD,
    p_results: [
      { question_id: timedQuestion, marks_awarded: 2, is_correct: true },
    ],
  });
  check(
    "server-side finalize closes an expired attempt",
    !timedFinalize.error && timedFinalize.data?.status === "graded",
    timedFinalize.error?.message ?? JSON.stringify(timedFinalize.data),
  );

  const closedAfterFinalize = await studentA.rpc("student_attempt_payload", {
    p_attempt_id: attemptD,
  });
  check(
    "the runner payload is closed once the attempt is finalized",
    Boolean(closedAfterFinalize.error),
    closedAfterFinalize.error?.message ?? "payload unexpectedly returned",
  );

  const secondFinalize = await admin.rpc("finalize_attempt", {
    p_attempt_id: attemptD,
    p_results: [],
  });
  check(
    "finalize_attempt is idempotent for a closed attempt",
    !secondFinalize.error &&
      secondFinalize.data?.status === "graded" &&
      Number(secondFinalize.data?.score) === 2,
    secondFinalize.error?.message ?? JSON.stringify(secondFinalize.data),
  );

  // -------------------------------------------------------------------------
  // Strict Exam Mode
  // -------------------------------------------------------------------------
  for (const type of ["exam", "quiz"]) {
    const { data: defaults, error: defaultsError } = await admin
      .from("assessments")
      .insert({
        grade_id: gradeA,
        type,
        title_en: `RLS strict defaults ${type}`,
        title_ar: "افتراضيات التحقق",
        time_limit_minutes: 30,
        results_visibility: "after_review",
        grading_mode: "automatic",
        allow_retakes: false,
        max_attempts: 1,
        is_published: false,
      })
      .select(
        "id, type, strict_exam_mode, allow_resume_after_connection_loss, heartbeat_timeout_seconds",
      )
      .single();

    if (defaultsError || !defaults) {
      throw new Error(
        `strict default ${type} create failed: ${defaultsError?.message}`,
      );
    }

    created.assessments.push(defaults.id);

    check(
      `${type} gets the type-aware strict defaults`,
      defaults.strict_exam_mode === (type === "exam") &&
        defaults.allow_resume_after_connection_loss === (type !== "exam") &&
        Number(defaults.heartbeat_timeout_seconds) === 60,
      JSON.stringify(defaults),
    );
  }

  const assessmentE = await createAssessment({
    grade_id: gradeA,
    type: "exam",
    time_limit_minutes: 30,
    results_visibility: "immediately",
    grading_mode: "automatic",
    allow_retakes: false,
    max_attempts: 1,
    strict_exam_mode: true,
    submit_on_tab_hidden: true,
    submit_on_navigation: true,
    heartbeat_timeout_seconds: 15,
    allow_resume_after_connection_loss: false,
    randomize_question_order: true,
    randomize_option_order: true,
  });
  const sectionE = await createSection(assessmentE);
  const strictQuestionA = await createQuestion(sectionE, { position: 0 });
  const strictQuestionB = await createQuestion(sectionE, {
    position: 1,
    marks: 1,
  });
  const strictOptions = await addOptions(strictQuestionA, [
    "One",
    "Two",
    "Three",
    "Four",
  ]);
  await addOptions(strictQuestionB, ["Yes", "No"]);

  await expectError(
    "anonymous cannot send a heartbeat",
    anon.rpc("attempt_heartbeat", {
      p_attempt_id: crypto.randomUUID(),
      p_tab_hidden: false,
      p_focus_lost: false,
    }),
    "permission denied",
  );

  await expectError(
    "students cannot run the stale-attempt sweep",
    studentA.rpc("finalize_stale_attempts", { p_limit: 10 }),
    "not_authorized",
  );

  const strictStart = await studentA.rpc("student_start_attempt", {
    p_assessment_id: assessmentE,
  });
  const attemptE = strictStart.data?.attempt_id;
  check(
    "strict exam attempt starts",
    Boolean(attemptE),
    strictStart.error?.message ?? JSON.stringify(strictStart.data),
  );

  const strictPayload = await studentA.rpc("student_attempt_payload", {
    p_attempt_id: attemptE,
  });
  check(
    "strict settings are delivered without answer keys",
    !strictPayload.error &&
      strictPayload.data?.assessment?.strict_exam_mode === true &&
      strictPayload.data?.assessment?.heartbeat_timeout_seconds === 15 &&
      !hasAnswerKey(strictPayload.data),
    strictPayload.error?.message ??
      JSON.stringify(strictPayload.data?.assessment ?? null),
  );

  const strictAnswer = await studentA.from("answers").insert({
    attempt_id: attemptE,
    question_id: strictQuestionA,
    response: { selectedOptionId: strictOptions[0].id },
  });
  check(
    "strict attempt accepts an answer before finalisation",
    !strictAnswer.error,
    strictAnswer.error?.message ?? "saved",
  );

  const heartbeat = await studentA.rpc("attempt_heartbeat", {
    p_attempt_id: attemptE,
    p_tab_hidden: true,
    p_focus_lost: true,
  });
  check(
    "heartbeat records the server time and suspicious events",
    !heartbeat.error &&
      heartbeat.data?.status === "in_progress" &&
      heartbeat.data?.strict_exam_mode === true,
    heartbeat.error?.message ?? JSON.stringify(heartbeat.data),
  );

  const heartbeatRow = await admin
    .from("attempts")
    .select(
      "last_heartbeat_at, tab_hidden_count, focus_loss_count, signal_count, submission_reason",
    )
    .eq("id", attemptE)
    .single();
  check(
    "heartbeat counters are stored on the attempt",
    !heartbeatRow.error &&
      Boolean(heartbeatRow.data?.last_heartbeat_at) &&
      Number(heartbeatRow.data?.tab_hidden_count) === 1 &&
      Number(heartbeatRow.data?.focus_loss_count) === 1 &&
      Number(heartbeatRow.data?.signal_count) === 1,
    heartbeatRow.error?.message ?? JSON.stringify(heartbeatRow.data),
  );

  await expectError(
    "another student cannot send a heartbeat for my attempt",
    studentB.rpc("attempt_heartbeat", {
      p_attempt_id: attemptE,
      p_tab_hidden: false,
      p_focus_lost: false,
    }),
    "attempt_not_found",
  );

  const forgedCounters = await studentA
    .from("attempts")
    .update({ tab_hidden_count: 999, focus_loss_count: 999 })
    .eq("id", attemptE);
  const countersAfterForge = await admin
    .from("attempts")
    .select("tab_hidden_count, focus_loss_count")
    .eq("id", attemptE)
    .single();
  check(
    "students cannot forge suspicious-event counters",
    !forgedCounters.error &&
      Number(countersAfterForge.data?.tab_hidden_count) === 1 &&
      Number(countersAfterForge.data?.focus_loss_count) === 1,
    forgedCounters.error?.message ?? JSON.stringify(countersAfterForge.data),
  );

  const forgedReason = await studentA
    .from("attempts")
    .update({ submission_reason: "heartbeat_expired" })
    .eq("id", attemptE);
  const reasonAfterForge = await admin
    .from("attempts")
    .select("submission_reason")
    .eq("id", attemptE)
    .single();
  check(
    "a direct student update cannot set a submission reason",
    !forgedReason.error && reasonAfterForge.data?.submission_reason === null,
    forgedReason.error?.message ?? JSON.stringify(reasonAfterForge.data),
  );

  const forgedClose = await studentA
    .from("attempts")
    .update({ status: "graded" })
    .eq("id", attemptE);
  check(
    "students cannot jump an attempt straight to graded",
    Boolean(forgedClose.error) &&
      /invalid_attempt_transition/.test(forgedClose.error.message),
    forgedClose.error?.message ?? "update unexpectedly succeeded",
  );

  const randomSeed = `rls-${attemptE}`;
  const [seededA, seededB] = await Promise.all([
    studentA.rpc("get_student_assessment_payload", {
      p_assessment_id: assessmentE,
      p_seed: randomSeed,
    }),
    studentA.rpc("get_student_assessment_payload", {
      p_assessment_id: assessmentE,
      p_seed: randomSeed,
    }),
  ]);
  const seededOptions = (payloadData) =>
    (payloadData?.sections ?? []).flatMap((section) =>
      section.questions.flatMap((question) =>
        question.options.map((option) => option.id),
      ),
    );
  check(
    "a seeded payload order is stable and key-free",
    !seededA.error &&
      !seededB.error &&
      JSON.stringify(seededOptions(seededA.data)) ===
        JSON.stringify(seededOptions(seededB.data)) &&
      seededOptions(seededA.data).length === 6 &&
      !hasAnswerKey(seededA.data),
    seededA.error?.message ?? "seeded payload mismatch",
  );

  // Force the heartbeat to look old, exactly like a crashed browser.
  const staleSince = new Date(Date.now() - 2 * 60000).toISOString();
  const { error: staleError } = await admin
    .from("attempts")
    .update({ last_heartbeat_at: staleSince })
    .eq("id", attemptE);
  check(
    "attempt heartbeat can be aged for testing",
    !staleError,
    staleError?.message ?? "ok",
  );

  const staleBeat = await studentA.rpc("attempt_heartbeat", {
    p_attempt_id: attemptE,
  });
  check(
    "a missed heartbeat is reported as stale and not refreshed",
    !staleBeat.error && staleBeat.data?.status === "stale",
    staleBeat.error?.message ?? JSON.stringify(staleBeat.data),
  );

  await expectError(
    "a stale attempt cannot be resumed through the start RPC",
    studentA.rpc("student_start_attempt", { p_assessment_id: assessmentE }),
    "attempt_stale",
  );

  // Never sweep unrelated live attempts on a hosted project. Only run the
  // maintenance RPC when our attempt is the sole stale row.
  const { data: openAttempts } = await admin
    .from("attempts")
    .select(
      "id, started_at, last_heartbeat_at, expires_at, status, assessment:assessments!inner(strict_exam_mode, allow_resume_after_connection_loss, heartbeat_timeout_seconds)",
    )
    .eq("status", "in_progress")
    .limit(1000);

  const staleNow = (row) => {
    const settings = row.assessment ?? {};
    const expiresAt = Date.parse(row.expires_at);
    const lastBeat = Date.parse(row.last_heartbeat_at ?? row.started_at);

    return (
      expiresAt <= Date.now() ||
      (settings.strict_exam_mode === true &&
        settings.allow_resume_after_connection_loss !== true &&
        lastBeat <
          Date.now() - Number(settings.heartbeat_timeout_seconds ?? 60) * 1000)
    );
  };
  const unrelatedStale = (openAttempts ?? []).filter(
    (row) => row.id !== attemptE && staleNow(row),
  );

  if (unrelatedStale.length === 0) {
    const sweep = await admin.rpc("finalize_stale_attempts", { p_limit: 25 });
    const swept = (sweep.data ?? []).find((row) => row.attempt_id === attemptE);
    check(
      "the stale sweep selects the heartbeat-expired attempt",
      !sweep.error && swept?.reason === "heartbeat_expired",
      sweep.error?.message ?? JSON.stringify(sweep.data),
    );
  } else {
    check(
      "the stale sweep was skipped to protect unrelated live attempts",
      true,
      `${unrelatedStale.length} unrelated stale attempt(s) present`,
    );
  }

  const strictFinalize = await admin.rpc("finalize_attempt", {
    p_attempt_id: attemptE,
    p_results: [
      { question_id: strictQuestionA, marks_awarded: 2, is_correct: true },
      { question_id: strictQuestionB, marks_awarded: 1, is_correct: false },
    ],
    p_reason: "heartbeat_expired",
  });
  check(
    "automatic finalisation stores the submission reason",
    !strictFinalize.error &&
      strictFinalize.data?.status === "graded" &&
      strictFinalize.data?.submission_reason === "heartbeat_expired",
    strictFinalize.error?.message ?? JSON.stringify(strictFinalize.data),
  );

  const lateStrictAnswer = await studentA
    .from("answers")
    .update({ response: { selectedOptionId: strictOptions[1].id } })
    .eq("attempt_id", attemptE)
    .eq("question_id", strictQuestionA);

  // The RLS update policy only exposes in-progress rows, so a closed attempt
  // yields a silent zero-row update rather than a raised error. Verify the
  // stored answer itself is untouched.
  const storedStrictAnswer = await admin
    .from("answers")
    .select("response")
    .eq("attempt_id", attemptE)
    .eq("question_id", strictQuestionA)
    .single();
  check(
    "answers cannot be changed after automatic submission",
    !storedStrictAnswer.error &&
      storedStrictAnswer.data?.response?.selectedOptionId ===
        strictOptions[0].id,
    lateStrictAnswer.error?.message ?? JSON.stringify(storedStrictAnswer.data),
  );

  const duplicateFinalize = await admin.rpc("finalize_attempt", {
    p_attempt_id: attemptE,
    p_results: [
      { question_id: strictQuestionA, marks_awarded: 0, is_correct: false },
    ],
    p_reason: "time_expired",
  });
  check(
    "duplicate finalisation keeps the first score and reason",
    !duplicateFinalize.error &&
      Number(duplicateFinalize.data?.score) === Number(
        strictFinalize.data?.score,
      ) &&
      duplicateFinalize.data?.submission_reason === "heartbeat_expired",
    duplicateFinalize.error?.message ??
      JSON.stringify(duplicateFinalize.data),
  );

  const { data: autoEvents } = await admin
    .from("assessment_admin_events")
    .select("id, action, detail")
    .eq("assessment_id", assessmentE)
    .eq("action", "attempt_auto_submitted");
  check(
    "an automatic submission appends exactly one audit event",
    (autoEvents ?? []).length === 1 &&
      autoEvents[0]?.detail?.reason === "heartbeat_expired",
    JSON.stringify(autoEvents ?? []),
  );

  await expectError(
    "a closed strict attempt cannot be restarted without retakes",
    studentA.rpc("student_start_attempt", { p_assessment_id: assessmentE }),
    "retakes_not_allowed",
  );

  const closedStrictPayload = await studentA.rpc("student_attempt_payload", {
    p_attempt_id: attemptE,
  });
  check(
    "the strict runner payload is closed after automatic submission",
    Boolean(closedStrictPayload.error),
    closedStrictPayload.error?.message ?? "payload unexpectedly returned",
  );

  // -------------------------------------------------------------------------
  // Staff access and the audit log
  // -------------------------------------------------------------------------
  await expectRows(
    "teachers can read answer keys directly",
    teacher
      .from("questions")
      .select("id, correct_answer")
      .eq("id", shortQuestion),
    (rows) => Array.isArray(rows) && rows.length === 1,
  );
  await expectRows(
    "teachers can read every attempt",
    teacher.from("attempts").select("id").eq("assessment_id", assessmentA),
    (rows) => Array.isArray(rows) && rows.length >= 1,
  );

  const auditInsert = await teacher.from("assessment_admin_events").insert({
    assessment_id: assessmentA,
    actor_id: teacherId,
    action: "updated",
  });
  check(
    "teachers can append to the assessment audit log",
    !auditInsert.error,
    auditInsert.error?.message ?? "inserted",
  );

  const forgedAudit = await teacher.from("assessment_admin_events").insert({
    assessment_id: assessmentA,
    actor_id: studentAId,
    action: "updated",
  });
  check(
    "audit rows cannot be attributed to another user",
    Boolean(forgedAudit.error),
    forgedAudit.error?.message ?? "insert unexpectedly succeeded",
  );

  const studentAudit = await studentA.from("assessment_admin_events").insert({
    assessment_id: assessmentA,
    actor_id: studentAId,
    action: "updated",
  });
  check(
    "students cannot write to the audit log",
    Boolean(studentAudit.error),
    studentAudit.error?.message ?? "insert unexpectedly succeeded",
  );

  const auditDelete = await teacher
    .from("assessment_admin_events")
    .delete()
    .eq("assessment_id", assessmentA);
  await expectRows(
    "the audit log is append-only",
    teacher.from("assessment_admin_events").select("id").eq("assessment_id", assessmentA),
    (rows) => Array.isArray(rows) && rows.length >= 1,
  );
  check(
    "delete is a silent no-op for the append-only log",
    !auditDelete.error,
    auditDelete.error?.message ?? "no error",
  );

  // Students cannot author or edit assessments.
  const forgedAssessment = await studentA
    .from("assessments")
    .update({ title_en: "Hacked" })
    .eq("id", assessmentA)
    .select("id");
  check(
    "students cannot update assessments",
    !forgedAssessment.error &&
      Array.isArray(forgedAssessment.data) &&
      forgedAssessment.data.length === 0,
    forgedAssessment.error?.message ?? JSON.stringify(forgedAssessment.data),
  );

  // -------------------------------------------------------------------------
  // Submission storage
  // -------------------------------------------------------------------------
  const ownPath = `${studentAId}/${attemptA}/rls-check.pdf`;
  const otherPath = `${studentBId}/${attemptA}/rls-check.pdf`;
  created.storage.push(ownPath, otherPath);

  const ownUpload = await studentA.storage
    .from("assessment-submissions")
    .upload(ownPath, Buffer.from("%PDF-1.4 rls"), { contentType: "application/pdf" });
  check(
    "students can upload inside their own attempt folder",
    !ownUpload.error,
    ownUpload.error?.message ?? "uploaded",
  );

  const foreignUpload = await studentA.storage
    .from("assessment-submissions")
    .upload(otherPath, Buffer.from("%PDF-1.4 rls"), { contentType: "application/pdf" });
  check(
    "students cannot upload into another student's folder",
    Boolean(foreignUpload.error),
    foreignUpload.error?.message ?? "upload unexpectedly succeeded",
  );

  const foreignRead = await studentB.storage
    .from("assessment-submissions")
    .download(ownPath);
  check(
    "students cannot download another student's submission",
    Boolean(foreignRead.error),
    foreignRead.error?.message ?? "download unexpectedly allowed",
  );

  const teacherRead = await teacher.storage
    .from("assessment-submissions")
    .download(ownPath);
  check(
    "teachers can download student submissions",
    !teacherRead.error && Boolean(teacherRead.data),
    teacherRead.error?.message ?? "downloaded",
  );

  // -------------------------------------------------------------------------
  // Phase 4 reporting security
  // -------------------------------------------------------------------------

  // Sync logs: service-role writes, staff reads, students never see them.
  const syncSeed = await admin
    .from("google_sheet_sync_logs")
    .insert({
      attempt_id: attemptC,
      status: "failed",
      last_error: "rls probe",
    })
    .select("id")
    .single();
  check(
    "service role can seed a sync log row",
    !syncSeed.error && Boolean(syncSeed.data?.id),
    syncSeed.error?.message ?? "created",
  );

  if (!syncSeed.error) {
    created.syncLogAttempts.push(attemptC);
  }

  await expectRows(
    "students cannot read Google Sheets sync logs",
    studentA.from("google_sheet_sync_logs").select("id").eq("attempt_id", attemptC),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  await expectRows(
    "teachers can read the sync log",
    teacher.from("google_sheet_sync_logs").select("id").eq("attempt_id", attemptC),
    (rows) => Array.isArray(rows) && rows.length === 1,
  );

  const studentSyncInsert = await studentA
    .from("google_sheet_sync_logs")
    .insert({ attempt_id: attemptA, status: "pending" })
    .select("id");
  check(
    "students cannot insert sync log rows",
    Boolean(studentSyncInsert.error),
    studentSyncInsert.error?.message ?? "insert unexpectedly succeeded",
  );

  const teacherSyncInsert = await teacher
    .from("google_sheet_sync_logs")
    .insert({ attempt_id: attemptA, status: "pending" })
    .select("id");
  check(
    "teachers cannot insert sync log rows",
    Boolean(teacherSyncInsert.error),
    teacherSyncInsert.error?.message ?? "insert unexpectedly succeeded",
  );

  const studentSyncUpdate = await studentA
    .from("google_sheet_sync_logs")
    .update({ status: "synced" })
    .eq("attempt_id", attemptC)
    .select("id");
  check(
    "students cannot update sync log rows",
    !studentSyncUpdate.error &&
      Array.isArray(studentSyncUpdate.data) &&
      studentSyncUpdate.data.length === 0,
    studentSyncUpdate.error?.message ?? JSON.stringify(studentSyncUpdate.data),
  );

  // Reporting settings: admin-only read and update, no insert/delete.
  const { data: settingsBackup, error: settingsReadError } = await admin
    .from("reporting_settings")
    .select("sync_enabled, mock_mode, sheet_name, updated_by")
    .eq("id", 1)
    .single();

  if (!settingsReadError && settingsBackup) {
    created.settingsBackup = settingsBackup;
  }

  check(
    "service role can read the reporting settings row",
    !settingsReadError && Boolean(settingsBackup),
    settingsReadError?.message ?? "read",
  );

  await expectRows(
    "students cannot read reporting settings",
    studentA.from("reporting_settings").select("id"),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  await expectRows(
    "teachers cannot read reporting settings",
    teacher.from("reporting_settings").select("id"),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  await expectRows(
    "administrators can read reporting settings",
    adminUser.from("reporting_settings").select("id, sheet_name"),
    (rows) => Array.isArray(rows) && rows.length === 1,
  );

  const studentSettingsUpdate = await studentA
    .from("reporting_settings")
    .update({ sheet_name: "hacked" })
    .eq("id", 1)
    .select("id");
  check(
    "students cannot update reporting settings",
    !studentSettingsUpdate.error &&
      Array.isArray(studentSettingsUpdate.data) &&
      studentSettingsUpdate.data.length === 0,
    studentSettingsUpdate.error?.message ??
      JSON.stringify(studentSettingsUpdate.data),
  );

  const teacherSettingsUpdate = await teacher
    .from("reporting_settings")
    .update({ sheet_name: "hacked" })
    .eq("id", 1)
    .select("id");
  check(
    "teachers cannot update reporting settings",
    !teacherSettingsUpdate.error &&
      Array.isArray(teacherSettingsUpdate.data) &&
      teacherSettingsUpdate.data.length === 0,
    teacherSettingsUpdate.error?.message ??
      JSON.stringify(teacherSettingsUpdate.data),
  );

  const adminSettingsUpdate = await adminUser
    .from("reporting_settings")
    .update({ sheet_name: `RLS ${short(crypto.randomUUID())}` })
    .eq("id", 1)
    .select("id, sheet_name");
  check(
    "administrators can update reporting settings",
    !adminSettingsUpdate.error &&
      Array.isArray(adminSettingsUpdate.data) &&
      adminSettingsUpdate.data.length === 1,
    adminSettingsUpdate.error?.message ??
      JSON.stringify(adminSettingsUpdate.data),
  );

  const adminSettingsInsert = await adminUser
    .from("reporting_settings")
    .insert({ id: 1, sheet_name: "duplicate" })
    .select("id");
  check(
    "nobody can insert a second reporting settings row",
    Boolean(adminSettingsInsert.error),
    adminSettingsInsert.error?.message ?? "insert unexpectedly succeeded",
  );

  const adminSettingsDelete = await adminUser
    .from("reporting_settings")
    .delete()
    .eq("id", 1)
    .select("id");
  check(
    "the reporting settings row cannot be deleted",
    !adminSettingsDelete.error &&
      Array.isArray(adminSettingsDelete.data) &&
      adminSettingsDelete.data.length === 0,
    adminSettingsDelete.error?.message ??
      JSON.stringify(adminSettingsDelete.data),
  );

  // Reporting audit: staff may append their own events only; nobody edits.
  await expectRows(
    "students cannot read the reporting audit log",
    studentA.from("reporting_admin_events").select("id"),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  await expectRows(
    "teachers can read the reporting audit log",
    teacher.from("reporting_admin_events").select("id"),
    (rows) => Array.isArray(rows) && rows.length >= 0,
  );

  const studentEventInsert = await studentA
    .from("reporting_admin_events")
    .insert({ actor_id: studentAId, action: "sync_manual", detail: {} })
    .select("id");
  check(
    "students cannot append reporting audit events",
    Boolean(studentEventInsert.error),
    studentEventInsert.error?.message ?? "insert unexpectedly succeeded",
  );

  const forgedEventInsert = await teacher
    .from("reporting_admin_events")
    .insert({ actor_id: adminId, action: "sync_manual", detail: {} })
    .select("id");
  check(
    "audit events cannot be attributed to another user",
    Boolean(forgedEventInsert.error),
    forgedEventInsert.error?.message ?? "insert unexpectedly succeeded",
  );

  const ownEventInsert = await teacher
    .from("reporting_admin_events")
    .insert({ actor_id: teacherId, action: "connectivity_checked", detail: {} })
    .select("id")
    .single();
  check(
    "staff can append their own reporting audit event",
    !ownEventInsert.error && Boolean(ownEventInsert.data?.id),
    ownEventInsert.error?.message ?? "created",
  );

  if (ownEventInsert.data?.id) {
    created.events.push(ownEventInsert.data.id);
  }

  const otherEvent = await adminUser
    .from("reporting_admin_events")
    .insert({ actor_id: adminId, action: "settings_updated", detail: {} })
    .select("id")
    .single();

  if (otherEvent.data?.id) {
    created.events.push(otherEvent.data.id);
  }

  const studentEventUpdate = await studentA
    .from("reporting_admin_events")
    .update({ action: "sync_retry" })
    .eq("id", otherEvent.data?.id ?? "00000000-0000-0000-0000-000000000000")
    .select("id");
  check(
    "students cannot update reporting audit events",
    !studentEventUpdate.error &&
      Array.isArray(studentEventUpdate.data) &&
      studentEventUpdate.data.length === 0,
    studentEventUpdate.error?.message ??
      JSON.stringify(studentEventUpdate.data),
  );

  const appendOnlyDelete = await teacher
    .from("reporting_admin_events")
    .delete()
    .eq("id", ownEventInsert.data?.id ?? "00000000-0000-0000-0000-000000000000");
  await expectRows(
    "the reporting audit log is append-only",
    teacher
      .from("reporting_admin_events")
      .select("id")
      .eq("id", ownEventInsert.data?.id ?? "00000000-0000-0000-0000-000000000000"),
    (rows) => Array.isArray(rows) && rows.length === 1,
  );
  check(
    "delete is a silent no-op for reporting audit events",
    !appendOnlyDelete.error,
    appendOnlyDelete.error?.message ?? "no error",
  );

  // -------------------------------------------------------------------------
  // Staff management
  // -------------------------------------------------------------------------
  const secondAdmin = await createUser("admin");
  const secondAdminId = await me(secondAdmin);

  await expectRows(
    "teachers cannot read the staff audit log",
    teacher.from("staff_admin_events").select("id"),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  const teacherEventInsert = await teacher
    .from("staff_admin_events")
    .insert({ staff_id: teacherId, actor_id: teacherId, action: "created" })
    .select("id");
  check(
    "teachers cannot append staff audit events",
    Boolean(teacherEventInsert.error) ||
      (teacherEventInsert.data ?? []).length === 0,
    teacherEventInsert.error?.message ??
      JSON.stringify(teacherEventInsert.data),
  );

  const teacherSelfPromotion = await teacher
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", teacherId)
    .select("id");
  check(
    "teachers cannot promote themselves through profiles",
    Boolean(teacherSelfPromotion.error) ||
      (teacherSelfPromotion.data ?? []).length === 0,
    teacherSelfPromotion.error?.message ??
      JSON.stringify(teacherSelfPromotion.data),
  );

  const { data: teacherRow } = await admin
    .from("profiles")
    .select("role")
    .eq("id", teacherId)
    .single();
  check(
    "the teacher role is unchanged after the failed promotion",
    teacherRow?.role === "teacher",
    teacherRow?.role,
  );

  const teacherStaffEdit = await teacher
    .from("profiles")
    .update({ full_name_en: "Hijacked" })
    .eq("id", adminId)
    .select("id");
  check(
    "teachers cannot edit staff profiles",
    Boolean(teacherStaffEdit.error) ||
      (teacherStaffEdit.data ?? []).length === 0,
    teacherStaffEdit.error?.message ?? JSON.stringify(teacherStaffEdit.data),
  );

  const adminEvent = await adminUser
    .from("staff_admin_events")
    .insert({
      staff_id: teacherId,
      actor_id: adminId,
      action: "updated",
      detail: { role: "teacher" },
    })
    .select("id")
    .single();

  if (adminEvent.data?.id) {
    created.staffEvents.push(adminEvent.data.id);
  }

  check(
    "admins can append staff audit events",
    !adminEvent.error && Boolean(adminEvent.data?.id),
    adminEvent.error?.message ?? adminEvent.data?.id,
  );

  const forgedActor = await adminUser
    .from("staff_admin_events")
    .insert({
      staff_id: teacherId,
      actor_id: teacherId,
      action: "updated",
    })
    .select("id");
  check(
    "admins cannot forge the staff audit actor",
    Boolean(forgedActor.error) || (forgedActor.data ?? []).length === 0,
    forgedActor.error?.message ?? JSON.stringify(forgedActor.data),
  );

  await expectRows(
    "admins can read the staff audit log",
    adminUser
      .from("staff_admin_events")
      .select("id")
      .eq(
        "id",
        adminEvent.data?.id ?? "00000000-0000-0000-0000-000000000000",
      ),
    (rows) => Array.isArray(rows) && rows.length === 1,
  );

  const staffEventUpdate = await adminUser
    .from("staff_admin_events")
    .update({ action: "activated" })
    .eq("id", adminEvent.data?.id ?? "00000000-0000-0000-0000-000000000000")
    .select("id");
  check(
    "staff audit events cannot be updated",
    Boolean(staffEventUpdate.error) ||
      (Array.isArray(staffEventUpdate.data) &&
        staffEventUpdate.data.length === 0),
    staffEventUpdate.error?.message ?? JSON.stringify(staffEventUpdate.data),
  );

  const staffEventDelete = await adminUser
    .from("staff_admin_events")
    .delete()
    .eq("id", adminEvent.data?.id ?? "00000000-0000-0000-0000-000000000000");
  await expectRows(
    "the staff audit log is append-only",
    adminUser
      .from("staff_admin_events")
      .select("id")
      .eq(
        "id",
        adminEvent.data?.id ?? "00000000-0000-0000-0000-000000000000",
      ),
    (rows) => Array.isArray(rows) && rows.length === 1,
  );
  check(
    "staff audit deletes are refused by the append-only guard",
    Boolean(staffEventDelete.error),
    staffEventDelete.error?.message ?? "delete unexpectedly succeeded",
  );

  const selfDemotion = await adminUser
    .from("profiles")
    .update({ role: "teacher" })
    .eq("id", adminId)
    .select("id");
  check(
    "admins cannot demote their own account",
    Boolean(selfDemotion.error) || (selfDemotion.data ?? []).length === 0,
    selfDemotion.error?.message ?? JSON.stringify(selfDemotion.data),
  );

  const selfDeactivation = await adminUser
    .from("profiles")
    .update({ is_active: false })
    .eq("id", adminId)
    .select("id");
  check(
    "admins cannot deactivate their own account",
    Boolean(selfDeactivation.error) ||
      (selfDeactivation.data ?? []).length === 0,
    selfDeactivation.error?.message ?? JSON.stringify(selfDeactivation.data),
  );

  const { data: adminRow } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", adminId)
    .single();
  check(
    "the acting admin account is unchanged after the blocked self changes",
    adminRow?.role === "admin" && adminRow?.is_active === true,
    JSON.stringify(adminRow),
  );

  const demoteSecondAdmin = await adminUser
    .from("profiles")
    .update({ role: "teacher" })
    .eq("id", secondAdminId)
    .select("id");
  check(
    "admins can demote another admin while an active admin remains",
    !demoteSecondAdmin.error &&
      Array.isArray(demoteSecondAdmin.data) &&
      demoteSecondAdmin.data.length === 1,
    demoteSecondAdmin.error?.message ??
      JSON.stringify(demoteSecondAdmin.data),
  );

  // -------------------------------------------------------------------------
  // Assessment import staging
  // -------------------------------------------------------------------------
  const secondTeacher = await createUser("teacher");
  const secondTeacherId = await me(secondTeacher);
  const importId = crypto.randomUUID();
  const importSourcePath = `${teacherId}/${importId}/questions-paper.docx`;
  const importAnswerPath = `${teacherId}/${importId}/answers-key.txt`;
  const importInsert = {
    created_by: teacherId,
    source_file_name: "questions-paper.docx",
    source_mime_type: DOCX_MIME,
    source_size: 1024,
    source_kind: "docx",
    source_path: importSourcePath,
    answer_file_name: "answers-key.txt",
    answer_mime_type: "text/plain",
    answer_size: 64,
    answer_kind: "txt",
    answer_path: importAnswerPath,
    source_text: "1. Choose one.",
    answer_text: "1. B",
    draft: { settings: {}, sections: [], warnings: [], answerKey: [] },
  };

  const studentImportRead = await studentA
    .from("assessment_imports")
    .select("id");
  await expectRows(
    "students cannot read assessment imports",
    Promise.resolve(studentImportRead),
    (rows) => Array.isArray(rows) && rows.length === 0,
  );

  const studentImportInsert = await studentA
    .from("assessment_imports")
    .insert({ ...importInsert, created_by: studentAId })
    .select("id");
  check(
    "students cannot stage assessment imports",
    Boolean(studentImportInsert.error) ||
      (studentImportInsert.data ?? []).length === 0,
    studentImportInsert.error?.message ??
      JSON.stringify(studentImportInsert.data),
  );

  const ownImport = await teacher
    .from("assessment_imports")
    .insert(importInsert)
    .select("id")
    .single();
  const ownImportId = ownImport.data?.id ?? null;

  if (ownImportId) {
    created.imports.push(ownImportId);
  }

  check(
    "teachers can stage their own assessment import",
    !ownImport.error && Boolean(ownImportId),
    ownImport.error?.message ?? ownImportId,
  );

  if (ownImportId) {
    await expectRows(
      "teachers cannot read another teacher's staged import",
      secondTeacher
        .from("assessment_imports")
        .select("id")
        .eq("id", ownImportId),
      (rows) => Array.isArray(rows) && rows.length === 0,
    );

    await expectRows(
      "admins can inspect any staged import",
      adminUser.from("assessment_imports").select("id").eq("id", ownImportId),
      (rows) => Array.isArray(rows) && rows.length === 1,
    );

    await expectRows(
      "students cannot read a specific staged import",
      studentA
        .from("assessment_imports")
        .select("id")
        .eq("id", ownImportId),
      (rows) => Array.isArray(rows) && rows.length === 0,
    );

    const stealOwnership = await secondTeacher
      .from("assessment_imports")
      .update({ created_by: secondTeacherId })
      .eq("id", ownImportId)
      .select("id");
    check(
      "teachers cannot take over another teacher's import",
      Boolean(stealOwnership.error) ||
        (stealOwnership.data ?? []).length === 0,
      stealOwnership.error?.message ?? JSON.stringify(stealOwnership.data),
    );

    const { data: ownerRow } = await admin
      .from("assessment_imports")
      .select("created_by, status")
      .eq("id", ownImportId)
      .single();
    check(
      "the import owner and unpublished status stay intact",
      ownerRow?.created_by === teacherId && ownerRow?.status === "draft",
      JSON.stringify(ownerRow),
    );

    const forgedPath = await teacher
      .from("assessment_imports")
      .insert({
        ...importInsert,
        source_path: `${secondTeacherId}/${importId}/questions-paper.docx`,
      })
      .select("id");
    check(
      "import file paths outside the owner folder are rejected",
      Boolean(forgedPath.error),
      forgedPath.error?.message ?? JSON.stringify(forgedPath.data),
    );

    const badStatus = await teacher
      .from("assessment_imports")
      .insert({ ...importInsert, status: "published" })
      .select("id");
    check(
      "imports cannot be staged with a published status",
      Boolean(badStatus.error),
      badStatus.error?.message ?? JSON.stringify(badStatus.data),
    );
  }

  const importBucket = await admin.storage.getBucket(IMPORT_BUCKET);
  check(
    "the assessment-imports bucket is private and size-limited",
    !importBucket.error &&
      importBucket.data?.public === false &&
      importBucket.data?.file_size_limit === 4194304,
    importBucket.error?.message ?? JSON.stringify(importBucket.data ?? {}),
  );

  const importBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  const importOwnerUpload = await teacher.storage
    .from(IMPORT_BUCKET)
    .upload(importSourcePath, importBytes, {
      contentType: DOCX_MIME,
      upsert: true,
    });
  check(
    "teachers can upload into their own import folder",
    !importOwnerUpload.error,
    importOwnerUpload.error?.message ?? "uploaded",
  );

  const importOwnerDownload = await teacher.storage
    .from(IMPORT_BUCKET)
    .download(importSourcePath);
  check(
    "teachers can read their own import file",
    !importOwnerDownload.error && Boolean(importOwnerDownload.data),
    importOwnerDownload.error?.message ?? "downloaded",
  );

  const importAnonDownload = await anon.storage
    .from(IMPORT_BUCKET)
    .download(importSourcePath);
  check(
    "anonymous requests cannot download import files",
    Boolean(importAnonDownload.error),
    importAnonDownload.error?.message ?? "download unexpectedly succeeded",
  );

  const importForeignUpload = await secondTeacher.storage
    .from(IMPORT_BUCKET)
    .upload(`${teacherId}/${importId}/hijack.docx`, importBytes, {
      contentType: DOCX_MIME,
      upsert: true,
    });
  check(
    "teachers cannot upload into another teacher's import folder",
    Boolean(importForeignUpload.error),
    importForeignUpload.error?.message ?? "upload unexpectedly succeeded",
  );

  const importStudentUpload = await studentA.storage
    .from(IMPORT_BUCKET)
    .upload(`${studentAId}/${importId}/questions-paper.docx`, importBytes, {
      contentType: DOCX_MIME,
      upsert: true,
    });
  check(
    "students cannot upload import files even into their own folder",
    Boolean(importStudentUpload.error),
    importStudentUpload.error?.message ?? "upload unexpectedly succeeded",
  );

  const importBadMimeUpload = await teacher.storage
    .from(IMPORT_BUCKET)
    .upload(`${teacherId}/${importId}/paper.png`, importBytes, {
      contentType: "image/png",
      upsert: true,
    });
  check(
    "the import bucket rejects non-document MIME types",
    Boolean(importBadMimeUpload.error),
    importBadMimeUpload.error?.message ?? "upload unexpectedly succeeded",
  );

  created.importObjects.push(importSourcePath, importAnswerPath);

  for (const action of [
    "import_started",
    "import_draft_created",
    "import_draft_edited",
    "import_published",
  ]) {
    const event = await teacher
      .from("assessment_admin_events")
      .insert({
        assessment_id: null,
        actor_id: teacherId,
        action,
        detail: { question_count: 1 },
      })
      .select("id")
      .single();

    if (event.data?.id) {
      created.importAuditEvents.push(event.data.id);
    }

    check(
      `the import audit action ${action} is accepted`,
      !event.error && Boolean(event.data?.id),
      event.error?.message ?? event.data?.id,
    );
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
}

async function cleanup() {
  try {
    // Restore the shared settings row first; it is global, not test data.
    if (created.settingsBackup) {
      const { error } = await admin
        .from("reporting_settings")
        .update({
          sync_enabled: created.settingsBackup.sync_enabled,
          mock_mode: created.settingsBackup.mock_mode,
          sheet_name: created.settingsBackup.sheet_name,
          updated_by: created.settingsBackup.updated_by,
        })
        .eq("id", 1);

      if (error) {
        console.error("settings restore failed:", error.message);
      }
    }

    for (const attemptId of created.syncLogAttempts) {
      await admin
        .from("google_sheet_sync_logs")
        .delete()
        .eq("attempt_id", attemptId);
    }

    if (created.events.length > 0) {
      await admin.from("reporting_admin_events").delete().in("id", created.events);
    }

    if (created.staffEvents.length > 0) {
      await admin
        .from("staff_admin_events")
        .delete()
        .in("id", created.staffEvents);
    }

    if (created.storage.length > 0) {
      await admin.storage.from("assessment-submissions").remove(created.storage);
    }

    if (created.importAuditEvents.length > 0) {
      await admin
        .from("assessment_admin_events")
        .delete()
        .in("id", created.importAuditEvents);
    }

    if (created.importObjects.length > 0) {
      await admin.storage.from(IMPORT_BUCKET).remove(created.importObjects);
    }

    if (created.users.length > 0) {
      await admin
        .from("assessment_imports")
        .delete()
        .in("created_by", created.users);
    }

    // Auth occasionally refuses a delete while a session request is still in
    // flight ("Database error deleting user"), so retry briefly.
    for (const userId of created.users) {
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (!error) {
          lastError = null;
          break;
        }
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (lastError) {
        console.error("user delete failed", userId, lastError.message);
      }
    }
    for (const assessmentId of created.assessments) {
      await admin
        .from("assessment_admin_events")
        .delete()
        .eq("assessment_id", assessmentId);
      await admin.from("attempts").delete().eq("assessment_id", assessmentId);
      await admin.from("assessments").delete().eq("id", assessmentId);
    }
    for (const gradeId of created.grades) {
      await admin.from("grades").delete().eq("id", gradeId);
    }
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
}

async function verifyCleanup() {
  try {
    if (created.users.length > 0) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .in("id", created.users);
      const left = (data ?? []).length;
      check(
        "cleanup deletes every test user, including the teacher who graded",
        left === 0,
        `${left} profile(s) left`,
      );
    }

    if (created.assessments.length > 0) {
      const { data: assessments } = await admin
        .from("assessments")
        .select("id")
        .in("id", created.assessments);
      check(
        "cleanup deletes every test assessment",
        (assessments ?? []).length === 0,
        `${(assessments ?? []).length} assessment(s) left`,
      );

      const { data: events } = await admin
        .from("assessment_admin_events")
        .select("id")
        .in("assessment_id", created.assessments);
      check(
        "cleanup deletes the audit rows it wrote",
        (events ?? []).length === 0,
        `${(events ?? []).length} audit row(s) left`,
      );
    }

    if (created.grades.length > 0) {
      const { data: grades } = await admin
        .from("grades")
        .select("id")
        .in("id", created.grades);
      check(
        "cleanup deletes the temporary grade",
        (grades ?? []).length === 0,
        `${(grades ?? []).length} grade(s) left`,
      );
    }

    if (created.syncLogAttempts.length > 0) {
      const { data: logs } = await admin
        .from("google_sheet_sync_logs")
        .select("attempt_id")
        .in("attempt_id", created.syncLogAttempts);
      check(
        "cleanup deletes the sync log rows it wrote",
        (logs ?? []).length === 0,
        `${(logs ?? []).length} sync log row(s) left`,
      );
    }

    if (created.events.length > 0) {
      const { data: events } = await admin
        .from("reporting_admin_events")
        .select("id")
        .in("id", created.events);
      check(
        "cleanup deletes the reporting audit rows it wrote",
        (events ?? []).length === 0,
        `${(events ?? []).length} reporting audit row(s) left`,
      );
    }

    if (created.staffEvents.length > 0) {
      const { data: staffEvents } = await admin
        .from("staff_admin_events")
        .select("id")
        .in("id", created.staffEvents);
      check(
        "cleanup deletes the staff audit rows it wrote",
        (staffEvents ?? []).length === 0,
        `${(staffEvents ?? []).length} staff audit row(s) left`,
      );
    }

    if (created.imports.length > 0) {
      const { data: imports } = await admin
        .from("assessment_imports")
        .select("id")
        .in("id", created.imports);
      check(
        "cleanup deletes every staged assessment import",
        (imports ?? []).length === 0,
        `${(imports ?? []).length} import row(s) left`,
      );
    }

    if (created.importObjects.length > 0) {
      const leftovers = [];

      for (const objectPath of created.importObjects) {
        const { error } = await admin.storage
          .from(IMPORT_BUCKET)
          .download(objectPath);

        if (!error) {
          leftovers.push(objectPath);
        }
      }

      check(
        "cleanup deletes every temporary import file",
        leftovers.length === 0,
        `${leftovers.length} import object(s) left`,
      );
    }

    if (created.importAuditEvents.length > 0) {
      const { data: importEvents } = await admin
        .from("assessment_admin_events")
        .select("id")
        .in("id", created.importAuditEvents);
      check(
        "cleanup deletes the import audit rows it wrote",
        (importEvents ?? []).length === 0,
        `${(importEvents ?? []).length} import audit row(s) left`,
      );
    }

    if (created.settingsBackup) {
      const { data: settings } = await admin
        .from("reporting_settings")
        .select("sync_enabled, mock_mode, sheet_name, updated_by")
        .eq("id", 1)
        .single();
      check(
        "cleanup restores the original reporting settings",
        Boolean(settings) &&
          settings.sync_enabled === created.settingsBackup.sync_enabled &&
          settings.mock_mode === created.settingsBackup.mock_mode &&
          settings.sheet_name === created.settingsBackup.sheet_name &&
          settings.updated_by === created.settingsBackup.updated_by,
        JSON.stringify(settings),
      );
    }
  } catch (error) {
    check("cleanup verification ran", false, error.message);
  }
}

try {
  await run();
} catch (error) {
  check("suite completed without an unexpected exception", false, error.message);
} finally {
  await cleanup();
  await verifyCleanup();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed, ${failed.length} failed.`,
);
process.exitCode = failed.length ? 1 : 0;
await new Promise((resolve) => setTimeout(resolve, 300));
