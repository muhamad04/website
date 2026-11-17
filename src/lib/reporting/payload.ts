/**
 * The 18-column Google Sheets row.
 *
 * `buildSyncPayload` is pure and deliberately narrow: it receives only
 * submission metadata, student placement, assessment metadata and teacher
 * feedback snippets. Essay responses, answer text and uploaded file paths are
 * never part of the input type, so they cannot leak into the sheet by
 * accident.
 */

import type {
  AssessmentType,
  AttemptStatus,
  GradingMode,
  ManualReviewStatus,
  ResultsVisibility,
} from "@/lib/domain/types";

export const SHEET_HEADERS = [
  "Submission ID",
  "Student ID",
  "Student name",
  "Student email",
  "Grade",
  "Class",
  "Assessment title",
  "Assessment type",
  "Grading mode",
  "Start time",
  "Submission time",
  "Time limit (minutes)",
  "Score",
  "Maximum score",
  "Percentage",
  "Result status",
  "Manual review status",
  "Feedback summary",
] as const;

export const SHEET_COLUMN_COUNT = SHEET_HEADERS.length;

export type SyncAttempt = {
  id: string;
  attempt_number: number;
  started_at: string;
  submitted_at: string | null;
  status: AttemptStatus;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  manual_review_status: ManualReviewStatus;
};

export type SyncAssessment = {
  title_en: string;
  title_ar: string | null;
  type: AssessmentType;
  grading_mode: GradingMode;
  results_visibility: ResultsVisibility;
  time_limit_minutes: number;
};

export type SyncStudent = {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  email: string | null;
  student_number: string | null;
  grade_name_en: string | null;
  grade_name_ar: string | null;
  class_name_en: string | null;
  class_name_ar: string | null;
};

export type SyncFeedbackEntry = {
  feedback_en: string | null;
  feedback_ar: string | null;
};

export type SyncPayloadInput = {
  attempt: SyncAttempt;
  assessment: SyncAssessment;
  student: SyncStudent;
  feedback: SyncFeedbackEntry[];
};

export type SyncPayload = Array<string | number>;

const FEEDBACK_LIMIT = 500;

function bilingual(en: string | null, ar: string | null): string {
  const english = en?.trim() ?? "";
  const arabic = ar?.trim() ?? "";

  if (english && arabic && english !== arabic) {
    return `${english} · ${arabic}`;
  }

  return english || arabic;
}

function round2(value: number | null): number | "" {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  return Math.round(value * 100) / 100;
}

/**
 * Collapses teacher feedback into one short cell. Full essay answers are never
 * included: only the feedback fields are passed in, and the result is capped.
 */
export function summariseFeedback(
  entries: SyncFeedbackEntry[],
  limit: number = FEEDBACK_LIMIT,
): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const entry of entries) {
    for (const value of [entry.feedback_en, entry.feedback_ar]) {
      const text = value?.replace(/\s+/g, " ").trim();

      if (!text || seen.has(text)) {
        continue;
      }

      seen.add(text);
      parts.push(text);
    }
  }

  const joined = parts.join(" | ");

  if (joined.length <= limit) {
    return joined;
  }

  return `${joined.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function buildSyncPayload(input: SyncPayloadInput): SyncPayload {
  const { attempt, assessment, student, feedback } = input;

  return [
    attempt.id,
    student.student_number?.trim() || student.id,
    bilingual(student.full_name_en, student.full_name_ar),
    student.email?.trim() ?? "",
    bilingual(student.grade_name_en, student.grade_name_ar),
    bilingual(student.class_name_en, student.class_name_ar),
    bilingual(assessment.title_en, assessment.title_ar),
    assessment.type,
    assessment.grading_mode,
    attempt.started_at,
    attempt.submitted_at ?? "",
    assessment.time_limit_minutes,
    round2(attempt.score),
    round2(attempt.max_score),
    round2(attempt.percentage),
    attempt.status,
    attempt.manual_review_status,
    summariseFeedback(feedback),
  ];
}

/** True when two payloads are identical, used to skip redundant writes. */
export function payloadsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isSyncPayload(value: unknown): value is SyncPayload {
  return (
    Array.isArray(value) &&
    value.length === SHEET_COLUMN_COUNT &&
    value.every(
      (cell) => typeof cell === "string" || typeof cell === "number",
    )
  );
}
