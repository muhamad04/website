import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  signInError: null as { code: string; message: string; status: number } | null,
  userId: "user-1" as string | null,
  profile: null as { role: string; is_active: boolean } | null,
  profileError: null as { message: string } | null,
  signInEmail: null as string | null,
  signInPassword: null as string | null,
  signOutCalls: 0,
  retryAfter: 0,
  throttleRecords: [] as Array<{ succeeded: boolean }>,
  throttleChecks: 0,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/throttle", () => ({
  buildLoginThrottleKeys: ({
    mode,
    identifier,
    ip,
  }: {
    mode: string;
    identifier: string;
    ip: string | null;
  }) => ({
    identifierKey: `${mode}:${identifier}`,
    ipKey: ip ? `ip:${ip}` : null,
  }),
  checkLoginThrottle: async () => {
    state.throttleChecks += 1;
    return state.retryAfter;
  },
  getClientIp: async () => "203.0.113.10",
  recordLoginAttempt: async (
    _keys: unknown,
    succeeded: boolean,
  ) => {
    state.throttleRecords.push({ succeeded });
  },
}));

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: () => state.configured,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async ({
        email,
        password,
      }: {
        email: string;
        password: string;
      }) => {
        state.signInEmail = email;
        state.signInPassword = password;
        return {
          data: { user: state.userId ? { id: state.userId } : null },
          error: state.signInError,
        };
      },
      signOut: async () => {
        state.signOutCalls += 1;
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: state.profile,
            error: state.profileError,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

import { signInAction } from "@/lib/auth/actions";

beforeEach(() => {
  state.configured = true;
  state.signInError = null;
  state.userId = "user-1";
  state.profile = { role: "student", is_active: true };
  state.profileError = null;
  state.signInEmail = null;
  state.signInPassword = null;
  state.signOutCalls = 0;
  state.retryAfter = 0;
  state.throttleRecords = [];
  state.throttleChecks = 0;
});

describe("student ID sign-in", () => {
  it("maps a Student ID to the private Auth address and redirects to /student", async () => {
    await expect(
      signInAction({
        mode: "student",
        student_id: "  G10-001  ",
        password: "Student123!",
      }),
    ).rejects.toThrow("redirect:/student");

    expect(state.signInEmail).toBe("student-g10-001@accounts.internal");
    expect(state.signInPassword).toBe("Student123!");
  });

  it("does not require or accept a student email", async () => {
    await expect(
      signInAction({
        mode: "student",
        student_id: "G10-001",
        password: "Student123!",
        email: "sara@example.com",
      }),
    ).rejects.toThrow("redirect:/student");

    expect(state.signInEmail).toBe("student-g10-001@accounts.internal");
  });

  it("returns a generic error for a wrong password and never echoes the identifier", async () => {
    state.signInError = {
      code: "invalid_credentials",
      message: "Invalid login credentials",
      status: 400,
    };
    state.userId = null;

    const result = await signInAction({
      mode: "student",
      student_id: "G10-001",
      password: "wrong-password",
    });

    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
    expect(JSON.stringify(result)).not.toContain("accounts.internal");
    expect(JSON.stringify(result)).not.toContain("wrong-password");
  });

  it("rejects a deactivated student with the same generic error as a wrong password", async () => {
    state.profile = { role: "student", is_active: false };

    const result = await signInAction({
      mode: "student",
      student_id: "G10-002",
      password: "Student123!",
    });

    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
    expect(state.signOutCalls).toBe(1);
    expect(state.throttleRecords).toEqual([{ succeeded: true }]);
  });

  it("does not let a student sign in through the staff tab", async () => {
    const result = await signInAction({
      mode: "staff",
      email: "sara@example.com",
      password: "Student123!",
    });

    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
    expect(state.signOutCalls).toBe(1);
  });

  it("does not let staff sign in through the student tab", async () => {
    state.profile = { role: "admin", is_active: true };

    const result = await signInAction({
      mode: "student",
      student_id: "G10-001",
      password: "Teacher123!",
    });

    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
    expect(state.signOutCalls).toBe(1);
  });

  it("fails validation before touching Supabase", async () => {
    const result = await signInAction({
      mode: "student",
      student_id: "not a valid id",
      password: "Student123!",
    });

    expect(result).toEqual({ ok: false, error: "validation_failed" });
    expect(state.signInEmail).toBeNull();
  });
});

describe("staff email sign-in", () => {
  it("keeps email login and the admin landing page unchanged", async () => {
    state.profile = { role: "admin", is_active: true };

    await expect(
      signInAction({
        mode: "staff",
        email: "ma2034816@gmail.com",
        password: "AdminPass123!",
      }),
    ).rejects.toThrow("redirect:/teacher");

    expect(state.signInEmail).toBe("ma2034816@gmail.com");
  });

  it("rejects an inactive staff account with the generic error", async () => {
    state.profile = { role: "teacher", is_active: false };

    const result = await signInAction({
      mode: "staff",
      email: "teacher@example.com",
      password: "Teacher123!",
    });

    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
  });
});

describe("login throttling", () => {
  it("stops before calling Supabase while a throttle is active", async () => {
    state.retryAfter = 30;

    const result = await signInAction({
      mode: "student",
      student_id: "G10-001",
      password: "Student123!",
    });

    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(state.throttleChecks).toBe(1);
    expect(state.signInEmail).toBeNull();
  });

  it("records a failed attempt without leaking the identifier", async () => {
    state.signInError = {
      code: "invalid_credentials",
      message: "Invalid login credentials",
      status: 400,
    };
    state.userId = null;

    const result = await signInAction({
      mode: "student",
      student_id: "G10-001",
      password: "wrong-password",
    });

    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
    expect(state.throttleRecords).toEqual([{ succeeded: false }]);
    expect(JSON.stringify(result)).not.toContain("G10-001");
  });
});
