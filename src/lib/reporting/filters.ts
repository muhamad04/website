/**
 * Pure query-string helpers for the Phase 4 reporting surfaces.
 *
 * Kept free of Supabase imports so the parsing rules can be unit tested.
 * Every value is re-validated server-side on each request; nothing from the
 * browser is trusted beyond the shape parsed here.
 */

import { isUuid } from "@/lib/search";

export const REPORTING_PAGE_SIZE = 20;
export const EXPORT_ROW_LIMIT = 5000;

export const REPORT_TYPE_FILTERS = ["all", "quiz", "exam"] as const;
export type ReportTypeFilter = (typeof REPORT_TYPE_FILTERS)[number];

export const GRADING_STATUS_FILTERS = [
  "all",
  "pending",
  "completed",
  "not_required",
] as const;
export type GradingStatusFilter = (typeof GRADING_STATUS_FILTERS)[number];

export type ReportFilters = {
  gradeId: string | null;
  classId: string | null;
  studentId: string | null;
  assessmentId: string | null;
  type: ReportTypeFilter;
  grading: GradingStatusFilter;
  /** Inclusive YYYY-MM-DD date, or null. */
  from: string | null;
  to: string | null;
  search: string | null;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function uuidOrNull(value: string): string | null {
  return isUuid(value) ? value : null;
}

function choice<T extends string>(
  value: string,
  options: readonly T[],
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/** Accepts only a real calendar date in YYYY-MM-DD form. */
export function normaliseDateValue(value: string): string | null {
  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

export function parseReportFilters(params: RawParams): ReportFilters {
  const page = Number.parseInt(first(params.page), 10);
  const search = first(params.q).trim().slice(0, 80);
  let from = normaliseDateValue(first(params.from));
  let to = normaliseDateValue(first(params.to));

  // A reversed range is almost always a mistake in the date inputs; showing
  // the same window keeps the page useful instead of returning nothing.
  if (from && to && from > to) {
    [from, to] = [to, from];
  }

  return {
    gradeId: uuidOrNull(first(params.grade)),
    classId: uuidOrNull(first(params.class)),
    studentId: uuidOrNull(first(params.student)),
    assessmentId: uuidOrNull(first(params.assessment)),
    type: choice(first(params.type).toLowerCase(), REPORT_TYPE_FILTERS, "all"),
    grading: choice(
      first(params.grading).toLowerCase(),
      GRADING_STATUS_FILTERS,
      "all",
    ),
    from,
    to,
    search: search.length > 0 ? search : null,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export function hasReportFilters(filters: ReportFilters): boolean {
  return Boolean(
    filters.gradeId ||
      filters.classId ||
      filters.studentId ||
      filters.assessmentId ||
      filters.type !== "all" ||
      filters.grading !== "all" ||
      filters.from ||
      filters.to ||
      filters.search,
  );
}

/** Inclusive UTC bounds for PostgREST timestamptz comparisons. */
export function dateRangeBounds(filters: {
  from: string | null;
  to: string | null;
}): { fromIso: string | null; toIso: string | null } {
  return {
    fromIso: filters.from ? `${filters.from}T00:00:00.000Z` : null,
    toIso: filters.to ? `${filters.to}T23:59:59.999Z` : null,
  };
}

/**
 * Builds a shareable query string. `page` is omitted unless it is above 1 so
 * pagination links do not grow noise on the first page.
 */
export function buildReportQuery(
  filters: ReportFilters,
  options: { page?: number; includeSearch?: boolean } = {},
): string {
  const params = new URLSearchParams();
  const includeSearch = options.includeSearch ?? true;

  if (filters.gradeId) params.set("grade", filters.gradeId);
  if (filters.classId) params.set("class", filters.classId);
  if (filters.studentId) params.set("student", filters.studentId);
  if (filters.assessmentId) params.set("assessment", filters.assessmentId);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.grading !== "all") params.set("grading", filters.grading);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (includeSearch && filters.search) params.set("q", filters.search);

  const page = options.page ?? filters.page;

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
