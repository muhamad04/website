import { z } from "zod";
import {
  fieldErrorsFrom,
  type FieldErrors,
} from "@/lib/validation/fields";
import {
  QUESTION_TYPES,
  isAutoGradableType,
  isManualOnlyType,
} from "@/lib/validation/assessments";
import { IMPORT_WARNING_CODES } from "@/lib/import/types";

/**
 * Stable importer error codes. Only these reach the browser; parser output and
 * database messages never do.
 */
export const IMPORT_ERROR_CODES = [
  "validation_failed",
  "forbidden",
  "not_found",
  "expired",
  "already_saved",
  "file_required",
  "file_type_invalid",
  "file_too_large",
  "file_empty",
  "file_name_invalid",
  "no_text_extracted",
  "parse_failed",
  "grade_required",
  "grade_not_found",
  "type_invalid",
  "upload_failed",
  "storage_failed",
  "service_unavailable",
  "ai_disabled",
  "ai_limit_reached",
  "save_failed",
  "unknown",
] as const;

export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[number];

export type ImportActionResult = {
  ok: boolean;
  error?: ImportErrorCode;
  fieldErrors?: FieldErrors;
  importId?: string;
  assessmentId?: string;
};

export type ImportSignedUploadDescriptor = {
  role: "questions" | "answers";
  path: string;
  token: string;
  signedUrl: string;
  fileName: string;
};

export type ImportUploadInitResult = ImportActionResult & {
  uploads?: ImportSignedUploadDescriptor[];
  maxBytes?: number;
  maxTotalBytes?: number;
};

export type ImportAiRouteResult = ImportActionResult & {
  ai?: import("@/lib/import/types").ImportAiState;
  remainingRequests?: number;
};

const optionalText = (max: number, error = "validation_failed") =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(max, { error }).optional(),
  );

const requiredText = (max: number, error: string) =>
  z.string().trim().min(1, { error }).max(max, { error });

const booleanValue = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean().default(false));

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

const acceptedList = z.preprocess((value) => {
  if (typeof value === "string") {
    return value
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return value;
}, z.array(z.string().trim().min(1)).max(20).default([]));

export const importUploadMetaSchema = z.object({
  grade_id: z.uuid({ error: "grade_required" }),
  type: z.enum(["quiz", "exam"], { error: "type_invalid" }).default("quiz"),
  title_en: optionalText(200, "title_too_long"),
});

export type ImportUploadMeta = z.infer<typeof importUploadMetaSchema>;

export const importUploadFileSchema = z.object({
  role: z.enum(["questions", "answers"]),
  name: z.string().trim().min(1, { error: "file_required" }).max(240),
  size: z.coerce
    .number({ error: "file_required" })
    .int()
    .min(1, { error: "file_empty" })
    .max(200 * 1024 * 1024, { error: "file_too_large" }),
  type: z.string().trim().min(1, { error: "file_type_invalid" }).max(160),
});

export type ImportUploadFileInput = z.infer<typeof importUploadFileSchema>;

const uploadFilesShape = {
  files: z
    .array(importUploadFileSchema)
    .min(1, { error: "file_required" })
    .max(2, { error: "validation_failed" }),
};

function refineUploadRoles(
  value: { files: ImportUploadFileInput[] },
  ctx: {
    addIssue: (issue: {
      code: "custom";
      path: Array<string | number>;
      message: string;
    }) => void;
  },
): void {
  const questions = value.files.filter((file) => file.role === "questions");
  const answers = value.files.filter((file) => file.role === "answers");

  if (questions.length !== 1) {
    ctx.addIssue({ code: "custom", path: ["files"], message: "file_required" });
  }

  if (answers.length > 1) {
    ctx.addIssue({ code: "custom", path: ["files"], message: "validation_failed" });
  }
}

export const importUploadInitSchema = z
  .object({
    grade_id: z.uuid({ error: "grade_required" }),
    type: z.enum(["quiz", "exam"], { error: "type_invalid" }).default("quiz"),
    title_en: optionalText(200, "title_too_long"),
    ...uploadFilesShape,
  })
  .superRefine(refineUploadRoles);

export type ImportUploadInitInput = z.infer<typeof importUploadInitSchema>;

export const importUploadFinalizeSchema = z
  .object({
    import_id: z.uuid({ error: "validation_failed" }),
    grade_id: z.uuid({ error: "grade_required" }),
    type: z.enum(["quiz", "exam"], { error: "type_invalid" }).default("quiz"),
    title_en: optionalText(200, "title_too_long"),
    ...uploadFilesShape,
  })
  .superRefine(refineUploadRoles);

export type ImportUploadFinalizeInput = z.infer<
  typeof importUploadFinalizeSchema
>;

export const importIdSchema = z.object({
  import_id: z.uuid({ error: "validation_failed" }),
});

export const importSettingsSchema = z
  .object({
    type: z.enum(["quiz", "exam"], { error: "type_invalid" }),
    gradeId: z.uuid({ error: "grade_required" }),
    titleEn: requiredText(200, "title_required"),
    instructionsEn: optionalText(4000, "instructions_too_long"),
    timeLimitMinutes: z.coerce
      .number({ error: "time_limit_invalid" })
      .int({ error: "time_limit_invalid" })
      .min(1, { error: "time_limit_invalid" })
      .max(600, { error: "time_limit_invalid" }),
    resultsVisibility: z.enum(["immediately", "after_review", "hidden"], {
      error: "visibility_invalid",
    }),
    allowRetakes: booleanValue,
    maxAttempts: z.coerce
      .number({ error: "retake_invalid" })
      .int({ error: "retake_invalid" })
      .min(1, { error: "retake_invalid" })
      .max(10, { error: "retake_invalid" }),
    availableFrom: isoDateTime,
    availableUntil: isoDateTime,
  })
  .superRefine((value, ctx) => {
    if (!value.allowRetakes && value.maxAttempts !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["maxAttempts"],
        message: "retake_invalid",
      });
    }

    if (value.allowRetakes && value.maxAttempts < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["maxAttempts"],
        message: "retake_invalid",
      });
    }

    if (
      value.availableFrom &&
      value.availableUntil &&
      Date.parse(value.availableUntil) <= Date.parse(value.availableFrom)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["availableUntil"],
        message: "availability_invalid",
      });
    }
  });

