/**
 * New-password policy shared by account creation and password reset.
 *
 * Sign-in deliberately keeps the old, shorter floor so students with existing
 * passwords can still log in. The stronger rules apply only when a password is
 * created or changed.
 *
 * The policy follows current NIST guidance: length matters more than forced
 * character classes, so there is no "must contain a symbol" rule. Instead a
 * small blocklist, repetition checks and sequence checks reject the passwords
 * that actually get guessed.
 */

export const NEW_PASSWORD_MIN_LENGTH = 10;
export const NEW_PASSWORD_MAX_LENGTH = 200;

export type NewPasswordIssue =
  | "password_required"
  | "password_short"
  | "password_too_long"
  | "password_weak";

const COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678910",
  "password",
  "password1",
  "password123",
  "passw0rd",
  "qwertyuiop",
  "qwerty123",
  "iloveyou",
  "welcome",
  "welcome1",
  "letmein",
  "admin123",
  "student",
  "student123",
  "teacher",
  "teacher123",
  "school123",
  "football",
  "baseball",
  "sunshine",
  "princess",
  "dragon123",
  "monkey123",
  "abc123456",
  "aaaaaaaaaa",
  "1111111111",
]);

const SEQUENCES = [
  "abcdefghij",
  "0123456789",
  "1234567890",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
];

function isRepeatedCharacter(value: string): boolean {
  return value.length > 0 && /^(.)\1*$/.test(value);
}

function isSequence(value: string): boolean {
  const lower = value.toLowerCase();

  return SEQUENCES.some(
    (sequence) => lower === sequence || lower.includes(sequence),
  );
}

/**
 * Returns the first policy violation, or null when the password is acceptable.
 * The messages are stable codes; the UI renders them in both languages.
 */
export function newPasswordIssue(value: string): NewPasswordIssue | null {
  if (!value) {
    return "password_required";
  }

  if (value.length > NEW_PASSWORD_MAX_LENGTH) {
    return "password_too_long";
  }

  if (value.length < NEW_PASSWORD_MIN_LENGTH) {
    return "password_short";
  }

  const lower = value.toLowerCase();

  if (
    COMMON_PASSWORDS.has(lower) ||
    isRepeatedCharacter(value) ||
    isSequence(lower)
  ) {
    return "password_weak";
  }

  return null;
}

/** True when the password satisfies the create/reset policy. */
export function isStrongNewPassword(value: string): boolean {
  return newPasswordIssue(value) === null;
}
