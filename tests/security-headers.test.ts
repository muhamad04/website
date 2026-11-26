import { describe, expect, it } from "vitest";
import { securityHeaders } from "../next.config";

function headerMap(headers: Array<{ key: string; value: string }>) {
  return new Map(headers.map((header) => [header.key, header.value]));
}

describe("security headers", () => {
  it("sets the baseline headers in development", () => {
    const headers = headerMap(securityHeaders(false));

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Permissions-Policy")).toContain("microphone=()");
    expect(headers.get("Permissions-Policy")).toContain("geolocation=()");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });

  it("adds HSTS only in production", () => {
    const production = headerMap(securityHeaders(true));

    expect(production.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });

  it("uses a scoped CSP with clickjacking protection", () => {
    const csp = headerMap(securityHeaders(true)).get(
      "Content-Security-Policy",
    );

    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("wss://*.supabase.co");
    expect(csp).toContain("https://www.youtube-nocookie.com");
    expect(csp).toContain("https://i.ytimg.com");
    expect(csp).toContain("upgrade-insecure-requests");
    // Development-only escape hatch must not leak into production.
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("keeps development's eval escape hatch scoped to development", () => {
    const csp = headerMap(securityHeaders(false)).get(
      "Content-Security-Policy",
    );

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
