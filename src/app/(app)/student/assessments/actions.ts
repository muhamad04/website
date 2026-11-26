"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { finalizeAttempt, finalizeStaleAttempts } from "@/lib/assessments/finalize";
import {
  evaluateAttemptWriteState,
  isAttemptWritable,
  reasonForWriteState,
  type AttemptWriteState,
} from "@/lib/assessments/heartbeat";
import { sanitizeAnswerResponse } from "@/lib/assessments/answers";
import {
  ASSESSMENT_BUCKET,
  buildSubmissionPath,
  isAllowedSubmissionMime,
  isSubmissionPathFor,
} from "@/lib/assessments/files";
import {
  removeSubmissionObject,
  verifySubmissionObject,
} from "@/lib/assessments/storage";
import {
  fieldErrorsFrom,
  heartbeatAttemptSchema,
  prepareSubmissionUploadSchema,
  saveAnswerSchema,
  startAttemptSchema,
  submitAttemptSchema,
  type AssessmentActionResult,
  type AssessmentErrorCode,
} from "@/lib/validation/assessments";
import type { SubmissionReason } from "@/lib/domain/types";

/**
 * Student attempt actions. Identity always comes from the session, never from
 * the browser. Writes use the user-scoped client so the database triggers and
 * RLS remain the final authority for timer and ownership rules.
 */

function fail(
  error: AssessmentErrorCode,
  extra: Partial<AssessmentActionResult> = {},
): AssessmentActionResult {
  return { ok: false, error, ...extra };
}

function mapAttemptError(message: string): AssessmentErrorCode {
  if (message.includes("retakes_not_allowed")) return "retakes_not_allowed";
  if (message.includes("max_attempts_reached")) return "max_attempts_reached";
  if (message.includes("assessment_not_available")) return "attempt_not_available";
  if (message.includes("attempt_already_in_progress")) return "attempt_not_available";
  if (message.includes("profile_not_ready")) return "forbidden";
  if (message.includes("not_authenticated")) return "forbidden";
  if (message.includes("attempt_expired")) return "attempt_closed";
  if (message.includes("attempt_stale")) return "attempt_closed";
  if (message.includes("invalid_file_path")) return "file_required";
  return "unknown";
}

type AttemptGuardRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  status: string;
  expires_at: string;
  started_at: string;
  last_heartbeat_at: string | null;
};

/**
 * Loads the attempt and its strict settings, then applies the same write-state
 * policy as the database trigger. A strict attempt whose heartbeat went stale
 * is not writable even if the browser keeps sending saves.
 */
async function loadAttemptWriteState(
  admin: ReturnType<typeof createAdminClient>,
  attemptId: string,
  studentId: string,
): Promise<
  | { ok: true; attempt: AttemptGuardRow; state: AttemptWriteState }
  | { ok: false; error: AssessmentErrorCode }
> {
  const { data: attempt } = await admin
    .from("attempts")
    .select(
      "id, assessment_id, student_id, status, expires_at, started_at, last_heartbeat_at",
    )
    .eq("id", attemptId)
    .maybeSingle<AttemptGuardRow>();

  if (!attempt || attempt.student_id !== studentId) {
    return { ok: false, error: "attempt_not_found" };
  }

  const { data: assessment } = await admin
    .from("assessments")
    .select(
      "strict_exam_mode, allow_resume_after_connection_loss, heartbeat_timeout_seconds",
    )
    .eq("id", attempt.assessment_id)
    .maybeSingle<{
      strict_exam_mode: boolean;
      allow_resume_after_connection_loss: boolean;
      heartbeat_timeout_seconds: number;
    }>();

  if (!assessment) {
    return { ok: false, error: "attempt_closed" };
  }

  return {
    ok: true,
    attempt,
    state: evaluateAttemptWriteState({
      status: attempt.status,
      expiresAt: attempt.expires_at,
      startedAt: attempt.started_at,
      lastHeartbeatAt: attempt.last_heartbeat_at,
      strictExamMode: assessment.strict_exam_mode,
      allowResumeAfterConnectionLoss:
        assessment.allow_resume_after_connection_loss,
      heartbeatTimeoutSeconds: assessment.heartbeat_timeout_seconds,
    }),
  };
}

