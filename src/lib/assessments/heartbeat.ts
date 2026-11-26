import type { SubmissionReason } from "@/lib/domain/types";

/**
 * Pure Strict Exam Mode write-state policy.
 *
 * The database trigger and RLS helpers enforce the same rules; this module is
 * the server-action copy used to return a clean error and to choose the right
 * submission reason. Keeping it pure makes the four critical sequences
 * (answer save, submission, reload, resume) testable without a database.
 */
export type AttemptWriteState = "open" | "closed" | "expired" | "stale";

export type AttemptWriteInput = {
  status: string;
  expiresAt: string;
  startedAt: string;
  lastHeartbeatAt: string | null;
  strictExamMode: boolean;
  allowResumeAfterConnectionLoss: boolean;
  heartbeatTimeoutSeconds: number;
  /** Injectable clock for tests. */
  now?: number;
};

export function evaluateAttemptWriteState(
  input: AttemptWriteInput,
): AttemptWriteState {
  if (input.status !== "in_progress") {
    return "closed";
  }

  const now = input.now ?? Date.now();
  const expiresAt = Date.parse(input.expiresAt);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return "expired";
  }

  if (input.strictExamMode && !input.allowResumeAfterConnectionLoss) {
    const last = Date.parse(input.lastHeartbeatAt ?? input.startedAt);
    const timeoutMs =
      Math.max(1, Math.round(input.heartbeatTimeoutSeconds)) * 1000;

    if (!Number.isFinite(last) || last + timeoutMs < now) {
      return "stale";
    }
  }

  return "open";
}

/** The reason a stale/expired attempt should be closed with, if any. */
export function reasonForWriteState(
  state: AttemptWriteState,
): SubmissionReason | null {
  if (state === "stale") {
    return "heartbeat_expired";
  }

  if (state === "expired") {
    return "time_expired";
  }

  return null;
}

/** True when the student may still write an answer or upload a file. */
export function isAttemptWritable(state: AttemptWriteState): boolean {
  return state === "open";
}
