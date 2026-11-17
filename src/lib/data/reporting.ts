import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listGradesWithClasses } from "@/lib/data/students";
import {
  getStudentAttemptResult,
  listStudentAssessments,
} from "@/lib/data/assessments";
import type {
  AssessmentType,
  AttemptStatus,
  ClassSummary,
  GradeSummary,
  GradeWithClasses,
  GradingMode,
  ManualReviewStatus,
  ResourceRecord,
  ResultsVisibility,
  StudentAssessmentOverview,
} from "@/lib/domain/types";
import {
  EXPORT_ROW_LIMIT,
  REPORTING_PAGE_SIZE,
  dateRangeBounds,
  type ReportFilters,
} from "@/lib/reporting/filters";
import {
  computeStudentSummary,
  computeTeacherAggregates,
  type ClassOption,
  type StudentSummary,
  type TeacherAggregates,
} from "@/lib/reporting/aggregates";
import { readReportingSettings } from "@/lib/reporting/settings";
import { clampPage } from "@/lib/search";

/**
 * Request-scoped reporting reads.
 *
 * Teacher screens use the session client, so RLS still applies even if a
 * filter is forgotten. The sync worker (a separate module) is the only place
 * that uses the service-role client for reporting rows.
 */

export type ReportingStudentOption = {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  student_number: string | null;
  grade_id: string | null;
  class_id: string | null;
};

export type ReportingAssessmentOption = {
  id: string;
  title_en: string;
  title_ar: string;
  type: AssessmentType;
  grade_id: string;
  is_published: boolean;
};

export type ReportingFilterOptions = {
  grades: GradeWithClasses[];
  students: ReportingStudentOption[];
  assessments: ReportingAssessmentOption[];
};

export async function listReportingOptions(): Promise<ReportingFilterOptions> {
  const supabase = await createClient();
  const [gradesResult, studentsResult, assessmentsResult] = await Promise.all([
    listGradesWithClasses(),
    supabase
      .from("profiles")
      .select(
        "id, full_name_en, full_name_ar, student_number, grade_id, class_id",
      )
      .eq("role", "student")
      .order("full_name_en", { ascending: true })
      .range(0, 999),
    supabase
      .from("assessments")
      .select("id, title_en, title_ar, type, grade_id, is_published")
      .order("created_at", { ascending: false })
      .range(0, 999),
  ]);

  return {
    grades: gradesResult.grades,
    students: (studentsResult.data ?? []) as ReportingStudentOption[],
    assessments: (assessmentsResult.data ??
      []) as ReportingAssessmentOption[],
  };
}

export type ReportingAttemptRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  attempt_number: number;
  status: AttemptStatus;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  manual_review_status: ManualReviewStatus;
  assessment: {
    id: string;
    title_en: string;
    title_ar: string;
    type: AssessmentType;
    grading_mode: GradingMode;
    results_visibility: ResultsVisibility;
    grade_id: string;
  } | null;
  student: {
    id: string;
    full_name_en: string;
    full_name_ar: string | null;
    student_number: string | null;
    grade_id: string | null;
    class_id: string | null;
    grade: GradeSummary | null;
    class: ClassSummary | null;
  } | null;
};

const ATTEMPT_SELECT = `
  id,
  assessment_id,
  student_id,
  attempt_number,
  status,
  started_at,
  expires_at,
  submitted_at,
  score,
  max_score,
  percentage,
  manual_review_status,
  assessment:assessments!attempts_assessment_id_fkey (
    id,
    title_en,
    title_ar,
    type,
    grading_mode,
    results_visibility,
    grade_id
  ),
  student:profiles!attempts_student_id_fkey (
    id,
    full_name_en,
    full_name_ar,
    student_number,
    grade_id,
    class_id,
    grade:grades ( id, name_en, name_ar, slug ),
    class:classes ( id, name_en, name_ar )
  )
`;

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

type IdFilters = {
  studentIds: string[] | null;
  assessmentIds: string[] | null;
};

