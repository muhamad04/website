import { getCurrentProfile } from "@/lib/auth/dal";
import { gradeExists } from "@/lib/data/resources";
import { isStaffRole } from "@/lib/domain/roles";
import { sanitiseImportAuditDetail } from "@/lib/import/audit";
import { getImportMaxBytes, getImportMaxTotalBytes } from "@/lib/import/config";
import {
  buildImportPath,
  importKindForFile,
  isSuspiciousImportFileName,
  IMPORT_RETENTION_HOURS,
  type ImportFileKind,
} from "@/lib/import/files";
import { createImportSignedUpload } from "@/lib/import/storage";
import {
  importUploadInitSchema,
  type ImportSignedUploadDescriptor,
  type ImportUploadInitResult,
} from "@/lib/import/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * Step 1 of the signed-upload flow. The browser sends only metadata, never file
 * bytes, so a 50 MiB file never touches a Vercel Function body. The route
 * re-checks the staff session and grade, reserves a private owner path, creates
 * short-lived signed upload URLs and registers the staging row so abandoned
 * uploads can be cleaned up.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: ImportUploadInitResult, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
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

  const parsed = importUploadInitSchema.safeParse(payload);

  if (!parsed.success) {
    return json({ ok: false, error: "validation_failed" }, 400);
  }

  if (!(await gradeExists(parsed.data.grade_id))) {
    return json({ ok: false, error: "grade_not_found" }, 400);
  }

  const maxBytes = getImportMaxBytes();
  const maxTotalBytes = getImportMaxTotalBytes();
  const totalSize = parsed.data.files.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > maxTotalBytes) {
    return json({ ok: false, error: "file_too_large" }, 413);
  }

  const files: Array<{
    role: "questions" | "answers";
    name: string;
    size: number;
    type: string;
    kind: ImportFileKind;
  }> = [];

  for (const file of parsed.data.files) {
    if (isSuspiciousImportFileName(file.name)) {
      return json({ ok: false, error: "file_name_invalid" }, 400);
    }

    if (file.size > maxBytes) {
      return json({ ok: false, error: "file_too_large" }, 413);
    }

    const kind = importKindForFile({
      fileName: file.name,
      mimeType: file.type,
    });

    if (!kind) {
      return json({ ok: false, error: "file_type_invalid" }, 400);
    }

    files.push({ ...file, kind });
  }

  const questionFile = files.find((file) => file.role === "questions");
  const answerFile = files.find((file) => file.role === "answers");

  if (!questionFile) {
    return json({ ok: false, error: "file_required" }, 400);
  }

  const importId = globalThis.crypto.randomUUID();
  const questionPath = buildImportPath({
    userId: profile.id,
    importId,
    role: "questions",
    fileName: questionFile.name,
  });
  const answerPath = answerFile
    ? buildImportPath({
        userId: profile.id,
        importId,
        role: "answers",
        fileName: answerFile.name,
      })
    : null;

  const supabase = await createClient();
  const { error: insertError } = await supabase
    .from("assessment_imports")
    .insert({
      id: importId,
      created_by: profile.id,
      status: "draft",
      source_file_name: questionFile.name.slice(0, 240),
      source_mime_type: questionFile.type,
      source_size: questionFile.size,
      source_kind: questionFile.kind,
      answer_file_name: answerFile?.name.slice(0, 240) ?? null,
      answer_mime_type: answerFile?.type ?? null,
      answer_size: answerFile?.size ?? null,
      answer_kind: answerFile?.kind ?? null,
      source_path: questionPath,
      answer_path: answerPath,
      source_text: "",
      answer_text: "",
      draft: {},
      expires_at: new Date(
        Date.now() + IMPORT_RETENTION_HOURS * 60 * 60 * 1000,
      ).toISOString(),
    });

  if (insertError) {
    console.error("assessment import staging failed", insertError.message);
    return json({ ok: false, error: "storage_failed" }, 500);
  }

  const targets: Array<{
    role: "questions" | "answers";
    path: string;
    fileName: string;
  }> = [
    { role: "questions", path: questionPath, fileName: questionFile.name },
  ];

  if (answerPath && answerFile) {
    targets.push({
      role: "answers",
      path: answerPath,
      fileName: answerFile.name,
    });
  }

  const uploads: ImportSignedUploadDescriptor[] = [];

  for (const target of targets) {
    const signed = await createImportSignedUpload(target.path);

    if (!signed.ok) {
      await supabase.from("assessment_imports").delete().eq("id", importId);
      return json({ ok: false, error: signed.error }, 500);
    }

    uploads.push({
      role: target.role,
      path: signed.upload.path,
      token: signed.upload.token,
      signedUrl: signed.upload.signedUrl,
      fileName: target.fileName,
    });
  }

  const { error: eventError } = await supabase
    .from("assessment_admin_events")
    .insert({
      assessment_id: null,
      actor_id: profile.id,
      action: "import_started",
      detail: sanitiseImportAuditDetail({
        import_id: importId,
        status: "uploading",
        file_name: questionFile.name,
        file_size: questionFile.size,
        source_kind: questionFile.kind,
        has_answer_key: Boolean(answerFile),
        answer_kind: answerFile?.kind,
      }),
    });

  if (eventError) {
    console.error("import started event failed", eventError.message);
  }

  return json({ ok: true, importId, uploads, maxBytes, maxTotalBytes });
}
