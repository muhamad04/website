import { requireTeacher } from "@/lib/auth/dal";
import { getTeacherResultsForExport } from "@/lib/data/reporting";
import { buildCsv, exportFileName } from "@/lib/reporting/csv";
import {
  RESULTS_CSV_HEADERS,
  resultsCsvRows,
} from "@/lib/reporting/results-csv";
import { parseReportFilters } from "@/lib/reporting/filters";

export const dynamic = "force-dynamic";

/**
 * Teacher-only CSV export. The route re-checks the session (never trusts the
 * link), reuses the exact results filters, and sanitises every cell against
 * formula injection in `buildCsv`.
 */
export async function GET(request: Request): Promise<Response> {
  await requireTeacher();

  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const filters = parseReportFilters(params);
  const result = await getTeacherResultsForExport(filters);

  if (result.hasError) {
    return new Response("The results export could not be generated.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const rows = resultsCsvRows(result.rows);

  return new Response(buildCsv(RESULTS_CSV_HEADERS, rows), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName()}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
