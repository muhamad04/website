/**
 * Pure helpers for the admin-only staff list. Kept free of Supabase imports so
 * query-string parsing can be unit tested directly.
 */

import {
  clampPage,
  firstValue,
  sanitizeSearchTerm,
} from "@/lib/search";

export { clampPage, sanitizeSearchTerm };

export const STAFF_ROLE_FILTERS = ["all", "teacher", "admin"] as const;
export type StaffRoleFilter = (typeof STAFF_ROLE_FILTERS)[number];

export const STAFF_STATUS_FILTERS = ["all", "active", "inactive"] as const;
export type StaffStatusFilter = (typeof STAFF_STATUS_FILTERS)[number];

export const STAFF_PAGE_SIZE = 15;

export type StaffFilters = {
  search: string | null;
  role: StaffRoleFilter;
  status: StaffStatusFilter;
  page: number;
};

export function parseStaffFilters(input: {
  q?: string | string[];
  role?: string | string[];
  status?: string | string[];
  page?: string | string[];
}): StaffFilters {
  const roleRaw = firstValue(input.role);
  const statusRaw = firstValue(input.status);

  const role: StaffRoleFilter = STAFF_ROLE_FILTERS.includes(
    roleRaw as StaffRoleFilter,
  )
    ? (roleRaw as StaffRoleFilter)
    : "all";

  const status: StaffStatusFilter = STAFF_STATUS_FILTERS.includes(
    statusRaw as StaffStatusFilter,
  )
    ? (statusRaw as StaffStatusFilter)
    : "all";

  const pageRaw = Number.parseInt(firstValue(input.page) ?? "1", 10);

  return {
    search: sanitizeSearchTerm(firstValue(input.q)),
    role,
    status,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function buildStaffQuery(
  filters: StaffFilters,
  overrides: Partial<{ page: number }> = {},
): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.role !== "all") params.set("role", filters.role);
  if (filters.status !== "all") params.set("status", filters.status);

  const page = overrides.page ?? filters.page;
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasStaffFilters(filters: StaffFilters): boolean {
  return (
    Boolean(filters.search) ||
    filters.role !== "all" ||
    filters.status !== "all"
  );
}
