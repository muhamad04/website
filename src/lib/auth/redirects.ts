/**
 * Only allow internal, single-slash paths as redirect targets. Blocks
 * protocol-relative URLs (//example.com) and backslash tricks.
 */
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback = "/",
): string {
  if (typeof candidate !== "string") {
    return fallback;
  }

  const value = candidate.trim();

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return fallback;
  }

  return value;
}
