import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AssessmentSectionRecord,
  GradingMode,
  MatchingPairRecord,
  QuestionOptionRecord,
  QuestionRecord,
} from "@/lib/domain/types";
import {
  buildAutomaticResults,
  type GradableAnswer,
  type GradableQuestion,
} from "@/lib/assessments/grading";
import type { AssessmentErrorCode } from "@/lib/validation/assessments";
import { requestAttemptSync } from "@/lib/reporting/sync";

export type FinalizeOutcome =
  | {
      ok: true;
      status: string;
      score: number | null;
      maxScore: number | null;
      percentage: number | null;
      pendingReview: boolean;
    }
  | { ok: false; error: AssessmentErrorCode };

function mapRpcError(message: string): AssessmentErrorCode {
  if (message.includes("attempt_not_found")) return "not_found";
  if (message.includes("attempt_closed")) return "attempt_closed";
  if (message.includes("attempt_not_submitted")) return "attempt_not_submitted";
  if (message.includes("assessment_has_no_marks")) return "assessment_no_questions";
  if (message.includes("not_authorized")) return "forbidden";
  if (message.includes("service_role") || message.includes("not configured")) {
    return "service_unavailable";
  }
  return "unknown";
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

/**
 * Loads the private question data (including keys) with the service-role client,
 * computes the objective marks in TypeScript and applies them atomically.
 *
 * Pass `studentId` when finalizing on behalf of a student; the attempt is then
 * verified to belong to that student before anything is written.
 */
export async function finalizeAttempt(options: {
  attemptId: string;
  studentId?: string;
}): Promise<FinalizeOutcome> {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "service_unavailable" };
  }

  const { data: attempt, error: attemptError } = await admin
    .from("attempts")
    .select(
      "id, assessment_id, student_id, status, score, max_score, percentage",
    )
    .eq("id", options.attemptId)
    .maybeSingle();

  if (attemptError) {
    console.error("finalize attempt lookup failed", attemptError.message);
    return { ok: false, error: "unknown" };
  }

  if (!attempt) {
    return { ok: false, error: "not_found" };
  }

  if (options.studentId && attempt.student_id !== options.studentId) {
    return { ok: false, error: "not_found" };
  }

  if (attempt.status !== "in_progress") {
    return {
      ok: true,
      status: attempt.status,
      score: attempt.score === null ? null : toNumber(attempt.score),
      maxScore: attempt.max_score === null ? null : toNumber(attempt.max_score),
      percentage:
        attempt.percentage === null ? null : toNumber(attempt.percentage),
      pendingReview: attempt.status === "grading",
    };
  }

  const { data: assessment, error: assessmentError } = await admin
    .from("assessments")
    .select("id, grading_mode")
    .eq("id", attempt.assessment_id)
    .maybeSingle();

  if (assessmentError || !assessment) {
    console.error(
      "finalize assessment lookup failed",
      assessmentError?.message ?? "missing",
    );
    return { ok: false, error: "unknown" };
  }

  const { data: sectionRows, error: sectionError } = await admin
    .from("assessment_sections")
    .select("id")
    .eq("assessment_id", attempt.assessment_id);

  if (sectionError) {
    console.error("finalize section lookup failed", sectionError.message);
    return { ok: false, error: "unknown" };
  }

  const sectionIds = ((sectionRows ?? []) as Array<{ id: string }>).map(
    (section) => section.id,
  );

  let questions: QuestionRecord[] = [];

  if (sectionIds.length > 0) {
    const { data: questionRows, error: questionError } = await admin
      .from("questions")
      .select(
        "id, section_id, type, marks, grading_method, correct_answer, position, prompt_en, prompt_ar, help_text_en, help_text_ar, is_required, explanation_en, explanation_ar, created_at, updated_at",
      )
      .in("section_id", sectionIds)
      .order("position", { ascending: true });

    if (questionError) {
      console.error("finalize question lookup failed", questionError.message);
      return { ok: false, error: "unknown" };
    }

    questions = ((questionRows ?? []) as unknown as Array<
      Omit<QuestionRecord, "options" | "pairs">
    >).map((question) => ({
      ...question,
      marks: toNumber(question.marks),
      options: [],
      pairs: [],
    }));
  }

  const questionIds = questions.map((question) => question.id);
  const optionsByQuestion = new Map<string, QuestionOptionRecord[]>();
  const pairsByQuestion = new Map<string, MatchingPairRecord[]>();

  if (questionIds.length > 0) {
    const [optionsResult, pairsResult] = await Promise.all([
      admin
        .from("question_options")
        .select("id, question_id, is_correct")
        .in("question_id", questionIds),
      admin
        .from("matching_pairs")
        .select("id, question_id, right_key")
        .in("question_id", questionIds),
    ]);

    if (optionsResult.error || pairsResult.error) {
      console.error(
        "finalize option/pair lookup failed",
        optionsResult.error?.message ?? pairsResult.error?.message,
      );
      return { ok: false, error: "unknown" };
    }

    for (const option of (optionsResult.data ?? []) as Array<{
      id: string;
      question_id: string;
      is_correct: boolean;
    }>) {
      optionsByQuestion.set(option.question_id, [
        ...(optionsByQuestion.get(option.question_id) ?? []),
        option as QuestionOptionRecord,
      ]);
    }

    for (const pair of (pairsResult.data ?? []) as Array<{
      id: string;
      question_id: string;
      right_key: string;
    }>) {
      pairsByQuestion.set(pair.question_id, [
        ...(pairsByQuestion.get(pair.question_id) ?? []),
        pair as MatchingPairRecord,
      ]);
    }
  }

  const gradable: GradableQuestion[] = questions.map((question) => ({
    id: question.id,
    type: question.type,
    marks: question.marks,
    grading_method: question.grading_method,
    correct_answer: question.correct_answer,
    options: (optionsByQuestion.get(question.id) ?? []).map((option) => ({
      id: option.id,
      is_correct: option.is_correct,
    })),
    pairs: (pairsByQuestion.get(question.id) ?? []).map((pair) => ({
      id: pair.id,
      right_key: pair.right_key,
    })),
  }));

  const { data: answerRows, error: answerError } = await admin
    .from("answers")
    .select("question_id, response, file_path")
    .eq("attempt_id", options.attemptId);

  if (answerError) {
    console.error("finalize answer lookup failed", answerError.message);
    return { ok: false, error: "unknown" };
  }

  const answers: GradableAnswer[] = (
    (answerRows ?? []) as Array<{
      question_id: string;
      response: Record<string, unknown>;
      file_path: string | null;
    }>
  ).map((answer) => ({
    question_id: answer.question_id,
    response: answer.response,
    file_path: answer.file_path,
  }));

  const results = buildAutomaticResults({
    gradingMode: assessment.grading_mode as GradingMode,
    questions: gradable,
    answers,
  });

  const { data, error } = await admin.rpc("finalize_attempt", {
    p_attempt_id: options.attemptId,
    p_results: results,
  });

  if (error) {
    console.error("finalize_attempt failed", error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  const summary = data as {
    status: string;
    score: number | null;
    max_score: number | null;
    percentage: number | null;
    pending_review: boolean;
  };

  // Reporting is best-effort and runs after the response. A Google outage can
  // never fail or slow down the student's submission.
  try {
    after(() => requestAttemptSync(options.attemptId));
  } catch {
    // Called outside a request scope (for example a maintenance script).
  }

  return {
    ok: true,
    status: summary.status,
    score: summary.score === null ? null : toNumber(summary.score),
    maxScore: summary.max_score === null ? null : toNumber(summary.max_score),
    percentage:
      summary.percentage === null ? null : toNumber(summary.percentage),
    pendingReview: Boolean(summary.pending_review),
  };
}

/** Small helper used by tests and by the teacher grading screen. */
export function totalsForQuestions(
  questions: Array<Pick<QuestionRecord, "marks">>,
): number {
  return questions.reduce((sum, question) => sum + Number(question.marks), 0);
}

export type { AssessmentSectionRecord };
