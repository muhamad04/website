import type { ImportDraft } from "@/lib/import/types";

/**
 * Import audit details are counts only. Question text, answer keys, file names
 * and storage paths must never enter the audit log.
 */

const SAFE_KEYS = new Set([
  "import_id",
  "assessment_id",
  "question_count",
  "section_count",
  "total_marks",
  "warning_count",
  "matched_answers",
  "unmatched_answers",
  "has_answer_key",
  "source_kind",
  "answer_kind",
  "status",
  "cancelled",
]);

export function sanitiseImportAuditDetail(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const detail: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!SAFE_KEYS.has(key)) {
      continue;
    }

    if (typeof value === "boolean" || typeof value === "number") {
      detail[key] = value;
      continue;
    }

    if (typeof value === "string") {
      detail[key] = value.slice(0, 80);
    }
  }

  return detail;
}

export function importAuditStats(draft: ImportDraft): Record<string, unknown> {
  return sanitiseImportAuditDetail({
    question_count: draft.stats.questionCount,
    section_count: draft.stats.sectionCount,
    total_marks: draft.stats.totalMarks,
    warning_count: draft.stats.warningCount,
    matched_answers: draft.stats.matchedAnswers,
    unmatched_answers: draft.stats.unmatchedAnswers,
    has_answer_key: draft.answerText.trim() !== "",
  });
}