export type ImportSettingsInput = z.infer<typeof importSettingsSchema>;

const importOptionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, { error: "question_option_required" })
    .max(500, { error: "question_options_invalid" }),
  correct: z.boolean().default(false),
});

const importPairSchema = z.object({
  left: z
    .string()
    .trim()
    .min(1, { error: "question_pairs_invalid" })
    .max(500, { error: "question_pairs_invalid" }),
  right: z
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

export const importQuestionSchema = z
  .object({
    key: z.string().trim().max(80).optional(),
    sourceNumber: z.string().trim().max(20).optional(),
    type: z.enum(QUESTION_TYPES, { error: "question_type_invalid" }),
    promptEn: requiredText(4000, "question_prompt_required"),
    helpTextEn: optionalText(1000),
    topicEn: optionalText(300),
    minWords: optionalWordCount,
    maxWords: optionalWordCount,
    rubricEn: optionalText(4000),
    marks: z.coerce
      .number({ error: "question_marks_invalid" })
      .min(0.01, { error: "question_marks_invalid" })
      .max(100, { error: "question_marks_invalid" })
      .refine((value) => Math.round(value * 100) === value * 100, {
        error: "question_marks_invalid",
      }),
    confidence: z.enum(["high", "medium", "low"]).default("medium"),
    confidenceScore: z.coerce.number().min(0).max(1).default(0.5),
    evidence: z.array(z.string().trim().max(120)).max(12).default([]),
    reviewed: z.boolean().default(false),
    gradingMethod: z.enum(["automatic", "manual"], {
      error: "grading_method_invalid",
    }),
    options: z.array(importOptionSchema).max(10).default([]),
    pairs: z.array(importPairSchema).max(10).default([]),
    accepted: acceptedList,
    correctValue: z.enum(["true", "false"]).nullable().optional(),
    explanationEn: optionalText(2000),
    warnings: z.array(z.enum(IMPORT_WARNING_CODES)).max(30).default([]),
    raw: z.string().max(20_000).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.minWords !== undefined &&
      value.maxWords !== undefined &&
      value.maxWords < value.minWords
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxWords"],
        message: "question_word_limits_invalid",
      });
    }

    if (isManualOnlyType(value.type) && value.gradingMethod !== "manual") {
      ctx.addIssue({
        code: "custom",
        path: ["gradingMethod"],
        message: "grading_method_requires_manual",
      });
    }

    if (
      value.gradingMethod === "automatic" &&
      !isAutoGradableType(value.type)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["gradingMethod"],
        message: "automatic_grading_not_supported",
      });
    }

    if (value.type === "multiple_choice") {
      if (value.options.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "question_options_invalid",
        });
      }

      if (value.gradingMethod === "automatic") {
        const correct = value.options.filter((option) => option.correct);

        if (correct.length !== 1) {
          ctx.addIssue({
            code: "custom",
            path: ["options"],
            message: "question_option_required",
          });
        }
      }
    }

    if (value.type === "true_false" && value.gradingMethod === "automatic") {
      if (!value.correctValue) {
        ctx.addIssue({
          code: "custom",
          path: ["correctValue"],
          message: "question_answer_required",
        });
      }
    }

    if (value.type === "matching") {
      if (value.pairs.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["pairs"],
          message: "question_pairs_invalid",
        });
      }
    }

    if (
      (value.type === "short_answer" ||
        value.type === "rewrite" ||
        value.type === "find_the_mistake") &&
      value.gradingMethod === "automatic" &&
      value.accepted.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["accepted"],
        message: "question_answer_required",
      });
    }
  });

