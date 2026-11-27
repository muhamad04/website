import { z } from "zod";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/validation/fields";
import { ASSESSMENT_MAX_FILE_BYTES } from "@/lib/assessments/files";
import {
  ATTEMPT_SIGNALS,
  STRICT_MAX_HEARTBEAT_SECONDS,
  STRICT_MIN_HEARTBEAT_SECONDS,
  SUBMISSION_REASONS,
} from "@/lib/assessments/strict";

/**
 * Stable assessment error codes. Nothing from Postgres or the provider reaches
 * the browser; the UI maps these codes to bilingual sentences.
 */
export const ASSESSMENT_ERROR_CODES = [
  "validation_failed",
  "forbidden",
  "not_found",
  "title_required",
  "title_too_long",
  "instructions_too_long",
  "grade_required",
  "grade_not_found",
  "type_invalid",
  "time_limit_invalid",
  "heartbeat_invalid",
  "visibility_invalid",
  "grading_mode_invalid",
  "grading_method_invalid",
  "grading_method_requires_manual",
  "automatic_grading_not_supported",
  "retake_invalid",
  "availability_invalid",
  "assessment_has_attempts",
  "assessment_no_questions",
  "assessment_no_gradable_questions",
  "section_not_found",
  "section_title_required",
  "section_has_answers",
  "section_kind_invalid",
  "section_content_required",
  "section_has_questions",
  "question_not_found",
  "question_type_invalid",
  "question_prompt_required",
  "question_marks_invalid",
  "question_word_limits_invalid",
  "question_options_invalid",
  "question_option_required",
  "question_pairs_invalid",
  "question_answer_required",
  "question_has_answers",
  "invalid_order",
  "attempt_not_available",
  "attempt_not_found",
  "attempt_not_submitted",
  "attempt_closed",
  "retakes_not_allowed",
  "max_attempts_reached",
  "answer_invalid",
  "answer_too_long",
  "reason_invalid",
  "file_required",
  "file_type_invalid",
  "file_too_large",
  "upload_failed",
  "upload_missing",
  "storage_failed",
  "service_unavailable",
  "unknown",
] as const;

export type AssessmentErrorCode = (typeof ASSESSMENT_ERROR_CODES)[number];

export type AssessmentActionResult = {
  ok: boolean;
  error?: AssessmentErrorCode;
  fieldErrors?: FieldErrors;
  assessmentId?: string;
  sectionId?: string;
  questionId?: string;
  attemptId?: string;
  redirectTo?: string;
  /** Short-lived signed upload details. Never logged or persisted. */
  upload?: {
    bucket: string;
    path: string;
    token: string;
  };
};

const trimmed = (max: number, error: string = "instructions_too_long") =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(max, { error }).optional(),
  );

const requiredText = (max: number, error: string) =>
  z
    .string()
    .trim()
    .min(1, { error })
    .max(max, { error });

const booleanValue = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean().default(false));

/** Optional boolean: omitted values fall back to type-aware strict defaults. */
const optionalBoolean = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  if (value === undefined || value === null || value === "") return undefined;
  return value;
}, z.boolean().optional());

const isoDateTime = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .max(40)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      error: "availability_invalid",
    })
    .optional(),
);

const acceptedList = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }
    return value;
  },
  z
    .array(z.string().trim().min(1, { error: "question_answer_required" }))
    .min(1, { error: "question_answer_required" })
    .max(20, { error: "question_answer_required" }),
);

/* -------------------------------------------------------------------------- */
/* Assessments                                                                */
/* -------------------------------------------------------------------------- */

