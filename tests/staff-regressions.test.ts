import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loginSchema } from "@/lib/validation/auth";
import { studentAuthEmail } from "@/lib/auth/student-identity";
import { parseResourceFilters } from "@/lib/resources/filters";
import { gradeObjectiveAnswer } from "@/lib/assessments/grading";
import { buildCsv } from "@/lib/reporting/csv";
import { computeStudentSummary } from "@/lib/reporting/aggregates";
import { canAccessStaffArea } from "@/lib/staff/rules";

/**
 * Guard rails for the staff feature's regressions. The full suites for each
 * area remain in their own test files; these checks assert that the staff
 * work did not alter the student/resource/assessment/reporting contracts.
 */
describe("staff feature regressions", () => {
  it("keeps student sign-in independent of email", () => {
    expect(studentAuthEmail("G10-001")).toBe(
      "student-g10-001@accounts.internal",
    );
    expect(studentAuthEmail("  G10-001  ")).toBe(
      "student-g10-001@accounts.internal",
    );
    expect(studentAuthEmail("")).toBeNull();

    const student = loginSchema.safeParse({
      mode: "student",
      student_id: "G10-001",
      password: "Student123!",
    });
    const staff = loginSchema.safeParse({
      mode: "staff",
      email: "Teacher@Example.com",
      password: "Staff123!",
    });

    expect(student.success).toBe(true);
    expect(staff.success).toBe(true);
    if (staff.success && staff.data.mode !== "student") {
      expect(staff.data.email).toBe("Teacher@Example.com");
    }
  });

  it("never lets a student or teacher reach the staff surface", () => {
    expect(canAccessStaffArea("student")).toBe(false);
    expect(canAccessStaffArea("teacher")).toBe(false);
    expect(canAccessStaffArea("admin")).toBe(true);
  });

  it("keeps resource filters stable for the student surface", () => {
    const filters = parseResourceFilters(
      { status: "inactive" },
      { allowStatus: false },
    );

    expect(filters.status).toBe("all");
    expect(filters.page).toBe(1);
  });

  it("keeps objective grading unchanged", () => {
    const correct = gradeObjectiveAnswer(
      {
        id: "q1",
        type: "multiple_choice",
        marks: 2,
        grading_method: "automatic",
        correct_answer: { value: true },
        options: [
          { id: "opt-wrong", is_correct: false },
          { id: "opt-right", is_correct: true },
        ],
        pairs: [],
      },
      { selectedOptionId: "opt-right" },
    );

    expect(correct).toBe(true);
  });

  it("keeps hidden results out of the student summary", () => {
    const summary = computeStudentSummary({
      resourceCount: 1,
      overview: [
        {
          attempts_used: 1,
          in_progress_attempt_id: null,
          last_percentage: 90,
          result_visible: false,
          manual_review_status: "completed",
          last_attempt_id: "attempt-hidden",
          last_submitted_at: "2026-11-15T10:00:00Z",
        },
      ],
    });

    expect(summary.averageVisiblePercentage).toBeNull();
    expect(summary.visibleScores).toBe(0);
  });

  it("keeps CSV export escaping and formula neutralisation", () => {
    const csv = buildCsv(
      ["Name", "Score"],
      [
        ["Sara, Ahmed", 10],
        ["=SUM(A1)", 20],
      ],
    );

    expect(csv).toContain('"Sara, Ahmed"');
    expect(csv).toContain("'=SUM(A1)");
  });
});
