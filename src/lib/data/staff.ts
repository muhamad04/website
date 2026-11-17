import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { StaffAdminEvent, StaffRecord } from "@/lib/domain/types";
import {
  STAFF_PAGE_SIZE,
  clampPage,
  type StaffFilters,
} from "@/lib/staff/filters";

/**
 * Request-scoped staff reads. The page and every action are already
 * admin-guarded; using the signed-in session here means the admin-only audit
 * RLS still applies as a second layer.
 */

const STAFF_SELECT = `
  id,
  role,
  full_name_en,
  full_name_ar,
  email,
  is_active,
  invitation_sent_at,
  access_reset_at,
  created_at,
  updated_at
`;

const STAFF_EVENT_SELECT = `
  id,
  staff_id,
  actor_id,
  action,
  detail,
  created_at,
  actor:profiles!staff_admin_events_actor_id_fkey ( id, full_name_en, full_name_ar ),
  staff:profiles!staff_admin_events_staff_id_fkey ( id, full_name_en, full_name_ar )
`;

export type StaffListResult = {
  staff: StaffRecord[];
  total: number;
  page: number;
  pageCount: number;
  hasError: boolean;
};

export async function listStaff(
  filters: StaffFilters,
): Promise<StaffListResult> {
  const supabase = await createClient();

  const run = async (page: number) => {
    const from = (page - 1) * STAFF_PAGE_SIZE;
    let query = supabase
      .from("profiles")
      .select(STAFF_SELECT, { count: "exact" })
      .in("role", ["teacher", "admin"]);

    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.or(
        [
          `full_name_en.ilike.${term}`,
          `full_name_ar.ilike.${term}`,
          `email.ilike.${term}`,
        ].join(","),
      );
    }

    if (filters.role !== "all") {
      query = query.eq("role", filters.role);
    }

    if (filters.status !== "all") {
      query = query.eq("is_active", filters.status === "active");
    }

    return query
      .order("full_name_en", { ascending: true })
      .range(from, from + STAFF_PAGE_SIZE - 1);
  };

  const first = await run(filters.page);

  if (first.error) {
    console.error("staff list failed", first.error.message);
    return {
      staff: [],
      total: 0,
      page: 1,
      pageCount: 0,
      hasError: true,
    };
  }

  const total = first.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / STAFF_PAGE_SIZE));
  const page = clampPage(filters.page, pageCount);
  let rows = (first.data ?? []) as unknown as StaffRecord[];

  if (rows.length === 0 && total > 0 && page !== filters.page) {
    const retry = await run(page);

    if (retry.error) {
      console.error("staff list retry failed", retry.error.message);
      return { staff: [], total, page, pageCount, hasError: true };
    }

    rows = (retry.data ?? []) as unknown as StaffRecord[];
  }

  return { staff: rows, total, page, pageCount, hasError: false };
}

export async function getStaffById(id: string): Promise<StaffRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(STAFF_SELECT)
    .eq("id", id)
    .in("role", ["teacher", "admin"])
    .maybeSingle();

  if (error) {
    console.error("staff lookup failed", error.message);
    return null;
  }

  return (data as unknown as StaffRecord | null) ?? null;
}

export type ManagedStaffProfile = {
  id: string;
  role: "teacher" | "admin";
  is_active: boolean;
  email: string | null;
  full_name_en: string;
  full_name_ar: string | null;
};

/** Minimal lookup used by actions to reject non-staff targets. */
export async function getManagedStaffProfile(
  id: string,
): Promise<ManagedStaffProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, is_active, email, full_name_en, full_name_ar")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("staff profile lookup failed", error.message);
    return null;
  }

  const row = data as ManagedStaffProfile | null;

  if (!row || (row.role !== "teacher" && row.role !== "admin")) {
    return null;
  }

  return row;
}

/**
 * Counts other active admins. The caller passes the target id, so the result
 * answers "would this change remove the final active administrator?".
 */
export async function countOtherActiveAdmins(
  excludeId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true)
    .neq("id", excludeId);

  if (error) {
    console.error("active admin count failed", error.message);
    // Fail closed: an unknown count must not allow a last-admin change.
    return 0;
  }

  return count ?? 0;
}

export async function listStaffEvents(
  staffId: string,
  limit = 30,
): Promise<StaffAdminEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_admin_events")
    .select(STAFF_EVENT_SELECT)
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("staff event list failed", error.message);
    return [];
  }

  return (data ?? []) as unknown as StaffAdminEvent[];
}

export async function listRecentStaffEvents(
  limit = 12,
): Promise<StaffAdminEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_admin_events")
    .select(STAFF_EVENT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("recent staff event list failed", error.message);
    return [];
  }

  return (data ?? []) as unknown as StaffAdminEvent[];
}
