import "server-only";

import {
  IMPORT_DEFAULT_MAX_FILE_BYTES,
  IMPORT_MAX_TOTAL_BYTES,
} from "@/lib/import/files";

/**
 * Server-side importer configuration. Values are read lazily so tests and
 * builds do not need a populated environment. The browser receives only the
 * numeric limit as a prop, never the environment variable itself.
 */

const MIN_FILE_BYTES = 1 * 1024 * 1024;
/** Absolute cap, matched by the private bucket's file_size_limit. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function getImportMaxBytes(): number {
  const raw = process.env.ASSESSMENT_IMPORT_MAX_BYTES?.trim();

  if (!raw) {
    return IMPORT_DEFAULT_MAX_FILE_BYTES;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return IMPORT_DEFAULT_MAX_FILE_BYTES;
  }

  return Math.min(MAX_FILE_BYTES, Math.max(MIN_FILE_BYTES, Math.floor(parsed)));
}

export function getImportMaxTotalBytes(): number {
  return Math.max(IMPORT_MAX_TOTAL_BYTES, getImportMaxBytes() * 2);
}
