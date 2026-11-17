import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  RESOURCE_BUCKET,
  RESOURCE_MAX_FILE_BYTES,
  isAllowedMimeForType,
  type StoredResourceType,
} from "@/lib/resources/files";
import type { ResourceErrorCode } from "@/lib/validation/resources";

/**
 * Private-storage helpers for resource files.
 *
 * Signed upload URLs are issued with the teacher's own session, so Storage RLS
 * still applies. Object metadata is then verified with the service-role client
 * because the browser's declared MIME type and size are untrusted.
 */

export type ObjectVerification =
  | { ok: true; size: number; contentType: string }
  | { ok: false; error: ResourceErrorCode };

export async function verifyUploadedResourceObject(
  path: string,
  type: StoredResourceType,
): Promise<ObjectVerification> {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "service_unavailable" };
  }

  const { data, error } = await admin.storage.from(RESOURCE_BUCKET).info(path);

  if (error || !data) {
    return { ok: false, error: "upload_missing" };
  }

  const size = data.size ?? data.metadata?.size ?? 0;
  const contentType = (
    data.contentType ??
    data.metadata?.mimetype ??
    ""
  ).toLowerCase();

  if (size <= 0) {
    return { ok: false, error: "file_empty" };
  }

  if (size > RESOURCE_MAX_FILE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }

  if (!isAllowedMimeForType(type, contentType)) {
    return { ok: false, error: "file_type_invalid" };
  }

  return { ok: true, size, contentType };
}

export async function removeResourceObject(
  path: string | null,
): Promise<boolean> {
  if (!path) {
    return true;
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(RESOURCE_BUCKET).remove([path]);

    if (error) {
      console.error("resource object removal failed", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "resource object removal failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return false;
  }
}

export async function moveResourceObject(
  fromPath: string,
  toPath: string,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(RESOURCE_BUCKET)
      .move(fromPath, toPath);

    if (error) {
      console.error("resource object move failed", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "resource object move failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return false;
  }
}

/**
 * Signs a private object with the signed-in user's session. Both the storage
 * policy and the resource RLS decide whether the URL may be issued.
 */
export async function createSignedResourceUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error("resource signing failed", error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}
