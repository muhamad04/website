import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ReportingAdminAction =
  | "sync_manual"
  | "sync_retry"
  | "settings_updated"
  | "connectivity_checked";

/**
 * Appends to the reporting audit log. The insert runs as the signed-in staff
 * user, so the RLS policy (staff role + actor_id = auth.uid()) is the final
 * authority; a forged actor id is rejected by the database.
 */
export async function logReportingEvent(
  actorId: string,
  action: ReportingAdminAction,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("reporting_admin_events").insert({
    actor_id: actorId,
    action,
    detail,
  });

  if (error) {
    console.error("reporting audit write failed", error.message);
  }
}
