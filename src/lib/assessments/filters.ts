export const ASSESSMENTS_PAGE_SIZE = 20;

export const ASSESSMENT_TYPE_FILTERS = ["all", "quiz", "exam"] as const;
export const ASSESSMENT_STATUS_FILTERS = [
  "all",
  "published",
  "draft",
] as const;

export type AssessmentTypeFilter = (typeof ASSESSMENT_TYPE_FILTERS)[number];
export type AssessmentStatusFilter =
  (typeof ASSESSMENT_STATUS_FILTERS)[number];

export type AssessmentFilters = {
  search: string;
  gradeId: string;
  type: AssessmentTypeFilter;
  status: AssessmentStatusFilter;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function parseAssessmentFilters(params: RawParams): AssessmentFilters {
  const type = first(params.type).toLowerCase();
  const status = first(params.status).toLowerCase();
  const page = Number.parseInt(first(params.page), 10);

  return {
    search: first(params.q).trim().slice(0, 80),
    gradeId: first(params.grade).trim().slice(0, 64),
    type: (ASSESSMENT_TYPE_FILTERS as readonly string[]).includes(type)
      ? (type as AssessmentTypeFilter)
      : "all",
    status: (ASSESSMENT_STATUS_FILTERS as readonly string[]).includes(status)
      ? (status as AssessmentStatusFilter)
      : "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function hasAssessmentFilters(filters: AssessmentFilters): boolean {
  return Boolean(
    filters.search || filters.gradeId || filters.type !== "all" || filters.status !== "all",
  );
}

export function buildAssessmentQuery(
  filters: AssessmentFilters,
  overrides: Partial<AssessmentFilters> = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.search) params.set("q", merged.search);
  if (merged.gradeId) params.set("grade", merged.gradeId);
  if (merged.type !== "all") params.set("type", merged.type);
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.page > 1) params.set("page", String(merged.page));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const STUDENT_ASSESSMENT_VIEWS = ["all", "completed"] as const;
export type StudentAssessmentView = (typeof STUDENT_ASSESSMENT_VIEWS)[number];

export type StudentAssessmentFilters = {
  type: AssessmentTypeFilter;
  view: StudentAssessmentView;
};

export function parseStudentAssessmentFilters(
  params: RawParams,
): StudentAssessmentFilters {
  const type = first(params.type).toLowerCase();
  const view = first(params.view).toLowerCase();

  return {
    type: (ASSESSMENT_TYPE_FILTERS as readonly string[]).includes(type)
      ? (type as AssessmentTypeFilter)
      : "all",
    view: (STUDENT_ASSESSMENT_VIEWS as readonly string[]).includes(view)
      ? (view as StudentAssessmentView)
      : "all",
  };
}

export function buildStudentAssessmentQuery(
  filters: StudentAssessmentFilters,
  overrides: Partial<StudentAssessmentFilters> = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.type !== "all") params.set("type", merged.type);
  if (merged.view !== "all") params.set("view", merged.view);

  const query = params.toString();
  return query ? `?${query}` : "";
}
