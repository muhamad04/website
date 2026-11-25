"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireTeacher } from "@/lib/auth/dal";
import {
  getAssessmentDetail,
  getTeacherAssessmentById,
} from "@/lib/data/assessments";
import { gradeExists } from "@/lib/data/resources";
import type { AssessmentAdminAction } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import {
  answerKeyForQuestion,
  assessmentIdSchema,
  createAssessmentSchema,
  createQuestionSchema,
  createSectionSchema,
  fieldErrorsFrom,
  gradeAttemptSchema,
  questionIdSchema,
  reorderQuestionsSchema,
  reorderSectionsSchema,
  sectionIdSchema,
  setAssessmentPublishedSchema,
  updateAssessmentSchema,
  updateQuestionSchema,
  updateSectionSchema,
  isManualOnlyType,
  type AssessmentActionResult,
  type AssessmentErrorCode,
} from "@/lib/validation/assessments";
import { requestAttemptSync } from "@/lib/reporting/sync";
import { resolveStrictSettings } from "@/lib/assessments/strict";

/**
 * Assessment authoring actions. Every entry point begins with requireTeacher(),
 * validates with zod and re-reads the owning assessment before writing. The
 * browser never supplies a trusted grade, and answer keys are only written
 * here, never returned.
 */

function fail(
  error: AssessmentErrorCode,
  extra: Partial<AssessmentActionResult> = {},
): AssessmentActionResult {
  return { ok: false, error, ...extra };
}

function revalidateAssessmentSurfaces(assessmentId?: string): void {
  revalidatePath("/teacher/assessments");
  revalidatePath("/teacher");
  revalidatePath("/student/assessments");
  revalidatePath("/student");

  if (assessmentId) {
    revalidatePath(`/teacher/assessments/${assessmentId}`);
    revalidatePath(`/teacher/assessments/${assessmentId}/results`);
    revalidatePath(`/student/assessments/${assessmentId}`);
  }
}

async function logAssessmentEvent(
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
    detail,
  });

  if (error) {
    // Auditing must not turn a successful authoring action into a failure.
    console.error("assessment event log failed", error.message);
  }
}

function mapWriteError(message: string): AssessmentErrorCode {
  if (message.includes("assessments_attempt_rules_check")) {
    return "retake_invalid";
  }
  if (message.includes("assessments_availability_check")) {
    return "availability_invalid";
  }
  if (message.includes("question_options_label_unique")) {
    return "question_options_invalid";
  }
  if (message.includes("row-level security")) {
    return "forbidden";
  }
  return "unknown";
}

function optionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

/* -------------------------------------------------------------------------- */
/* Assessments                                                                */
/* -------------------------------------------------------------------------- */

export async function createAssessmentAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = createAssessmentSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;

  if (!(await gradeExists(data.grade_id))) {
    return fail("grade_not_found", {
      fieldErrors: { grade_id: "grade_not_found" },
    });
  }

  const supabase = await createClient();
  const strictSettings = resolveStrictSettings(data.type, data);
  const { data: created, error } = await supabase
    .from("assessments")
    .insert({
      grade_id: data.grade_id,
      type: data.type,
      title_en: data.title_en,
      // Assessments are authored in English only now, but the legacy column is
      // still NOT NULL. New rows mirror the English title; updates below omit
      // the Arabic column so existing Arabic data is never overwritten.
      title_ar: data.title_en,
      instructions_en: data.instructions_en ?? null,
      time_limit_minutes: data.time_limit_minutes,
      results_visibility: data.results_visibility,
      grading_mode: data.grading_mode,
      allow_retakes: data.allow_retakes,
      max_attempts: data.allow_retakes ? data.max_attempts : 1,
      available_from: data.available_from ?? null,
      available_until: data.available_until ?? null,
      is_published: data.is_published,
      ...strictSettings,
      created_by: staff.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("assessment insert failed", error?.message ?? "no data");
    return fail(mapWriteError(error?.message ?? ""));
  }

  await logAssessmentEvent(staff.id, created.id, "created", {
    title_en: data.title_en,
    type: data.type,
    grade_id: data.grade_id,
  });
  revalidateAssessmentSurfaces(created.id);

  return { ok: true, assessmentId: created.id };
}

