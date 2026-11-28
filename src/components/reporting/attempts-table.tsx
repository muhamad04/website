import Link from "next/link";
import { ArrowRight, Inbox, PencilLine } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReportingAttemptRow } from "@/lib/data/reporting";
import {
  assessmentTypeCopy,
  attemptStatusCopy,
  gradingModeCopy,
  resultsVisibilityCopy,
} from "@/lib/i18n/assessments";
import { manualReviewCopy, reportingUi } from "@/lib/i18n/reporting";
import { formatAdminDateTime } from "@/lib/students/format";
import { cn } from "@/lib/utils";

function scoreLabel(attempt: ReportingAttemptRow): string {
  if (attempt.percentage === null || attempt.score === null) {
    return "—";
  }

  const score = Math.round(attempt.score * 100) / 100;
  const max = attempt.max_score === null ? null : Math.round(attempt.max_score * 100) / 100;
  const percentage = Math.round(attempt.percentage * 10) / 10;

  return max === null
    ? `${score} (${percentage}%)`
    : `${score}/${max} (${percentage}%)`;
}

function studentName(attempt: ReportingAttemptRow): string {
  return attempt.student?.full_name_en ?? attempt.student_id.slice(0, 8);
}

function placementLabel(attempt: ReportingAttemptRow): string {
  const grade = attempt.student?.grade?.name_en ?? "—";
  const classRow = attempt.student?.class?.name_en;
  return classRow ? `${grade} · ${classRow}` : grade;
}

function reviewVariant(
  status: ReportingAttemptRow["manual_review_status"],
): "success" | "muted" | "outline" {
  if (status === "completed") {
    return "success";
  }

  if (status === "pending") {
    return "outline";
  }

  return "muted";
}

function detailHref(attempt: ReportingAttemptRow): string {
  return `/teacher/assessments/${attempt.assessment_id}/results/${attempt.id}`;
}

export function AttemptsTable({
  rows,
  emptyFiltered = false,
}: {
  rows: ReportingAttemptRow[];
  emptyFiltered?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={emptyFiltered ? Inbox : PencilLine}
          title={
            <Bi
              en={reportingUi.results.empty.en}
              ar={reportingUi.results.empty.en}
            />
          }
          description={
            <Bi
              en={reportingUi.results.emptyHint.en}
              ar={reportingUi.results.emptyHint.en}
            />
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[62rem] text-sm">
          <caption className="sr-only">
            Assessment results
          </caption>
          <thead className="bg-secondary/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5">
                <Bi en={reportingUi.results.columns.student.en} ar={reportingUi.results.columns.student.en} />
              </th>
              <th scope="col" className="px-4 py-2.5">
                <Bi en={reportingUi.results.columns.placement.en} ar={reportingUi.results.columns.placement.en} />
              </th>
              <th scope="col" className="px-4 py-2.5">
                <Bi en={reportingUi.results.columns.assessment.en} ar={reportingUi.results.columns.assessment.en} />
              </th>
              <th scope="col" className="px-4 py-2.5">
                <Bi en={reportingUi.results.columns.submitted.en} ar={reportingUi.results.columns.submitted.en} />
              </th>
              <th scope="col" className="px-4 py-2.5">
                <Bi en={reportingUi.results.columns.score.en} ar={reportingUi.results.columns.score.en} />
              </th>
              <th scope="col" className="px-4 py-2.5">
                <Bi en={reportingUi.results.columns.grading.en} ar={reportingUi.results.columns.grading.en} />
              </th>
              <th scope="col" className="px-4 py-2.5">
                <Bi en={reportingUi.results.columns.visibility.en} ar={reportingUi.results.columns.visibility.en} />
              </th>
              <th scope="col" className="px-4 py-2.5">
                <Bi en={reportingUi.results.columns.review.en} ar={reportingUi.results.columns.review.en} />
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">
                  <Bi en={reportingUi.results.columns.details.en} ar={reportingUi.results.columns.details.en} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((attempt) => (
              <tr key={attempt.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">
                    {studentName(attempt)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {attempt.student?.student_number ??
                      attempt.student_id.slice(0, 8)}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {placementLabel(attempt)}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    {attempt.assessment?.title_en ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {attempt.assessment ? (
                      <Bi
                        en={assessmentTypeCopy[attempt.assessment.type].en}
                        ar={assessmentTypeCopy[attempt.assessment.type].en}
                        hideSeparator
                      />
                    ) : null}
                    {" · "}
                    <Bi
                      en={`${reportingUi.results.attemptNumber.en} ${attempt.attempt_number}`}
                      ar={`${reportingUi.results.attemptNumber.en} ${attempt.attempt_number}`}
                      hideSeparator
                    />
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatAdminDateTime(attempt.submitted_at)}
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums">
                  {scoreLabel(attempt)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground">
                    {attempt.assessment ? (
                      <Bi
                        en={gradingModeCopy[attempt.assessment.grading_mode].en}
                        ar={gradingModeCopy[attempt.assessment.grading_mode].en}
                        hideSeparator
                      />
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Bi
                      en={attemptStatusCopy[attempt.status].en}
                      ar={attemptStatusCopy[attempt.status].en}
                      hideSeparator
                    />
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {attempt.assessment ? (
                    <Bi
                      en={resultsVisibilityCopy[attempt.assessment.results_visibility].en}
                      ar={resultsVisibilityCopy[attempt.assessment.results_visibility].en}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={reviewVariant(attempt.manual_review_status)}>
                    <Bi
                      en={manualReviewCopy(attempt.manual_review_status).en}
                      ar={manualReviewCopy(attempt.manual_review_status).en}
                      hideSeparator
                    />
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={detailHref(attempt)}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <ArrowRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
                    <Bi en={reportingUi.results.columns.details.en} ar={reportingUi.results.columns.details.en} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map((attempt) => (
          <li key={attempt.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  {studentName(attempt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {placementLabel(attempt)}
                </p>
              </div>
              <Badge variant={reviewVariant(attempt.manual_review_status)}>
                <Bi
                  en={manualReviewCopy(attempt.manual_review_status).en}
                  ar={manualReviewCopy(attempt.manual_review_status).en}
                  hideSeparator
                />
              </Badge>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {attempt.assessment?.title_en ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatAdminDateTime(attempt.submitted_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold tabular-nums">
                {scoreLabel(attempt)}
              </span>
              <Link
                href={detailHref(attempt)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <ArrowRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
                <Bi en={reportingUi.results.columns.details.en} ar={reportingUi.results.columns.details.en} />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
