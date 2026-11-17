import { describe, expect, it, vi } from "vitest";

// The identity module is server-only in the app; the test runtime uses the
// marker package's empty export so the pure derivation can be exercised.
vi.mock("server-only", () => ({}));

import {
  isInternalStudentEmail,
  studentAuthEmail,
} from "@/lib/auth/student-identity";

describe("private student auth identity", () => {
  it("derives a deterministic internal address from a Student ID", () => {
    expect(studentAuthEmail("G10-001")).toBe(
      "student-g10-001@accounts.internal",
    );
    expect(studentAuthEmail("  g10-001  ")).toBe(
      "student-g10-001@accounts.internal",
    );
  });

  it("never collides for IDs that differ after normalisation", () => {
    expect(studentAuthEmail("A-1")).not.toBe(studentAuthEmail("A-2"));
    expect(studentAuthEmail("student-A-1")).not.toBe(
      studentAuthEmail("A-1"),
    );
  });

  it("rejects unsafe or empty IDs instead of inventing an address", () => {
    expect(studentAuthEmail("")).toBeNull();
    expect(studentAuthEmail("a b")).toBeNull();
    expect(studentAuthEmail("a/b")).toBeNull();
    expect(studentAuthEmail("a".repeat(41))).toBeNull();
  });

  it("recognises the private domain without exposing it elsewhere", () => {
    expect(isInternalStudentEmail("student-x@accounts.internal")).toBe(true);
    expect(isInternalStudentEmail("Student-X@Accounts.Internal")).toBe(true);
    expect(isInternalStudentEmail("sara@example.com")).toBe(false);
  });
});
