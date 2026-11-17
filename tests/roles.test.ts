import { describe, expect, it } from "vitest";
import {
  canAccessArea,
  dashboardPathForRole,
  isStaffRole,
  isStudentRole,
} from "@/lib/domain/roles";

describe("role routing", () => {
  it("sends teachers and admins to the teacher area", () => {
    expect(dashboardPathForRole("teacher")).toBe("/teacher");
    expect(dashboardPathForRole("admin")).toBe("/teacher");
  });

  it("sends students to the student area", () => {
    expect(dashboardPathForRole("student")).toBe("/student");
  });

  it("distinguishes staff from students", () => {
    expect(isStaffRole("teacher")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("student")).toBe(false);
    expect(isStudentRole("student")).toBe(true);
  });

  it("prevents cross-area access", () => {
    expect(canAccessArea("student", "teacher")).toBe(false);
    expect(canAccessArea("teacher", "student")).toBe(false);
    expect(canAccessArea("student", "student")).toBe(true);
    expect(canAccessArea("admin", "teacher")).toBe(true);
  });
});
