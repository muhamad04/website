import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabasePublicConfig } from "@/lib/env";
import { getServiceRoleKey } from "@/lib/env.server";

/**
 * Privileged client for trusted server jobs only (account creation, grading
 * and Sheets sync in later phases). Never pass this client data straight from
 * a request without authorization checks first.
 */
export function createAdminClient() {
  const { url } = requireSupabasePublicConfig();
  const serviceRoleKey = getServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Admin operations are unavailable.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
