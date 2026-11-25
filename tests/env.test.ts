import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabasePublicConfig } from "@/lib/env";
import { getOpenRouterConfig } from "@/lib/env.server";

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

describe("optional OpenRouter configuration", () => {
  it("is disabled with the documented defaults", () => {
    vi.stubEnv("ASSESSMENT_IMPORT_AI_ENABLED", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_MODEL", "");
    vi.stubEnv("OPENROUTER_MAX_REQUESTS_PER_IMPORT", "");
    vi.stubEnv("OPENROUTER_MAX_OUTPUT_TOKENS", "");
    vi.stubEnv("OPENROUTER_TIMEOUT_MS", "");

    expect(getOpenRouterConfig()).toEqual({
      enabled: false,
      apiKey: null,
      model: "openrouter/free",
      maxRequestsPerImport: 3,
      maxOutputTokens: 12_000,
      timeoutMs: 30_000,
    });
  });

  it("requires both the flag and a key to enable assistance", () => {
    vi.stubEnv("ASSESSMENT_IMPORT_AI_ENABLED", "TRUE");
    vi.stubEnv("OPENROUTER_API_KEY", "  sk-test  ");

    const config = getOpenRouterConfig();

    expect(config.enabled).toBe(true);
    expect(config.apiKey).toBe("sk-test");
  });

  it("clamps request, token and timeout limits", () => {
    vi.stubEnv("OPENROUTER_MAX_REQUESTS_PER_IMPORT", "999");
    vi.stubEnv("OPENROUTER_MAX_OUTPUT_TOKENS", "999999");
    vi.stubEnv("OPENROUTER_TIMEOUT_MS", "1");

    const config = getOpenRouterConfig();

    expect(config.maxRequestsPerImport).toBe(10);
    expect(config.maxOutputTokens).toBe(32_000);
    expect(config.timeoutMs).toBe(1);
  });
});
