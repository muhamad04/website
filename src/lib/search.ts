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

/** Maximum accepted free-text search length, before any filter grammar. */
export const SEARCH_MAX_LENGTH = 80;

/**
 * Escapes a value for a PostgREST filter expression.
 *
 * PostgREST parses commas, periods and parentheses as filter grammar. Wrapping
 * the entire value in double quotes makes those characters literal; embedded
 * backslashes and quotes are escaped so the value cannot terminate the quoted
 * segment and start a new filter.
 */
export function escapePostgrestFilterValue(value: string): string {
  const withoutControls = value.replace(/[\u0000-\u001f\u007f]/g, "");
  const escaped = withoutControls
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

  return `"${escaped}"`;
}

/**
 * Builds a fixed-column `ilike` OR filter. Only the caller's column names are
 * interpolated; the search value is always one quoted literal, so a comma or
 * `role.eq.admin` inside it stays search text instead of becoming a filter.
 */
export function buildIlikeOrFilter(
  columns: readonly string[],
  search: string,
  maxLength = SEARCH_MAX_LENGTH,
): string {
  const quoted = escapePostgrestFilterValue(
    `%${search.slice(0, maxLength)}%`,
  );

  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}

export function clampPage(page: number, pageCount: number): number {
  if (pageCount <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), pageCount);
}
