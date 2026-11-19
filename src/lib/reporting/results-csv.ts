import type { ReportingAttemptRow } from "@/lib/data/reporting";
import type { CsvValue } from "@/lib/reporting/csv";

export const RESULTS_CSV_HEADERS = [
  "Submission ID",
  "Student ID",
  "Student name",
  "Grade",
  "Class",
  "Assessment",
  "Assessment type",
  "Attempt",
  "Submitted at",
  "Score",
  "Maximum score",
  "Percentage",
  "Grading mode",
  "Result status",
  "Manual review",
  "Result visibility",
  "Submission reason",
  "Tab hidden events",
  "Focus loss events",
  "Suspicious events",
] as const;

export function resultsCsvRows(
  attempts: ReadonlyArray<ReportingAttemptRow>,
): CsvValue[][] {
  return attempts.map((attempt) => [
    attempt.id,
    attempt.student?.student_number ?? attempt.student_id,
    attempt.student?.full_name_en ?? "",
    attempt.student?.grade?.name_en ?? "",
    attempt.student?.class?.name_en ?? "",
    attempt.assessment?.title_en ?? "",
    attempt.assessment?.type ?? "",
    attempt.attempt_number,
    attempt.submitted_at ?? "",
    attempt.score,
    attempt.max_score,
    attempt.percentage,
    attempt.assessment?.grading_mode ?? "",
    attempt.status,
    attempt.manual_review_status,
    attempt.assessment?.results_visibility ?? "",
    attempt.submission_reason ?? "",
    attempt.tab_hidden_count,
    attempt.focus_loss_count,
    attempt.signal_count,
  ]);
}
