/**
 * Cooperative parse timeout.
 *
 * Mammoth and unpdf do not accept an AbortSignal. Racing the parse against a
 * timer bounds how long a request waits; the parser may still finish in the
 * background, so serverless functions should also keep their platform timeout
 * low. The wrapped promise is observed either way, so a late rejection never
 * becomes an unhandled rejection.
 */

export type TimeoutResult<T> =
  | { kind: "value"; value: T }
  | { kind: "error"; error: unknown }
  | { kind: "timeout" };

export async function runWithTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
): Promise<TimeoutResult<T>> {
  const wrapped = task.then(
    (value): TimeoutResult<T> => ({ kind: "value", value }),
    (error): TimeoutResult<T> => ({ kind: "error", error }),
  );

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<TimeoutResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "timeout" }), timeoutMs);
  });

  try {
    return await Promise.race([wrapped, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
