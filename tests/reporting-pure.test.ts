import { describe, expect, it } from "vitest";
import {
  buildReportQuery,
  dateRangeBounds,
  hasReportFilters,
  normaliseDateValue,
  parseReportFilters,
} from "@/lib/reporting/filters";
import { buildCsv, exportFileName } from "@/lib/reporting/csv";
import {
  buildSyncPayload,
  payloadsEqual,
  SHEET_COLUMN_COUNT,
  SHEET_HEADERS,
  summariseFeedback,
  type SyncPayloadInput,
} from "@/lib/reporting/payload";
import {
  findSubmissionRow,
  parseRowNumber,
  planSheetSync,
  rowReference,
} from "@/lib/reporting/plan";
import {
  averagePercentage,
  computeStudentSummary,
  computeTeacherAggregates,
} from "@/lib/reporting/aggregates";

const GRADE_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const ASSESSMENT_ID = "44444444-4444-4444-8444-444444444444";
const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";

describe("reporting filters", () => {
  it("parses, validates and defaults every query value", () => {
    const filters = parseReportFilters({
      grade: GRADE_ID,
      class: "not-a-uuid",
      student: STUDENT_ID,
      assessment: ASSESSMENT_ID,
      type: "EXAM",
      grading: "pending",
      from: "2026-11-10",
      to: "2026-11-20",
      q: "  sara  ",
      page: "3",
    });

    expect(filters).toEqual({
      gradeId: GRADE_ID,
      classId: null,
      studentId: STUDENT_ID,
      assessmentId: ASSESSMENT_ID,
      type: "exam",
      grading: "pending",
      from: "2026-11-10",
      to: "2026-11-20",
      search: "sara",
      page: 3,
    });
  });

  it("rejects impossible dates and swaps a reversed range", () => {
    expect(normaliseDateValue("2026-02-30")).toBeNull();
    expect(normaliseDateValue("2026-2-3")).toBeNull();
    expect(normaliseDateValue("2026-02-28")).toBe("2026-02-28");

    const filters = parseReportFilters({
      from: "2026-12-01",
      to: "2026-11-01",
    });

    expect(filters.from).toBe("2026-11-01");
    expect(filters.to).toBe("2026-12-01");
  });

  it("builds a shareable query and omits default values", () => {
    const filters = parseReportFilters({
      grade: GRADE_ID,
      grading: "completed",
      page: "2",
    });

    expect(hasReportFilters(filters)).toBe(true);
    expect(buildReportQuery(filters)).toBe(
      `?grade=${GRADE_ID}&grading=completed&page=2`,
    );
    expect(buildReportQuery(filters, { page: 1 })).toBe(
      `?grade=${GRADE_ID}&grading=completed`,
    );
    expect(buildReportQuery(parseReportFilters({}))).toBe("");
  });

  it("expands date-only filters into inclusive UTC bounds", () => {
    expect(
      dateRangeBounds({ from: "2026-11-01", to: "2026-11-30" }),
    ).toEqual({
      fromIso: "2026-11-01T00:00:00.000Z",
      toIso: "2026-11-30T23:59:59.999Z",
    });
    expect(dateRangeBounds({ from: null, to: null })).toEqual({
      fromIso: null,
      toIso: null,
    });
  });
});

