import { getCurrentProfile } from "@/lib/auth/dal";
import { getAssessmentImport } from "@/lib/data/imports";
import { isStaffRole } from "@/lib/domain/roles";
import { getOpenRouterConfig } from "@/lib/env.server";
import { runImportAi } from "@/lib/import/ai";
import { sanitiseImportAuditDetail } from "@/lib/import/audit";
import { importIdSchema, type ImportAiRouteResult } from "@/lib/import/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * Optional AI assistance. Server-only: the OpenRouter key never reaches the
 * browser, the model name is configurable, and every request is capped per
 * import. Suggestions are stored next to the deterministic draft and only
 * change a question when the teacher accepts them.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: ImportAiRouteResult, status = 200): Response {
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

  const config = getOpenRouterConfig();

  if (!config.enabled || !config.apiKey) {
    return json({ ok: false, error: "ai_disabled" }, 503);
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

  if (!row || (row.created_by !== profile.id && profile.role !== "admin")) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  if (row.status !== "draft") {
    return json({ ok: false, error: "not_found" }, 404);
  }

  if (Date.parse(row.expires_at) <= Date.now()) {
    return json({ ok: false, error: "expired" }, 410);
  }

  if (!row.draft || !Array.isArray(row.draft.sections)) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  const used = row.draft.ai?.requestCount ?? 0;
  const remaining = config.maxRequestsPerImport - used;

  if (remaining <= 0) {
    return json({ ok: false, error: "ai_limit_reached" }, 429);
  }

  const result = await runImportAi(row.draft, remaining);
  const draft = { ...row.draft, ai: result.ai };

  const supabase = await createClient();
  const { error } = await supabase
    .from("assessment_imports")
    .update({ draft })
    .eq("id", row.id);

  if (error) {
    console.error("import AI save failed", error.message);
    return json({ ok: false, error: "save_failed" }, 500);
  }

  const { error: eventError } = await supabase
    .from("assessment_admin_events")
    .insert({
      assessment_id: null,
      actor_id: profile.id,
      action: "import_draft_edited",
      detail: sanitiseImportAuditDetail({
        import_id: row.id,
        status: "ai_completed",
        model: result.ai.model,
        ai_request_count: result.ai.requestCount,
        ai_warning_count: result.ai.warnings.length,
        ai_suggestion_count: result.ai.suggestions.length,
      }),
    });

  if (eventError) {
    console.error("import AI event failed", eventError.message);
  }

  return json({
    ok: true,
    ai: result.ai,
    remainingRequests: Math.max(
      0,
      config.maxRequestsPerImport - result.ai.requestCount,
    ),
  });
}
