import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { IMPORT_BUCKET } from "@/lib/import/files";

export type ImportStorageError = "upload_failed" | "storage_failed";

/** Uploads with the signed-in teacher's session so storage RLS still applies. */
export async function uploadImportObject(options: {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<{ ok: true } | { ok: false; error: ImportStorageError }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from(IMPORT_BUCKET)
      .upload(options.path, options.bytes, {
        contentType: options.contentType,
        cacheControl: "0",
        upsert: false,
      });

    if (error) {
      console.error("import upload failed", error.message);
      return { ok: false, error: "upload_failed" };
    }

    return { ok: true };
  } catch (error) {
    console.error(
      "import upload failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return { ok: false, error: "storage_failed" };
  }
}

/**
 * Server-side removal for save, cancel and expiry. Paths come from the staging
 * row the teacher owns, never from the browser.
 */
export async function removeImportObjects(
  paths: Array<string | null | undefined>,
): Promise<boolean> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];

  if (unique.length === 0) {
    return true;
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(IMPORT_BUCKET).remove(unique);

    if (error) {
      console.error("import file removal failed", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "import file removal failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return false;
  }
}