const assessmentBaseSchema = z.object({
  type: z.enum(["quiz", "exam"], { error: "type_invalid" }),
  title_en: requiredText(200, "title_required"),
  instructions_en: trimmed(4000),
  grade_id: z.uuid({ error: "grade_required" }),
  time_limit_minutes: z.coerce
    .number({ error: "time_limit_invalid" })
    .int({ error: "time_limit_invalid" })
    .min(1, { error: "time_limit_invalid" })
    .max(600, { error: "time_limit_invalid" }),
  results_visibility: z.enum(["immediately", "after_review", "hidden"], {
    error: "visibility_invalid",
  }),
  grading_mode: z.enum(["automatic", "manual", "mixed"], {
    error: "grading_mode_invalid",
  }),
  allow_retakes: booleanValue,
  max_attempts: z.coerce
    .number({ error: "retake_invalid" })
    .int({ error: "retake_invalid" })
    .min(1, { error: "retake_invalid" })
    .max(10, { error: "retake_invalid" }),
  available_from: isoDateTime,
  available_until: isoDateTime,
  is_published: booleanValue,
  strict_exam_mode: optionalBoolean,
  submit_on_tab_hidden: optionalBoolean,
  submit_on_navigation: optionalBoolean,
  heartbeat_timeout_seconds: z.preprocess(
    (value) =>
      value === undefined || value === null || value === "" ? undefined : value,
    z.coerce
      .number({ error: "heartbeat_invalid" })
      .int({ error: "heartbeat_invalid" })
      .min(STRICT_MIN_HEARTBEAT_SECONDS, { error: "heartbeat_invalid" })
      .max(STRICT_MAX_HEARTBEAT_SECONDS, { error: "heartbeat_invalid" })
      .optional(),
  ),
  allow_resume_after_connection_loss: optionalBoolean,
  randomize_question_order: optionalBoolean,
  randomize_option_order: optionalBoolean,
});

function refineAssessment(
  value: z.infer<typeof assessmentBaseSchema>,
  ctx: z.RefinementCtx,
): void {
  if (!value.allow_retakes && value.max_attempts !== 1) {
    ctx.addIssue({
      code: "custom",
      path: ["max_attempts"],
      message: "retake_invalid",
    });
  }

  if (value.allow_retakes && value.max_attempts < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["max_attempts"],
      message: "retake_invalid",
    });
  }

  if (value.available_from && value.available_until) {
    if (
      Date.parse(value.available_until) <= Date.parse(value.available_from)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["available_until"],
        message: "availability_invalid",
      });
    }
  }
}

export const createAssessmentSchema =
  assessmentBaseSchema.superRefine(refineAssessment);
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const updateAssessmentSchema = assessmentBaseSchema
  .extend({ assessment_id: z.uuid({ error: "validation_failed" }) })
  .superRefine(refineAssessment);
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

export const assessmentIdSchema = z.object({
  assessment_id: z.uuid({ error: "validation_failed" }),
});

export const setAssessmentPublishedSchema = z.object({
  assessment_id: z.uuid({ error: "validation_failed" }),
  is_published: z.enum(["true", "false"]),
});

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

const SECTION_KINDS = ["standard", "reading_passage", "dialogue"] as const;

const optionalSectionText = (max: number, error: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(max, { error }).optional(),
  );

const dialogueLineSchema = z.object({
  speaker: z
    .string()
    .trim()
    .min(1, { error: "section_content_required" })
    .max(120, { error: "section_content_required" }),
  text: z
    .string()
    .trim()
    .min(1, { error: "section_content_required" })
    .max(4000, { error: "section_content_required" }),
});

const sectionBaseSchema = z.object({
  title_en: requiredText(200, "section_title_required"),
  instructions_en: trimmed(2000),
  kind: z.enum(SECTION_KINDS, { error: "section_kind_invalid" }).default("standard"),
  passage_en: optionalSectionText(20000, "section_content_required"),
  vocabulary_en: optionalSectionText(4000, "section_content_required"),
  source_en: optionalSectionText(500, "section_content_required"),
  dialogue_lines: z.array(dialogueLineSchema).max(200).default([]),
});

function refineSection(
  value: z.infer<typeof sectionBaseSchema>,
  ctx: z.RefinementCtx,
): void {
  if (value.kind === "reading_passage" && !value.passage_en) {
    ctx.addIssue({
      code: "custom",
      path: ["passage_en"],
      message: "section_content_required",
    });
  }

  if (value.kind === "dialogue" && value.dialogue_lines.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["dialogue_lines"],
      message: "section_content_required",
    });
  }
}

export const createSectionSchema = sectionBaseSchema
  .extend({
    assessment_id: z.uuid({ error: "validation_failed" }),
  })
  .superRefine(refineSection);
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const updateSectionSchema = sectionBaseSchema
  .extend({
    section_id: z.uuid({ error: "validation_failed" }),
  })
  .superRefine(refineSection);
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

export const sectionIdSchema = z.object({
  section_id: z.uuid({ error: "validation_failed" }),
});

export const deleteSectionSchema = z.object({
  section_id: z.uuid({ error: "validation_failed" }),
  /** Optional destination for questions when the group itself is deleted. */
  move_questions_to_section_id: z.uuid({ error: "validation_failed" }).optional(),
});

export const moveQuestionSchema = z.object({
  question_id: z.uuid({ error: "validation_failed" }),
  section_id: z.uuid({ error: "validation_failed" }),
});

