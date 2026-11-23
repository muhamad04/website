import { getCurrentProfile } from "@/lib/auth/dal";
import { getAssessmentImport } from "@/lib/data/imports";
import { isStaffRole } from "@/lib/domain/roles";
import { removeImportFolder } from "@/lib/import/storage";
import { importIdSchema, type ImportActionResult } from "@/lib/import/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * Deletes a half-finished direct upload. Called by the browser when a signed
 * upload or the finalize step fails, so abandoned bytes never linger.
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

  const parsed = importIdSchema.safeParse(payload);

  if (!parsed.success) {
    return json({ ok: false, error: "validation_failed" }, 400);
  }

  const row = await getAssessmentImport(parsed.data.import_id);

  if (!row || row.created_by !== profile.id) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  if (row.status === "saved") {
    return json({ ok: false, error: "already_saved" }, 409);
  }

  await removeImportFolder(profile.id, row.id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("assessment_imports")
    .delete()
    .eq("id", row.id);

  if (error) {
    console.error("import abort cleanup failed", error.message);
    return json({ ok: false, error: "storage_failed" }, 500);
  }

  return json({ ok: true, importId: row.id });
}