describe("CSV export", () => {
  it("quotes separators and escapes embedded quotes", () => {
    const csv = buildCsv(
      ["Name", "Feedback"],
      [['Sara, "S"', "Line one\nLine two"]],
    );

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Sara, ""S"""');
    expect(csv).toContain('"Line one\nLine two"');
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("neutralises spreadsheet formula injection but keeps numbers bare", () => {
    const csv = buildCsv(
      ["A", "B", "C", "D"],
      [["=1+1", "+SUM(A1)", "@cmd", -5]],
    );

    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+SUM(A1)");
    expect(csv).toContain("'@cmd");
    expect(csv).toContain(",-5");
  });

  it("names the export with a stable date", () => {
    expect(exportFileName(new Date("2026-11-16T12:00:00Z"))).toBe(
      "results-2026-11-16.csv",
    );
  });
});

function payloadInput(): SyncPayloadInput {
  return {
    attempt: {
      id: ATTEMPT_ID,
      attempt_number: 1,
      started_at: "2026-11-16T09:00:00.000Z",
      submitted_at: "2026-11-16T09:30:00.000Z",
      status: "grading",
      score: 7.5,
      max_score: 10,
      percentage: 75,
      manual_review_status: "pending",
    },
    assessment: {
      title_en: "Unit quiz",
      title_ar: "اختبار الوحدة",
      type: "quiz",
      grading_mode: "mixed",
      results_visibility: "after_review",
      time_limit_minutes: 30,
    },
    student: {
      id: STUDENT_ID,
      full_name_en: "Sara Ahmed",
      full_name_ar: "سارة أحمد",
      email: "sara@example.com",
      student_number: "S-001",
      grade_name_en: "Grade 10",
      grade_name_ar: "الصف العاشر",
      class_name_en: "10A",
      class_name_ar: "10أ",
    },
    feedback: [
      { feedback_en: "Good structure.", feedback_ar: "بنية جيدة." },
      { feedback_en: "Good structure.", feedback_ar: null },
      { feedback_en: "  ", feedback_ar: "" },
    ],
  };
}

describe("Google Sheets payload", () => {
  it("produces exactly 18 columns in the documented order", () => {
    const row = buildSyncPayload(payloadInput());

    expect(SHEET_HEADERS).toHaveLength(SHEET_COLUMN_COUNT);
    expect(row).toHaveLength(SHEET_COLUMN_COUNT);
    expect(row[0]).toBe(ATTEMPT_ID);
    expect(row[1]).toBe("S-001");
    expect(row[2]).toBe("Sara Ahmed · سارة أحمد");
    expect(row[3]).toBe("sara@example.com");
    expect(row[4]).toBe("Grade 10 · الصف العاشر");
    expect(row[5]).toBe("10A · 10أ");
    expect(row[6]).toBe("Unit quiz · اختبار الوحدة");
    expect(row[7]).toBe("quiz");
    expect(row[8]).toBe("mixed");
    expect(row[11]).toBe(30);
    expect(row[12]).toBe(7.5);
    expect(row[13]).toBe(10);
    expect(row[14]).toBe(75);
    expect(row[15]).toBe("grading");
    expect(row[16]).toBe("pending");
    expect(row[17]).toBe("Good structure. | بنية جيدة.");
  });

  it("leaves the optional email blank when unavailable", () => {
    const input = payloadInput();
    input.student.email = null;

    const row = buildSyncPayload(input);

    expect(row[1]).toBe("S-001");
    expect(row[3]).toBe("");
    expect(row).toHaveLength(SHEET_COLUMN_COUNT);
  });

  it("never includes essay text, files or answer keys", () => {
    const row = buildSyncPayload(payloadInput()).join(" ");

    expect(row).not.toMatch(/response|file_path|answer_key|essay/i);
  });

  it("falls back to the profile id only for a legacy row without a Student ID", () => {
    const input = payloadInput();
    input.student.student_number = null;
    expect(buildSyncPayload(input)[1]).toBe(STUDENT_ID);
  });

  it("collapses and truncates long feedback", () => {
    const summary = summariseFeedback(
      [
        { feedback_en: "one   two\nthree", feedback_ar: null },
        { feedback_en: "x".repeat(600), feedback_ar: null },
      ],
      40,
    );

    expect(summary.length).toBeLessThanOrEqual(40);
    expect(summary.endsWith("…")).toBe(true);
    expect(summary).toContain("one two three");
  });

  it("compares payloads deterministically", () => {
    expect(payloadsEqual([1, "a"], [1, "a"])).toBe(true);
    expect(payloadsEqual([1, "a"], [1, "b"])).toBe(false);
  });
});

describe("Google Sheets idempotency planning", () => {
  const next = buildSyncPayload(payloadInput());

  it("appends the first time", () => {
    expect(
      planSheetSync({ existing: null, nextPayload: next, foundRowNumber: null }),
    ).toEqual({ action: "append", rowNumber: null });
  });

  it("skips an unchanged synced row", () => {
    expect(
      planSheetSync({
        existing: {
          status: "synced",
          payload: next,
          rowReference: "Results!A4",
        },
        nextPayload: next,
        foundRowNumber: 4,
      }),
    ).toEqual({ action: "skip", reason: "unchanged" });
  });

  it("updates when a regrade changes the payload", () => {
    const changed = [...next];
    changed[12] = 9;

    expect(
      planSheetSync({
        existing: {
          status: "synced",
          payload: next,
          rowReference: "Results!A4",
        },
        nextPayload: changed,
        foundRowNumber: 4,
      }),
    ).toEqual({ action: "update", rowNumber: 4 });
  });

  it("retries a failed sync without creating a duplicate row", () => {
    expect(
      planSheetSync({
        existing: {
          status: "failed",
          payload: next,
          rowReference: null,
        },
        nextPayload: next,
        foundRowNumber: 9,
      }),
    ).toEqual({ action: "update", rowNumber: 9 });
  });

  it("appends when a failed sync found no row", () => {
    expect(
      planSheetSync({
        existing: { status: "failed", payload: next, rowReference: null },
        nextPayload: next,
        foundRowNumber: null,
      }),
    ).toEqual({ action: "append", rowNumber: null });
  });

  it("repairs a row deleted from the sheet instead of skipping", () => {
    expect(
      planSheetSync({
        existing: {
          status: "synced",
          payload: next,
          rowReference: "Results!A4",
        },
        nextPayload: next,
        foundRowNumber: null,
      }),
    ).toEqual({ action: "append", rowNumber: null });
  });

  it("finds submission rows and parses references", () => {
    expect(
      findSubmissionRow(
        [["Submission ID"], [ATTEMPT_ID], ["other"]],
        ATTEMPT_ID,
      ),
    ).toBe(2);
    expect(findSubmissionRow([["other"]], ATTEMPT_ID)).toBeNull();
    expect(rowReference("Results", 2)).toBe("Results!A2");
    expect(parseRowNumber("Results!A2")).toBe(2);
    expect(parseRowNumber("Results")).toBeNull();
  });
});

describe("dashboard aggregates", () => {
  it("counts students by grade and class, resources and assessments", () => {
    const totals = computeTeacherAggregates({
      grades: [
        { id: GRADE_ID, name_en: "Grade 10", name_ar: "الصف العاشر" },
        { id: "grade-11", name_en: "Grade 11", name_ar: "الصف الحادي عشر" },
      ],
      classes: [
        {
          id: CLASS_ID,
          name_en: "10A",
          name_ar: "10أ",
          grade_id: GRADE_ID,
        },
      ],
      students: [
        { id: "s1", grade_id: GRADE_ID, class_id: CLASS_ID },
        { id: "s2", grade_id: GRADE_ID, class_id: CLASS_ID },
        { id: "s3", grade_id: "grade-11", class_id: null },
      ],
      resources: [
        { id: "r1", is_published: true },
        { id: "r2", is_published: false },
        { id: "r3", is_published: true },
      ],
      assessments: [
        { id: "a1", type: "quiz", is_published: true },
        { id: "a2", type: "quiz", is_published: false },
        { id: "a3", type: "exam", is_published: true },
      ],
      attempts: [
        {
          percentage: 80,
          status: "graded",
          manual_review_status: "completed",
        },
        {
          percentage: 60,
          status: "graded",
          manual_review_status: "completed",
        },
        {
          percentage: 100,
          status: "grading",
          manual_review_status: "pending",
        },
      ],
    });

    expect(totals.studentCount).toBe(3);
    expect(totals.studentsByGrade).toEqual([
      {
        id: GRADE_ID,
        name_en: "Grade 10",
        name_ar: "الصف العاشر",
        studentCount: 2,
      },
      {
        id: "grade-11",
        name_en: "Grade 11",
        name_ar: "الصف الحادي عشر",
        studentCount: 1,
      },
    ]);
    expect(totals.studentsByClass[0].studentCount).toBe(2);
    expect(totals.studentsByClass[0].grade_name_en).toBe("Grade 10");
    expect(totals.resourceCount).toBe(3);
    expect(totals.publishedResourceCount).toBe(2);
    expect(totals.unpublishedResourceCount).toBe(1);
    expect(totals.quizCount).toBe(2);
    expect(totals.examCount).toBe(1);
    expect(totals.publishedAssessmentCount).toBe(2);
    expect(totals.attemptCount).toBe(3);
    expect(totals.gradedAttemptCount).toBe(2);
    expect(totals.averagePercentage).toBe(70);
    expect(totals.pendingReviewCount).toBe(1);
  });

  it("averages only graded percentages and handles empty input", () => {
    expect(averagePercentage([])).toBeNull();
    expect(averagePercentage([80, 70])).toBe(75);
    expect(averagePercentage([70, 70, 70])).toBe(70);
  });

  it("never counts hidden scores in the student summary", () => {
    const summary = computeStudentSummary({
      resourceCount: 4,
      overview: [
        {
          attempts_used: 1,
          in_progress_attempt_id: null,
          last_percentage: 90,
          result_visible: true,
          manual_review_status: "completed",
          last_attempt_id: "a1",
          last_submitted_at: "2026-11-10T10:00:00Z",
        },
        {
          attempts_used: 1,
          in_progress_attempt_id: null,
          last_percentage: 100,
          result_visible: false,
          manual_review_status: "completed",
          last_attempt_id: "a2",
          last_submitted_at: "2026-11-11T10:00:00Z",
        },
        {
          attempts_used: 0,
          in_progress_attempt_id: "a3",
          last_percentage: null,
          result_visible: false,
          manual_review_status: "pending",
          last_attempt_id: null,
          last_submitted_at: null,
        },
      ],
    });

    expect(summary.availableResources).toBe(4);
    expect(summary.availableAssessments).toBe(3);
    expect(summary.completedAssessments).toBe(2);
    expect(summary.pendingAssessments).toBe(1);
    expect(summary.inProgressAssessments).toBe(1);
    expect(summary.visibleScores).toBe(1);
    expect(summary.averageVisiblePercentage).toBe(90);
    expect(summary.pendingReview).toBe(1);
  });
});
