import {
  IMPORT_RETENTION_HOURS,
  IMPORT_SAVED_RETENTION_DAYS,
} from "@/lib/import/files";

export const IMPORT_DRAFT_TTL_MS = IMPORT_RETENTION_HOURS * 60 * 60 * 1000;
export const IMPORT_SAVED_TTL_MS =
  IMPORT_SAVED_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type CleanupRow = {
  status: string;
  expires_at: string;
  updated_at: string;
  source_path: string | null;
  answer_path: string | null;
};

/** Answer-key objects are listed first so a partial failure still removes them. */
export function collectImportObjectPaths(row: CleanupRow): string[] {
  return [row.answer_path, row.source_path].filter(
    (path): path is string => Boolean(path),
  );
}

export function isImportDueForCleanup(
  row: Pick<CleanupRow, "status" | "expires_at" | "updated_at">,
  now = new Date(),
): boolean {
  if (row.status === "saved") {
    const updated = Date.parse(row.updated_at);

    if (Number.isNaN(updated)) {
      return true;
    }

    return updated + IMPORT_SAVED_TTL_MS <= now.getTime();
  }

  const expires = Date.parse(row.expires_at);

  if (Number.isNaN(expires)) {
    return true;
  }

  return expires <= now.getTime();
}
