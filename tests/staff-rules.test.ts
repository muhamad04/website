import { describe, expect, it } from "vitest";
import {
  canAccessStaffArea,
  evaluateStaffActivation,
  evaluateStaffRoleChange,
  isStaffRoleValue,
} from "@/lib/staff/rules";

const ADMIN_ID = "admin-1";
const TEACHER_ID = "teacher-1";

describe("staff authorization rules", () => {
  it("allows only admins into the staff area", () => {
    expect(canAccessStaffArea("admin")).toBe(true);
    expect(canAccessStaffArea("teacher")).toBe(false);
    expect(canAccessStaffArea("student")).toBe(false);
    expect(canAccessStaffArea(null)).toBe(false);
  });

  it("recognises only staff roles", () => {
    expect(isStaffRoleValue("teacher")).toBe(true);
    expect(isStaffRoleValue("admin")).toBe(true);
    expect(isStaffRoleValue("student")).toBe(false);
  });

  it("denies teachers and students even if they call an action directly", () => {
    for (const actorRole of ["teacher", "student"] as const) {
      const roleChange = evaluateStaffRoleChange({
        actorId: actorRole,
        actorRole,
        targetId: TEACHER_ID,
        targetRole: "teacher",
        targetIsActive: true,
        nextRole: "admin",
        otherActiveAdmins: 5,
      });
      const activation = evaluateStaffActivation({
        actorId: actorRole,
        actorRole,
        targetId: TEACHER_ID,
        targetRole: "teacher",
        targetIsActive: true,
        nextIsActive: false,
        otherActiveAdmins: 5,
      });

      expect(roleChange).toEqual({ allowed: false, error: "forbidden" });
      expect(activation).toEqual({ allowed: false, error: "forbidden" });
    }
  });

  it("blocks an admin from changing their own role", () => {
    expect(
      evaluateStaffRoleChange({
        actorId: ADMIN_ID,
        actorRole: "admin",
        targetId: ADMIN_ID,
        targetRole: "admin",
        targetIsActive: true,
        nextRole: "teacher",
        otherActiveAdmins: 5,
      }),
    ).toEqual({ allowed: false, error: "self_role_change_forbidden" });
  });

  it("blocks an admin from deactivating their own account", () => {
    expect(
      evaluateStaffActivation({
        actorId: ADMIN_ID,
        actorRole: "admin",
        targetId: ADMIN_ID,
        targetRole: "admin",
        targetIsActive: true,
        nextIsActive: false,
        otherActiveAdmins: 5,
      }),
    ).toEqual({ allowed: false, error: "self_deactivation_forbidden" });
  });

  it("protects the last active admin from demotion and deactivation", () => {
    expect(
      evaluateStaffRoleChange({
        actorId: ADMIN_ID,
        actorRole: "admin",
        targetId: "other-admin",
        targetRole: "admin",
        targetIsActive: true,
        nextRole: "teacher",
        otherActiveAdmins: 0,
      }),
    ).toEqual({ allowed: false, error: "last_admin_protected" });

    expect(
      evaluateStaffActivation({
        actorId: ADMIN_ID,
        actorRole: "admin",
        targetId: "other-admin",
        targetRole: "admin",
        targetIsActive: true,
        nextIsActive: false,
        otherActiveAdmins: 0,
      }),
    ).toEqual({ allowed: false, error: "last_admin_protected" });
  });

  it("allows an admin change when another active admin remains", () => {
    expect(
      evaluateStaffRoleChange({
        actorId: ADMIN_ID,
        actorRole: "admin",
        targetId: "other-admin",
        targetRole: "admin",
        targetIsActive: true,
        nextRole: "teacher",
        otherActiveAdmins: 1,
      }),
    ).toEqual({ allowed: true });

    expect(
      evaluateStaffActivation({
        actorId: ADMIN_ID,
        actorRole: "admin",
        targetId: "other-admin",
        targetRole: "admin",
        targetIsActive: true,
        nextIsActive: false,
        otherActiveAdmins: 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("allows teacher changes without a last-admin check", () => {
    expect(
      evaluateStaffRoleChange({
        actorId: ADMIN_ID,
        actorRole: "admin",
        targetId: TEACHER_ID,
        targetRole: "teacher",
        targetIsActive: true,
        nextRole: "admin",
        otherActiveAdmins: 0,
      }),
    ).toEqual({ allowed: true });

    expect(
      evaluateStaffActivation({
        actorId: ADMIN_ID,
        actorRole: "admin",
        targetId: TEACHER_ID,
        targetRole: "teacher",
        targetIsActive: true,
        nextIsActive: false,
        otherActiveAdmins: 0,
      }),
    ).toEqual({ allowed: true });
  });

  it("treats an unchanged role as a safe no-op", () => {
    expect(
      evaluateStaffRoleChange({
        actorId: ADMIN_ID,
        actorRole: "admin",
        targetId: TEACHER_ID,
        targetRole: "teacher",
        targetIsActive: true,
        nextRole: "teacher",
        otherActiveAdmins: 0,
      }),
    ).toEqual({ allowed: true });
  });
});
