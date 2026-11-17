/**
 * Assessment submission files live in a private bucket under
 * "<student_id>/<attempt_id>/<random>-<name>". The path convention is enforced
 * again by a database trigger and by the storage policy.
 */

export const ASSESSMENT_BUCKET = "assessment-submissions";
export const ASSESSMENT_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ASSESSMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function isAllowedSubmissionMime(mime: string): boolean {
  return (ASSESSMENT_MIME_TYPES as readonly string[]).includes(
    mime.toLowerCase(),
  );
}

export function sanitizeSubmissionFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);

  return cleaned || "file";
}

export function buildSubmissionPath(options: {
  studentId: string;
  attemptId: string;
  fileName: string;
  unique?: string;
}): string {
  const unique =
    options.unique ??
    globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${options.studentId}/${options.attemptId}/${unique}-${sanitizeSubmissionFileName(options.fileName)}`;
}

export function isSubmissionPathFor(
  path: string,
  studentId: string,
  attemptId: string,
): boolean {
  return path.startsWith(`${studentId}/${attemptId}/`);
}