async function resolveStudentIds(
  filters: ReportFilters,
): Promise<{ ids: string[] | null; hasError: boolean }> {
  if (
    !filters.gradeId &&
    !filters.classId &&
    !filters.studentId &&
    !filters.search
  ) {
    return { ids: null, hasError: false };
  }

  const supabase = await createClient();
  let query = supabase.from("profiles").select("id").eq("role", "student");

  if (filters.studentId) {
    query = query.eq("id", filters.studentId);
  }

  if (filters.gradeId) {
    query = query.eq("grade_id", filters.gradeId);
  }

  if (filters.classId) {
    query = query.eq("class_id", filters.classId);
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      [
        `full_name_en.ilike.${term}`,
        `full_name_ar.ilike.${term}`,
        `email.ilike.${term}`,
        `student_number.ilike.${term}`,
      ].join(","),
    );
  }

  const { data, error } = await query.range(0, 999);

  if (error) {
    console.error("reporting student filter failed", error.message);
    return { ids: [], hasError: true };
  }

  return {
    ids: (data ?? []).map((row) => (row as { id: string }).id),
    hasError: false,
  };
}

async function resolveAssessmentIds(
  filters: ReportFilters,
): Promise<{ ids: string[] | null; hasError: boolean }> {
  if (filters.type === "all" && !filters.assessmentId) {
    return { ids: null, hasError: false };
  }

  const supabase = await createClient();
  let query = supabase.from("assessments").select("id");

  if (filters.assessmentId) {
    query = query.eq("id", filters.assessmentId);
  }

  if (filters.type !== "all") {
    query = query.eq("type", filters.type);
  }

  const { data, error } = await query.range(0, 999);

  if (error) {
    console.error("reporting assessment filter failed", error.message);
    return { ids: [], hasError: true };
  }

  return {
    ids: (data ?? []).map((row) => (row as { id: string }).id),
    hasError: false,
  };
}

async function fetchAttemptPages(
  filters: ReportFilters,
  ids: IdFilters,
  limit: number,
): Promise<{ rows: ReportingAttemptRow[]; hasError: boolean }> {
  if (ids.studentIds?.length === 0 || ids.assessmentIds?.length === 0) {
    return { rows: [], hasError: false };
  }

  const supabase = await createClient();
  const rows: ReportingAttemptRow[] = [];
  const chunk = 500;
  const { fromIso, toIso } = dateRangeBounds(filters);

  while (rows.length < limit) {
    const from = rows.length;
    const to = Math.min(from + chunk - 1, limit - 1);
    let query = supabase.from("attempts").select(ATTEMPT_SELECT);

    if (ids.studentIds !== null) {
      query = query.in("student_id", ids.studentIds);
    }

    if (ids.assessmentIds !== null) {
      query = query.in("assessment_id", ids.assessmentIds);
    }

    if (filters.grading !== "all") {
      query = query.eq("manual_review_status", filters.grading);
    }

    if (fromIso) {
      query = query.gte("submitted_at", fromIso);
    }

    if (toIso) {
      query = query.lte("submitted_at", toIso);
    }

    const { data, error } = await query
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("started_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("reporting attempt query failed", error.message);
      return { rows, hasError: true };
    }

    const page = (data ?? []) as unknown as ReportingAttemptRow[];
    rows.push(...page);

    if (page.length < to - from + 1) {
      break;
    }
  }

  return { rows, hasError: false };
}

export type TeacherDashboardResult = {
  aggregates: TeacherAggregates;
  recentActivity: ReportingAttemptRow[];
  recentResults: ReportingAttemptRow[];
  hasError: boolean;
};

