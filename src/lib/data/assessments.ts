import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentAdminEvent,
  AssessmentAttemptRow,
  AssessmentDetail,
  AssessmentRecord,
  AssessmentSectionRecord,
  MatchingPairRecord,
  QuestionOptionRecord,
  QuestionRecord,
  StudentAssessmentOverview,
  StudentAttemptPayload,
  StudentAttemptResult,
} from "@/lib/domain/types";
import {
  ASSESSMENTS_PAGE_SIZE,
  type AssessmentFilters,
} from "@/lib/assessments/filters";
import { buildIlikeOrFilter, clampPage } from "@/lib/search";

const ASSESSMENT_SELECT = `
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
  available_from,
  available_until,
  strict_exam_mode,
  submit_on_tab_hidden,
  submit_on_navigation,
  heartbeat_timeout_seconds,
  allow_resume_after_connection_loss,
  randomize_question_order,
  randomize_option_order,
  created_by,
  created_at,
  updated_at,
  grade:grades ( id, name_en, name_ar, slug )
`;

export type AssessmentListResult = {
  assessments: AssessmentRecord[];
  total: number;
  page: number;
  pageCount: number;
  hasError: boolean;
};

async function runList(
  filters: AssessmentFilters,
  page: number,
): Promise<{
  data: unknown;
  count: number | null;
  error: { message: string } | null;
}> {
  const supabase = await createClient();
  const from = (page - 1) * ASSESSMENTS_PAGE_SIZE;

  let query = supabase
    .from("assessments")
    .select(ASSESSMENT_SELECT, { count: "exact" });

  if (filters.search) {
    query = query.or(
      buildIlikeOrFilter(
        ["title_en", "title_ar", "instructions_en", "instructions_ar"],
        filters.search,
      ),
    );
  }

  if (filters.gradeId) {
    query = query.eq("grade_id", filters.gradeId);
  }

  if (filters.type !== "all") {
    query = query.eq("type", filters.type);
  }

  if (filters.status !== "all") {
    query = query.eq("is_published", filters.status === "published");
  }

  return query
    .order("created_at", { ascending: false })
    .range(from, from + ASSESSMENTS_PAGE_SIZE - 1);
}

/** Staff list: drafts included and every grade visible. */
export async function listTeacherAssessments(
  filters: AssessmentFilters,
): Promise<AssessmentListResult> {
  const first = await runList(filters, filters.page);

  if (first.error) {
    console.error("teacher assessment list failed", first.error.message);
    return {
      assessments: [],
      total: 0,
      page: 1,
      pageCount: 0,
      hasError: true,
    };
  }

  const total = first.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ASSESSMENTS_PAGE_SIZE));
  const page = clampPage(filters.page, pageCount);
  let rows = (first.data ?? []) as unknown as AssessmentRecord[];

  if (rows.length === 0 && total > 0 && page !== filters.page) {
    const retry = await runList(filters, page);

    if (retry.error) {
      console.error("teacher assessment list retry failed", retry.error.message);
      return { assessments: [], total, page, pageCount, hasError: true };
    }

    rows = (retry.data ?? []) as unknown as AssessmentRecord[];
  }

  return { assessments: rows, total, page, pageCount, hasError: false };
}

export async function getTeacherAssessmentById(
  id: string,
): Promise<AssessmentRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select(ASSESSMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("teacher assessment lookup failed", error.message);
    return null;
  }

  return (data as unknown as AssessmentRecord | null) ?? null;
}

/**
 * Loads sections, questions, options and pairs in four queries and assembles
 * them in order. This avoids relying on deep PostgREST embedding rules.
 */
