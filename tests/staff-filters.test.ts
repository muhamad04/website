import { describe, expect, it } from "vitest";
import {
  STAFF_PAGE_SIZE,
  buildStaffQuery,
  clampPage,
  hasStaffFilters,
  parseStaffFilters,
  sanitizeSearchTerm,
  type StaffFilters,
} from "@/lib/staff/filters";

const defaults: StaffFilters = {
  search: null,
  role: "all",
  status: "all",
  page: 1,
};

describe("staff filters", () => {
  it("parses empty params into safe defaults", () => {
    expect(parseStaffFilters({})).toEqual(defaults);
  });

  it("takes the first value when a param is repeated", () => {
    const filters = parseStaffFilters({
      q: ["nora", "omar"],
      role: ["admin", "teacher"],
      status: ["inactive", "active"],
    });

    expect(filters.search).toBe("nora");
    expect(filters.role).toBe("admin");
    expect(filters.status).toBe("inactive");
  });

  it("ignores malformed roles, statuses and pages", () => {
    const filters = parseStaffFilters({
      role: "student",
      status: "deleted",
      page: "-4",
    });

    expect(filters.role).toBe("all");
    expect(filters.status).toBe("all");
    expect(filters.page).toBe(1);
  });

  it("keeps well-formed filters and the requested page", () => {
    const filters = parseStaffFilters({
      role: "teacher",
      status: "active",
      page: "3",
    });

    expect(filters.role).toBe("teacher");
    expect(filters.status).toBe("active");
    expect(filters.page).toBe(3);
  });

  it("strips PostgREST syntax out of search terms", () => {
    const term = sanitizeSearchTerm("  Nora, (x). % * : \" ' ; `  ");

    expect(term).not.toBeNull();
    expect(term).not.toMatch(/[%,().:*"'`;]/);
    expect(term).toBe("Nora x");
  });

  it("builds shareable pagination links without losing filters", () => {
    expect(buildStaffQuery(defaults)).toBe("");

    const filters: StaffFilters = {
      search: "nora",
      role: "admin",
      status: "inactive",
      page: 1,
    };

    const query = buildStaffQuery(filters);
    const params = new URLSearchParams(query);

    expect(params.get("q")).toBe("nora");
    expect(params.get("role")).toBe("admin");
    expect(params.get("status")).toBe("inactive");
    expect(params.get("page")).toBeNull();

    const second = new URLSearchParams(
      buildStaffQuery(filters, { page: 2 }),
    );
    expect(second.get("page")).toBe("2");
  });

  it("detects whether any filter is active", () => {
    expect(hasStaffFilters(defaults)).toBe(false);
    expect(hasStaffFilters({ ...defaults, search: "nora" })).toBe(true);
    expect(hasStaffFilters({ ...defaults, role: "admin" })).toBe(true);
    expect(hasStaffFilters({ ...defaults, status: "inactive" })).toBe(true);
  });

  it("clamps pages into range and uses a 15-row page size", () => {
    expect(clampPage(1, 0)).toBe(1);
    expect(clampPage(-2, 4)).toBe(1);
    expect(clampPage(9, 4)).toBe(4);
    expect(STAFF_PAGE_SIZE).toBe(15);
  });
});
