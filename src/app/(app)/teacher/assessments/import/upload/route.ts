import { getCurrentProfile } from "@/lib/auth/dal";
import { gradeExists } from "@/lib/data/resources";
import { isStaffRole } from "@/lib/domain/roles";
import { sanitiseImportAuditDetail } from "@/lib/import/audit";
import { buildImportDraft } from "@/lib/import/parser";
import {
  IMPORT_MAX_TOTAL_BYTES,
  buildImportPath,
} from "@/lib/import/files";
import { extractImportFile } from "@/lib/import/extract";
import { removeImportObjects, uploadImportObject } from "@/lib/import/storage";
import type { ImportSettings } from "@/lib/import/types";
import {
  importUploadMetaSchema,
  type ImportActionResult,
} from "@/lib/import/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * Upload route rather than a server action: a 4 MB DOCX and a 4 MB answer key
 * would otherwise run into server-action body limits. The route re-checks the
 * staff session, validates every byte locally and only then creates the staging
 * row. Uploaded content is never logged.
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

function fileFrom(value: FormDataEntryValue | null): File | null {
  return value instanceof File ? value : null;
}

export async function POST(request: Request): Promise<Response> {
  const profile = await getCurrentProfile();

  if (!profile || !profile.is_active || !isStaffRole(profile.role)) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "validation_failed" }, 400);
  }

  const questionFile = fileFrom(form.get("questions"));
  const answerFile = fileFrom(form.get("answers"));

  if (!questionFile || questionFile.size === 0) {
    return json({ ok: false, error: "file_required" }, 400);
  }

  const totalSize = questionFile.size + (answerFile?.size ?? 0);

  if (totalSize > IMPORT_MAX_TOTAL_BYTES) {
    return json({ ok: false, error: "file_too_large" }, 413);
  }

  const meta = importUploadMetaSchema.safeParse({
    grade_id: form.get("grade_id"),
    type: form.get("type") ?? "quiz",
    title_en: form.get("title_en") ?? undefined,
  });

  if (!meta.success) {
    return json({ ok: false, error: "validation_failed" }, 400);
  }

  if (!(await gradeExists(meta.data.grade_id))) {
    return json({ ok: false, error: "grade_not_found" }, 400);
  }

  const [questionBytes, answerBytes] = await Promise.all([
    questionFile.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
    answerFile
      ? answerFile.arrayBuffer().then((buffer) => new Uint8Array(buffer))
      : Promise.resolve(null),
  ]);

  const questionExtract = await extractImportFile({
    fileName: questionFile.name,
    mimeType: questionFile.type,
    bytes: questionBytes,
  });

  if (!questionExtract.ok) {
    return json({ ok: false, error: questionExtract.error }, 400);
  }

  let answerExtract: Awaited<ReturnType<typeof extractImportFile>> | null = null;

  if (answerFile && answerBytes) {
    answerExtract = await extractImportFile({
      fileName: answerFile.name,
      mimeType: answerFile.type,
      bytes: answerBytes,
    });

    if (!answerExtract.ok) {
      return json({ ok: false, error: answerExtract.error }, 400);
    }
  }

  const settings: ImportSettings = {
    type: meta.data.type,
    gradeId: meta.data.grade_id,
    titleEn: meta.data.title_en ?? "",
    titleAr: "",
    instructionsEn: "",
    instructionsAr: "",
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
    fileName: questionFile.name,
    settings,
    questionTextTruncated: questionExtract.truncated,
    answerTextTruncated: answerExtract ? answerExtract.ok && answerExtract.truncated : false,
  });

  const answerKind = answerExtract && answerExtract.ok ? answerExtract.kind : null;
  const answerText = answerExtract && answerExtract.ok ? answerExtract.text : "";

  const importId = globalThis.crypto.randomUUID();
  const questionPath = buildImportPath({
    userId: profile.id,
    importId,
    role: "questions",
    fileName: questionFile.name,
  });
  const answerPath =
    answerFile && answerExtract?.ok
      ? buildImportPath({
          userId: profile.id,
          importId,
          role: "answers",
          fileName: answerFile.name,
        })
      : null;

  const questionUpload = await uploadImportObject({
    path: questionPath,
    bytes: questionBytes,
    contentType: questionFile.type,
  });

  if (!questionUpload.ok) {
    return json({ ok: false, error: questionUpload.error }, 500);
  }

  if (answerFile && answerBytes && answerPath && answerExtract?.ok) {
    const answerUpload = await uploadImportObject({
      path: answerPath,
      bytes: answerBytes,
      contentType: answerFile.type,
    });

    if (!answerUpload.ok) {
      await removeImportObjects([questionPath, answerPath]);
      return json({ ok: false, error: answerUpload.error }, 500);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("assessment_imports").insert({
    id: importId,
    created_by: profile.id,
    status: "draft",
    source_file_name: questionFile.name.slice(0, 240),
    source_mime_type: questionFile.type,
    source_size: questionFile.size,
    source_kind: questionExtract.kind,
    answer_file_name: answerFile?.name.slice(0, 240) ?? null,
    answer_mime_type: answerFile?.type ?? null,
    answer_size: answerFile?.size ?? null,
    answer_kind: answerKind,
    source_path: questionPath,
    answer_path: answerPath,
    source_text: questionExtract.text,
    answer_text: answerText,
    draft,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) {
    await removeImportObjects([questionPath, answerPath]);
    console.error("assessment import staging failed", error.message);
    return json({ ok: false, error: "storage_failed" }, 500);
  }

  const { error: eventError } = await supabase
    .from("assessment_admin_events")
    .insert({
      assessment_id: null,
      actor_id: profile.id,
      action: "import_started",
      detail: sanitiseImportAuditDetail({
        import_id: importId,
        question_count: draft.stats.questionCount,
        section_count: draft.stats.sectionCount,
        warning_count: draft.stats.warningCount,
        has_answer_key: Boolean(answerFile),
        source_kind: questionExtract.kind,
        answer_kind: answerKind ?? undefined,
      }),
    });

  if (eventError) {
    console.error("import started event failed", eventError.message);
  }

  return json({ ok: true, importId });
}
