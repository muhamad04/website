import "server-only";

import {
  isValidStudentId,
  normaliseStudentId,
} from "@/lib/validation/student-id";

/**
 * Private Supabase Auth identity for students.
 *
 * Supabase password auth requires an e-mail-shaped identifier, so a student ID
 * is deterministically mapped to a non-routable internal address. This value is
 * never stored in `public.profiles`, never rendered in the UI and never sent to
 * Google Sheets. Only server-side code imports this module.
 */

export const STUDENT_AUTH_EMAIL_DOMAIN = "accounts.internal";

export function studentAuthEmail(studentId: string): string | null {
  const normalised = normaliseStudentId(studentId);

  if (!isValidStudentId(normalised)) {
    return null;
  }

  return `student-${normalised}@${STUDENT_AUTH_EMAIL_DOMAIN}`;
}

export function isInternalStudentEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${STUDENT_AUTH_EMAIL_DOMAIN}`);
}