export const reorderSectionsSchema = z.object({
  assessment_id: z.uuid({ error: "validation_failed" }),
  section_ids: z
    .array(z.uuid({ error: "invalid_order" }))
    .min(1, { error: "invalid_order" })
    .max(100, { error: "invalid_order" }),
});

export const reorderQuestionsSchema = z.object({
  section_id: z.uuid({ error: "validation_failed" }),
  question_ids: z
    .array(z.uuid({ error: "invalid_order" }))
    .min(1, { error: "invalid_order" })
    .max(200, { error: "invalid_order" }),
});

/* -------------------------------------------------------------------------- */
/* Questions                                                                  */
/* -------------------------------------------------------------------------- */

export const QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
  "matching",
  "short_answer",
  "essay",
  "paragraph",
  "file_upload",
  "rewrite",
  "find_the_mistake",
] as const;

/** Types that share the long-form writing UI and word-count guidance. */
export const WRITING_TYPES = ["essay", "paragraph"] as const;

export function isWritingType(type: string): boolean {
  return (WRITING_TYPES as readonly string[]).includes(type);
}

/** Types the automatic grader understands. */
export const AUTO_GRADABLE_TYPES = [
  "multiple_choice",
  "true_false",
  "matching",
  "short_answer",
  "rewrite",
  "find_the_mistake",
] as const;

export function isAutoGradableType(type: string): boolean {
  return (AUTO_GRADABLE_TYPES as readonly string[]).includes(type);
}

export function isManualOnlyType(type: string): boolean {
  return type === "essay" || type === "paragraph" || type === "file_upload";
}

const optionInputSchema = z.object({
  text_en: z
    .string()
    .trim()
    .min(1, { error: "question_option_required" })
    .max(500, { error: "question_options_invalid" }),
});

const pairInputSchema = z.object({
  left_text_en: z
    .string()
    .trim()
    .min(1, { error: "question_pairs_invalid" })
    .max(500, { error: "question_pairs_invalid" }),
  right_text_en: z
    .string()
    .trim()
    .min(1, { error: "question_pairs_invalid" })
    .max(500, { error: "question_pairs_invalid" }),
});

const optionalWordCount = z.preprocess(
  (value) =>
    value === undefined || value === null || value === "" ? undefined : value,
  z.coerce
    .number({ error: "question_word_limits_invalid" })
    .int({ error: "question_word_limits_invalid" })
    .min(1, { error: "question_word_limits_invalid" })
    .max(20000, { error: "question_word_limits_invalid" })
    .optional(),
);

const questionBaseSchema = z.object({
  type: z.enum(QUESTION_TYPES, { error: "question_type_invalid" }),
  prompt_en: requiredText(4000, "question_prompt_required"),
  help_text_en: trimmed(1000),
  topic_en: trimmed(300),
  min_words: optionalWordCount,
  max_words: optionalWordCount,
  rubric_en: trimmed(4000),
  marks: z.coerce
    .number({ error: "question_marks_invalid" })
    .min(0.01, { error: "question_marks_invalid" })
    .max(100, { error: "question_marks_invalid" })
    .refine((value) => Math.round(value * 100) === value * 100, {
      error: "question_marks_invalid",
    }),
  is_required: booleanValue,
  grading_method: z.enum(["automatic", "manual"], {
    error: "grading_method_invalid",
  }),
  explanation_en: trimmed(2000),
  options: z.array(optionInputSchema).max(10).optional(),
  correct_index: z.coerce.number().int().min(0).max(9).optional(),
  correct_value: z.enum(["true", "false"]).optional(),
  pairs: z.array(pairInputSchema).max(10).optional(),
  accepted: acceptedList.optional(),
  case_sensitive: booleanValue.optional(),
});