export async function updateAssessmentAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = updateAssessmentSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const existing = await getTeacherAssessmentById(data.assessment_id);

  if (!existing) {
    return fail("not_found");
  }

  if (!(await gradeExists(data.grade_id))) {
    return fail("grade_not_found", {
      fieldErrors: { grade_id: "grade_not_found" },
    });
  }

  const supabase = await createClient();
  const strictSettings = resolveStrictSettings(data.type, data);
  const { error } = await supabase
    .from("assessments")
    .update({
      grade_id: data.grade_id,
      type: data.type,
      title_en: data.title_en,
      instructions_en: data.instructions_en ?? null,
      time_limit_minutes: data.time_limit_minutes,
      results_visibility: data.results_visibility,
      grading_mode: data.grading_mode,
      allow_retakes: data.allow_retakes,
      max_attempts: data.allow_retakes ? data.max_attempts : 1,
      available_from: data.available_from ?? null,
      available_until: data.available_until ?? null,
      is_published: data.is_published,
      ...strictSettings,
    })
    .eq("id", data.assessment_id);

  if (error) {
    console.error("assessment update failed", error.message);
    return fail(mapWriteError(error.message));
  }

  await logAssessmentEvent(staff.id, data.assessment_id, "updated", {
    title_en: data.title_en,
    type: data.type,
  });
  revalidateAssessmentSurfaces(data.assessment_id);

  return { ok: true, assessmentId: data.assessment_id };
}

