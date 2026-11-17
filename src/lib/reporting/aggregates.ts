/**
 * Pure aggregate maths for the teacher and student dashboards.
 *
 * The data layer supplies rows already scoped by RLS (teacher: all rows,
 * student: RPC-filtered own rows). These functions only count and average
 * what they are given, which makes the rules testable without a database and
 * keeps "hidden results never contribute a score" explicit.
 */

export type GradeOption = {
  id: string;
  name_en: string;
  name_ar: string;
};

export type ClassOption = {
  id: string;
  name_en: string;
  name_ar: string;
  grade_id: string;
};

export type AggregateStudent = {
  id: string;
  grade_id: string | null;
  class_id: string | null;
};

export type AggregateResource = {
  id: string;
  is_published: boolean;
};

export type AggregateAssessment = {
  id: string;
  type: "quiz" | "exam";
  is_published: boolean;
};

export type AggregateAttempt = {
  percentage: number | null;
  status: string;
  manual_review_status: string;
};

export type TeacherAggregates = {
  studentCount: number;
  studentsByGrade: Array<GradeOption & { studentCount: number }>;
  studentsByClass: Array<
    ClassOption & { grade_name_en: string; studentCount: number }
  >;
  resourceCount: number;
  publishedResourceCount: number;
  unpublishedResourceCount: number;
  quizCount: number;
  examCount: number;
  publishedAssessmentCount: number;
  attemptCount: number;
  gradedAttemptCount: number;
  averagePercentage: number | null;
  pendingReviewCount: number;
};

export function averagePercentage(values: number[]): number | null {
  const finite = values.filter((value) => Number.isFinite(value));

  if (finite.length === 0) {
    return null;
  }

  const total = finite.reduce((sum, value) => sum + value, 0);
  return Math.round((total / finite.length) * 100) / 100;
}

export function computeTeacherAggregates(input: {
  grades: GradeOption[];
  classes: ClassOption[];
  students: AggregateStudent[];
  resources: AggregateResource[];
  assessments: AggregateAssessment[];
  attempts: AggregateAttempt[];
}): TeacherAggregates {
  const studentCountByGrade = new Map<string, number>();
  const studentCountByClass = new Map<string, number>();

  for (const student of input.students) {
    if (student.grade_id) {
      studentCountByGrade.set(
        student.grade_id,
        (studentCountByGrade.get(student.grade_id) ?? 0) + 1,
      );
    }

    if (student.class_id) {
      studentCountByClass.set(
        student.class_id,
        (studentCountByClass.get(student.class_id) ?? 0) + 1,
      );
    }
  }

  const gradeNames = new Map(
    input.grades.map((grade) => [grade.id, grade.name_en]),
  );

  const gradedPercentages = input.attempts
    .filter(
      (attempt) =>
        attempt.status === "graded" &&
        attempt.percentage !== null &&
        Number.isFinite(attempt.percentage),
    )
    .map((attempt) => attempt.percentage as number);

  return {
    studentCount: input.students.length,
    studentsByGrade: input.grades.map((grade) => ({
      ...grade,
      studentCount: studentCountByGrade.get(grade.id) ?? 0,
    })),
    studentsByClass: input.classes.map((classRow) => ({
      ...classRow,
      grade_name_en: gradeNames.get(classRow.grade_id) ?? "",
      studentCount: studentCountByClass.get(classRow.id) ?? 0,
    })),
    resourceCount: input.resources.length,
    publishedResourceCount: input.resources.filter(
      (resource) => resource.is_published,
    ).length,
    unpublishedResourceCount: input.resources.filter(
      (resource) => !resource.is_published,
    ).length,
    quizCount: input.assessments.filter(
      (assessment) => assessment.type === "quiz",
    ).length,
    examCount: input.assessments.filter(
      (assessment) => assessment.type === "exam",
    ).length,
    publishedAssessmentCount: input.assessments.filter(
      (assessment) => assessment.is_published,
    ).length,
    attemptCount: input.attempts.length,
    gradedAttemptCount: gradedPercentages.length,
    averagePercentage: averagePercentage(gradedPercentages),
    pendingReviewCount: input.attempts.filter(
      (attempt) => attempt.manual_review_status === "pending",
    ).length,
  };
}

export type StudentOverviewRow = {
  attempts_used: number;
  in_progress_attempt_id: string | null;
  last_percentage: number | null;
  result_visible: boolean;
  manual_review_status: string | null;
  last_attempt_id: string | null;
  last_submitted_at: string | null;
};

export type StudentSummary = {
  availableResources: number;
  availableAssessments: number;
  completedAssessments: number;
  pendingAssessments: number;
  inProgressAssessments: number;
  visibleScores: number;
  averageVisiblePercentage: number | null;
  pendingReview: number;
};

/**
 * Score-related fields only count when `result_visible` is true. A hidden
 * result therefore contributes no score, no average and no "scored" badge,
 * even if the raw row happened to carry a percentage.
 */
export function computeStudentSummary(input: {
  resourceCount: number;
  overview: StudentOverviewRow[];
}): StudentSummary {
  const visiblePercentages = input.overview
    .filter(
      (row) =>
        row.result_visible &&
        row.last_percentage !== null &&
        Number.isFinite(row.last_percentage),
    )
    .map((row) => row.last_percentage as number);

  return {
    availableResources: input.resourceCount,
    availableAssessments: input.overview.length,
    completedAssessments: input.overview.filter((row) => row.attempts_used > 0)
      .length,
    pendingAssessments: input.overview.filter((row) => row.attempts_used === 0)
      .length,
    inProgressAssessments: input.overview.filter((row) =>
      Boolean(row.in_progress_attempt_id),
    ).length,
    visibleScores: visiblePercentages.length,
    averageVisiblePercentage: averagePercentage(visiblePercentages),
    pendingReview: input.overview.filter(
      (row) => row.manual_review_status === "pending",
    ).length,
  };
}