function refineQuestion(
  value: z.infer<typeof questionBaseSchema>,
  ctx: z.RefinementCtx,
): void {
  if (value.type === "multiple_choice") {
    const options = value.options ?? [];

    if (options.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "question_options_invalid",
      });
    }

    if (
      value.correct_index === undefined ||
      value.correct_index >= options.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["correct_index"],
        message: "question_option_required",
      });
    }
  }

  if (value.type === "true_false" && value.correct_value === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["correct_value"],
      message: "question_answer_required",
    });
  }

  if (value.type === "matching") {
    const pairs = value.pairs ?? [];

    if (pairs.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["pairs"],
        message: "question_pairs_invalid",
      });
    }
  }

  if (
    value.type === "short_answer" ||
    value.type === "rewrite" ||
    value.type === "find_the_mistake"
  ) {
    if (!value.accepted || value.accepted.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["accepted"],
        message: "question_answer_required",
      });
    }
  }

  if (
    value.min_words !== undefined &&
    value.max_words !== undefined &&
    value.max_words < value.min_words
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["max_words"],
      message: "question_word_limits_invalid",
    });
  }

  if (isManualOnlyType(value.type) && value.grading_method !== "manual") {
    ctx.addIssue({
      code: "custom",
      path: ["grading_method"],
      message: "grading_method_requires_manual",
    });
  }

  if (value.grading_method === "automatic" && !isAutoGradableType(value.type)) {
    ctx.addIssue({
      code: "custom",
      path: ["grading_method"],
      message: "automatic_grading_not_supported",
    });
  }
}

export const questionInputSchema =
  questionBaseSchema.superRefine(refineQuestion);
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const createQuestionSchema = questionBaseSchema
  .extend({ section_id: z.uuid({ error: "validation_failed" }) })
  .superRefine(refineQuestion);
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = questionBaseSchema
  .extend({ question_id: z.uuid({ error: "validation_failed" }) })
  .superRefine(refineQuestion);
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

export const questionIdSchema = z.object({
  question_id: z.uuid({ error: "validation_failed" }),
});

/** Correct-answer payload written to questions.correct_answer. */
export function answerKeyForQuestion(
  input: QuestionInput | CreateQuestionInput | UpdateQuestionInput,
): Record<string, unknown> | null {
  switch (input.type) {
    case "true_false":
      return { value: input.correct_value === "true" };
    case "short_answer":
    case "rewrite":
    case "find_the_mistake":
      return {
        accepted: input.accepted ?? [],
        caseSensitive: Boolean(input.case_sensitive),
      };
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Attempts and answers                                                       */
/* -------------------------------------------------------------------------- */

export const attemptIdSchema = z.object({
  attempt_id: z.uuid({ error: "validation_failed" }),
});

export const attemptSignalSchema = z.object({
  attempt_id: z.uuid({ error: "validation_failed" }),
  signal: z.enum(ATTEMPT_SIGNALS, { error: "validation_failed" }),
});

export const submitAttemptSchema = z.object({
  attempt_id: z.uuid({ error: "validation_failed" }),
  reason: z.enum(SUBMISSION_REASONS, { error: "reason_invalid" }).optional(),
});

export const heartbeatAttemptSchema = z.object({
  attempt_id: z.uuid({ error: "validation_failed" }),
  focus_lost: optionalBoolean,
});

export const startAttemptSchema = z.object({
  assessment_id: z.uuid({ error: "validation_failed" }),
});

const answerResponseSchema = z.record(z.string(), z.unknown());

export const saveAnswerSchema = z.object({
  attempt_id: z.uuid({ error: "validation_failed" }),
  question_id: z.uuid({ error: "validation_failed" }),
  response: answerResponseSchema,
  file_path: z
    .preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().max(500).optional(),
    ),
});
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

export const prepareSubmissionUploadSchema = z.object({
  attempt_id: z.uuid({ error: "validation_failed" }),
  question_id: z.uuid({ error: "validation_failed" }),
  file_name: z
    .string()
    .trim()
    .min(1, { error: "file_required" })
    .max(240, { error: "file_required" }),
  file_size: z.coerce
    .number({ error: "file_too_large" })
    .int()
    .min(1, { error: "file_required" })
    .max(ASSESSMENT_MAX_FILE_BYTES, { error: "file_too_large" }),
  mime_type: z
    .string()
    .trim()
    .min(1, { error: "file_type_invalid" })
    .max(120, { error: "file_type_invalid" }),
});

export const gradeAttemptSchema = z.object({
  attempt_id: z.uuid({ error: "validation_failed" }),
  grades: z
    .array(
      z.object({
        answer_id: z.uuid({ error: "validation_failed" }),
        marks_awarded: z.coerce
          .number({ error: "question_marks_invalid" })
          .min(0, { error: "question_marks_invalid" })
          .max(100, { error: "question_marks_invalid" }),
        feedback_en: trimmed(2000),
        feedback_ar: trimmed(2000),
      }),
    )
    .min(1, { error: "validation_failed" })
    .max(500, { error: "validation_failed" }),
});
export type GradeAttemptInput = z.infer<typeof gradeAttemptSchema>;

export { fieldErrorsFrom };
export type { FieldErrors };
