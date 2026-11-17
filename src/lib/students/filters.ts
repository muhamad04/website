/**
 * Pure helpers for the student list: query-string parsing and sanitising.
 * Kept free of Supabase imports so they can be unit tested directly.
 */

import {
  clampPage,
  firstValue,
  isUuid,
  sanitizeSearchTerm,
} from "@/lib/search";

export { clampPage, sanitizeSearchTerm };

export const STUDENT_STATUS_FILTERS = ["all", "active", "inactive"] as const;
export type StudentStatusFilter = (typeof STUDENT_STATUS_FILTERS)[number];

export const STUDENTS_PAGE_SIZE = 15;

export type StudentFilters = {
  search: string | null;
  gradeId: string | null;
  classId: string | null;
  status: StudentStatusFilter;
  page: number;
};

export function parseStudentFilters(input: {
  q?: string | string[];
  grade?: string | string[];
  class?: string | string[];
  status?: string | string[];
  page?: string | string[];
}): StudentFilters {
  const statusRaw = firstValue(input.status);
  const status: StudentStatusFilter = STUDENT_STATUS_FILTERS.includes(
    statusRaw as StudentStatusFilter,
  )
    ? (statusRaw as StudentStatusFilter)
    : "all";

  const grade = firstValue(input.grade);
  const classId = firstValue(input.class);
  const pageRaw = Number.parseInt(firstValue(input.page) ?? "1", 10);

  return {
    search: sanitizeSearchTerm(firstValue(input.q)),
    gradeId: isUuid(grade) ? grade : null,
    classId: isUuid(classId) ? classId : null,
    status,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

/** Builds the query string for pagination links without dropping filters. */
export function buildStudentQuery(
  filters: StudentFilters,
  overrides: Partial<{ page: number }> = {},
): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.gradeId) params.set("grade", filters.gradeId);
  if (filters.classId) params.set("class", filters.classId);
  if (filters.status !== "all") params.set("status", filters.status);

  const page = overrides.page ?? filters.page;
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `?${query}` : "";
}
