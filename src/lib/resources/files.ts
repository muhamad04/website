import type { ResourceType } from "@/lib/domain/types";

/**
 * Pure file rules shared by the browser form and the server actions. The
 * bucket enforces the same limits, but the server never relies on the browser
 * for size or MIME validation.
 */

export const RESOURCE_BUCKET = "resources";
export const RESOURCE_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const RESOURCE_MIME_TYPES = {
  pdf: ["application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp"],
} as const;

export const RESOURCE_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type StoredResourceType = "pdf" | "image";

export function isStoredResourceType(
  type: ResourceType,
): type is StoredResourceType {
  return type === "pdf" || type === "image";
}

export function isAllowedMimeForType(
  type: StoredResourceType,
  mimeType: string,
): boolean {
  return (RESOURCE_MIME_TYPES[type] as readonly string[]).includes(
    mimeType.toLowerCase(),
  );
}

export function extensionForMime(mimeType: string): string | null {
  return RESOURCE_EXTENSIONS[mimeType.toLowerCase()] ?? null;
}

/** Turns any uploaded file name into a safe lowercase ASCII stem. */
export function safeFileStem(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]*$/, "");
  const stem = withoutExtension
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);

  return stem || "resource";
}

/**
 * The only place storage paths are generated:
 *   <grade_id>/<pdf|image>/<uuid>-<safe-name>.<ext>
 * The database check constraint verifies the grade/type prefix as a second
 * line of defence, and RLS ties the object back to a published row.
 */
export function buildResourceStoragePath(input: {
  gradeId: string;
  type: StoredResourceType;
  fileName: string;
  mimeType: string;
  id?: string;
}): string | null {
  const extension = extensionForMime(input.mimeType);

  if (!extension) {
    return null;
  }

  const uuid = input.id ?? globalThis.crypto.randomUUID();
  const stem = safeFileStem(input.fileName);
  return `${input.gradeId}/${input.type}/${uuid}-${stem}.${extension}`;
}

const STORAGE_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(pdf|image)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-z0-9][a-z0-9._-]{0,120})$/i;

export type ParsedStoragePath = {
  gradeId: string;
  type: StoredResourceType;
  fileName: string;
};

export function parseResourceStoragePath(
  path: string | null | undefined,
): ParsedStoragePath | null {
  if (!path) {
    return null;
  }

  const match = STORAGE_PATH_PATTERN.exec(path);

  if (!match) {
    return null;
  }

  return {
    gradeId: match[1],
    type: match[2] as StoredResourceType,
    fileName: match[3],
  };
}

/** True only when the path belongs to the given grade and file type. */
export function isResourceStoragePathFor(
  path: string,
  gradeId: string,
  type: StoredResourceType,
): boolean {
  const parsed = parseResourceStoragePath(path);

  return Boolean(
    parsed &&
      parsed.gradeId.toLowerCase() === gradeId.toLowerCase() &&
      parsed.type === type,
  );
}

/** Keeps the file name and type, and swaps the leading grade folder. */
export function moveResourceStoragePath(
  path: string,
  newGradeId: string,
): string | null {
  const parsed = parseResourceStoragePath(path);

  if (!parsed) {
    return null;
  }

  return `${newGradeId}/${parsed.type}/${parsed.fileName}`;
}
