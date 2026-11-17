import { describe, expect, it } from "vitest";
import {
  buildSubmissionPath,
  isAllowedSubmissionMime,
  isSubmissionPathFor,
  sanitizeSubmissionFileName,
} from "@/lib/assessments/files";
import {
  buildAssessmentQuery,
  buildStudentAssessmentQuery,
  hasAssessmentFilters,
  parseAssessmentFilters,
  parseStudentAssessmentFilters,
} from "@/lib/assessments/filters";

const STUDENT_ID = "77000000-0000-4000-8000-000000000001";
const ATTEMPT_ID = "88000000-0000-4000-8000-000000000001";

describe("submission file rules", () => {
  it("allows only the documented MIME types", () => {
    for (const mime of [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]) {
      expect(isAllowedSubmissionMime(mime)).toBe(true);
    }

    expect(isAllowedSubmissionMime("IMAGE/PNG")).toBe(true);
    expect(isAllowedSubmissionMime("application/zip")).toBe(false);
    expect(isAllowedSubmissionMime("image/gif")).toBe(false);
  });

  it("sanitizes names and keeps the extension", () => {
    expect(sanitizeSubmissionFileName("../../My Essay (final).pdf")).toBe(
      "My-Essay-final-.pdf",
    );
    expect(sanitizeSubmissionFileName("")).toBe("file");
    expect(sanitizeSubmissionFileName("...")).toBe("file");
  });

  it("builds and checks the student/attempt path prefix", () => {
    const path = buildSubmissionPath({
      studentId: STUDENT_ID,
      attemptId: ATTEMPT_ID,
      fileName: "answer.pdf",
      unique: "abcd1234",
    });

    expect(path).toBe(`${STUDENT_ID}/${ATTEMPT_ID}/abcd1234-answer.pdf`);
    expect(isSubmissionPathFor(path, STUDENT_ID, ATTEMPT_ID)).toBe(true);
    expect(isSubmissionPathFor(path, STUDENT_ID, "other")).toBe(false);
    expect(isSubmissionPathFor(path, "other", ATTEMPT_ID)).toBe(false);
  });
});

describe("assessment filters", () => {
  it("parses and clamps query values", () => {
    const filters = parseAssessmentFilters({
      q: "  unit 3  ",
      grade: " grade-id ",
      type: "EXAM",
      status: "published",
      page: "3",
    });

    expect(filters).toEqual({
      search: "unit 3",
      gradeId: "grade-id",
      type: "exam",
      status: "published",
      page: 3,
    });

    expect(
      parseAssessmentFilters({ type: "nope", status: "nope", page: "-2" }),
    ).toEqual({
      search: "",
      gradeId: "",
      type: "all",
      status: "all",
      page: 1,
    });
  });

  it("builds stable query strings and detects active filters", () => {
    const filters = {
      search: "unit",
      gradeId: "grade-id",
      type: "quiz" as const,
      status: "draft" as const,
      page: 2,
    };

    expect(hasAssessmentFilters(filters)).toBe(true);
    expect(buildAssessmentQuery(filters)).toBe(
      "?q=unit&grade=grade-id&type=quiz&status=draft&page=2",
    );
    expect(buildAssessmentQuery(filters, { page: 1 })).toBe(
      "?q=unit&grade=grade-id&type=quiz&status=draft",
    );
    expect(
      hasAssessmentFilters({
        search: "",
        gradeId: "",
        type: "all",
        status: "all",
        page: 1,
      }),
    ).toBe(false);
  });

  it("parses student type and view filters", () => {
    expect(parseStudentAssessmentFilters({ type: "quiz", view: "completed" })).toEqual({
      type: "quiz",
      view: "completed",
    });

    expect(parseStudentAssessmentFilters({ type: "bad", view: "bad" })).toEqual({
      type: "all",
      view: "all",
    });

    expect(
      buildStudentAssessmentQuery({ type: "exam", view: "all" }),
    ).toBe("?type=exam");
    expect(
      buildStudentAssessmentQuery(
        { type: "exam", view: "completed" },
        { type: "all" },
      ),
    ).toBe("?view=completed");
  });
});