export async function setAssessmentPublishedAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = setAssessmentPublishedSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const publish = parsed.data.is_published === "true";
  const existing = await getTeacherAssessmentById(parsed.data.assessment_id);

  if (!existing) {
    return fail("not_found");
  }

  if (publish) {
    const detail = await getAssessmentDetail(existing.id);

    if (!detail || detail.questionCount === 0) {
      return fail("assessment_no_questions");
    }

    if (detail.totalMarks <= 0) {
      return fail("assessment_no_gradable_questions");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("assessments")
    .update({ is_published: publish })
    .eq("id", existing.id);

  if (error) {
    console.error("assessment publish failed", error.message);
    return fail(mapWriteError(error.message));
  }

  await logAssessmentEvent(
    staff.id,
    existing.id,
    publish ? "published" : "unpublished",
    { title_en: existing.title_en },
  );

  if (publish) {
    const { data: importMarker } = await supabase
      .from("assessment_admin_events")
      .select("id")
      .eq("assessment_id", existing.id)
      .eq("action", "import_draft_created")
      .limit(1);

    if (importMarker && importMarker.length > 0) {
      await logAssessmentEvent(staff.id, existing.id, "import_published", {
        imported: true,
      });
    }
  }

  revalidateAssessmentSurfaces(existing.id);

  return { ok: true, assessmentId: existing.id };
}

export async function deleteAssessmentAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = assessmentIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const existing = await getTeacherAssessmentById(parsed.data.assessment_id);

  if (!existing) {
    return fail("not_found");
  }

  const supabase = await createClient();
  const { count, error: attemptError } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", existing.id);

  if (attemptError) {
    console.error("assessment attempt count failed", attemptError.message);
    return fail("unknown");
  }

  if ((count ?? 0) > 0) {
    return fail("assessment_has_attempts");
  }

  const { error } = await supabase
    .from("assessments")
    .delete()
    .eq("id", existing.id);

  if (error) {
    console.error("assessment delete failed", error.message);
    return fail(
      error.message.includes("attempts") ? "assessment_has_attempts" : mapWriteError(error.message),
    );
  }

  await logAssessmentEvent(staff.id, existing.id, "deleted", {
    title_en: existing.title_en,
    type: existing.type,
  });
  revalidateAssessmentSurfaces(existing.id);

  return { ok: true, assessmentId: existing.id };
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

export async function createSectionAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = createSectionSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const assessment = await getTeacherAssessmentById(parsed.data.assessment_id);

  if (!assessment) {
    return fail("not_found");
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("assessment_sections")
    .select("position")
    .eq("assessment_id", assessment.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = last ? Number(last.position) + 1 : 0;

  const { data: created, error } = await supabase
    .from("assessment_sections")
    .insert({
      assessment_id: assessment.id,
      title_en: parsed.data.title_en,
      // Legacy NOT NULL column: mirror the English title for new sections.
      // Section updates omit it, preserving any Arabic already stored.
      title_ar: parsed.data.title_en,
      instructions_en: parsed.data.instructions_en ?? null,
      position,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("section insert failed", error?.message ?? "no data");
    return fail(mapWriteError(error?.message ?? ""));
  }

  await logAssessmentEvent(staff.id, assessment.id, "section_created", {
    section_id: created.id,
    title_en: parsed.data.title_en,
  });
  revalidateAssessmentSurfaces(assessment.id);

  return { ok: true, assessmentId: assessment.id, sectionId: created.id };
}

export async function updateSectionAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = updateSectionSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("assessment_sections")
    .select("id, assessment_id")
    .eq("id", parsed.data.section_id)
    .maybeSingle();

  if (!section) {
    return fail("section_not_found");
  }

  const { error } = await supabase
    .from("assessment_sections")
    .update({
      title_en: parsed.data.title_en,
      instructions_en: parsed.data.instructions_en ?? null,
    })
    .eq("id", section.id);

  if (error) {
    console.error("section update failed", error.message);
    return fail(mapWriteError(error.message));
  }

  await logAssessmentEvent(staff.id, section.assessment_id, "section_updated", {
    section_id: section.id,
    title_en: parsed.data.title_en,
  });
  revalidateAssessmentSurfaces(section.assessment_id);

  return { ok: true, assessmentId: section.assessment_id, sectionId: section.id };
}

export async function deleteSectionAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = sectionIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("assessment_sections")
    .select("id, assessment_id, title_en")
    .eq("id", parsed.data.section_id)
    .maybeSingle();

  if (!section) {
    return fail("section_not_found");
  }

  const { data: questionRows } = await supabase
    .from("questions")
    .select("id")
    .eq("section_id", section.id);
  const questionIds = ((questionRows ?? []) as Array<{ id: string }>).map(
    (row) => row.id,
  );

  if (questionIds.length > 0) {
    const { count } = await supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .in("question_id", questionIds);

    if ((count ?? 0) > 0) {
      return fail("section_has_answers");
    }
  }

  const { error } = await supabase
    .from("assessment_sections")
    .delete()
    .eq("id", section.id);

  if (error) {
    console.error("section delete failed", error.message);
    return fail(
      error.message.includes("answers") ? "section_has_answers" : mapWriteError(error.message),
    );
  }

  await logAssessmentEvent(staff.id, section.assessment_id, "section_deleted", {
    section_id: section.id,
    title_en: section.title_en,
  });
  revalidateAssessmentSurfaces(section.assessment_id);

  return { ok: true, assessmentId: section.assessment_id };
}

export async function reorderSectionsAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = reorderSectionsSchema.safeParse(input);

  if (!parsed.success) {
    return fail("invalid_order");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_assessment_sections", {
    p_assessment_id: parsed.data.assessment_id,
    p_section_ids: parsed.data.section_ids,
  });

  if (error) {
    console.error("section reorder failed", error.message);
    return fail("invalid_order");
  }

  await logAssessmentEvent(staff.id, parsed.data.assessment_id, "sections_reordered", {
    section_ids: parsed.data.section_ids,
  });
  revalidateAssessmentSurfaces(parsed.data.assessment_id);

  return { ok: true, assessmentId: parsed.data.assessment_id };
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                  */
/* -------------------------------------------------------------------------- */

async function assertQuestionGradingRules(
  assessmentId: string,
  gradingMethod: "automatic" | "manual",
  type: string,
): Promise<AssessmentErrorCode | null> {
  const detail = await getAssessmentDetail(assessmentId);

  if (!detail) {
    return "not_found";
  }

  if (detail.grading_mode === "automatic" && gradingMethod !== "automatic") {
    return "automatic_grading_not_supported";
  }

  if (detail.grading_mode === "manual" && gradingMethod !== "manual") {
    return "grading_method_requires_manual";
  }

  if (isManualOnlyType(type) && gradingMethod !== "manual") {
    return "grading_method_requires_manual";
  }

  return null;
}

