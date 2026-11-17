import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ResourceAdminEvent,
  ResourceCategory,
  ResourceCategoryWithCount,
  ResourceRecord,
} from "@/lib/domain/types";
import {
  RESOURCES_PAGE_SIZE,
  type ResourceFilters,
} from "@/lib/resources/filters";
import { clampPage } from "@/lib/search";

const RESOURCE_SELECT = `
  id,
  grade_id,
  category_id,
  type,
  title_en,
  title_ar,
  description_en,
  description_ar,
  storage_path,
  external_url,
  thumbnail_url,
  is_published,
  sort_order,
  created_by,
  created_at,
  updated_at,
  grade:grades ( id, name_en, name_ar, slug ),
  category:resource_categories ( id, name_en, name_ar, slug )
`;

export type ResourceListResult = {
  resources: ResourceRecord[];
  total: number;
  page: number;
  pageCount: number;
  hasError: boolean;
};

async function runTeacherList(
  filters: ResourceFilters,
  page: number,
): Promise<{
  /** Raw PostgREST rows; callers cast after the embedded relations are read. */
  data: unknown;
  count: number | null;
  error: { message: string } | null;
}> {
  const supabase = await createClient();
  const from = (page - 1) * RESOURCES_PAGE_SIZE;

  let query = supabase
    .from("resources")
    .select(RESOURCE_SELECT, { count: "exact" });

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      [
        `title_en.ilike.${term}`,
        `title_ar.ilike.${term}`,
        `description_en.ilike.${term}`,
        `description_ar.ilike.${term}`,
      ].join(","),
    );
  }

  if (filters.gradeId) {
    query = query.eq("grade_id", filters.gradeId);
  }

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (filters.type !== "all") {
    query = query.eq("type", filters.type);
  }

  if (filters.status !== "all") {
    query = query.eq("is_published", filters.status === "published");
  }

  return query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(from, from + RESOURCES_PAGE_SIZE - 1);
}

/** Staff list: drafts included, RLS grants every row. */
export async function listTeacherResources(
  filters: ResourceFilters,
): Promise<ResourceListResult> {
  const first = await runTeacherList(filters, filters.page);

  if (first.error) {
    console.error("teacher resource list failed", first.error.message);
    return {
      resources: [],
      total: 0,
      page: 1,
      pageCount: 0,
      hasError: true,
    };
  }

  const total = first.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / RESOURCES_PAGE_SIZE));
  const page = clampPage(filters.page, pageCount);
  let rows = (first.data ?? []) as unknown as ResourceRecord[];

  if (rows.length === 0 && total > 0 && page !== filters.page) {
    const retry = await runTeacherList(filters, page);

    if (retry.error) {
      console.error("teacher resource list retry failed", retry.error.message);
      return { resources: [], total, page, pageCount, hasError: true };
    }

    rows = (retry.data ?? []) as unknown as ResourceRecord[];
  }

  return { resources: rows, total, page, pageCount, hasError: false };
}

async function runStudentList(
  gradeId: string,
  filters: ResourceFilters,
  page: number,
): Promise<{
  /** Raw PostgREST rows; callers cast after the embedded relations are read. */
  data: unknown;
  count: number | null;
  error: { message: string } | null;
}> {
  const supabase = await createClient();
  const from = (page - 1) * RESOURCES_PAGE_SIZE;

  let query = supabase
    .from("resources")
    .select(RESOURCE_SELECT, { count: "exact" })
    .eq("grade_id", gradeId)
    .eq("is_published", true);

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      [
        `title_en.ilike.${term}`,
        `title_ar.ilike.${term}`,
        `description_en.ilike.${term}`,
        `description_ar.ilike.${term}`,
      ].join(","),
    );
  }

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (filters.type !== "all") {
    query = query.eq("type", filters.type);
  }

  return query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(from, from + RESOURCES_PAGE_SIZE - 1);
}

/**
 * Student list: the grade comes from the profile, never from the query
 * string, and the published filter is explicit in addition to RLS.
 */
