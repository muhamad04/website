import "server-only";

import { finalizeStaleAttempts } from "@/lib/assessments/finalize";

/**
 * Opportunistic stale-attempt cleanup for page loads.
 *
 * Vercel Hobby has no minute-level cron, so the app relies on server signals,
 * the heartbeat, the timer and lazy sweeps. A module-level throttle keeps the
 * sweep off the hot path: at most one sweep starts per interval per server
 * instance. The sweep itself is idempotent.
 *
 * Correctness-critical paths (the attempt runner, the start action and the
 * explicit sweep route) call `finalizeStaleAttempts` directly instead of this
 * helper, so a heartbeat-expired attempt can never be resumed.
 */
const SWEEP_INTERVAL_MS = 60_000;

let lastStartedAt = 0;
let inFlight: Promise<void> | null = null;

export async function maybeFinalizeStaleAttempts(limit = 10): Promise<void> {
  if (inFlight) {
    return inFlight;
  }

  const now = Date.now();

  if (now - lastStartedAt < SWEEP_INTERVAL_MS) {
    return;
  }

  lastStartedAt = now;
  inFlight = finalizeStaleAttempts(limit)
    .then(() => undefined)
    .catch((error: unknown) => {
      console.error("lazy stale-attempt sweep failed", error);
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