async function insertQuestionChildren(
  supabase: Awaited<ReturnType<typeof createClient>>,
  questionId: string,
  input: {
    type: string;
    options?: Array<{ text_en: string }>;
    correct_index?: number;
    pairs?: Array<{
      left_text_en: string;
      right_text_en: string;
    }>;
  },
): Promise<string | null> {
  if (input.type === "multiple_choice") {
    const rows = (input.options ?? []).map((option, index) => ({
      question_id: questionId,
      label: optionLabel(index),
      text_en: option.text_en,
      is_correct: index === input.correct_index,
      position: index,
    }));

    const { error } = await supabase.from("question_options").insert(rows);
    if (error) return error.message;
  }

  if (input.type === "matching") {
    const rows = (input.pairs ?? []).map((pair, index) => ({
      question_id: questionId,
      left_text_en: pair.left_text_en,
      right_text_en: pair.right_text_en,
      position: index,
    }));

    const { error } = await supabase.from("matching_pairs").insert(rows);
    if (error) return error.message;
  }

  return null;
}

export async function createQuestionAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = createQuestionSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const supabase = await createClient();
  const { data: section } = await supabase
    .from("assessment_sections")
    .select("id, assessment_id")
    .eq("id", data.section_id)
    .maybeSingle();

  if (!section) {
    return fail("section_not_found", {
      fieldErrors: { section_id: "section_not_found" },
    });
  }

  const ruleError = await assertQuestionGradingRules(
    section.assessment_id,
    data.grading_method,
    data.type,
  );

  if (ruleError) {
    return fail(ruleError, { fieldErrors: { grading_method: ruleError } });
  }

  const { data: last } = await supabase
    .from("questions")
    .select("position")
    .eq("section_id", section.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = last ? Number(last.position) + 1 : 0;

  const { data: created, error } = await supabase
    .from("questions")
    .insert({
      section_id: section.id,
      type: data.type,
      prompt_en: data.prompt_en,
      help_text_en: data.help_text_en ?? null,
      marks: data.marks,
      is_required: data.is_required,
      position,
      correct_answer: answerKeyForQuestion(data),
      grading_method: data.grading_method,
      explanation_en: data.explanation_en ?? null,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("question insert failed", error?.message ?? "no data");
    return fail(mapWriteError(error?.message ?? ""));
  }

  const childError = await insertQuestionChildren(supabase, created.id, data);

  if (childError) {
    console.error("question children insert failed", childError);
    await supabase.from("questions").delete().eq("id", created.id);
    return fail(mapWriteError(childError));
  }

  await logAssessmentEvent(staff.id, section.assessment_id, "question_created", {
    question_id: created.id,
    section_id: section.id,
    type: data.type,
  });
  revalidateAssessmentSurfaces(section.assessment_id);

  return {
    ok: true,
    assessmentId: section.assessment_id,
    sectionId: section.id,
    questionId: created.id,
  };
}

export async function updateQuestionAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = updateQuestionSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const supabase = await createClient();
  const { data: question } = await supabase
    .from("questions")
    .select("id, section_id, type, section:assessment_sections!inner ( id, assessment_id )")
    .eq("id", data.question_id)
    .maybeSingle();

  if (!question) {
    return fail("question_not_found");
  }

  const section = question.section as unknown as {
    id: string;
    assessment_id: string;
  } | null;

  if (!section) {
    return fail("section_not_found");
  }

  const { count: answerCount } = await supabase
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("question_id", question.id);

  const hasAnswers = (answerCount ?? 0) > 0;

  if (hasAnswers && question.type !== data.type) {
    return fail("question_has_answers");
  }

  const ruleError = await assertQuestionGradingRules(
    section.assessment_id,
    data.grading_method,
    data.type,
  );

  if (ruleError) {
    return fail(ruleError, { fieldErrors: { grading_method: ruleError } });
  }

  const { error } = await supabase
    .from("questions")
    .update({
      type: data.type,
      prompt_en: data.prompt_en,
      help_text_en: data.help_text_en ?? null,
      marks: data.marks,
      is_required: data.is_required,
      correct_answer: answerKeyForQuestion(data),
      grading_method: data.grading_method,
      explanation_en: data.explanation_en ?? null,
    })
    .eq("id", question.id);

  if (error) {
    console.error("question update failed", error.message);
    return fail(mapWriteError(error.message));
  }

  const replacesChoices =
    data.type === "multiple_choice" || data.type === "matching";

  if (!hasAnswers && replacesChoices) {
    await supabase.from("question_options").delete().eq("question_id", question.id);
    await supabase.from("matching_pairs").delete().eq("question_id", question.id);
    const childError = await insertQuestionChildren(
      supabase,
      question.id,
      data,
    );

    if (childError) {
      console.error("question children update failed", childError);
      return fail(mapWriteError(childError));
    }
  }

  await logAssessmentEvent(
    staff.id,
    section.assessment_id,
    "question_updated",
    {
      question_id: question.id,
      section_id: section.id,
      type: data.type,
    },
  );
  revalidateAssessmentSurfaces(section.assessment_id);

  return {
    ok: true,
    assessmentId: section.assessment_id,
    sectionId: section.id,
    questionId: question.id,
  };
}