export async function listStudentResources(
  gradeId: string,
  filters: ResourceFilters,
): Promise<ResourceListResult> {
  const first = await runStudentList(gradeId, filters, filters.page);

  if (first.error) {
    console.error("student resource list failed", first.error.message);
    return {
      resources: [],
      total: 0,
      page: 1,
      pageCount: 0,
      hasError: true,
    };
  }

  const total = first.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / RESOURCES_PAGE_SIZE));
  const page = clampPage(filters.page, pageCount);
  let rows = (first.data ?? []) as unknown as ResourceRecord[];

  if (rows.length === 0 && total > 0 && page !== filters.page) {
    const retry = await runStudentList(gradeId, filters, page);

    if (retry.error) {
      console.error("student resource list retry failed", retry.error.message);
      return { resources: [], total, page, pageCount, hasError: true };
    }

    rows = (retry.data ?? []) as unknown as ResourceRecord[];
  }

  return { resources: rows, total, page, pageCount, hasError: false };
}

export async function getTeacherResourceById(
  id: string,
): Promise<ResourceRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .select(RESOURCE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("teacher resource lookup failed", error.message);
    return null;
  }

  return (data as unknown as ResourceRecord | null) ?? null;
}

/** Student detail: same explicit grade/published filters as the list. */
export async function getStudentResourceById(
  id: string,
  gradeId: string,
): Promise<ResourceRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .select(RESOURCE_SELECT)
    .eq("id", id)
    .eq("grade_id", gradeId)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("student resource lookup failed", error.message);
    return null;
  }

  return (data as unknown as ResourceRecord | null) ?? null;
}

export async function listResourceCategories(options: {
  activeOnly?: boolean;
  withCounts?: boolean;
} = {}): Promise<{
  categories: ResourceCategoryWithCount[];
  hasError: boolean;
}> {
  const supabase = await createClient();
  let query = supabase
    .from("resource_categories")
    .select(
      "id, name_en, name_ar, slug, description_en, description_ar, sort_order, is_active, created_at, updated_at",
    )
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });

  if (options.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("resource category list failed", error.message);
    return { categories: [], hasError: true };
  }

  const categories = ((data ?? []) as unknown as ResourceCategory[]).map(
    (category) => ({ ...category, resourceCount: 0 }),
  );

  if (!options.withCounts || categories.length === 0) {
    return { categories, hasError: false };
  }

  const countsResult = await supabase
    .from("resources")
    .select("category_id");

  if (countsResult.error) {
    console.error("resource category counts failed", countsResult.error.message);
    return { categories, hasError: true };
  }

  const counts = new Map<string, number>();

  for (const row of (countsResult.data ?? []) as Array<{
    category_id: string | null;
  }>) {
    if (row.category_id) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
  }

  return {
    categories: categories.map((category) => ({
      ...category,
      resourceCount: counts.get(category.id) ?? 0,
    })),
    hasError: false,
  };
}

/** Action pre-check/snapshot. RLS limits this to staff. */
export async function getResourceCategoryById(
  id: string,
): Promise<ResourceCategory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resource_categories")
    .select(
      "id, name_en, name_ar, slug, description_en, description_ar, sort_order, is_active, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("resource category lookup failed", error.message);
    return null;
  }

  return (data as unknown as ResourceCategory | null) ?? null;
}

export async function gradeExists(gradeId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select("id")
    .eq("id", gradeId)
    .maybeSingle();

  if (error) {
    console.error("grade existence check failed", error.message);
    return false;
  }

  return Boolean(data);
}

export async function listResourceAdminEvents(
  resourceId: string,
  limit = 20,
): Promise<ResourceAdminEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resource_admin_events")
    .select(
      "id, resource_id, category_id, actor_id, action, detail, created_at",
    )
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("resource event list failed", error.message);
    return [];
  }

  return (data ?? []) as unknown as ResourceAdminEvent[];
}