export async function startAttemptAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const student = await requireStudent();
  const parsed = startAttemptSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  // Close any stale attempt before the RPC can resume it, so a connection loss
  // cannot silently revive a strict attempt.
  await finalizeStaleAttempts(10);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_start_attempt", {
    p_assessment_id: parsed.data.assessment_id,
  });

  if (error) {
    return fail(mapAttemptError(error.message));
  }

  const started = data as {
    attempt_id: string;
    expires_at: string;
    resumed: boolean;
  };

  // A resumed attempt that has run out of time is finalized before the student
  // is sent anywhere, so the expired answers cannot be edited any more.
  if (Date.parse(started.expires_at) <= Date.now()) {
    const outcome = await finalizeAttempt({
      attemptId: started.attempt_id,
      studentId: student.id,
    });

    if (!outcome.ok) {
      return fail(outcome.error);
    }

    revalidatePath(`/student/assessments/${parsed.data.assessment_id}`);

    return {
      ok: true,
      attemptId: started.attempt_id,
      redirectTo: `/student/assessments/${parsed.data.assessment_id}/attempt/${started.attempt_id}/result`,
    };
  }

  return {
    ok: true,
    attemptId: started.attempt_id,
    redirectTo: `/student/assessments/${parsed.data.assessment_id}/attempt/${started.attempt_id}`,
  };
}

export async function saveAnswerAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const student = await requireStudent();
  const parsed = saveAnswerSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return fail("service_unavailable");
  }

  const guard = await loadAttemptWriteState(admin, data.attempt_id, student.id);

  if (!guard.ok) {
    return fail(guard.error);
  }

  const attempt = guard.attempt;

  if (!isAttemptWritable(guard.state)) {
    const reason = reasonForWriteState(guard.state);

    if (reason) {
      await finalizeAttempt({
        attemptId: attempt.id,
        studentId: student.id,
        reason,
      });
    }

    return fail("attempt_closed");
  }

  const { data: question } = await admin
    .from("questions")
    .select(
      "id, type, section:assessment_sections!inner ( assessment_id )",
    )
    .eq("id", data.question_id)
    .maybeSingle();

  const questionSection = question?.section as unknown as {
    assessment_id: string;
  } | null;

  if (!question || questionSection?.assessment_id !== attempt.assessment_id) {
    return fail("question_not_found");
  }

  const { data: optionRows } = await admin
    .from("question_options")
    .select("id")
    .eq("question_id", question.id);
  const { data: pairRows } = await admin
    .from("matching_pairs")
    .select("id, right_key")
    .eq("question_id", question.id);

  const pairs = (pairRows ?? []) as Array<{ id: string; right_key: string }>;
  const sanitized = sanitizeAnswerResponse(
    {
      type: question.type,
      optionIds: ((optionRows ?? []) as Array<{ id: string }>).map(
        (row) => row.id,
      ),
      leftIds: pairs.map((pair) => pair.id),
      rightKeys: pairs.map((pair) => pair.right_key),
    },
    data.response,
  );

  if (!sanitized.ok) {
    return fail(sanitized.error);
  }

  let filePath: string | null = null;

  if (question.type === "file_upload") {
    if (!data.file_path) {
      return fail("file_required");
    }

    if (!isSubmissionPathFor(data.file_path, student.id, attempt.id)) {
      return fail("file_required");
    }

    const verification = await verifySubmissionObject(data.file_path);

    if (!verification.ok) {
      return fail(verification.error);
    }

    filePath = data.file_path;
  }

  const { data: existing } = await admin
    .from("answers")
    .select("file_path")
    .eq("attempt_id", attempt.id)
    .eq("question_id", question.id)
    .maybeSingle();

  const supabase = await createClient();
  const { error } = await supabase.from("answers").upsert(
    {
      attempt_id: attempt.id,
      question_id: question.id,
      response: sanitized.response,
      file_path: filePath,
    },
    { onConflict: "attempt_id,question_id" },
  );

  if (error) {
    console.error("answer save failed", error.message);
    return fail(mapAttemptError(error.message));
  }

  if (
    question.type === "file_upload" &&
    existing?.file_path &&
    existing.file_path !== filePath
  ) {
    await removeSubmissionObject(existing.file_path);
  }

  return { ok: true, attemptId: attempt.id };
}

export async function prepareSubmissionUploadAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const student = await requireStudent();
  const parsed = prepareSubmissionUploadSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;

  if (!isAllowedSubmissionMime(data.mime_type)) {
    return fail("file_type_invalid", {
      fieldErrors: { mime_type: "file_type_invalid" },
    });
  }

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return fail("service_unavailable");
  }

  const guard = await loadAttemptWriteState(admin, data.attempt_id, student.id);

  if (!guard.ok) {
    return fail(guard.error);
  }

  const attempt = guard.attempt;

  if (!isAttemptWritable(guard.state)) {
    const reason = reasonForWriteState(guard.state);

    if (reason) {
      await finalizeAttempt({
        attemptId: attempt.id,
        studentId: student.id,
        reason,
      });
    }

    return fail("attempt_closed");
  }

  const { data: question } = await admin
    .from("questions")
    .select("id, type, section:assessment_sections!inner ( assessment_id )")
    .eq("id", data.question_id)
    .maybeSingle();

  const section = question?.section as unknown as {
    assessment_id: string;
  } | null;

  if (
    !question ||
    question.type !== "file_upload" ||
    section?.assessment_id !== attempt.assessment_id
  ) {
    return fail("question_not_found");
  }

  const path = buildSubmissionPath({
    studentId: student.id,
    attemptId: attempt.id,
    fileName: data.file_name,
  });

  const supabase = await createClient();
  const { data: signed, error } = await supabase.storage
    .from(ASSESSMENT_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !signed) {
    console.error("submission upload signing failed", error?.message ?? "no data");
    return fail("storage_failed");
  }

  return {
    ok: true,
    upload: {
      bucket: ASSESSMENT_BUCKET,
      path,
      token: signed.token,
    },
  };
}