export async function getAssessmentDetail(
  id: string,
): Promise<AssessmentDetail | null> {
  const assessment = await getTeacherAssessmentById(id);

  if (!assessment) {
    return null;
  }

  const supabase = await createClient();
  const { data: sectionRows, error: sectionError } = await supabase
    .from("assessment_sections")
    .select(
      "id, assessment_id, kind, title_en, title_ar, instructions_en, instructions_ar, passage_en, vocabulary_en, source_en, dialogue_lines, position",
    )
    .eq("assessment_id", id)
    .order("position", { ascending: true });

  if (sectionError) {
    console.error("assessment section list failed", sectionError.message);
    return null;
  }

  const sections = (
    (sectionRows ?? []) as unknown as Array<
      Omit<AssessmentSectionRecord, "questions">
    >
  ).map((section) => ({
    ...section,
    kind: section.kind ?? "standard",
    dialogue_lines: Array.isArray(section.dialogue_lines)
      ? section.dialogue_lines.filter(
          (line) =>
            line &&
            typeof line === "object" &&
            typeof (line as { speaker?: unknown }).speaker === "string" &&
            typeof (line as { text?: unknown }).text === "string",
        )
      : [],
  }));
  const sectionIds = sections.map((section) => section.id);

  let questions: QuestionRecord[] = [];

  if (sectionIds.length > 0) {
    const { data: questionRows, error: questionError } = await supabase
      .from("questions")
      .select(
        "id, section_id, type, prompt_en, prompt_ar, help_text_en, help_text_ar, topic_en, min_words, max_words, rubric_en, marks, is_required, position, correct_answer, grading_method, explanation_en, explanation_ar, created_at, updated_at",
      )
      .in("section_id", sectionIds)
      .order("position", { ascending: true });

    if (questionError) {
      console.error("assessment question list failed", questionError.message);
      return null;
    }

    questions = ((questionRows ?? []) as unknown as Array<
      Omit<QuestionRecord, "options" | "pairs">
    >).map((question) => ({
      ...question,
      marks: Number(question.marks),
      options: [],
      pairs: [],
    }));
  }

  const questionIds = questions.map((question) => question.id);

  if (questionIds.length > 0) {
    const [optionsResult, pairsResult] = await Promise.all([
      supabase
        .from("question_options")
        .select(
          "id, question_id, label, text_en, text_ar, is_correct, position",
        )
        .in("question_id", questionIds)
        .order("position", { ascending: true }),
      supabase
        .from("matching_pairs")
        .select(
          "id, question_id, left_text_en, left_text_ar, right_text_en, right_text_ar, right_key, position",
        )
        .in("question_id", questionIds)
        .order("position", { ascending: true }),
    ]);

    if (optionsResult.error) {
      console.error("question option list failed", optionsResult.error.message);
      return null;
    }

    if (pairsResult.error) {
      console.error("matching pair list failed", pairsResult.error.message);
      return null;
    }

    const options = (optionsResult.data ?? []) as unknown as QuestionOptionRecord[];
    const pairs = (pairsResult.data ?? []) as unknown as MatchingPairRecord[];
    const optionsByQuestion = new Map<string, QuestionOptionRecord[]>();
    const pairsByQuestion = new Map<string, MatchingPairRecord[]>();

    for (const option of options) {
      optionsByQuestion.set(option.question_id, [
        ...(optionsByQuestion.get(option.question_id) ?? []),
        option,
      ]);
    }

    for (const pair of pairs) {
      pairsByQuestion.set(pair.question_id, [
        ...(pairsByQuestion.get(pair.question_id) ?? []),
        pair,
      ]);
    }

    questions = questions.map((question) => ({
      ...question,
      options: optionsByQuestion.get(question.id) ?? [],
      pairs: pairsByQuestion.get(question.id) ?? [],
    }));
  }

  const questionsBySection = new Map<string, QuestionRecord[]>();

  for (const question of questions) {
    questionsBySection.set(question.section_id, [
      ...(questionsBySection.get(question.section_id) ?? []),
      question,
    ]);
  }

  const assembled: AssessmentSectionRecord[] = sections.map((section) => ({
    ...section,
    questions: questionsBySection.get(section.id) ?? [],
  }));

  return {
    ...assessment,
    sections: assembled,
    questionCount: questions.length,
    totalMarks: questions.reduce((sum, question) => sum + Number(question.marks), 0),
  };
}

export async function listAssessmentAdminEvents(
  assessmentId: string,
  limit = 20,
): Promise<AssessmentAdminEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessment_admin_events")
    .select(
      "id, assessment_id, actor_id, action, detail, created_at, actor:profiles!assessment_admin_events_actor_id_fkey ( id, full_name_en, full_name_ar )",
    )
    .eq("assessment_id", assessmentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("assessment event list failed", error.message);
    return [];
  }

  return (data ?? []) as unknown as AssessmentAdminEvent[];
}