export async function deleteQuestionAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = questionIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const supabase = await createClient();
  const { data: question } = await supabase
    .from("questions")
    .select("id, section_id, type, section:assessment_sections!inner ( assessment_id )")
    .eq("id", parsed.data.question_id)
    .maybeSingle();

  if (!question) {
    return fail("question_not_found");
  }

  const section = question.section as unknown as { assessment_id: string } | null;

  const { count } = await supabase
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("question_id", question.id);

  if ((count ?? 0) > 0) {
    return fail("question_has_answers");
  }

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", question.id);

  if (error) {
    console.error("question delete failed", error.message);
    return fail(
      error.message.includes("answers") ? "question_has_answers" : mapWriteError(error.message),
    );
  }

  await logAssessmentEvent(
    staff.id,
    section?.assessment_id ?? null,
    "question_deleted",
    { question_id: question.id, section_id: question.section_id, type: question.type },
  );
  revalidateAssessmentSurfaces(section?.assessment_id);

  return { ok: true, assessmentId: section?.assessment_id };
}

export async function reorderQuestionsAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = reorderQuestionsSchema.safeParse(input);

  if (!parsed.success) {
    return fail("invalid_order");
  }

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("assessment_sections")
    .select("id, assessment_id")
    .eq("id", parsed.data.section_id)
    .maybeSingle();

  if (!section) {
    return fail("section_not_found");
  }

  const { error } = await supabase.rpc("reorder_section_questions", {
    p_section_id: parsed.data.section_id,
    p_question_ids: parsed.data.question_ids,
  });

  if (error) {
    console.error("question reorder failed", error.message);
    return fail("invalid_order");
  }

  await logAssessmentEvent(
    staff.id,
    section.assessment_id,
    "questions_reordered",
    {
      section_id: section.id,
      question_ids: parsed.data.question_ids,
    },
  );
  revalidateAssessmentSurfaces(section.assessment_id);

  return { ok: true, assessmentId: section.assessment_id, sectionId: section.id };
}

/* -------------------------------------------------------------------------- */
/* Manual grading                                                             */
/* -------------------------------------------------------------------------- */

export async function gradeAttemptAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const staff = await requireTeacher();
  const parsed = gradeAttemptSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, assessment_id, status")
    .eq("id", parsed.data.attempt_id)
    .maybeSingle();

  if (!attempt) {
    return fail("attempt_not_found");
  }

  if (attempt.status !== "grading" && attempt.status !== "graded") {
    return fail("attempt_not_submitted");
  }

  const { error } = await supabase.rpc("teacher_grade_attempt", {
    p_attempt_id: parsed.data.attempt_id,
    p_grades: parsed.data.grades.map((grade) => ({
      answer_id: grade.answer_id,
      marks_awarded: grade.marks_awarded,
      feedback_en: grade.feedback_en ?? "",
      feedback_ar: grade.feedback_ar ?? "",
    })),
  });

  if (error) {
    console.error("teacher_grade_attempt failed", error.message);
    if (error.message.includes("invalid_marks")) {
      return fail("question_marks_invalid");
    }
    if (error.message.includes("attempt_not_submitted")) {
      return fail("attempt_not_submitted");
    }
    if (error.message.includes("not_authorized")) {
      return fail("forbidden");
    }
    return fail("unknown");
  }

  await logAssessmentEvent(staff.id, attempt.assessment_id, "attempt_graded", {
    attempt_id: attempt.id,
    answers: parsed.data.grades.length,
  });
  revalidateAssessmentSurfaces(attempt.assessment_id);
  revalidatePath(
    `/teacher/assessments/${attempt.assessment_id}/results/${attempt.id}`,
  );
  revalidatePath(`/student/assessments/${attempt.assessment_id}`);

  try {
    after(() => requestAttemptSync(attempt.id));
  } catch {
    // Outside a request scope; the admin retry action can sync it later.
  }

  return {
    ok: true,
    assessmentId: attempt.assessment_id,
    attemptId: attempt.id,
  };
}
