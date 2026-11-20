import { requireTeacher } from "@/lib/auth/dal";
import { finalizeStaleAttempts } from "@/lib/assessments/finalize";

export const dynamic = "force-dynamic";

/**
 * Maintenance endpoint for manual or external scheduler calls. Set the optional
 * CRON_SECRET in the deployment and call with `Authorization: Bearer <secret>`;
 * without a secret, a signed-in staff session is required. The sweep itself is
 * idempotent.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: "forbidden" }, { status: 401 });
    }
  } else {
    await requireTeacher();
  }

  const result = await finalizeStaleAttempts(50);

  return Response.json(result, { status: result.ok ? 200 : 500 });
}
