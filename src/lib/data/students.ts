import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  GradeSummary,
  GradeWithClasses,
  StudentAdminEvent,
  StudentRecord,
} from "@/lib/domain/types";
import {
  STUDENTS_PAGE_SIZE,
  clampPage,
  type StudentFilters,
} from "@/lib/students/filters";

/**
 * Request-scoped reads. The signed-in teacher's session is used, so RLS still
 * applies even if a filter is forgotten here.
 */

const STUDENT_SELECT = `
  id,
  full_name_en,
  full_name_ar,
  email,
  username,
  student_number,
  grade_id,
  class_id,
  is_active,
  invitation_sent_at,
  access_reset_at,
  created_at,
  updated_at,
  grade:grades ( id, name_en, name_ar, slug ),
  class:classes ( id, name_en, name_ar )
`;

export type StudentListResult = {
  students: StudentRecord[];
  total: number;
  page: number;
  pageCount: number;
  hasError: boolean;
};

export async function listStudents(
  filters: StudentFilters,
): Promise<StudentListResult> {
  const supabase = await createClient();

  const run = async (page: number) => {
    const from = (page - 1) * STUDENTS_PAGE_SIZE;
    let query = supabase
      .from("profiles")
      .select(STUDENT_SELECT, { count: "exact" })
      .eq("role", "student");

    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.or(
        [
          `full_name_en.ilike.${term}`,
          `full_name_ar.ilike.${term}`,
          `email.ilike.${term}`,
          `username.ilike.${term}`,
          `student_number.ilike.${term}`,
        ].join(","),
      );
    }

    if (filters.gradeId) {
      query = query.eq("grade_id", filters.gradeId);
    }

    if (filters.classId) {
      query = query.eq("class_id", filters.classId);
    }

    if (filters.status !== "all") {
      query = query.eq("is_active", filters.status === "active");
    }

    return query
      .order("full_name_en", { ascending: true })
      .range(from, from + STUDENTS_PAGE_SIZE - 1);
  };

  const first = await run(filters.page);

  if (first.error) {
    console.error("student list failed", first.error.message);
    return {
      students: [],
      total: 0,
      page: 1,
      pageCount: 0,
      hasError: true,
    };
  }

  const total = first.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));
  const page = clampPage(filters.page, pageCount);
  let rows = (first.data ?? []) as unknown as StudentRecord[];

  // A stale ?page= link should show data, not an empty table.
  if (rows.length === 0 && total > 0 && page !== filters.page) {
    const retry = await run(page);

    if (retry.error) {
      console.error("student list retry failed", retry.error.message);
      return { students: [], total, page, pageCount, hasError: true };
    }

    rows = (retry.data ?? []) as unknown as StudentRecord[];
  }

  return { students: rows, total, page, pageCount, hasError: false };
}

export async function getStudentById(id: string): Promise<StudentRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(STUDENT_SELECT)
    .eq("id", id)
    .eq("role", "student")
    .maybeSingle();

  if (error) {
    console.error("student lookup failed", error.message);
    return null;
  }

  return (data as unknown as StudentRecord | null) ?? null;
}

/** Minimal lookup used by actions to reject non-student targets. */
export async function getManagedProfileRole(
  id: string,
): Promise<{
  id: string;
  role: string;
  is_active: boolean;
  email: string | null;
  student_number: string | null;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, is_active, email, student_number")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("profile role lookup failed", error.message);
    return null;
  }

  return (
    (data as {
      id: string;
      role: string;
      is_active: boolean;
      email: string | null;
      student_number: string | null;
    } | null) ?? null
  );
}

export async function listGradesWithClasses(): Promise<{
  grades: GradeWithClasses[];
  hasError: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select(
      `
        id,
        name_en,
        name_ar,
        slug,
        description_en,
        description_ar,
        sort_order,
        is_active,
        classes ( id, grade_id, name_en, name_ar, academic_year, is_active )
      `,
    )
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true })
    .order("name_en", { referencedTable: "classes", ascending: true });

  if (error) {
    console.error("grade list failed", error.message);
    return { grades: [], hasError: true };
  }

  return {
    grades: (data ?? []) as unknown as GradeWithClasses[],
    hasError: false,
  };
}

export async function listGradeOptions(): Promise<GradeSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select("id, name_en, name_ar, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });

  if (error) {
    console.error("grade options failed", error.message);
    return [];
  }

  return (data ?? []) as unknown as GradeSummary[];
}

/** Class lookup used to verify that a class belongs to the submitted grade. */
export async function getClassGradeId(
  classId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("grade_id")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    console.error("class lookup failed", error.message);
    return null;
  }

  return (data as { grade_id: string } | null)?.grade_id ?? null;
}

export async function listStudentEvents(
  studentId: string,
  limit = 20,
): Promise<StudentAdminEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_admin_events")
    .select("id, student_id, actor_id, action, detail, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("student event list failed", error.message);
    return [];
  }

  return (data ?? []) as unknown as StudentAdminEvent[];
}
