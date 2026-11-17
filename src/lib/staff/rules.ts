import type { StaffRole, UserRole } from "@/lib/domain/roles";
import type { StaffErrorCode } from "@/lib/validation/staff";

/**
 * Pure staff-authorization rules. The database trigger is the final authority;
 * these helpers keep the UI and server actions consistent with it and make the
 * rules directly testable.
 */

export type StaffDecision =
  | { allowed: true }
  | { allowed: false; error: StaffErrorCode };

export function canAccessStaffArea(
  role: UserRole | null | undefined,
): boolean {
  return role === "admin";
}

export function isStaffRoleValue(
  role: UserRole | null | undefined,
): role is StaffRole {
  return role === "teacher" || role === "admin";
}

export function evaluateStaffRoleChange(input: {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
  targetRole: StaffRole;
  targetIsActive: boolean;
  nextRole: StaffRole;
  otherActiveAdmins: number;
}): StaffDecision {
  if (input.actorRole !== "admin") {
    return { allowed: false, error: "forbidden" };
  }

  if (!isStaffRoleValue(input.targetRole)) {
    return { allowed: false, error: "not_staff" };
  }

  if (input.actorId === input.targetId) {
    return { allowed: false, error: "self_role_change_forbidden" };
  }

  if (input.targetRole === input.nextRole) {
    return { allowed: true };
  }

  if (
    input.targetRole === "admin" &&
    input.targetIsActive &&
    input.nextRole !== "admin" &&
    input.otherActiveAdmins < 1
  ) {
    return { allowed: false, error: "last_admin_protected" };
  }

  return { allowed: true };
}

export function evaluateStaffActivation(input: {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
  targetRole: StaffRole;
  targetIsActive: boolean;
  nextIsActive: boolean;
  otherActiveAdmins: number;
}): StaffDecision {
  if (input.actorRole !== "admin") {
    return { allowed: false, error: "forbidden" };
  }

  if (!isStaffRoleValue(input.targetRole)) {
    return { allowed: false, error: "not_staff" };
  }

  if (
    input.targetRole === "admin" &&
    input.targetIsActive &&
    !input.nextIsActive
  ) {
    if (input.actorId === input.targetId) {
      return { allowed: false, error: "self_deactivation_forbidden" };
    }

    if (input.otherActiveAdmins < 1) {
      return { allowed: false, error: "last_admin_protected" };
    }
  }

  return { allowed: true };
}
