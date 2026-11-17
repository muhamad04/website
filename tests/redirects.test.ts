import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/auth/redirects";

describe("safeInternalPath", () => {
  it("allows internal paths", () => {
    expect(safeInternalPath("/teacher")).toBe("/teacher");
    expect(safeInternalPath("/student?tab=results")).toBe(
      "/student?tab=results",
    );
  });

  it("uses the fallback for external or malformed paths", () => {
    expect(safeInternalPath("https://example.com")).toBe("/");
    expect(safeInternalPath("//example.com")).toBe("/");
    expect(safeInternalPath("/\\example.com")).toBe("/");
    expect(safeInternalPath("/path\nnext")).toBe("/");
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath(undefined, "/login")).toBe("/login");
  });

  it("trims whitespace before validating", () => {
    expect(safeInternalPath("  /teacher  ")).toBe("/teacher");
  });
});
