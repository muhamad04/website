import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "33000000-0000-4000-8000-000000000011", role: "admin" } as {
    id: string;
    role: string;
  } | null,
  target: null as {
    id: string;
    role: "teacher" | "admin";
    is_active: boolean;
    email: string | null;
    full_name_en: string;
    full_name_ar: string | null;
  } | null,
  otherActiveAdmins: 1,
  emailsInUse: false,
  updates: [] as Record<string, unknown>[],
  audits: [] as Array<{
    actorId: string;
    staffId: string;
    action: string;
    detail: Record<string, unknown>;
  }>,
  createCalls: [] as Record<string, unknown>[],
  createResult: {
    ok: true,
    userId: "33000000-0000-4000-8000-000000000013",
    accessUrl: "https://example.test/setup",
  } as
    | { ok: true; userId: string; accessUrl: string | null }
    | { ok: false; error: string },
  resetResult: "https://example.test/reset" as string | null,
  authEmailCalls: [] as Array<{ userId: string; email: string }>,
  restoreEmailCalls: [] as Array<{ userId: string; email: string | null }>,
  metadataCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("@/lib/auth/dal", () => ({
  requireAdmin: async () => {
    if (!state.actor || state.actor.role !== "admin") {
      throw new Error("redirect:/teacher");
    }

    return { id: state.actor.id, role: "admin" };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => {
        const result = {
          data: state.emailsInUse ? [{ id: "existing" }] : [],
          error: null,
        };
        const builder: Record<string, unknown> = {
          then: (
            resolve: (value: typeof result) => unknown,
            reject?: (reason: unknown) => unknown,
          ) => Promise.resolve(result).then(resolve, reject),
        };
        builder.eq = () => builder;
        builder.neq = () => builder;
        builder.limit = () => builder;
        return builder;
      },
      update: (payload: Record<string, unknown>) => {
        state.updates.push(payload);

        const builder: Record<string, unknown> = {
          then: (
            resolve: (value: { error: null }) => unknown,
            reject?: (reason: unknown) => unknown,
          ) => Promise.resolve({ error: null as null }).then(resolve, reject),
        };
        builder.eq = () => builder;
        builder.in = () => builder;
        return builder;
      },
    }),
  }),
}));

vi.mock("@/lib/data/staff", () => ({
  getManagedStaffProfile: async () => state.target,
  countOtherActiveAdmins: async () => state.otherActiveAdmins,
}));

vi.mock("@/lib/staff/provisioning", () => ({
  createStaffAccount: async (input: Record<string, unknown>) => {
    state.createCalls.push(input);
    return state.createResult;
  },
  issueStaffAccessLink: async () => state.resetResult,
  updateStaffAuthEmail: async (userId: string, email: string) => {
    state.authEmailCalls.push({ userId, email });
    return { ok: true };
  },
  restoreStaffAuthEmail: async (userId: string, email: string | null) => {
    state.restoreEmailCalls.push({ userId, email });
  },
  syncStaffAuthMetadata: async (
    userId: string,
    metadata: Record<string, unknown>,
  ) => {
    state.metadataCalls.push({ userId, ...metadata });
  },
}));

vi.mock("@/lib/staff/audit", () => ({
  logStaffEvent: async (
    actorId: string,
    staffId: string,
    action: string,
    detail: Record<string, unknown>,
  ) => {
    state.audits.push({ actorId, staffId, action, detail });
  },
}));

import {
  changeStaffRoleAction,
  createStaffAction,
  resetStaffAccessAction,
  setStaffActiveAction,
  updateStaffAction,
} from "@/app/(app)/teacher/staff/actions";

const STAFF_ID = "33000000-0000-4000-8000-000000000001";

const validTarget = {
  id: STAFF_ID,
  role: "teacher" as const,
  is_active: true,
  email: "nora@example.com",
  full_name_en: "Nora Hassan",
  full_name_ar: "نورة حسن",
};

beforeEach(() => {
  state.actor = { id: "33000000-0000-4000-8000-000000000011", role: "admin" };
  state.target = { ...validTarget };
  state.otherActiveAdmins = 1;
  state.emailsInUse = false;
  state.updates = [];
  state.audits = [];
  state.createCalls = [];
  state.createResult = {
    ok: true,
    userId: "33000000-0000-4000-8000-000000000013",
    accessUrl: "https://example.test/setup",
  };
  state.resetResult = "https://example.test/reset";
  state.authEmailCalls = [];
  state.restoreEmailCalls = [];
  state.metadataCalls = [];
});

