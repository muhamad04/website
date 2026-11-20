import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  finalizeStaleAttempts: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({
  requireTeacher: mocks.requireTeacher,
}));

vi.mock("@/lib/assessments/finalize", () => ({
  finalizeStaleAttempts: mocks.finalizeStaleAttempts,
}));

import { GET } from "@/app/api/assessments/sweep/route";

function sweepRequest(headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/assessments/sweep", { headers });
}

describe("assessment sweep route", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    mocks.requireTeacher.mockReset();
    mocks.finalizeStaleAttempts.mockReset();
    mocks.finalizeStaleAttempts.mockResolvedValue({ ok: true, finalized: 0 });
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it("accepts the correct bearer token", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    mocks.finalizeStaleAttempts.mockResolvedValue({ ok: true, finalized: 3 });

    const response = await GET(
      sweepRequest({ authorization: "Bearer cron-test-secret" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, finalized: 3 });
    expect(mocks.finalizeStaleAttempts).toHaveBeenCalledWith(50);
    expect(mocks.requireTeacher).not.toHaveBeenCalled();
  });

  it("rejects a missing bearer token", async () => {
    process.env.CRON_SECRET = "cron-test-secret";

    const response = await GET(sweepRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mocks.finalizeStaleAttempts).not.toHaveBeenCalled();
    expect(mocks.requireTeacher).not.toHaveBeenCalled();
  });

  it("rejects an incorrect bearer token", async () => {
    process.env.CRON_SECRET = "cron-test-secret";

    const response = await GET(
      sweepRequest({ authorization: "Bearer wrong-secret" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mocks.finalizeStaleAttempts).not.toHaveBeenCalled();
  });

  it("uses the signed-in teacher fallback only when CRON_SECRET is absent", async () => {
    delete process.env.CRON_SECRET;
    mocks.finalizeStaleAttempts.mockResolvedValue({ ok: true, finalized: 1 });

    const response = await GET(sweepRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, finalized: 1 });
    expect(mocks.requireTeacher).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeStaleAttempts).toHaveBeenCalledWith(50);
  });

  it("does not sweep when the teacher fallback rejects the caller", async () => {
    delete process.env.CRON_SECRET;
    mocks.requireTeacher.mockRejectedValue(new Error("redirect:/login"));

    await expect(GET(sweepRequest())).rejects.toThrow("redirect:/login");
    expect(mocks.finalizeStaleAttempts).not.toHaveBeenCalled();
  });

  it("returns 500 when the idempotent sweep fails", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    mocks.finalizeStaleAttempts.mockResolvedValue({
      ok: false,
      finalized: 0,
    });

    const response = await GET(
      sweepRequest({ authorization: "Bearer cron-test-secret" }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      finalized: 0,
    });
  });

  it("delegates each request to the idempotent sweep exactly once", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    mocks.finalizeStaleAttempts
      .mockResolvedValueOnce({ ok: true, finalized: 2 })
      .mockResolvedValueOnce({ ok: true, finalized: 0 });

    const first = await GET(
      sweepRequest({ authorization: "Bearer cron-test-secret" }),
    );
    const second = await GET(
      sweepRequest({ authorization: "Bearer cron-test-secret" }),
    );

    expect(await first.json()).toEqual({ ok: true, finalized: 2 });
    expect(await second.json()).toEqual({ ok: true, finalized: 0 });
    expect(mocks.finalizeStaleAttempts).toHaveBeenCalledTimes(2);
  });
});