export async function getTeacherDashboardData(
  filters: ReportFilters,
): Promise<TeacherDashboardResult> {
  const supabase = await createClient();
  const [gradesResult, resourcesResult, assessmentsResult] = await Promise.all([
    listGradesWithClasses(),
    (() => {
      let query = supabase
        .from("resources")
        .select("id, is_published")
        .order("updated_at", { ascending: false });
      if (filters.gradeId) {
        query = query.eq("grade_id", filters.gradeId);
      }
      return query.range(0, 4999);
    })(),
    (() => {
      let query = supabase
        .from("assessments")
        .select("id, type, is_published");
      if (filters.gradeId) {
        query = query.eq("grade_id", filters.gradeId);
      }
      if (filters.type !== "all") {
        query = query.eq("type", filters.type);
      }
      if (filters.assessmentId) {
        query = query.eq("id", filters.assessmentId);
      }
      return query.range(0, 4999);
    })(),
  ]);

  let studentsQuery = supabase
    .from("profiles")
    .select("id, grade_id, class_id")
    .eq("role", "student")
    .eq("is_active", true);

  if (filters.gradeId) {
    studentsQuery = studentsQuery.eq("grade_id", filters.gradeId);
  }

  if (filters.classId) {
    studentsQuery = studentsQuery.eq("class_id", filters.classId);
  }

  if (filters.studentId) {
    studentsQuery = studentsQuery.eq("id", filters.studentId);
  }

  const studentsResult = await studentsQuery.range(0, 4999);

  const hasError = Boolean(
    gradesResult.hasError ||
      resourcesResult.error ||
      assessmentsResult.error ||
      studentsResult.error,
  );

  const students = (studentsResult.data ?? []) as Array<{
    id: string;
    grade_id: string | null;
    class_id: string | null;
  }>;
  const assessments = (assessmentsResult.data ?? []) as Array<{
    id: string;
    type: "quiz" | "exam";
    is_published: boolean;
  }>;

  const attemptsResult = await fetchAttemptPages(
    filters,
    {
      studentIds:
        filters.gradeId || filters.classId || filters.studentId
          ? students.map((student) => student.id)
          : null,
      assessmentIds:
        filters.type !== "all" || filters.assessmentId
          ? assessments.map((assessment) => assessment.id)
          : null,
    },
    5000,
  );

  const classes: ClassOption[] = gradesResult.grades.flatMap((grade) =>
    grade.classes.map((classRow) => ({
      id: classRow.id,
      name_en: classRow.name_en,
      name_ar: classRow.name_ar,
      grade_id: classRow.grade_id,
    })),
  );

  const aggregates = computeTeacherAggregates({
    grades: gradesResult.grades.map((grade) => ({
      id: grade.id,
      name_en: grade.name_en,
      name_ar: grade.name_ar,
    })),
    classes,
    students,
    resources: (resourcesResult.data ?? []) as Array<{
      id: string;
      is_published: boolean;
    }>,
    assessments,
    attempts: attemptsResult.rows.map((attempt) => ({
      percentage: attempt.percentage,
      status: attempt.status,
      manual_review_status: attempt.manual_review_status,
    })),
  });

  const recentActivity = [...attemptsResult.rows]
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 6);
  const recentResults = attemptsResult.rows
    .filter((attempt) => attempt.status === "graded")
    .slice(0, 6);

  return {
    aggregates,
    recentActivity,
    recentResults,
    hasError: hasError || attemptsResult.hasError,
  };
}

export type TeacherResultsResult = {
  rows: ReportingAttemptRow[];
  total: number;
  page: number;
  pageCount: number;
  hasError: boolean;
};

export async function getTeacherResults(
  filters: ReportFilters,
): Promise<TeacherResultsResult> {
  const [studentIdsResult, assessmentIdsResult] = await Promise.all([
    resolveStudentIds(filters),
    resolveAssessmentIds(filters),
  ]);
  const empty = {
    rows: [],
    total: 0,
    page: 1,
    pageCount: 0,
    hasError: studentIdsResult.hasError || assessmentIdsResult.hasError,
  };

  if (
    studentIdsResult.ids?.length === 0 ||
    assessmentIdsResult.ids?.length === 0
  ) {
    return empty;
  }

  const supabase = await createClient();
  const ids: IdFilters = {
    studentIds: studentIdsResult.ids,
    assessmentIds: assessmentIdsResult.ids,
  };
  const { fromIso, toIso } = dateRangeBounds(filters);

  const run = async (page: number) => {
    const from = (page - 1) * REPORTING_PAGE_SIZE;
    let query = supabase
      .from("attempts")
      .select(ATTEMPT_SELECT, { count: "exact" });

    if (ids.studentIds !== null) {
      query = query.in("student_id", ids.studentIds);
    }

    if (ids.assessmentIds !== null) {
      query = query.in("assessment_id", ids.assessmentIds);
    }

    if (filters.grading !== "all") {
      query = query.eq("manual_review_status", filters.grading);
    }

    if (fromIso) {
      query = query.gte("submitted_at", fromIso);
    }

    if (toIso) {
      query = query.lte("submitted_at", toIso);
    }

    return query
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("started_at", { ascending: false })
      .range(from, from + REPORTING_PAGE_SIZE - 1);
  };

  const first = await run(filters.page);

  if (first.error) {
    console.error("reporting results query failed", first.error.message);
    return { ...empty, hasError: true };
  }

  const total = first.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / REPORTING_PAGE_SIZE));
  const page = clampPage(filters.page, pageCount);
  let rows = (first.data ?? []) as unknown as ReportingAttemptRow[];

  if (rows.length === 0 && total > 0 && page !== filters.page) {
    const retry = await run(page);

    if (retry.error) {
      console.error("reporting results retry failed", retry.error.message);
      return { ...empty, total, page, pageCount, hasError: true };
    }

    rows = (retry.data ?? []) as unknown as ReportingAttemptRow[];
  }

  return { rows, total, page, pageCount, hasError: false };
}