export async function submitAttemptAction(
  input: unknown,
): Promise<AssessmentActionResult> {
  const student = await requireStudent();
  const parsed = submitAttemptSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const reason: SubmissionReason = parsed.data.reason ?? "student_submitted";

  // Browser actions may only claim a normal submit or timer expiry. Automatic
  // reasons are decided by the server signal route, never by client input.
  if (reason !== "student_submitted" && reason !== "time_expired") {
    return fail("reason_invalid");
  }

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return fail("service_unavailable");
  }

  const guard = await loadAttemptWriteState(
    admin,
    parsed.data.attempt_id,
    student.id,
  );

  if (!guard.ok) {
    return fail(guard.error);
  }

  // Duplicate finalisation is idempotent: an already-closed attempt is a
  // success, not an error, so a double-click or a retry does not alarm the
  // student. The result page shows the authoritative status.
  if (guard.state === "closed") {
    revalidatePath("/student/assessments");

    return {
      ok: true,
      attemptId: parsed.data.attempt_id,
    };
  }

  // A heartbeat-stale strict attempt must close with the automatic reason, even
  // if the browser claims a normal submission.
  const effectiveReason = reasonForWriteState(guard.state) ?? reason;

  const outcome = await finalizeAttempt({
    attemptId: parsed.data.attempt_id,
    studentId: student.id,
    reason: effectiveReason,
  });

  if (!outcome.ok) {
    return fail(outcome.error);
  }

  revalidatePath("/student/assessments");

  return {
    ok: true,
    attemptId: parsed.data.attempt_id,
  };
}

export async function heartbeatAttemptAction(
  input: unknown,
): Promise<
  AssessmentActionResult & {
    closed?: boolean;
    expired?: boolean;
    status?: string;
    serverTime?: string;
    expiresAt?: string;
    strictExamMode?: boolean;
    submitOnTabHidden?: boolean;
    submitOnNavigation?: boolean;
    allowResumeAfterConnectionLoss?: boolean;
    heartbeatTimeoutSeconds?: number;
  }
> {
  const student = await requireStudent();
  const parsed = heartbeatAttemptSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attempt_heartbeat", {
    p_attempt_id: parsed.data.attempt_id,
    p_tab_hidden: false,
    p_focus_lost: Boolean(parsed.data.focus_lost),
  });

  if (error) {
    return fail(mapAttemptError(error.message));
  }

  const heartbeat = data as {
    status: string;
    server_time: string;
    expires_at: string;
    submission_reason: SubmissionReason | null;
    strict_exam_mode?: boolean;
    submit_on_tab_hidden?: boolean;
    submit_on_navigation?: boolean;
    allow_resume_after_connection_loss?: boolean;
    heartbeat_timeout_seconds?: number;
  };

  if (heartbeat.status !== "in_progress") {
    if (heartbeat.status === "expired" || heartbeat.status === "stale") {
      const outcome = await finalizeAttempt({
        attemptId: parsed.data.attempt_id,
        studentId: student.id,
        reason:
          heartbeat.status === "stale" ? "heartbeat_expired" : "time_expired",
      });

      if (!outcome.ok) {
        return fail(outcome.error);
      }
    }

    return {
      ok: true,
      attemptId: parsed.data.attempt_id,
      closed: true,
      expired: heartbeat.status === "expired",
      status: heartbeat.status,
      serverTime: heartbeat.server_time,
      expiresAt: heartbeat.expires_at,
    };
  }

  return {
    ok: true,
    attemptId: parsed.data.attempt_id,
    status: heartbeat.status,
    serverTime: heartbeat.server_time,
    expiresAt: heartbeat.expires_at,
    strictExamMode: heartbeat.strict_exam_mode,
    submitOnTabHidden: heartbeat.submit_on_tab_hidden,
    submitOnNavigation: heartbeat.submit_on_navigation,
    allowResumeAfterConnectionLoss:
      heartbeat.allow_resume_after_connection_loss,
    heartbeatTimeoutSeconds: heartbeat.heartbeat_timeout_seconds,
  };
}
