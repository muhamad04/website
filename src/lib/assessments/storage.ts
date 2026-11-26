import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ASSESSMENT_BUCKET,
  ASSESSMENT_MAX_FILE_BYTES,
  isAllowedSubmissionMime,
} from "@/lib/assessments/files";
import type { AssessmentErrorCode } from "@/lib/validation/assessments";

/**
 * Submission URLs are bearer tokens. Ten minutes is long enough for a teacher
 * to open a file from the grading screen and short enough to limit leakage
 * through history, screenshots or a shared link.
 */
export const SUBMISSION_SIGNED_URL_TTL_SECONDS = 10 * 60;

export type SubmissionVerification =
  | { ok: true; size: number; contentType: string }
  | { ok: false; error: AssessmentErrorCode };

/**
 * The browser declares the size and MIME type, so the stored object is checked
 * again with the service-role client before an answer references it.
 */
export async function verifySubmissionObject(
  path: string,
): Promise<SubmissionVerification> {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "service_unavailable" };
  }

  const { data, error } = await admin.storage.from(ASSESSMENT_BUCKET).info(path);

  if (error || !data) {
    return { ok: false, error: "upload_missing" };
  }

  const size = data.size ?? data.metadata?.size ?? 0;
  const contentType = (data.contentType ?? data.metadata?.mimetype ?? "")
    .toLowerCase();

  if (size <= 0) {
    return { ok: false, error: "file_too_large" };
  }

  if (size > ASSESSMENT_MAX_FILE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }

  if (!isAllowedSubmissionMime(contentType)) {
    return { ok: false, error: "file_type_invalid" };
  }

  return { ok: true, size, contentType };
}

/**
 * Signs a submission with the signed-in user's session, so the storage policy
 * (own folder for students, any folder for staff) remains the boundary.
 */
export async function createSignedSubmissionUrl(
  path: string,
  expiresInSeconds = SUBMISSION_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(ASSESSMENT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error("submission signing failed", error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

export async function removeSubmissionObject(path: string | null): Promise<void> {
  if (!path) {
    return;
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(ASSESSMENT_BUCKET).remove([path]);

    if (error) {
      console.error("submission removal failed", error.message);
    }
  } catch (error) {
    console.error(
      "submission removal failed",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

/**
 * Removes files a student uploaded but never attached to an answer.
 *
 * The upload URL is signed before the answer row exists, so a student can
 * upload and then abandon the page. Once the attempt is finalised, anything in
 * `<student>/<attempt>/` that no answer references is unreachable by design and
 * is safe to delete. Best-effort: a Storage error never fails a submission.
 */
export async function cleanupUnreferencedSubmissionFiles(options: {
  attemptId: string;
  studentId: string;
}): Promise<number> {
  const prefix = `${options.studentId}/${options.attemptId}`;

  try {
    const admin = createAdminClient();
    const [filesResult, answersResult] = await Promise.all([
      admin.storage.from(ASSESSMENT_BUCKET).list(prefix, { limit: 100 }),
      admin
        .from("answers")
        .select("file_path")
        .eq("attempt_id", options.attemptId)
        .not("file_path", "is", null),
    ]);

    if (filesResult.error || answersResult.error) {
      return 0;
    }

    const referenced = new Set(
      ((answersResult.data ?? []) as Array<{ file_path: string | null }>)
        .map((answer) => answer.file_path)
        .filter((path): path is string => Boolean(path)),
    );

    const stale = (filesResult.data ?? [])
      .map((file) => `${prefix}/${file.name}`)
      .filter((path) => !referenced.has(path));

    if (stale.length === 0) {
      return 0;
    }

    const { error } = await admin.storage
      .from(ASSESSMENT_BUCKET)
      .remove(stale);

    return error ? 0 : stale.length;
  } catch {
    return 0;
  }
}
