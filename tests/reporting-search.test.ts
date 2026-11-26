import { describe, expect, it } from "vitest";
import {
  REPORT_SEARCH_MAX_LENGTH,
  buildStudentSearchFilter,
  parseReportFilters,
} from "@/lib/reporting/filters";
import {
  buildIlikeOrFilter,
  escapePostgrestFilterValue,
} from "@/lib/search";

const HOSTILE_INPUTS = [
  "sara,role.eq.admin",
  "a.b(c)",
  "x%\" OR \"1\"=\"1",
  "'; drop table profiles; --",
  "مرحبا، (اختبار)",
  "a\\b\"c,d.e(f)",
  "100%",
  "name.ilike.*",
  "one,two,three",
  "()",
];

describe("PostgREST search escaping", () => {
  it("quotes the whole value and escapes quotes and backslashes", () => {
    expect(escapePostgrestFilterValue('a",role.eq.admin')).toBe(
      '"a\\",role.eq.admin"',
    );
    expect(escapePostgrestFilterValue("a\\b")).toBe('"a\\\\b"');
    expect(escapePostgrestFilterValue("plain")).toBe('"plain"');
  });

  it("never lets hostile input add filter grammar", () => {
    for (const input of HOSTILE_INPUTS) {
      const filter = buildStudentSearchFilter(input);
      const quoted = escapePostgrestFilterValue(
        `%${input.slice(0, REPORT_SEARCH_MAX_LENGTH)}%`,
      );

      // The value appears exactly four times, always as one quoted literal.
      expect(filter.split(quoted)).toEqual([
        "full_name_en.ilike.",
        ",full_name_ar.ilike.",
        ",email.ilike.",
        ",student_number.ilike.",
        "",
      ]);

      // The only unquoted text is the four fixed column prefixes.
      expect(filter.replaceAll(quoted, "")).toBe(
        "full_name_en.ilike.,full_name_ar.ilike.,email.ilike.,student_number.ilike.",
      );
    }
  });

  it("cannot switch the queried column or operator", () => {
    const filter = buildStudentSearchFilter("x,role.eq.admin");
    const quoted = escapePostgrestFilterValue("%x,role.eq.admin%");

    expect(filter).not.toMatch(/^role/);
    expect(filter.match(/\.ilike\./g)).toHaveLength(4);
    // `.eq.` may appear inside the quoted search literal, but never as grammar.
    expect(filter.replaceAll(quoted, "")).not.toContain(".eq.");
  });

  it("caps the search length before building the filter", () => {
    const long = "a".repeat(REPORT_SEARCH_MAX_LENGTH + 500);
    const filter = buildStudentSearchFilter(long);

    expect(filter).toContain("a".repeat(REPORT_SEARCH_MAX_LENGTH));
    expect(filter).not.toContain("a".repeat(REPORT_SEARCH_MAX_LENGTH + 1));
  });

  it("caps the search length when parsing the query string", () => {
    const filters = parseReportFilters({
      q: "a".repeat(REPORT_SEARCH_MAX_LENGTH + 500),
    });

    expect(filters.search).toHaveLength(REPORT_SEARCH_MAX_LENGTH);
  });

  it("supports the fixed assessment columns with the same escaping", () => {
    const filter = buildIlikeOrFilter(
      ["title_en", "title_ar"],
      "x,role.eq.admin",
    );

    expect(filter.split(escapePostgrestFilterValue("%x,role.eq.admin%"))).toEqual([
      "title_en.ilike.",
      ",title_ar.ilike.",
      "",
    ]);
  });
});
