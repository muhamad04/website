/**
 * Shared field-error helpers. Server actions return stable codes in
 * `fieldErrors`, and the UI maps each code to bilingual copy.
 */

export type FieldErrors = Record<string, string>;

export function fieldErrorsFrom(
  issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }>,
): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!(key in errors)) {
      errors[key] = issue.message;
    }
  }

  return errors;
}
