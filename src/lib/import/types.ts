import type {
  AssessmentType,
  GradingMethod,
  QuestionType,
  ResultsVisibility,
} from "@/lib/domain/types";

/**
 * Shapes used by the free, local assessment importer. Everything here is
 * produced by deterministic parsing on the server and edited by a teacher
 * before it can reach the assessment tables. No external service is called.
 */

export const IMPORT_WARNING_CODES = [
  "no_title_detected",
  "no_questions_detected",
  "empty_section",
  "duplicate_question_number",
  "missing_answer",
  "unmatched_answer",
  "duplicate_answer_number",
  "ambiguous_answer",
  "answer_mismatch",
  "matching_answer_not_applied",
  "manual_type_answer_ignored",
  "low_confidence_type",
  "multiple_choice_missing_options",
  "matching_incomplete",
  "marks_defaulted",
  "answer_key_in_question_file",
  "text_truncated",
  "file_empty",
] as const;

export type ImportWarningCode = (typeof IMPORT_WARNING_CODES)[number];

export type ImportWarning = {
  code: ImportWarningCode;
  /** Question number as printed in the source, when the warning is local. */
  questionNumber?: string;
  /** Stable identifier of the parsed question, when available. */
  questionKey?: string;
};

export type ImportConfidence = "high" | "medium" | "low";

export type ImportOptionDraft = {
  text: string;
  correct: boolean;
};

export type ImportPairDraft = {
  left: string;
  right: string;
};

export type ImportQuestionDraft = {
  key: string;
  sourceNumber: string;
  type: QuestionType;
  promptEn: string;
  promptAr: string;
  helpTextEn: string;
  marks: number;
  /** `false` only when the parser could not infer a type confidently. */
  confidence: ImportConfidence;
  gradingMethod: GradingMethod;
  options: ImportOptionDraft[];
  pairs: ImportPairDraft[];
  accepted: string[];
  correctValue: "true" | "false" | null;
  explanationEn: string;
  warnings: ImportWarningCode[];
  /** Original block, shown on the review screen for verification. */
  raw: string;
};

export type ImportSectionDraft = {
  key: string;
  titleEn: string;
  titleAr: string;
  instructionsEn: string;
  questions: ImportQuestionDraft[];
};

export type ImportAnswerStatus =
  | "matched"
  | "unmatched"
  | "duplicate"
  | "ambiguous";

export type ImportAnswerEntry = {
  key: string;
  number: string;
  raw: string;
  answers: string[];
  status: ImportAnswerStatus;
  questionKey?: string;
  questionNumber?: string;
  warnings: ImportWarningCode[];
};

/** Assessment-level settings chosen or confirmed by the teacher. */
export type ImportSettings = {
  type: AssessmentType;
  gradeId: string;
  titleEn: string;
  titleAr: string;
  instructionsEn: string;
  instructionsAr: string;
  timeLimitMinutes: number;
  resultsVisibility: ResultsVisibility;
  allowRetakes: boolean;
  maxAttempts: number;
  availableFrom: string;
  availableUntil: string;
};

export type ImportDraft = {
  settings: ImportSettings;
  sections: ImportSectionDraft[];
  answerKey: ImportAnswerEntry[];
  warnings: ImportWarning[];
  sourceText: string;
  answerText: string;
  stats: {
    sectionCount: number;
    questionCount: number;
    totalMarks: number;
    warningCount: number;
    matchedAnswers: number;
    unmatchedAnswers: number;
  };
};

export type ImportStatus = "draft" | "saved" | "cancelled";

export type ImportFileKind = "docx" | "pdf" | "txt";
