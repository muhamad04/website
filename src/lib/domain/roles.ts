export const USER_ROLES = ["teacher", "admin", "student"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type StaffRole = Extract<UserRole, "teacher" | "admin">;

export function isStaffRole(role: UserRole): role is StaffRole {
  return role === "teacher" || role === "admin";
}

export function isStudentRole(role: UserRole): role is "student" {
  return role === "student";
}

/** Role-aware landing page used after login and at the site root. */
export function dashboardPathForRole(role: UserRole): string {
  return isStaffRole(role) ? "/teacher" : "/student";
}

export type AppArea = "teacher" | "student";

export function canAccessArea(role: UserRole, area: AppArea): boolean {
  return area === "teacher" ? isStaffRole(role) : isStudentRole(role);
}

export function roleLabelKey(role: UserRole): "teacher" | "admin" | "student" {
  return role;
}