export async function getTeacherResultsForExport(
  filters: ReportFilters,
): Promise<{ rows: ReportingAttemptRow[]; hasError: boolean }> {
  const [studentIdsResult, assessmentIdsResult] = await Promise.all([
    resolveStudentIds(filters),
    resolveAssessmentIds(filters),
  ]);

  if (
    studentIdsResult.ids?.length === 0 ||
    assessmentIdsResult.ids?.length === 0
  ) {
    return { rows: [], hasError: false };
  }

  return fetchAttemptPages(
    filters,
    {
      studentIds: studentIdsResult.ids,
      assessmentIds: assessmentIdsResult.ids,
    },
    EXPORT_ROW_LIMIT,
  );
}

/* -------------------------------------------------------------------------- */
/* Student dashboard                                                          */
/* -------------------------------------------------------------------------- */

export type StudentFeedbackItem = {
  attemptId: string;
  assessmentId: string;
  title_en: string;
  title_ar: string;
  submittedAt: string | null;
  feedback: string[];
};

export type StudentActivityItem = {
  assessmentId: string;
  title_en: string;
  title_ar: string;
  type: AssessmentType;
  status: AttemptStatus | null;
  submittedAt: string | null;
  attemptsUsed: number;
  maxAttempts: number;
  percentage: number | null;
  score: number | null;
  maxScore: number | null;
  resultVisible: boolean;
  manualReviewStatus: ManualReviewStatus | null;
  inProgressAttemptId: string | null;
  lastAttemptId: string | null;
};

export type StudentDashboardResult = {
  summary: StudentSummary;
  resources: ResourceRecord[];
  assessments: StudentAssessmentOverview[];
  activity: StudentActivityItem[];
  feedback: StudentFeedbackItem[];
  hasError: boolean;
};

function feedbackFromResult(
  result: Awaited<ReturnType<typeof getStudentAttemptResult>>["result"],
): string[] {
  if (!result?.visible || !result.sections) {
    return [];
  }

  const messages: string[] = [];
  const seen = new Set<string>();

  for (const section of result.sections) {
    for (const question of section.questions) {
      for (const value of [
        question.answer?.feedback_en,
        question.answer?.feedback_ar,
      ]) {
        const text = value?.replace(/\s+/g, " ").trim();

        if (text && !seen.has(text)) {
          seen.add(text);
          messages.push(text);
        }
      }
    }
  }

  return messages;
}

