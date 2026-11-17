import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sanitiseStaffAuditDetail } from "@/lib/staff/audit-detail";
import type { StaffAdminAction } from "@/lib/domain/types";

/**
 * Appends to the staff audit log. The insert runs as the signed-in admin, so
 * the RLS policy (active admin + actor_id = auth.uid()) is the final authority.
 * Auditing never turns a successful administration action into a failure.
 */
export async function logStaffEvent(
  actorId: string,
  staffId: string,
  action: StaffAdminAction,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("staff_admin_events").insert({
    actor_id: actorId,
    staff_id: staffId,
    action,
    detail: sanitiseStaffAuditDetail(detail),
  });

  if (error) {
    console.error("staff event log failed", error.message);
  }
}
