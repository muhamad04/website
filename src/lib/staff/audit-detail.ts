/**
 * Safe audit metadata for staff events. Only flat, non-sensitive scalars are
 * kept so passwords, tokens, service-role keys, recovery links and nested
 * provider payloads can never end up in the append-only log.
 */

const SENSITIVE_KEY =
  /(password|passcode|secret|token|service[_ ]?role|api[_ ]?key|private[_ ]?key|access[_ ]?url|recovery|setup[_ ]?link|(^|_)url($|_))/i;

const SAFE_KEY = /^[a-z][a-z0-9_]{0,40}$/;

export function sanitiseStaffAuditDetail(
  detail: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  let kept = 0;

  for (const [key, value] of Object.entries(detail)) {
    if (kept >= 20) {
      break;
    }

    if (!SAFE_KEY.test(key) || SENSITIVE_KEY.test(key)) {
      continue;
    }

    if (typeof value === "string") {
      safe[key] = value.slice(0, 200);
      kept += 1;
      continue;
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key] = value;
      kept += 1;
    }
  }

  return safe;
}
