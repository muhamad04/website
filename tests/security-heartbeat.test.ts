import { describe, expect, it } from "vitest";
import {
  evaluateAttemptWriteState,
  isAttemptWritable,
  reasonForWriteState,
  type AttemptWriteInput,
} from "@/lib/assessments/heartbeat";

const NOW = Date.parse("2026-11-26T10:00:00.000Z");

function attempt(overrides: Partial<AttemptWriteInput> = {}): AttemptWriteInput {
  return {
    status: "in_progress",
    expiresAt: new Date(NOW + 30 * 60_000).toISOString(),
    startedAt: new Date(NOW - 5 * 60_000).toISOString(),
    lastHeartbeatAt: new Date(NOW - 10_000).toISOString(),
    strictExamMode: true,
    allowResumeAfterConnectionLoss: false,
    heartbeatTimeoutSeconds: 60,
    now: NOW,
    ...overrides,
  };
}

describe("strict-exam write state", () => {
  it("allows an open, fresh attempt", () => {
    const state = evaluateAttemptWriteState(attempt());

    expect(state).toBe("open");
    expect(isAttemptWritable(state)).toBe(true);
    expect(reasonForWriteState(state)).toBeNull();
  });

  it("blocks an answer save after the heartbeat went stale", () => {
    const state = evaluateAttemptWriteState(
      attempt({
        lastHeartbeatAt: new Date(NOW - 61_000).toISOString(),
      }),
    );

    expect(state).toBe("stale");
    expect(isAttemptWritable(state)).toBe(false);
    expect(reasonForWriteState(state)).toBe("heartbeat_expired");
  });

  it("uses started_at when no heartbeat has ever been recorded", () => {
    const state = evaluateAttemptWriteState(
      attempt({
        lastHeartbeatAt: null,
        startedAt: new Date(NOW - 61_000).toISOString(),
      }),
    );

    expect(state).toBe("stale");
  });

  it("keeps a stale attempt writable when connection-loss resume is allowed", () => {
    const state = evaluateAttemptWriteState(
      attempt({
        allowResumeAfterConnectionLoss: true,
        lastHeartbeatAt: new Date(NOW - 60 * 60_000).toISOString(),
      }),
    );

    expect(state).toBe("open");
  });

  it("does not apply heartbeat staleness to a non-strict quiz", () => {
    const state = evaluateAttemptWriteState(
      attempt({
        strictExamMode: false,
        lastHeartbeatAt: null,
        startedAt: new Date(NOW - 24 * 60 * 60_000).toISOString(),
      }),
    );

    expect(state).toBe("open");
  });

  it("treats the authoritative expiry as closed even with a fresh heartbeat", () => {
    const state = evaluateAttemptWriteState(
      attempt({
        expiresAt: new Date(NOW - 1_000).toISOString(),
        lastHeartbeatAt: new Date(NOW).toISOString(),
      }),
    );

    expect(state).toBe("expired");
    expect(isAttemptWritable(state)).toBe(false);
    expect(reasonForWriteState(state)).toBe("time_expired");
  });

  it("refuses a submission, reload or resume once the attempt is already closed", () => {
    for (const status of ["submitted", "grading", "graded"]) {
      const state = evaluateAttemptWriteState(attempt({ status }));

      expect(state).toBe("closed");
      expect(isAttemptWritable(state)).toBe(false);
      expect(reasonForWriteState(state)).toBeNull();
    }
  });

  it("treats an unparseable expiry as closed rather than open", () => {
    const state = evaluateAttemptWriteState(attempt({ expiresAt: "not-a-date" }));

    expect(state).toBe("expired");
  });

  it("treats an unparseable heartbeat as stale, not fresh", () => {
    const state = evaluateAttemptWriteState(
      attempt({ lastHeartbeatAt: "not-a-date" }),
    );

    expect(state).toBe("stale");
  });
});
