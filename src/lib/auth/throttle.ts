import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side login throttle.
 *
 * Keys are SHA-256 hashes of the Student ID/e-mail and the client IP, so the
 * throttle table never stores a raw identifier. The RPCs are granted to the
 * service role only; a client cannot call them to lock a known Student ID out.
 *
 * Failures are temporary: the window slides, the delay is capped, and a
 * successful password clears the key. If the throttle store is unavailable the
 * login falls through to Supabase Auth, which has its own rate limits.
 */
export type LoginThrottleKind = "student" | "staff" | "ip";

export type LoginThrottleKeys = {
  identifierKey: string;
  ipKey: string | null;
};

type ThrottlePolicy = {
  threshold: number;
  windowSeconds: number;
  capSeconds: number;
};

export const LOGIN_THROTTLE_POLICY: Record<"identifier" | "ip", ThrottlePolicy> =
  {
    // A student who mistypes five times waits at most a minute.
    identifier: { threshold: 5, windowSeconds: 900, capSeconds: 60 },
    // A single IP probing many IDs backs off for up to five minutes.
    ip: { threshold: 10, windowSeconds: 900, capSeconds: 300 },
  };

export function hashThrottleKey(
  kind: LoginThrottleKind,
  value: string,
): string {
  return createHash("sha256")
    .update(`${kind}:${value.trim().toLowerCase()}`)
    .digest("hex");
}

export function buildLoginThrottleKeys(input: {
  mode: "student" | "staff";
  identifier: string;
  ip: string | null;
}): LoginThrottleKeys {
  return {
    identifierKey: hashThrottleKey(input.mode, input.identifier),
    ipKey: input.ip ? hashThrottleKey("ip", input.ip) : null,
  };
}

/** Best-effort client IP from the platform proxy headers. */
export function clientIpFromHeaders(headersLike: Headers): string | null {
  const forwarded = headersLike.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const real = headersLike.get("x-real-ip")?.trim();
  const value = first || real;

  if (!value || value.length > 64 || /[\u0000-\u001f]/.test(value)) {
    return null;
  }

  return value;
}

export async function getClientIp(): Promise<string | null> {
  try {
    return clientIpFromHeaders(await headers());
  } catch {
    return null;
  }
}

function policyFor(key: string, policy: ThrottlePolicy) {
  return {
    p_key: key,
    p_threshold: policy.threshold,
    p_window_seconds: policy.windowSeconds,
    p_cap_seconds: policy.capSeconds,
  };
}

/** Returns the longest delay required by the identifier and IP keys. */
export async function checkLoginThrottle(
  keys: LoginThrottleKeys,
): Promise<number> {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return 0;
  }

  try {
    const requests = [
      admin.rpc(
        "login_throttle_retry_after",
        policyFor(keys.identifierKey, LOGIN_THROTTLE_POLICY.identifier),
      ),
    ];

    if (keys.ipKey) {
      requests.push(
        admin.rpc(
          "login_throttle_retry_after",
          policyFor(keys.ipKey, LOGIN_THROTTLE_POLICY.ip),
        ),
      );
    }

    const results = await Promise.all(requests);
    let retryAfter = 0;

    for (const result of results) {
      if (!result.error) {
        const value = Number(result.data ?? 0);
        if (Number.isFinite(value) && value > retryAfter) {
          retryAfter = value;
        }
      }
    }

    return Math.max(0, Math.min(LOGIN_THROTTLE_POLICY.ip.capSeconds, retryAfter));
  } catch {
    return 0;
  }
}

/** Records one outcome. Success clears the key; failure appends an event. */
export async function recordLoginAttempt(
  keys: LoginThrottleKeys,
  succeeded: boolean,
): Promise<void> {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  const requests = [
    admin.rpc("login_throttle_record", {
      p_key: keys.identifierKey,
      p_succeeded: succeeded,
    }),
  ];

  if (keys.ipKey) {
    requests.push(
      admin.rpc("login_throttle_record", {
        p_key: keys.ipKey,
        p_succeeded: succeeded,
      }),
    );
  }

  try {
    await Promise.all(requests);
  } catch {
    // Never fail a login because the throttle store had a problem.
  }
}