describe("staff server actions", () => {
  it("creates a staff account and returns only a one-time setup link", async () => {
    const result = await createStaffAction({
      full_name_en: "Nora Hassan",
      full_name_ar: "نورة حسن",
      email: "NORA@example.com",
      role: "teacher",
      is_active: "true",
    });

    expect(result).toEqual({
      ok: true,
      staffId: "33000000-0000-4000-8000-000000000013",
      staffName: "Nora Hassan",
      accessUrl: "https://example.test/setup",
    });
    expect("password" in result).toBe(false);
    expect(state.createCalls[0]).toEqual({
      email: "nora@example.com",
      full_name_en: "Nora Hassan",
      full_name_ar: "نورة حسن",
      role: "teacher",
      is_active: true,
    });
    expect(state.audits[0]).toMatchObject({
      actorId: "33000000-0000-4000-8000-000000000011",
      staffId: "33000000-0000-4000-8000-000000000013",
      action: "created",
      detail: { role: "teacher", is_active: true, setup_issued: true },
    });
    expect(JSON.stringify(state.audits)).not.toMatch(
      /password|token|example\.test/i,
    );
  });

  it("rejects duplicate emails before touching Auth", async () => {
    state.emailsInUse = true;

    const result = await createStaffAction({
      full_name_en: "Nora Hassan",
      full_name_ar: "نورة حسن",
      email: "nora@example.com",
      role: "teacher",
      is_active: "true",
    });

    expect(result).toEqual({
      ok: false,
      error: "email_taken",
      fieldErrors: { email: "email_taken" },
    });
    expect(state.createCalls).toHaveLength(0);
  });

  it("denies staff creation to teachers", async () => {
    state.actor = { id: "teacher-1", role: "teacher" };

    await expect(
      createStaffAction({
        full_name_en: "Nora Hassan",
        full_name_ar: "نورة حسن",
        email: "nora@example.com",
        role: "admin",
        is_active: "true",
      }),
    ).rejects.toThrow("redirect:/teacher");

    expect(state.createCalls).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });

  it("blocks an admin from changing their own role", async () => {
    state.target = { ...validTarget, id: "33000000-0000-4000-8000-000000000011", role: "admin" };

    const result = await changeStaffRoleAction({
      staff_id: "33000000-0000-4000-8000-000000000011",
      role: "teacher",
    });

    expect(result).toEqual({
      ok: false,
      error: "self_role_change_forbidden",
    });
    expect(state.updates).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });

  it("protects the last active admin from demotion", async () => {
    state.target = {
      ...validTarget,
      id: "33000000-0000-4000-8000-000000000012",
      role: "admin",
    };
    state.otherActiveAdmins = 0;

    const result = await changeStaffRoleAction({
      staff_id: "33000000-0000-4000-8000-000000000012",
      role: "teacher",
    });

    expect(result).toEqual({ ok: false, error: "last_admin_protected" });
    expect(state.updates).toHaveLength(0);
  });

  it("changes a role when another active admin remains and audits it", async () => {
    state.target = {
      ...validTarget,
      id: "33000000-0000-4000-8000-000000000012",
      role: "admin",
    };
    state.otherActiveAdmins = 1;

    const result = await changeStaffRoleAction({
      staff_id: "33000000-0000-4000-8000-000000000012",
      role: "teacher",
    });

    expect(result.ok).toBe(true);
    expect(state.updates).toContainEqual({ role: "teacher" });
    expect(state.metadataCalls).toContainEqual({
      userId: "33000000-0000-4000-8000-000000000012",
      app_role: "teacher",
    });
    expect(state.audits[0]).toMatchObject({
      action: "role_changed",
      detail: { previous_role: "admin", role: "teacher" },
    });
  });

  it("blocks an admin from deactivating their own account", async () => {
    state.target = { ...validTarget, id: "33000000-0000-4000-8000-000000000011", role: "admin" };

    const result = await setStaffActiveAction({
      staff_id: "33000000-0000-4000-8000-000000000011",
      is_active: "false",
    });

    expect(result).toEqual({
      ok: false,
      error: "self_deactivation_forbidden",
    });
    expect(state.updates).toHaveLength(0);
  });

  it("protects and then deactivates another admin safely", async () => {
    state.target = {
      ...validTarget,
      id: "33000000-0000-4000-8000-000000000012",
      role: "admin",
    };
    state.otherActiveAdmins = 0;

    const blocked = await setStaffActiveAction({
      staff_id: "33000000-0000-4000-8000-000000000012",
      is_active: "false",
    });
    expect(blocked).toEqual({
      ok: false,
      error: "last_admin_protected",
    });

    state.otherActiveAdmins = 1;
    const allowed = await setStaffActiveAction({
      staff_id: "33000000-0000-4000-8000-000000000012",
      is_active: "false",
    });

    expect(allowed.ok).toBe(true);
    expect(state.updates).toContainEqual({ is_active: false });
    expect(state.audits[0]).toMatchObject({ action: "deactivated" });
  });

  it("activates a staff account and audits the event", async () => {
    state.target = { ...validTarget, is_active: false };

    const result = await setStaffActiveAction({
      staff_id: STAFF_ID,
      is_active: "true",
    });

    expect(result.ok).toBe(true);
    expect(state.updates).toContainEqual({ is_active: true });
    expect(state.audits[0]).toMatchObject({ action: "activated" });
  });

  it("issues a one-time access link without recording it", async () => {
    const result = await resetStaffAccessAction({ staff_id: STAFF_ID });

    expect(result).toEqual({
      ok: true,
      staffId: STAFF_ID,
      staffName: "Nora Hassan",
      accessUrl: "https://example.test/reset",
    });
    expect(state.updates[0]).toHaveProperty("access_reset_at");
    expect(state.audits[0]).toMatchObject({
      action: "access_reset",
      detail: { setup_issued: true },
    });
    expect(JSON.stringify(state.audits)).not.toMatch(/example\.test/i);
  });

  it("updates names and the Auth email without exposing a password", async () => {
    const result = await updateStaffAction({
      staff_id: STAFF_ID,
      full_name_en: "Nora H.",
      full_name_ar: "نورة ح.",
      email: "new@example.com",
    });

    expect(result.ok).toBe(true);
    expect(state.authEmailCalls).toEqual([
      { userId: STAFF_ID, email: "new@example.com" },
    ]);
    expect(state.updates).toContainEqual({
      full_name_en: "Nora H.",
      full_name_ar: "نورة ح.",
      email: "new@example.com",
    });
    expect(state.audits[0]).toMatchObject({
      action: "updated",
      detail: { email_changed: true, name_changed: true },
    });
    expect(JSON.stringify(state.audits)).not.toMatch(
      /new@example\.com|password|token/i,
    );
  });
});
