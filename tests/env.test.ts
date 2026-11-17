import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabasePublicConfig } from "@/lib/env";

const SUPABASE_URL = "https://example.supabase.co";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase public configuration", () => {
  it("reads the current publishable key name", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    expect(getSupabasePublicConfig()).toEqual({
      url: SUPABASE_URL,
      publishableKey: "sb_publishable_test",
    });
  });

  it("falls back to the legacy anon key name", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-anon-key");

    expect(getSupabasePublicConfig()).toEqual({
      url: SUPABASE_URL,
      publishableKey: "legacy-anon-key",
    });
  });

  it("prefers the publishable key when both names are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy");

    expect(getSupabasePublicConfig()?.publishableKey).toBe("publishable");
  });

  it("returns null when the URL or a key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getSupabasePublicConfig()).toBeNull();

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");
    expect(getSupabasePublicConfig()).toBeNull();
  });

  it("rejects non-HTTP URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "javascript:alert(1)");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");

    expect(getSupabasePublicConfig()).toBeNull();
  });
});
