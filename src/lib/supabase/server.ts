import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabasePublicConfig } from "@/lib/env";
import { hardenedAuthCookieOptions } from "@/lib/supabase/cookies";

/**
 * Request-scoped Supabase client. RLS runs as the signed-in user, so student
 * reads/writes stay constrained even if a screen forgets a filter.
 *
 * Cookie writes fail inside Server Components by design; Proxy refreshes the
 * session cookie on every request instead.
 */
export async function createClient() {
  const { url, publishableKey } = requireSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(
              name,
              value,
              hardenedAuthCookieOptions(
                options,
                process.env.NODE_ENV === "production",
              ),
            );
          }
        } catch {
          // Called from a Server Component rendering pass. The proxy handles
          // token refresh and writes the updated cookies to the response.
        }
      },
    },
  });
}
