/**
 * Pure query-string helpers for the resource lists. The student list ignores
 * grade and status on purpose: the page sets the grade from the profile and
 * always asks for published rows.
 */

import { firstValue, isUuid, sanitizeSearchTerm } from "@/lib/search";

export const RESOURCE_TYPE_FILTERS = [
  "all",
  "pdf",
  "image",
  "youtube",
] as const;
export type ResourceTypeFilter = (typeof RESOURCE_TYPE_FILTERS)[number];

export const RESOURCE_STATUS_FILTERS = [
  "all",
  "published",
  "draft",
] as const;
export type ResourceStatusFilter = (typeof RESOURCE_STATUS_FILTERS)[number];

export const RESOURCES_PAGE_SIZE = 12;

export type ResourceFilters = {
  search: string | null;
  gradeId: string | null;
  categoryId: string | null;
  type: ResourceTypeFilter;
  status: ResourceStatusFilter;
  page: number;
};

export function parseResourceFilters(
  input: {
    q?: string | string[];
    grade?: string | string[];
    category?: string | string[];
    type?: string | string[];
    status?: string | string[];
    page?: string | string[];
  },
  options: { allowStatus?: boolean } = {},
): ResourceFilters {
  const allowStatus = options.allowStatus ?? true;
  const typeRaw = firstValue(input.type);
  const statusRaw = firstValue(input.status);
  const grade = firstValue(input.grade);
  const category = firstValue(input.category);
  const pageRaw = Number.parseInt(firstValue(input.page) ?? "1", 10);

  return {
    search: sanitizeSearchTerm(firstValue(input.q)),
    gradeId: isUuid(grade) ? grade : null,
    categoryId: isUuid(category) ? category : null,
    type: RESOURCE_TYPE_FILTERS.includes(typeRaw as ResourceTypeFilter)
      ? (typeRaw as ResourceTypeFilter)
      : "all",
    status:
      allowStatus &&
      RESOURCE_STATUS_FILTERS.includes(statusRaw as ResourceStatusFilter)
        ? (statusRaw as ResourceStatusFilter)
        : "all",
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function buildResourceQuery(
  filters: ResourceFilters,
  overrides: Partial<{ page: number }> = {},
  options: { includeStatus?: boolean; includeGrade?: boolean } = {},
): string {
  const includeStatus = options.includeStatus ?? true;
  const includeGrade = options.includeGrade ?? true;
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (includeGrade && filters.gradeId) params.set("grade", filters.gradeId);
  if (filters.categoryId) params.set("category", filters.categoryId);
  if (filters.type !== "all") params.set("type", filters.type);
  if (includeStatus && filters.status !== "all") {
    params.set("status", filters.status);
  }

  const page = overrides.page ?? filters.page;
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasResourceFilters(filters: ResourceFilters): boolean {
  return Boolean(
    filters.search ||
      filters.gradeId ||
      filters.categoryId ||
      filters.type !== "all" ||
      filters.status !== "all",
  );
}
