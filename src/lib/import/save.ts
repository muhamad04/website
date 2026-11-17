import type { GradingMode } from "@/lib/domain/types";
import type {
  ImportQuestionInput,
  ImportSectionInput,
  ImportSettingsInput,
} from "@/lib/import/validation";

/**
 * Pure mapping from reviewed draft fields to the existing assessment tables.
 * Nothing here publishes anything: `is_published` is always false, and the
 * teacher must use the normal publish action afterwards.
 */

export type ImportQuestionWrite = {
  section_id: string;
  type: ImportQuestionInput["type"];
  prompt_en: string;
  prompt_ar: string | null;
  help_text_en: string | null;
  help_text_ar: null;
  marks: number;
  is_required: boolean;
  position: number;
  correct_answer: Record<string, unknown> | null;
  grading_method: "automatic" | "manual";
  explanation_en: string | null;
  explanation_ar: string | null;
};

export type ImportOptionWrite = {
  question_id: string;
  label: string;
  text_en: string;
  text_ar: null;
  is_correct: boolean;
  position: number;
};

export type ImportPairWrite = {
  question_id: string;
  left_text_en: string;
  left_text_ar: null;
  right_text_en: string;
  right_text_ar: null;
  position: number;
};

/** Optional Arabic/help text is stored as NULL, never as invented content. */
function blankToNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function computeGradingMode(
  questions: ImportQuestionInput[],
): GradingMode {
  if (questions.length === 0) {
    return "manual";
  }

  const automatic = questions.filter(
    (question) => question.gradingMethod === "automatic",
  ).length;

  if (automatic === questions.length) {
    return "automatic";
  }

  if (automatic === 0) {
    return "manual";
  }

  return "mixed";
}

export function computeTotalMarks(questions: ImportQuestionInput[]): number {
  return questions.reduce((sum, question) => sum + question.marks, 0);
}

export function buildAssessmentWrite(options: {
  settings: ImportSettingsInput;
  gradingMode: GradingMode;
  createdBy: string;
}): Record<string, unknown> {
  return {
    grade_id: options.settings.gradeId,
    type: options.settings.type,
    title_en: options.settings.titleEn,
    title_ar: options.settings.titleAr ?? "",
    instructions_en: blankToNull(options.settings.instructionsEn),
    instructions_ar: blankToNull(options.settings.instructionsAr),
    time_limit_minutes: options.settings.timeLimitMinutes,
    results_visibility: options.settings.resultsVisibility,
    grading_mode: options.gradingMode,
    allow_retakes: options.settings.allowRetakes,
    max_attempts: options.settings.maxAttempts,
    available_from: options.settings.availableFrom ?? null,
    available_until: options.settings.availableUntil ?? null,
    // Imports are never published by this action, even if a caller forges a
    // flag. Publishing stays an explicit teacher action.
    is_published: false,
    created_by: options.createdBy,
  };
}

export function buildSectionWrite(options: {
  section: ImportSectionInput;
  assessmentId: string;
  position: number;
}): Record<string, unknown> {
  return {
    assessment_id: options.assessmentId,
    title_en: options.section.titleEn,
    title_ar: options.section.titleAr ?? "",
    instructions_en: options.section.instructionsEn ?? null,
    instructions_ar: null,
    position: options.position,
  };
}

export function answerKeyForImportedQuestion(
  question: ImportQuestionInput,
): Record<string, unknown> | null {
  if (question.type === "true_false") {
    if (!question.correctValue) {
      return null;
    }

    return { value: question.correctValue === "true" };
  }

  if (
    question.type === "short_answer" ||
    question.type === "rewrite" ||
    question.type === "find_the_mistake"
  ) {
    if (question.accepted.length === 0) {
      return null;
    }

    return { accepted: question.accepted, caseSensitive: false };
  }

  return null;
}

export function buildQuestionWrite(options: {
  question: ImportQuestionInput;
  sectionId: string;
  position: number;
}): ImportQuestionWrite {
  const question = options.question;

  return {
    section_id: options.sectionId,
    type: question.type,
    prompt_en: question.promptEn,
    prompt_ar: blankToNull(question.promptAr),
    help_text_en: blankToNull(question.helpTextEn),
    help_text_ar: null,
    marks: question.marks,
    is_required: true,
    position: options.position,
    correct_answer: answerKeyForImportedQuestion(question),
    grading_method: question.gradingMethod,
    explanation_en: blankToNull(question.explanationEn),
    explanation_ar: blankToNull(question.explanationAr),
  };
}

export function buildOptionWrites(
  questionId: string,
  question: ImportQuestionInput,
): ImportOptionWrite[] {
  if (question.type !== "multiple_choice") {
    return [];
  }

  return question.options.map((option, index) => ({
    question_id: questionId,
    label: String.fromCharCode(65 + index),
    text_en: option.text,
    text_ar: null,
    is_correct: option.correct,
    position: index,
  }));
}

export function buildPairWrites(
  questionId: string,
  question: ImportQuestionInput,
): ImportPairWrite[] {
  if (question.type !== "matching") {
    return [];
  }

  return question.pairs.map((pair, index) => ({
    question_id: questionId,
    left_text_en: pair.left,
    left_text_ar: null,
    right_text_en: pair.right,
    right_text_ar: null,
    position: index,
  }));
}

export function allQuestions(
  sections: ImportSectionInput[],
): ImportQuestionInput[] {
  return sections.flatMap((section) => section.questions);
}
