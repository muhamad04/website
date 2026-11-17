/**
 * Server-component clock helpers.
 *
 * `Date.now()` inside a component body trips the React purity lint rule even
 * for server components, so every "is this open / expired?" check reads the
 * clock through these small helpers instead.
 */

export function nowMs(): number {
  return Date.now();
}

export function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
