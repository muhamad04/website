"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth/dal";
import { getAssessmentImport } from "@/lib/data/imports";
import { gradeExists } from "@/lib/data/resources";
import type { AssessmentAdminAction } from "@/lib/domain/types";
import { importAuditStats, sanitiseImportAuditDetail } from "@/lib/import/audit";
import {
  buildAssessmentWrite,
  buildOptionWrites,
  buildPairWrites,
  buildQuestionWrite,
  buildSectionWrite,
  computeGradingMode,
  computeTotalMarks,
} from "@/lib/import/save";
import { removeImportObjects } from "@/lib/import/storage";
import type { ImportDraft, ImportSectionDraft } from "@/lib/import/types";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsFrom,
  importIdSchema,
  saveImportSchema,
  updateImportDraftSchema,
  type ImportActionResult,
  type ImportErrorCode,
  type ImportSectionInput,
  type ImportSettingsInput,
} from "@/lib/import/validation";

/**
 * Import staging actions. Every entry point re-reads the teacher, re-reads the
 * staging row through RLS and never accepts an assessment id from the browser.
 */

function fail(
  error: ImportErrorCode,
  extra: Partial<ImportActionResult> = {},
): ImportActionResult {
  return { ok: false, error, ...extra };
}

function revalidateImportSurfaces(assessmentId?: string): void {
  revalidatePath("/teacher/assessments/import");
  revalidatePath("/teacher/assessments");
  revalidatePath("/teacher");

  if (assessmentId) {
    revalidatePath(`/teacher/assessments/${assessmentId}`);
  }
}

async function logImportEvent(
  actorId: string,
  assessmentId: string | null,
  action: AssessmentAdminAction,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("assessment_admin_events").insert({
    assessment_id: assessmentId,
    actor_id: actorId,
    action,
    detail: sanitiseImportAuditDetail(detail),
  });

  if (error) {
    // Auditing must not turn a successful import into a failure.
    console.error("import event log failed", error.message);
  }
}

function isExpired(expiresAt: string): boolean {
  const value = Date.parse(expiresAt);
  return Number.isNaN(value) || value <= Date.now();
}

function ownerOrAdmin(
  row: { created_by: string },
  staff: { id: string; role: string },
): boolean {
  return row.created_by === staff.id || staff.role === "admin";
}

function mapWriteError(message: string): ImportErrorCode {
  if (message.includes("row-level security")) {
    return "forbidden";
  }

  return "save_failed";
}

function normalisedSettings(settings: ImportSettingsInput): ImportDraft["settings"] {
  return {
    ...settings,
    titleAr: settings.titleAr ?? "",
    instructionsEn: settings.instructionsEn ?? "",
    instructionsAr: settings.instructionsAr ?? "",
    availableFrom: settings.availableFrom ?? "",
    availableUntil: settings.availableUntil ?? "",
  };
}

