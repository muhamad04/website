import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  finalizeStaleAttempts: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/assessments/finalize", () => ({
  finalizeStaleAttempts: mocks.finalizeStaleAttempts,
}));

type LazySweep = typeof import("@/lib/assessments/lazy-sweep");

async function loadSweep(): Promise<LazySweep> {
  vi.resetModules();
  return import("@/lib/assessments/lazy-sweep");
}

describe("lazy stale-attempt sweep throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T00:00:00.000Z"));
    mocks.finalizeStaleAttempts.mockReset();
    mocks.finalizeStaleAttempts.mockResolvedValue({
      ok: true,
      finalized: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs once and skips calls inside the throttle window", async () => {
    const { maybeFinalizeStaleAttempts } = await loadSweep();

    await maybeFinalizeStaleAttempts(10);
    await maybeFinalizeStaleAttempts(10);

    expect(mocks.finalizeStaleAttempts).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeStaleAttempts).toHaveBeenCalledWith(10);
  });

  it("runs again after the throttle window", async () => {
    const { maybeFinalizeStaleAttempts } = await loadSweep();

    await maybeFinalizeStaleAttempts(10);
    vi.setSystemTime(new Date("2026-11-20T00:01:01.000Z"));
    await maybeFinalizeStaleAttempts(10);

    expect(mocks.finalizeStaleAttempts).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight sweep between concurrent callers", async () => {
    const { maybeFinalizeStaleAttempts } = await loadSweep();
    let resolveSweep: (value: { ok: boolean; finalized: number }) => void =
      () => {};

    mocks.finalizeStaleAttempts.mockReturnValue(
      new Promise((resolve) => {
        resolveSweep = resolve;
      }),
    );

    const first = maybeFinalizeStaleAttempts(10);
    const second = maybeFinalizeStaleAttempts(10);

    expect(mocks.finalizeStaleAttempts).toHaveBeenCalledTimes(1);

    resolveSweep({ ok: true, finalized: 0 });
    await Promise.all([first, second]);
  });

  it("does not throw when the sweep fails and still throttles", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { maybeFinalizeStaleAttempts } = await loadSweep();
    mocks.finalizeStaleAttempts.mockRejectedValue(new Error("database down"));

    await expect(maybeFinalizeStaleAttempts(10)).resolves.toBeUndefined();
    await maybeFinalizeStaleAttempts(10);

    expect(mocks.finalizeStaleAttempts).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "lazy stale-attempt sweep failed",
      expect.any(Error),
    );
  });
});
