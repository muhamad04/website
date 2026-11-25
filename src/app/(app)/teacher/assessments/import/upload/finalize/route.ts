import { getCurrentProfile } from "@/lib/auth/dal";
import { getAssessmentImport } from "@/lib/data/imports";
import { gradeExists } from "@/lib/data/resources";
import { isStaffRole } from "@/lib/domain/roles";
import { sanitiseImportAuditDetail } from "@/lib/import/audit";
import { getImportMaxBytes } from "@/lib/import/config";
import { buildImportPath, IMPORT_RETENTION_HOURS } from "@/lib/import/files";
import { extractImportFile } from "@/lib/import/extract";
import { buildImportDraft } from "@/lib/import/parser";
import {
  downloadImportObject,
  removeImportFolder,
  statImportObject,
} from "@/lib/import/storage";
import type { ImportSettings } from "@/lib/import/types";
import {
  importUploadFinalizeSchema,
  type ImportActionResult,
} from "@/lib/import/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * Step 2 of the signed-upload flow. The browser has already streamed bytes to
 * Storage. This route verifies ownership and object size, downloads only when
 * parsing is required, re-checks magic bytes, then stores the parsed draft.
 * Nothing is published.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: ImportActionResult, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

async function discard(importId: string, userId: string): Promise<void> {
  await removeImportFolder(userId, importId);

  try {
    const supabase = await createClient();
    await supabase.from("assessment_imports").delete().eq("id", importId);
  } catch {
    // The expiry sweep will remove the row later.
  }
}

export async function POST(request: Request): Promise<Response> {
  const profile = await getCurrentProfile();

  if (!profile || !profile.is_active || !isStaffRole(profile.role)) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "validation_failed" }, 400);
  }

  const parsed = importUploadFinalizeSchema.safeParse(payload);

  if (!parsed.success) {
    return json({ ok: false, error: "validation_failed" }, 400);
  }

  const { import_id: importId } = parsed.data;
  const row = await getAssessmentImport(importId);

  if (!row || row.created_by !== profile.id) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  if (row.status !== "draft") {
    return json({ ok: false, error: "not_found" }, 404);
  }

  if (Date.parse(row.expires_at) <= Date.now()) {
    await discard(importId, profile.id);
    return json({ ok: false, error: "expired" }, 410);
  }

  if (!(await gradeExists(parsed.data.grade_id))) {
    return json({ ok: false, error: "grade_not_found" }, 400);
  }

  const maxBytes = getImportMaxBytes();

  if (row.source_size > maxBytes || (row.answer_size ?? 0) > maxBytes) {
    await discard(importId, profile.id);
    return json({ ok: false, error: "file_too_large" }, 413);
  }

  const questionPath = buildImportPath({
    userId: profile.id,
    importId,
    role: "questions",
    fileName: row.source_file_name,
  });
  const answerPath = row.answer_file_name
    ? buildImportPath({
        userId: profile.id,
        importId,
        role: "answers",
        fileName: row.answer_file_name,
      })
    : null;

  if (
    !row.source_path ||
    row.source_path !== questionPath ||
    (answerPath !== null && row.answer_path !== answerPath)
  ) {
    await discard(importId, profile.id);
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const questionStat = await statImportObject(questionPath);

  if (!questionStat.ok || questionStat.stat.size <= 0) {
    await discard(importId, profile.id);
    return json({ ok: false, error: "upload_failed" }, 400);
  }

  if (questionStat.stat.size > maxBytes) {
    await discard(importId, profile.id);
    return json({ ok: false, error: "file_too_large" }, 413);
  }

  let answerStat: Awaited<ReturnType<typeof statImportObject>> | null = null;

  if (answerPath) {
    answerStat = await statImportObject(answerPath);

    if (!answerStat.ok || answerStat.stat.size <= 0) {
      await discard(importId, profile.id);
      return json({ ok: false, error: "upload_failed" }, 400);
    }

    if (answerStat.stat.size > maxBytes) {
      await discard(importId, profile.id);
      return json({ ok: false, error: "file_too_large" }, 413);
    }
  }

  const questionDownload = await downloadImportObject(questionPath);

  if (!questionDownload.ok) {
    await discard(importId, profile.id);
    return json({ ok: false, error: questionDownload.error }, 500);
  }

  const questionExtract = await extractImportFile({
    fileName: row.source_file_name,
    mimeType: row.source_mime_type,
    bytes: questionDownload.bytes,
    maxBytes,
  });

  if (!questionExtract.ok) {
    await discard(importId, profile.id);
    return json({ ok: false, error: questionExtract.error }, 400);
  }

  let answerExtract: Awaited<ReturnType<typeof extractImportFile>> | null = null;

  if (answerPath) {
    const answerDownload = await downloadImportObject(answerPath);

    if (!answerDownload.ok) {
      await discard(importId, profile.id);
      return json({ ok: false, error: answerDownload.error }, 500);
    }

    answerExtract = await extractImportFile({
      fileName: row.answer_file_name ?? "answers.txt",
      mimeType: row.answer_mime_type ?? "text/plain",
      bytes: answerDownload.bytes,
      maxBytes,
    });

    if (!answerExtract.ok) {
      await discard(importId, profile.id);
      return json({ ok: false, error: answerExtract.error }, 400);
    }
  }

  const settings: ImportSettings = {
    type: parsed.data.type,
    gradeId: parsed.data.grade_id,
    titleEn: parsed.data.title_en ?? "",
    instructionsEn: "",
    timeLimitMinutes: 30,
    resultsVisibility: "after_review",
    allowRetakes: false,
    maxAttempts: 1,
    availableFrom: "",
    availableUntil: "",
  };

  const draft = buildImportDraft({
    questionText: questionExtract.text,
    answerText: answerExtract?.ok ? answerExtract.text : "",
    fileName: row.source_file_name,
    settings,
    questionTextTruncated: questionExtract.truncated,
    answerTextTruncated: answerExtract?.ok ? answerExtract.truncated : false,
  });

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("assessment_imports")
    .update({
      source_kind: questionExtract.kind,
      answer_kind: answerExtract?.ok ? answerExtract.kind : null,
      source_text: questionExtract.text,
      answer_text: answerExtract?.ok ? answerExtract.text : "",
      draft,
      expires_at: new Date(
        Date.now() + IMPORT_RETENTION_HOURS * 60 * 60 * 1000,
      ).toISOString(),
    })
    .eq("id", importId);

  if (updateError) {
    await discard(importId, profile.id);
    console.error("assessment import staging failed", updateError.message);
    return json({ ok: false, error: "storage_failed" }, 500);
  }

  const { error: eventError } = await supabase
    .from("assessment_admin_events")
    .insert({
      assessment_id: null,
      actor_id: profile.id,
      action: "import_draft_created",
      detail: sanitiseImportAuditDetail({
        import_id: importId,
        status: "draft",
        file_name: row.source_file_name,
        file_size: questionStat.stat.size,
        question_count: draft.stats.questionCount,
        section_count: draft.stats.sectionCount,
        total_marks: draft.stats.totalMarks,
        warning_count: draft.stats.warningCount,
        matched_answers: draft.stats.matchedAnswers,
        unmatched_answers: draft.stats.unmatchedAnswers,
        review_count: draft.stats.reviewCount,
        parser_confidence: draft.stats.parserConfidence,
        has_answer_key: Boolean(answerPath),
        source_kind: questionExtract.kind,
        answer_kind: answerExtract?.ok ? answerExtract.kind : undefined,
      }),
    });

  if (eventError) {
    console.error("import draft created event failed", eventError.message);
  }

  return json({ ok: true, importId });
}