/** Whether any student has answered this question (locks its type). */
export async function questionHasAnswers(questionId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId);

  if (error) {
    console.error("question answer count failed", error.message);
    return true;
  }

  return (count ?? 0) > 0;
}

export async function listAssessmentAttempts(
  assessmentId: string,
): Promise<{ attempts: AssessmentAttemptRow[]; hasError: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, assessment_id, student_id, attempt_number, status, started_at, expires_at, submitted_at, score, max_score, percentage, manual_review_status, submission_reason, last_heartbeat_at, tab_hidden_count, focus_loss_count, signal_count, student:profiles!attempts_student_id_fkey ( id, full_name_en, full_name_ar, student_number )",
    )
    .eq("assessment_id", assessmentId)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false });

  if (error) {
    console.error("assessment attempt list failed", error.message);
    return { attempts: [], hasError: true };
  }

  return {
    attempts: (data ?? []) as unknown as AssessmentAttemptRow[],
    hasError: false,
  };
}

export type GradingAttempt = {
  id: string;
  assessment_id: string;
  student_id: string;
  attempt_number: number;
  status: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  manual_review_status: string;
  student: {
    id: string;
    full_name_en: string;
    full_name_ar: string | null;
    student_number: string | null;
  } | null;
};

export type GradingAnswer = {
  id: string;
  question_id: string;
  response: Record<string, unknown>;
  file_path: string | null;
  marks_awarded: number | null;
  is_correct: boolean | null;
  feedback_en: string | null;
  feedback_ar: string | null;
};

export async function getAttemptForGrading(attemptId: string): Promise<{
  attempt: GradingAttempt;
  detail: AssessmentDetail;
  answers: GradingAnswer[];
} | null> {
  const supabase = await createClient();
  const { data: attempt, error } = await supabase
    .from("attempts")
    .select(
      "id, assessment_id, student_id, attempt_number, status, started_at, submitted_at, score, max_score, percentage, manual_review_status, student:profiles!attempts_student_id_fkey ( id, full_name_en, full_name_ar, student_number )",
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    console.error("attempt lookup failed", error.message);
    return null;
  }

  if (!attempt) {
    return null;
  }

  const typed = attempt as unknown as GradingAttempt;
  const detail = await getAssessmentDetail(typed.assessment_id);

  if (!detail) {
    return null;
  }

  const { data: answerRows, error: answerError } = await supabase
    .from("answers")
    .select(
      "id, question_id, response, file_path, marks_awarded, is_correct, feedback_en, feedback_ar",
    )
    .eq("attempt_id", attemptId);

  if (answerError) {
    console.error("attempt answer list failed", answerError.message);
    return null;
  }

  return {
    attempt: typed,
    detail,
    answers: (answerRows ?? []) as unknown as GradingAnswer[],
  };
}

/** The student assessment list is produced entirely by the guarded RPC. */
export async function listStudentAssessments(): Promise<{
  assessments: StudentAssessmentOverview[];
  hasError: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_assessment_overview");

  if (error) {
    console.error("student assessment overview failed", error.message);
    return { assessments: [], hasError: true };
  }

  return {
    assessments: (data ?? []) as unknown as StudentAssessmentOverview[],
    hasError: false,
  };
}

/** One row of the guarded student overview, or null when not visible. */
export async function getStudentAssessmentOverviewRow(
  assessmentId: string,
): Promise<StudentAssessmentOverview | null> {
  const result = await listStudentAssessments();

  if (result.hasError) {
    return null;
  }

  return (
    result.assessments.find(
      (assessment) => assessment.id === assessmentId,
    ) ?? null
  );
}

export async function getStudentAttemptPayload(
  attemptId: string,
): Promise<{ payload: StudentAttemptPayload | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_attempt_payload", {
    p_attempt_id: attemptId,
  });

  if (error) {
    return { payload: null, error: error.message };
  }

  return { payload: data as unknown as StudentAttemptPayload, error: null };
}

export async function getStudentAttemptResult(
  attemptId: string,
): Promise<{ result: StudentAttemptResult | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_attempt_result", {
    p_attempt_id: attemptId,
  });

  if (error) {
    return { result: null, error: error.message };
  }

  return { result: data as unknown as StudentAttemptResult, error: null };
}
