import { describe, expect, it } from "vitest";
import { hardenedAuthCookieOptions } from "@/lib/supabase/cookies";

describe("Supabase auth cookie hardening", () => {
  it("forces Secure in production", () => {
    const options = hardenedAuthCookieOptions({ secure: false }, true);

    expect(options.secure).toBe(true);
    expect(options.path).toBe("/");
    expect(options.sameSite).toBe("lax");
  });

  it("keeps local HTTP development usable", () => {
    const options = hardenedAuthCookieOptions({}, false);

    expect(options.secure).toBe(false);
    expect(options.path).toBe("/");
    expect(options.sameSite).toBe("lax");
  });

  it("does not make the session cookie HttpOnly", () => {
    // The browser Supabase client reads this cookie for direct Storage
    // uploads; making it HttpOnly would break signed uploads.
    const options = hardenedAuthCookieOptions({}, true);

    expect(options.httpOnly).toBe(false);
  });

  it("preserves a library-provided SameSite policy", () => {
    const options = hardenedAuthCookieOptions(
      { sameSite: "strict", path: "/app" },
      true,
    );

    expect(options.sameSite).toBe("strict");
    expect(options.path).toBe("/app");
  });
});
