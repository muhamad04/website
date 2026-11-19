import { requireStudent } from "@/lib/auth/dal";
import { finalizeAttempt } from "@/lib/assessments/finalize";
import {
  autoSubmitReason,
  type AttemptSignal,
} from "@/lib/assessments/strict";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { attemptSignalSchema } from "@/lib/validation/assessments";
import type { SubmissionReason, StrictExamSettings } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

type AttemptRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  status: string;
  expires_at: string;
};

/**
 * Browser signals are hints, not authority. This endpoint authenticates the
 * student, proves ownership, re-reads the assessment settings and only then
 * decides whether to finalise. It is `keepalive`-friendly for page hide/close.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
): Promise<Response> {
  const student = await requireStudent();
  const { attemptId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    signal?: unknown;
  } | null;

  const parsed = attemptSignalSchema.safeParse({
    attempt_id: attemptId,
    signal: body?.signal,
  });

  if (!parsed.success) {
    return Response.json({ ok: false, error: "validation_failed" }, {
      status: 400,
    });
  }

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return Response.json({ ok: false, error: "service_unavailable" }, {
      status: 503,
    });
  }

  const { data: attempt, error: attemptError } = await admin
    .from("attempts")
    .select("id, assessment_id, student_id, status, expires_at")
    .eq("id", parsed.data.attempt_id)
    .maybeSingle<AttemptRow>();

  if (attemptError) {
    return Response.json({ ok: false, error: "unknown" }, { status: 500 });
  }

  if (!attempt || attempt.student_id !== student.id) {
    return Response.json({ ok: false, error: "attempt_not_found" }, {
      status: 404,
    });
  }

  const resultUrl = `/student/assessments/${attempt.assessment_id}/attempt/${attempt.id}/result`;

  if (attempt.status !== "in_progress") {
    return Response.json({
      ok: true,
      submitted: true,
      status: attempt.status,
      redirectTo: resultUrl,
    });
  }

  const { data: assessment, error: assessmentError } = await admin
    .from("assessments")
    .select(
      "strict_exam_mode, submit_on_tab_hidden, submit_on_navigation, heartbeat_timeout_seconds, allow_resume_after_connection_loss",
    )
    .eq("id", attempt.assessment_id)
    .maybeSingle<
      Pick<
        StrictExamSettings,
        | "strict_exam_mode"
        | "submit_on_tab_hidden"
        | "submit_on_navigation"
        | "heartbeat_timeout_seconds"
        | "allow_resume_after_connection_loss"
      >
    >();

  if (assessmentError || !assessment) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const signal: AttemptSignal = parsed.data.signal;
  const timedOut = Date.parse(attempt.expires_at) <= Date.now();
  let reason: SubmissionReason | null = timedOut
    ? "time_expired"
    : autoSubmitReason(assessment, signal);

  // Record tab-hidden/focus-loss counts through the ownership-checked RPC.
  if (
    !timedOut &&
    (signal === "tab_hidden" || signal === "focus_lost")
  ) {
    const supabase = await createClient();
    await supabase.rpc("attempt_heartbeat", {
      p_attempt_id: attempt.id,
      p_tab_hidden: signal === "tab_hidden",
      p_focus_lost: signal === "focus_lost",
    });
  }

  let submitted = false;

  if (reason) {
    const outcome = await finalizeAttempt({
      attemptId: attempt.id,
      studentId: student.id,
      reason,
    });

    if (!outcome.ok) {
      return Response.json({ ok: false, error: outcome.error }, { status: 409 });
    }

    submitted = true;
    reason = outcome.reason ?? reason;
  }

  return Response.json({
    ok: true,
    submitted,
    reason,
    redirectTo: submitted ? resultUrl : null,
    server_time: new Date().toISOString(),
  });
}
