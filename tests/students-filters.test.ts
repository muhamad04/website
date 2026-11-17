import { describe, expect, it } from "vitest";
import {
  STUDENTS_PAGE_SIZE,
  buildStudentQuery,
  clampPage,
  parseStudentFilters,
  sanitizeSearchTerm,
  type StudentFilters,
} from "@/lib/students/filters";

const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const CLASS_ID = "22000000-0000-4000-8000-000000000001";

const defaults: StudentFilters = {
  search: null,
  gradeId: null,
  classId: null,
  status: "all",
  page: 1,
};

describe("student filters", () => {
  it("parses empty params into safe defaults", () => {
    expect(parseStudentFilters({})).toEqual(defaults);
  });

  it("takes the first value when a param is repeated", () => {
    const filters = parseStudentFilters({
      q: ["sara", "omar"],
      status: ["inactive", "active"],
    });

    expect(filters.search).toBe("sara");
    expect(filters.status).toBe("inactive");
  });

  it("ignores malformed grades, classes and pages", () => {
    const filters = parseStudentFilters({
      grade: "not-a-uuid",
      class: "123",
      page: "-4",
      status: "deleted",
    });

    expect(filters.gradeId).toBeNull();
    expect(filters.classId).toBeNull();
    expect(filters.page).toBe(1);
    expect(filters.status).toBe("all");
  });

  it("keeps well-formed uuid filters and the requested page", () => {
    const filters = parseStudentFilters({
      grade: GRADE_ID,
      class: CLASS_ID,
      page: "3",
      status: "active",
    });

    expect(filters.gradeId).toBe(GRADE_ID);
    expect(filters.classId).toBe(CLASS_ID);
    expect(filters.page).toBe(3);
    expect(filters.status).toBe("active");
  });

  it("strips PostgREST syntax out of search terms", () => {
    const term = sanitizeSearchTerm("  Sara, (x). % * : \" ' ; `  ");

    expect(term).not.toBeNull();
    expect(term).not.toMatch(/[%,().:*"'`;]/);
    expect(term).toBe("Sara x");
  });

  it("returns null for blank and oversized search terms", () => {
    expect(sanitizeSearchTerm("   ")).toBeNull();
    expect(sanitizeSearchTerm(undefined)).toBeNull();
    expect(sanitizeSearchTerm(null)).toBeNull();

    const long = sanitizeSearchTerm("a".repeat(200));
    expect(long).toHaveLength(60);
  });

  it("builds shareable pagination links without losing filters", () => {
    expect(buildStudentQuery(defaults)).toBe("");

    const filters: StudentFilters = {
      search: "sara",
      gradeId: GRADE_ID,
      classId: CLASS_ID,
      status: "inactive",
      page: 1,
    };

    const query = buildStudentQuery(filters);
    const params = new URLSearchParams(query);

    expect(params.get("q")).toBe("sara");
    expect(params.get("grade")).toBe(GRADE_ID);
    expect(params.get("class")).toBe(CLASS_ID);
    expect(params.get("status")).toBe("inactive");
    expect(params.get("page")).toBeNull();

    const second = new URLSearchParams(
      buildStudentQuery(filters, { page: 2 }),
    );
    expect(second.get("page")).toBe("2");
  });

  it("clamps pages into range", () => {
    expect(clampPage(1, 0)).toBe(1);
    expect(clampPage(-2, 4)).toBe(1);
    expect(clampPage(9, 4)).toBe(4);
    expect(clampPage(3, 4)).toBe(3);
  });

  it("uses a 15-row page size", () => {
    expect(STUDENTS_PAGE_SIZE).toBe(15);
  });
});