function collectWarnings(
  sections: ImportSectionInput[],
  previous: ImportDraft["warnings"] = [],
): ImportDraft["warnings"] {
  const warnings: ImportDraft["warnings"] = [];
  const questions = sections.flatMap((section) => section.questions);

  if (sections.length === 0 || questions.length === 0) {
    warnings.push({ code: "no_questions_detected" });
  }

  for (const section of sections) {
    if (section.questions.length === 0) {
      warnings.push({ code: "empty_section" });
    }
  }

  const numbers = questions
    .map((question) => question.sourceNumber)
    .filter((number): number is string => Boolean(number));

  if (new Set(numbers).size !== numbers.length) {
    warnings.push({ code: "duplicate_question_number" });
  }

  for (const question of questions) {
    for (const code of question.warnings) {
      warnings.push({
        code,
        questionNumber: question.sourceNumber,
        questionKey: question.key,
      });
    }
  }

  for (const warning of previous) {
    if (warning.questionKey || warning.questionNumber) {
      continue;
    }

    if (
      warning.code === "no_title_detected" ||
      warning.code === "text_truncated" ||
      warning.code === "answer_key_in_question_file"
    ) {
      warnings.push(warning);
    }
  }

  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.questionKey ?? ""}:${warning.questionNumber ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildDraftFromReview(options: {
  row: { draft: ImportDraft };
  settings: ImportSettingsInput;
  sections: ImportSectionInput[];
  aiDecisions?: Array<{ id: string; status: "accepted" | "rejected" }>;
}): ImportDraft {
  const settings = normalisedSettings(options.settings);
  const warnings = collectWarnings(
    options.sections,
    options.row.draft?.warnings ?? [],
  );
  const questions = options.sections.flatMap((section) => section.questions);
  const sections: ImportSectionDraft[] = options.sections.map(
    (section, sectionIndex) => ({
      key: section.key ?? `s-${sectionIndex + 1}`,
      titleEn: section.titleEn,
      titleAr: section.titleAr ?? "",
      instructionsEn: section.instructionsEn ?? "",
      marks: section.marks ?? null,
      questions: section.questions.map((question, questionIndex) => ({
        key: question.key ?? `q-${sectionIndex + 1}-${questionIndex + 1}`,
        sourceNumber: question.sourceNumber ?? "",
        type: question.type,
        promptEn: question.promptEn,
        promptAr: question.promptAr ?? "",
        helpTextEn: question.helpTextEn ?? "",
        marks: question.marks,
        confidence: question.confidence,
        confidenceScore: question.confidenceScore,
        evidence: [...question.evidence],
        reviewed: question.reviewed,
        gradingMethod: question.gradingMethod,
        options: question.options.map((option) => ({ ...option })),
        pairs: question.pairs.map((pair) => ({ ...pair })),
        accepted: [...question.accepted],
        correctValue: question.correctValue ?? null,
        explanationEn: question.explanationEn ?? "",
        warnings: [...question.warnings],
        raw: question.raw ?? "",
      })),
    }),
  );

  const allQuestions = sections.flatMap((section) => section.questions);
  const storedAi = options.row.draft?.ai;
  const ai =
    storedAi && options.aiDecisions && options.aiDecisions.length > 0
      ? {
          ...storedAi,
          suggestions: storedAi.suggestions.map((suggestion) => {
            const decision = options.aiDecisions?.find(
              (candidate) => candidate.id === suggestion.id,
            );

            return decision
              ? { ...suggestion, status: decision.status }
              : suggestion;
          }),
        }
      : storedAi;

  return {
    settings,
    sections,
    answerKey: options.row.draft?.answerKey ?? [],
    warnings,
    sourceText: options.row.draft?.sourceText ?? "",
    answerText: options.row.draft?.answerText ?? "",
    ai,
    stats: {
      sectionCount: sections.length,
      questionCount: questions.length,
      totalMarks: computeTotalMarks(questions),
      warningCount: warnings.length,
      matchedAnswers: (options.row.draft?.answerKey ?? []).filter(
        (entry) => entry.status === "matched",
      ).length,
      unmatchedAnswers: (options.row.draft?.answerKey ?? []).filter(
        (entry) => entry.status !== "matched",
      ).length,
      reviewCount: allQuestions.filter(
        (question) =>
          question.confidence === "low" || question.warnings.length > 0,
      ).length,
      parserConfidence:
        allQuestions.length === 0
          ? 0
          : Math.round(
              (allQuestions.reduce(
                (sum, question) => sum + (question.confidenceScore ?? 0.5),
                0,
              ) /
                allQuestions.length) *
                100,
            ) / 100,
    },
  };
}

async function loadWritableImport(
  importId: string,
  staff: { id: string; role: string },
): Promise<
  | { ok: true; row: NonNullable<Awaited<ReturnType<typeof getAssessmentImport>>> }
  | { ok: false; error: ImportErrorCode }
> {
  const row = await getAssessmentImport(importId);

  if (!row || !ownerOrAdmin(row, staff)) {
    return { ok: false, error: "not_found" };
  }

  if (row.status === "saved") {
    return { ok: false, error: "already_saved" };
  }

  if (row.status === "cancelled") {
    return { ok: false, error: "not_found" };
  }

  if (isExpired(row.expires_at)) {
    return { ok: false, error: "expired" };
  }

  return { ok: true, row };
}

/* -------------------------------------------------------------------------- */
/* Draft editing                                                              */
/* -------------------------------------------------------------------------- */

export async function updateImportDraftAction(
  input: unknown,
): Promise<ImportActionResult> {
  const staff = await requireTeacher();
  const parsed = updateImportDraftSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const loaded = await loadWritableImport(parsed.data.import_id, staff);

  if (!loaded.ok) {
    return fail(loaded.error);
  }

  const draft = buildDraftFromReview({
    row: loaded.row,
    settings: parsed.data.settings,
    sections: parsed.data.sections,
    aiDecisions: parsed.data.ai_decisions,
  });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assessment_imports")
    .update({ draft, expires_at: expiresAt })
    .eq("id", loaded.row.id);

  if (error) {
    console.error("import draft update failed", error.message);
    return fail(mapWriteError(error.message));
  }

  await logImportEvent(staff.id, null, "import_draft_edited", {
    import_id: loaded.row.id,
    ...sanitiseImportAuditDetail({
      question_count: draft.stats.questionCount,
      section_count: draft.stats.sectionCount,
      warning_count: draft.stats.warningCount,
    }),
  });
  revalidateImportSurfaces();

  return { ok: true, importId: loaded.row.id };
}

/* -------------------------------------------------------------------------- */
/* Save as an unpublished assessment                                          */
/* -------------------------------------------------------------------------- */

export async function saveImportedAssessmentAction(
  input: unknown,
): Promise<ImportActionResult> {
  const staff = await requireTeacher();
  const parsed = saveImportSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const loaded = await loadWritableImport(parsed.data.import_id, staff);

  if (!loaded.ok) {
    return fail(loaded.error);
  }

  if (!(await gradeExists(parsed.data.settings.gradeId))) {
    return fail("grade_not_found", {
      fieldErrors: { "settings.gradeId": "grade_not_found" },
    });
  }

  const draft = buildDraftFromReview({
    row: loaded.row,
    settings: parsed.data.settings,
    sections: parsed.data.sections,
  });
  const questions = parsed.data.sections.flatMap(
    (section) => section.questions,
  );
  const gradingMode = computeGradingMode(questions);
  const supabase = await createClient();

  // Keep the teacher's review edits even if the assessment insert fails.
  const { error: draftError } = await supabase
    .from("assessment_imports")
    .update({
      draft,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", loaded.row.id);

  if (draftError) {
    console.error("import draft save failed", draftError.message);
    return fail(mapWriteError(draftError.message));
  }

  const { data: created, error: assessmentError } = await supabase
    .from("assessments")
    .insert(
      buildAssessmentWrite({
        settings: parsed.data.settings,
        gradingMode,
        createdBy: staff.id,
      }),
    )
    .select("id")
    .single();

  if (assessmentError || !created) {
    console.error(
      "imported assessment insert failed",
      assessmentError?.message ?? "no data",
    );
    return fail(mapWriteError(assessmentError?.message ?? ""));
  }

  const assessmentId = (created as { id: string }).id;

  try {
    for (const [sectionIndex, section] of parsed.data.sections.entries()) {
      const { data: sectionRow, error: sectionError } = await supabase
        .from("assessment_sections")
        .insert(
          buildSectionWrite({
            section,
            assessmentId,
            position: sectionIndex,
          }),
        )
        .select("id")
        .single();

      if (sectionError || !sectionRow) {
        throw new Error(sectionError?.message ?? "section");
      }

      const sectionId = (sectionRow as { id: string }).id;

      for (const [questionIndex, question] of section.questions.entries()) {
        const { data: questionRow, error: questionError } = await supabase
          .from("questions")
          .insert(
            buildQuestionWrite({
              question,
              sectionId,
              position: questionIndex,
            }),
          )
          .select("id")
          .single();

        if (questionError || !questionRow) {
          throw new Error(questionError?.message ?? "question");
        }

        const questionId = (questionRow as { id: string }).id;
        const options = buildOptionWrites(questionId, question);
        const pairs = buildPairWrites(questionId, question);

        if (options.length > 0) {
          const { error } = await supabase
            .from("question_options")
            .insert(options);

          if (error) {
            throw new Error(error.message);
          }
        }

        if (pairs.length > 0) {
          const { error } = await supabase
            .from("matching_pairs")
            .insert(pairs);

          if (error) {
            throw new Error(error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error(
      "imported assessment children failed",
      error instanceof Error ? error.message : "unknown error",
    );
    await supabase.from("assessments").delete().eq("id", assessmentId);
    return fail("save_failed");
  }

  const filesRemoved = await removeImportObjects([
    loaded.row.answer_path,
    loaded.row.source_path,
  ]);
  const now = new Date().toISOString();
  const { error: markError } = await supabase
    .from("assessment_imports")
    .update({
      status: "saved",
      assessment_id: assessmentId,
      source_path: filesRemoved ? null : loaded.row.source_path,
      answer_path: filesRemoved ? null : loaded.row.answer_path,
      source_text: "",
      answer_text: "",
      draft: {},
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now,
    })
    .eq("id", loaded.row.id);

  if (markError) {
    console.error("import saved state failed", markError.message);
    await supabase.from("assessments").delete().eq("id", assessmentId);
    return fail("save_failed");
  }

  await logImportEvent(staff.id, assessmentId, "import_draft_edited", {
    import_id: loaded.row.id,
    ...sanitiseImportAuditDetail({
      question_count: draft.stats.questionCount,
      section_count: draft.stats.sectionCount,
      warning_count: draft.stats.warningCount,
    }),
  });
  await logImportEvent(staff.id, assessmentId, "import_draft_created", {
    import_id: loaded.row.id,
    ...importAuditStats(draft),
  });
  revalidateImportSurfaces(assessmentId);

  return { ok: true, importId: loaded.row.id, assessmentId };
}

/* -------------------------------------------------------------------------- */
/* Cancel                                                                     */
/* -------------------------------------------------------------------------- */

export async function cancelImportAction(
  input: unknown,
): Promise<ImportActionResult> {
  const staff = await requireTeacher();
  const parsed = importIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const row = await getAssessmentImport(parsed.data.import_id);

  if (!row || !ownerOrAdmin(row, staff)) {
    return fail("not_found");
  }

  if (row.status === "saved") {
    return fail("already_saved");
  }

  const removed = await removeImportObjects([row.answer_path, row.source_path]);

  if (!removed) {
    return fail("storage_failed");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("assessment_imports")
    .delete()
    .eq("id", row.id);

  if (error) {
    console.error("import cancel failed", error.message);
    return fail(mapWriteError(error.message));
  }

  revalidateImportSurfaces();

  return { ok: true, importId: row.id };
}
