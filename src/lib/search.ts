/**
 * Small, dependency-free helpers shared by the list screens. Kept out of any
 * Supabase module so they can be unit tested directly.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function firstValue(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

/**
 * PostgREST treats commas, parentheses and dots as filter syntax. Strip them
 * instead of trying to escape, so a search term can never inject a new filter.
 */
export function sanitizeSearchTerm(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const cleaned = raw
    .replace(/[%,().:*"\\'`;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

  return cleaned.length === 0 ? null : cleaned;
}

export function clampPage(page: number, pageCount: number): number {
  if (pageCount <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), pageCount);
}
