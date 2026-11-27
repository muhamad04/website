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
  "answer_text_mismatch",
  "matching_answer_not_applied",
  "manual_type_answer_ignored",
  "low_confidence_type",
  "unsupported_question_type",
  "multiple_choice_missing_options",
  "matching_incomplete",
  "marks_defaulted",
  "section_marks_distributed",
  "group_without_questions",
  "grouping_uncertain",
  "passage_without_questions",
  "answer_key_in_question_file",
  "text_truncated",
  "file_empty",
  "ai_partial",
  "ai_invalid_response",
  "ai_unavailable",
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
  helpTextEn: string;
  topicEn?: string;
  minWords?: number | null;
  maxWords?: number | null;
  rubricEn?: string;
  marks: number;
  /** `false` only when the parser could not infer a type confidently. */
  confidence: ImportConfidence;
  /** 0–1 score behind the confidence label. */
  confidenceScore?: number;
  /** Short, human-readable evidence used by the detector. */
  evidence?: string[];
  gradingMethod: GradingMethod;
  options: ImportOptionDraft[];
  pairs: ImportPairDraft[];
  accepted: string[];
  correctValue: "true" | "false" | null;
  explanationEn: string;
  warnings: ImportWarningCode[];
  /** Original block, shown on the review screen for verification. */
  raw: string;
  /** Set by the teacher in the review editor. */
  reviewed?: boolean;
};

export type ImportDialogueLine = {
  speaker: string;
  text: string;
};

export type ImportSectionDraft = {
  key: string;
  titleEn: string;
  instructionsEn: string;
  kind?: "standard" | "reading_passage" | "dialogue";
  passageEn?: string;
  vocabularyEn?: string;
  sourceEn?: string;
  dialogueLines?: ImportDialogueLine[];
  /** Section-level marks printed in the heading, when clearly specified. */
  marks?: number | null;
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
  /** Detected letter, when the key prints one. */
  letter: string | null;
  /** Text printed after the letter, when present. */
  answerText: string | null;
  status: ImportAnswerStatus;
  questionKey?: string;
  questionNumber?: string;
  warnings: ImportWarningCode[];
};

export type ImportAiQuestionSnapshot = {
  type: QuestionType;
  promptEn: string;
  marks: number;
  options: ImportOptionDraft[];
  correctValue: "true" | "false" | null;
  accepted: string[];
  explanationEn: string;
};

export type ImportAiSuggestion = {
  id: string;
  questionKey: string;
  sourceNumber: string;
  before: ImportAiQuestionSnapshot;
  after: ImportAiQuestionSnapshot;
  safe: boolean;
  status: "pending" | "accepted" | "rejected";
  reason: string;
};

export type ImportAiState = {
  status: "idle" | "running" | "completed" | "failed" | "partial";
  model: string;
  requestCount: number;
  suggestions: ImportAiSuggestion[];
  warnings: ImportWarningCode[];
  completedAt: string | null;
};

/** Assessment-level settings chosen or confirmed by the teacher. */
export type ImportSettings = {
  type: AssessmentType;
  gradeId: string;
  titleEn: string;
  instructionsEn: string;
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
  ai?: ImportAiState;
  stats: {
    sectionCount: number;
    questionCount: number;
    totalMarks: number;
    warningCount: number;
    matchedAnswers: number;
    unmatchedAnswers: number;
    /** Questions the teacher still needs to check. */
    reviewCount: number;
    /** 0–1 confidence in the deterministic parse. */
    parserConfidence: number;
  };
};

export type ImportStatus = "draft" | "saved" | "cancelled";

export type ImportFileKind = "docx" | "pdf" | "txt";
