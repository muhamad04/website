import { describe, expect, it } from "vitest";
import {
  buildResourceQuery,
  hasResourceFilters,
  parseResourceFilters,
  type ResourceFilters,
} from "@/lib/resources/filters";

const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "44000000-0000-4000-8000-000000000001";

const defaults: ResourceFilters = {
  search: null,
  gradeId: null,
  categoryId: null,
  type: "all",
  status: "all",
  page: 1,
};

describe("resource filters", () => {
  it("parses empty params into safe defaults", () => {
    expect(parseResourceFilters({})).toEqual(defaults);
  });

  it("takes the first value when a param is repeated", () => {
    const filters = parseResourceFilters({
      q: ["grammar", "reading"],
      type: ["pdf", "youtube"],
      status: ["draft", "published"],
    });

    expect(filters.search).toBe("grammar");
    expect(filters.type).toBe("pdf");
    expect(filters.status).toBe("draft");
  });

  it("ignores malformed grades, categories, types, statuses and pages", () => {
    const filters = parseResourceFilters({
      grade: "not-a-uuid",
      category: "123",
      type: "video",
      status: "archived",
      page: "-4",
    });

    expect(filters.gradeId).toBeNull();
    expect(filters.categoryId).toBeNull();
    expect(filters.type).toBe("all");
    expect(filters.status).toBe("all");
    expect(filters.page).toBe(1);
  });

  it("forces status to all when the student surface disables it", () => {
    const filters = parseResourceFilters(
      { status: "draft", type: "image" },
      { allowStatus: false },
    );

    expect(filters.status).toBe("all");
    expect(filters.type).toBe("image");
  });

  it("sanitises PostgREST syntax out of the search term", () => {
    const filters = parseResourceFilters({ q: "  grammar, (unit).*  " });

    expect(filters.search).toBe("grammar unit");
  });

  it("serialises only active filters", () => {
    expect(buildResourceQuery(defaults)).toBe("");

    const filters: ResourceFilters = {
      search: "grammar",
      gradeId: GRADE_ID,
      categoryId: CATEGORY_ID,
      type: "pdf",
      status: "draft",
      page: 2,
    };

    expect(buildResourceQuery(filters)).toBe(
      `?q=grammar&grade=${GRADE_ID}&category=${CATEGORY_ID}&type=pdf&status=draft&page=2`,
    );
  });

  it("omits the page when a page override falls back to the first page", () => {
    const filters: ResourceFilters = { ...defaults, page: 3 };

    expect(buildResourceQuery(filters, { page: 1 })).toBe("");
  });

  it("can omit the staff-only grade and status params", () => {
    const filters: ResourceFilters = {
      ...defaults,
      gradeId: GRADE_ID,
      status: "draft",
      page: 2,
    };

    expect(
      buildResourceQuery(
        filters,
        {},
        { includeStatus: false, includeGrade: false },
      ),
    ).toBe("?page=2");
  });

  it("detects whether any filter is active", () => {
    expect(hasResourceFilters(defaults)).toBe(false);
    expect(hasResourceFilters({ ...defaults, search: "x" })).toBe(true);
    expect(hasResourceFilters({ ...defaults, type: "pdf" })).toBe(true);
    expect(hasResourceFilters({ ...defaults, status: "draft" })).toBe(true);
  });
});
