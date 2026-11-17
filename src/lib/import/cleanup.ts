import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { IMPORT_BUCKET } from "@/lib/import/files";
import { collectImportObjectPaths, isImportDueForCleanup } from "@/lib/import/retention";

type ExpiryRow = {
  id: string;
  status: string;
  expires_at: string;
  updated_at: string;
  source_path: string | null;
  answer_path: string | null;
};

/**
 * Lazy cleanup runs after a page renders. It is best-effort: failures are
 * logged without file names, paths or content, and the next visit retries.
 */
export async function cleanupExpiredImports(): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const savedCutoff = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [drafts, saved] = await Promise.all([
      admin
        .from("assessment_imports")
        .select("id, status, expires_at, updated_at, source_path, answer_path")
        .in("status", ["draft", "cancelled"])
        .lte("expires_at", nowIso)
        .limit(50),
      admin
        .from("assessment_imports")
        .select("id, status, expires_at, updated_at, source_path, answer_path")
        .eq("status", "saved")
        .lte("updated_at", savedCutoff)
        .limit(50),
    ]);

    if (drafts.error || saved.error) {
      console.error(
        "import cleanup query failed",
        drafts.error?.message ?? saved.error?.message ?? "unknown error",
      );
      return;
    }

    const rows = [
      ...((drafts.data ?? []) as unknown as ExpiryRow[]),
      ...((saved.data ?? []) as unknown as ExpiryRow[]),
    ].filter((row) => isImportDueForCleanup(row, now));

    if (rows.length === 0) {
      return;
    }

    const paths = rows.flatMap((row) => collectImportObjectPaths(row));

    try {
      if (paths.length > 0) {
        const { error } = await admin.storage
          .from(IMPORT_BUCKET)
          .remove(paths);

        if (error) {
          console.error("import cleanup file removal failed", error.message);
        }
      }
    } catch (error) {
      console.error(
        "import cleanup file removal failed",
        error instanceof Error ? error.message : "unknown error",
      );
    }

    const { error } = await admin
      .from("assessment_imports")
      .delete()
      .in(
        "id",
        rows.map((row) => row.id),
      );

    if (error) {
      console.error("import cleanup row deletion failed", error.message);
    }
  } catch (error) {
    console.error(
      "import cleanup failed",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}
