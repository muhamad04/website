import { requireTeacher } from "@/lib/auth/dal";
import { getTeacherResultsForExport } from "@/lib/data/reporting";
import { buildCsv, exportFileName, type CsvValue } from "@/lib/reporting/csv";
import { parseReportFilters } from "@/lib/reporting/filters";

export const dynamic = "force-dynamic";

const HEADERS = [
  "Submission ID",
  "Student ID",
  "Student name",
  "Grade",
  "Class",
  "Assessment",
  "Assessment type",
  "Attempt",
  "Submitted at",
  "Score",
  "Maximum score",
  "Percentage",
  "Grading mode",
  "Result status",
  "Manual review",
  "Result visibility",
];

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

  const rows: CsvValue[][] = result.rows.map((attempt) => [
    attempt.id,
    attempt.student?.student_number ?? attempt.student_id,
    attempt.student?.full_name_en ?? "",
    attempt.student?.grade?.name_en ?? "",
    attempt.student?.class?.name_en ?? "",
    attempt.assessment?.title_en ?? "",
    attempt.assessment?.type ?? "",
    attempt.attempt_number,
    attempt.submitted_at ?? "",
    attempt.score,
    attempt.max_score,
    attempt.percentage,
    attempt.assessment?.grading_mode ?? "",
    attempt.status,
    attempt.manual_review_status,
    attempt.assessment?.results_visibility ?? "",
  ]);

  return new Response(buildCsv(HEADERS, rows), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName()}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