export type ImportQuestionInput = z.infer<typeof importQuestionSchema>;

const importDialogueLineSchema = z.object({
  speaker: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(4000),
});

export const importSectionSchema = z
  .object({
    key: z.string().trim().max(80).optional(),
    titleEn: requiredText(200, "section_title_required"),
    instructionsEn: optionalText(2000),
    kind: z
      .enum(["standard", "reading_passage", "dialogue"], {
        error: "section_kind_invalid",
      })
      .default("standard"),
    passageEn: optionalText(20000, "section_content_required"),
    vocabularyEn: optionalText(4000, "section_content_required"),
    sourceEn: optionalText(500, "section_content_required"),
    dialogueLines: z.array(importDialogueLineSchema).max(200).default([]),
    marks: z.coerce.number().min(0).max(1000).nullable().optional(),
    questions: z.array(importQuestionSchema).max(200).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "reading_passage" && !value.passageEn) {
      ctx.addIssue({
        code: "custom",
        path: ["passageEn"],
        message: "section_content_required",
      });
    }

    if (value.kind === "dialogue" && value.dialogueLines.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["dialogueLines"],
        message: "section_content_required",
      });
    }
  });

export type ImportSectionInput = z.infer<typeof importSectionSchema>;

export const importAiDecisionSchema = z.object({
  id: z.string().trim().min(1).max(200),
  status: z.enum(["accepted", "rejected"]),
});

export type ImportAiDecision = z.infer<typeof importAiDecisionSchema>;

export const updateImportDraftSchema = z.object({
  import_id: z.uuid({ error: "validation_failed" }),
  settings: importSettingsSchema,
  sections: z.array(importSectionSchema).max(50).default([]),
  /**
   * Only the accept/reject decisions are accepted from the browser. The route
   * keeps the stored model and request count so a client cannot reset the
   * per-import AI budget.
   */
  ai_decisions: z.array(importAiDecisionSchema).max(200).optional(),
});

export type UpdateImportDraftInput = z.infer<typeof updateImportDraftSchema>;

export const saveImportSchema = z.object({
  import_id: z.uuid({ error: "validation_failed" }),
  settings: importSettingsSchema,
  sections: z
    .array(importSectionSchema)
    .min(1, { error: "validation_failed" })
    .max(50)
    .refine(
      (sections) =>
        sections.some((section) => section.questions.length > 0),
      { error: "validation_failed" },
    ),
});

export type SaveImportInput = z.infer<typeof saveImportSchema>;

export const importAiOptionSchema = z.object({
  text: z.string().trim().min(1).max(500),
  correct: z.boolean().default(false),
});

export const importAiSuggestionSchema = z.object({
  question_number: z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim()),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().trim().max(4000).optional(),
  marks: z.coerce.number().min(0.01).max(100).optional(),
  options: z.array(importAiOptionSchema).max(10).optional(),
  correct_value: z.enum(["true", "false"]).nullable().optional(),
  accepted: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  explanation: z.string().trim().max(2000).optional(),
  reason: z.string().trim().max(300).optional(),
});

export const importAiResponseSchema = z.object({
  suggestions: z.array(importAiSuggestionSchema).max(200).default([]),
  warnings: z.array(z.string().trim().max(160)).max(20).default([]),
});

export type ImportAiResponse = z.infer<typeof importAiResponseSchema>;

export { fieldErrorsFrom };
export type { FieldErrors };
