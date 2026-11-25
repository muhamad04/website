import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { IMPORT_BUCKET } from "@/lib/import/files";

export type ImportStorageError = "upload_failed" | "storage_failed";

export type ImportSignedUpload = {
  path: string;
  token: string;
  signedUrl: string;
};

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
 * Creates a short-lived signed upload URL so the browser can stream a large file
 * straight to Storage. Storage RLS still runs as the signed-in teacher, so the
 * path must already be inside the caller's folder.
 */
export async function createImportSignedUpload(
  path: string,
): Promise<
  { ok: true; upload: ImportSignedUpload } | { ok: false; error: ImportStorageError }
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(IMPORT_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !data) {
      console.error("import signed upload failed", error?.message ?? "no data");
      return { ok: false, error: "upload_failed" };
    }

    return {
      ok: true,
      upload: {
        path: data.path,
        token: data.token,
        signedUrl: data.signedUrl,
      },
    };
  } catch (error) {
    console.error(
      "import signed upload failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return { ok: false, error: "storage_failed" };
  }
}

export type ImportObjectStat = {
  size: number;
  contentType: string | null;
};

/**
 * Reads object metadata with the service role after the route has already
 * verified the owner. Used to confirm the browser really uploaded the file the
 * teacher declared before any byte reaches the parser.
 */
export async function statImportObject(
  path: string,
): Promise<{ ok: true; stat: ImportObjectStat } | { ok: false }> {
  try {
    const admin = createAdminClient();
    const separator = path.lastIndexOf("/");
    const folder = separator === -1 ? "" : path.slice(0, separator);
    const name = separator === -1 ? path : path.slice(separator + 1);
    const { data, error } = await admin.storage
      .from(IMPORT_BUCKET)
      .list(folder, { search: name, limit: 100 });

    if (error || !data) {
      return { ok: false };
    }

    const object = data.find((entry) => entry.name === name);

    if (!object) {
      return { ok: false };
    }

    const metadata = (object.metadata ?? {}) as Record<string, unknown>;
    const size = Number(metadata.size ?? object.metadata?.size ?? 0);

    return {
      ok: true,
      stat: {
        size: Number.isFinite(size) ? size : 0,
        contentType:
          typeof metadata.mimetype === "string" ? metadata.mimetype : null,
      },
    };
  } catch (error) {
    console.error(
      "import object stat failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return { ok: false };
  }
}

/**
 * Downloads the verified object for parsing. This is the only point where the
 * full file crosses the server; the browser never sends it through a function.
 */
export async function downloadImportObject(
  path: string,
): Promise<
  { ok: true; bytes: Uint8Array } | { ok: false; error: ImportStorageError }
> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(IMPORT_BUCKET)
      .download(path);

    if (error || !data) {
      console.error("import download failed", error?.message ?? "no data");
      return { ok: false, error: "storage_failed" };
    }

    return { ok: true, bytes: new Uint8Array(await data.arrayBuffer()) };
  } catch (error) {
    console.error(
      "import download failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return { ok: false, error: "storage_failed" };
  }
}

/**
 * Server-side removal for save, cancel, abort and expiry. Paths come from the
 * staging row the teacher owns, never from the browser.
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

/** Removes every object in one import folder, used when an upload is abandoned. */
export async function removeImportFolder(
  userId: string,
  importId: string,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const folder = `${userId}/${importId}`;
    const { data, error } = await admin.storage
      .from(IMPORT_BUCKET)
      .list(folder, { limit: 100 });

    if (error) {
      console.error("import folder listing failed", error.message);
      return false;
    }

    const paths = (data ?? []).map((entry) => `${folder}/${entry.name}`);
    return removeImportObjects(paths);
  } catch (error) {
    console.error(
      "import folder removal failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return false;
  }
}
