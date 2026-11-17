import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { GradeSummary } from "@/lib/domain/types";

export type TeacherDashboardData = {
  studentCount: number;
  gradeCount: number;
  resourceCount: number;
  assessmentCount: number;
  studentsByGrade: Array<GradeSummary & { studentCount: number }>;
  hasError: boolean;
};

export type StudentDashboardData = {
  resourceCount: number;
  assessmentCount: number;
  completedAttemptCount: number;
  hasError: boolean;
};

/**
 * Teacher aggregates. RLS grants staff read access to every row, so no extra
 * role filter is needed beyond the counts themselves.
 */
export async function getTeacherDashboardData(): Promise<TeacherDashboardData> {
  const supabase = await createClient();

  const [studentsResult, gradesResult, resourcesResult, assessmentsResult, studentRowsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("is_active", true),
      supabase
        .from("grades")
        .select("id, name_en, name_ar, slug", { count: "exact" })
        .eq("is_active", true)
        .order("name_en", { ascending: true }),
      supabase.from("resources").select("id", { count: "exact", head: true }),
      supabase.from("assessments").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("grade_id")
        .eq("role", "student")
        .eq("is_active", true),
    ]);

  const hasError = [
    studentsResult.error,
    gradesResult.error,
    resourcesResult.error,
    assessmentsResult.error,
    studentRowsResult.error,
  ].some(Boolean);

  const gradeRows = (gradesResult.data as GradeSummary[] | null) ?? [];

  const countsByGrade = new Map<string, number>();

  for (const row of (studentRowsResult.data ?? []) as Array<{
    grade_id: string | null;
  }>) {
    if (!row.grade_id) {
      continue;
    }

    countsByGrade.set(
      row.grade_id,
      (countsByGrade.get(row.grade_id) ?? 0) + 1,
    );
  }

  return {
    studentCount: studentsResult.count ?? 0,
    gradeCount: gradesResult.count ?? 0,
    resourceCount: resourcesResult.count ?? 0,
    assessmentCount: assessmentsResult.count ?? 0,
    studentsByGrade: gradeRows.map((grade) => ({
      ...grade,
      studentCount: countsByGrade.get(grade.id) ?? 0,
    })),
    hasError,
  };
}

/**
 * Student aggregates. RLS limits each query to the signed-in student's grade
 * and their own attempts.
 */
export async function getStudentDashboardData(
  gradeId: string,
  studentId: string,
): Promise<StudentDashboardData> {
  const supabase = await createClient();

  const [resourcesResult, assessmentsResult, attemptsResult] =
    await Promise.all([
      supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("grade_id", gradeId)
        .eq("is_published", true),
      supabase
        .from("assessments")
        .select("id", { count: "exact", head: true })
        .eq("grade_id", gradeId)
        .eq("is_published", true),
      supabase
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .in("status", ["submitted", "grading", "graded"]),
    ]);

  return {
    resourceCount: resourcesResult.count ?? 0,
    assessmentCount: assessmentsResult.count ?? 0,
    completedAttemptCount: attemptsResult.count ?? 0,
    hasError: Boolean(
      resourcesResult.error ||
        assessmentsResult.error ||
        attemptsResult.error,
    ),
  };
}
