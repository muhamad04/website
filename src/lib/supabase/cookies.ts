import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookie hardening shared by the proxy and request-scoped server client.
 *
 * `HttpOnly` is intentionally left at the library default (`false`). The
 * browser Supabase client reads the session cookie to sign direct Storage
 * uploads; making it HttpOnly would break that path. The session is still
 * refreshed server-side on every request, and the proxy adds the library's
 * no-store headers whenever it writes cookies.
 *
 * `Secure` is forced in production so a stray HTTP request cannot carry the
 * session in clear text. Local HTTP development keeps the library value.
 */
export function hardenedAuthCookieOptions(
  options: CookieOptions | undefined,
  isProduction: boolean,
): CookieOptions {
  return {
    ...options,
    path: options?.path ?? "/",
    sameSite: options?.sameSite ?? "lax",
    httpOnly: options?.httpOnly ?? false,
    secure: isProduction ? true : Boolean(options?.secure),
  };
}
