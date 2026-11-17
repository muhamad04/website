/**
 * Student ID rules shared by login, provisioning and validation.
 *
 * A student ID is the only identifier a student needs at sign-in. It is
 * normalised the same way here and in the database (trim + lower-case), and it
 * is restricted to characters that are safe inside a private Auth e-mail
 * local-part. The internal e-mail itself is derived server-side only.
 */

export const STUDENT_ID_MIN_LENGTH = 2;
export const STUDENT_ID_MAX_LENGTH = 40;

/**
 * First and last characters must be letters or digits so the derived internal
 * e-mail never starts or ends its local-part with a dot, dash or underscore.
 * Consecutive dots are rejected for the same reason.
 */
export const STUDENT_ID_PATTERN =
  /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

/** Display/storage form: Unicode-normalised and trimmed, original case kept. */
export function canonicalStudentId(value: string): string {
  return value.normalize("NFKC").trim();
}

/**
 * Lookup/login form. Matches the database's generated column expression
 * `lower(btrim(student_number))` after canonicalisation.
 */
export function normaliseStudentId(value: string): string {
  return canonicalStudentId(value).toLowerCase();
}

export function isValidStudentId(value: string): boolean {
  const canonical = canonicalStudentId(value);

  return (
    canonical.length >= STUDENT_ID_MIN_LENGTH &&
    canonical.length <= STUDENT_ID_MAX_LENGTH &&
    STUDENT_ID_PATTERN.test(canonical)
  );
}