export async function getStudentDashboardData(
  gradeId: string,
): Promise<StudentDashboardResult> {
  const supabase = await createClient();
  const [resourceCountResult, resourcesResult, overviewResult] =
    await Promise.all([
      supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("grade_id", gradeId)
        .eq("is_published", true),
      supabase
        .from("resources")
        .select(RESOURCE_SELECT)
        .eq("grade_id", gradeId)
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false })
        .range(0, 4),
      listStudentAssessments(),
    ]);

  const overview = overviewResult.assessments;
  const summary = computeStudentSummary({
    resourceCount: resourceCountResult.count ?? 0,
    overview,
  });

  const ordered = [...overview].sort((a, b) => {
    const left = a.last_submitted_at ?? "";
    const right = b.last_submitted_at ?? "";
    return right.localeCompare(left);
  });

  const activity: StudentActivityItem[] = ordered.slice(0, 6).map((row) => ({
    assessmentId: row.id,
    title_en: row.title_en,
    title_ar: row.title_ar,
    type: row.type,
    status: row.last_attempt_status,
    submittedAt: row.last_submitted_at,
    attemptsUsed: row.attempts_used,
    maxAttempts: row.max_attempts,
    percentage: row.result_visible ? row.last_percentage : null,
    score: row.result_visible ? row.last_score : null,
    maxScore: row.result_visible ? row.last_max_score : null,
    resultVisible: row.result_visible,
    manualReviewStatus: row.manual_review_status,
    inProgressAttemptId: row.in_progress_attempt_id,
    lastAttemptId: row.last_attempt_id,
  }));

  const feedbackCandidates = ordered
    .filter((row) => row.result_visible && row.last_attempt_id)
    .slice(0, 3);

  const feedbackResults = await Promise.all(
    feedbackCandidates.map(async (row) => {
      const { result } = await getStudentAttemptResult(row.last_attempt_id!);
      return {
        row,
        messages: feedbackFromResult(result),
      };
    }),
  );

  const feedback: StudentFeedbackItem[] = feedbackResults
    .filter((entry) => entry.messages.length > 0)
    .map((entry) => ({
      attemptId: entry.row.last_attempt_id!,
      assessmentId: entry.row.id,
      title_en: entry.row.title_en,
      title_ar: entry.row.title_ar,
      submittedAt: entry.row.last_submitted_at,
      feedback: entry.messages,
    }));

  return {
    summary,
    resources: (resourcesResult.data ?? []) as unknown as ResourceRecord[],
    assessments: overview,
    activity,
    feedback,
    hasError: Boolean(
      resourceCountResult.error ||
        resourcesResult.error ||
        overviewResult.hasError,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Admin reporting surfaces                                                   */
/* -------------------------------------------------------------------------- */

export type SyncLogListItem = {
  id: string;
  attempt_id: string;
  status: "pending" | "synced" | "failed" | "skipped";
  attempt_count: number;
  spreadsheet_id: string | null;
  sheet_name: string | null;
  row_reference: string | null;
  last_error: string | null;
  last_attempted_at: string | null;
  synced_at: string | null;
  updated_at: string;
  attempt: {
    id: string;
    submitted_at: string | null;
    assessment: {
      title_en: string;
      title_ar: string;
      type: AssessmentType;
    } | null;
    student: {
      full_name_en: string;
      full_name_ar: string | null;
    } | null;
  } | null;
};

export async function listSyncLogs(
  limit = 25,
): Promise<{ logs: SyncLogListItem[]; hasError: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("google_sheet_sync_logs")
    .select(
      `
      id,
      attempt_id,
      status,
      attempt_count,
      spreadsheet_id,
      sheet_name,
      row_reference,
      last_error,
      last_attempted_at,
      synced_at,
      updated_at,
      attempt:attempts!google_sheet_sync_logs_attempt_id_fkey (
        id,
        submitted_at,
        assessment:assessments!attempts_assessment_id_fkey (
          title_en,
          title_ar,
          type
        ),
        student:profiles!attempts_student_id_fkey (
          full_name_en,
          full_name_ar
        )
      )
    `,
    )
    .order("updated_at", { ascending: false })
    .range(0, Math.max(0, limit - 1));

  if (error) {
    console.error("sync log list failed", error.message);
    return { logs: [], hasError: true };
  }

  return {
    logs: (data ?? []) as unknown as SyncLogListItem[],
    hasError: false,
  };
}

export type ReportingEventRow = {
  id: string;
  actor_id: string | null;
  action: "sync_manual" | "sync_retry" | "settings_updated" | "connectivity_checked";
  attempt_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
  actor: {
    full_name_en: string;
    full_name_ar: string | null;
  } | null;
};

export async function listReportingEvents(
  limit = 20,
): Promise<{ events: ReportingEventRow[]; hasError: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reporting_admin_events")
    .select(
      `
      id,
      actor_id,
      action,
      attempt_id,
      detail,
      created_at,
      actor:profiles!reporting_admin_events_actor_id_fkey (
        full_name_en,
        full_name_ar
      )
    `,
    )
    .order("created_at", { ascending: false })
    .range(0, Math.max(0, limit - 1));

  if (error) {
    console.error("reporting event list failed", error.message);
    return { events: [], hasError: true };
  }

  return {
    events: (data ?? []) as unknown as ReportingEventRow[],
    hasError: false,
  };
}

export async function getReportingSettingsForPage() {
  const supabase = await createClient();
  return readReportingSettings(supabase);
}

export async function countFailedSyncs(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("google_sheet_sync_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");

  return count ?? 0;
}

export async function listFailedAttemptIds(limit = 20): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("google_sheet_sync_logs")
    .select("attempt_id")
    .eq("status", "failed")
    .order("updated_at", { ascending: true })
    .range(0, Math.max(0, limit - 1));

  if (error) {
    console.error("failed sync list failed", error.message);
    return [];
  }

  return (data ?? []).map(
    (row) => (row as { attempt_id: string }).attempt_id,
  );
}
