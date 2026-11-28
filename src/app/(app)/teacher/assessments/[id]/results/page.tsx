import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Inbox, PencilLine } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireTeacher } from "@/lib/auth/dal";
import { maybeFinalizeStaleAttempts } from "@/lib/assessments/lazy-sweep";
import {
  getTeacherAssessmentById,
  listAssessmentAttempts,
} from "@/lib/data/assessments";
import {
  assessmentsUi,
  attemptStatusCopy,
  submissionReasonCopy,
} from "@/lib/i18n/assessments";
import { formatAdminDateTime } from "@/lib/students/format";
import { isUuid } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Assessment results",
};

export const dynamic = "force-dynamic";

export default async function AssessmentResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const assessment = await getTeacherAssessmentById(id);

  if (!assessment) {
    notFound();
  }

  await maybeFinalizeStaleAttempts(20);
  const result = await listAssessmentAttempts(assessment.id);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={assessment.title_en} ar={assessment.title_ar} />}
        title={
          <Bi
            en={assessmentsUi.results.title.en}
            ar={assessmentsUi.results.title.en}
          />
        }
        description={
          <Bi
            en={assessmentsUi.results.subtitle.en}
            ar={assessmentsUi.results.subtitle.en}
          />
        }
        actions={
          <Link
            href={`/teacher/assessments/${assessment.id}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <Bi
              en={assessmentsUi.actions.backToBuilder.en}
              ar={assessmentsUi.actions.backToBuilder.en}
            />
          </Link>
        }
      />

      {result.hasError ? (
        <Alert variant="error">
          <Bi
            en={assessmentsUi.messages.loadFailed.en}
            ar={assessmentsUi.messages.loadFailed.en}
          />
        </Alert>
      ) : null}

      {result.attempts.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            <Bi
              en={assessmentsUi.results.empty.en}
              ar={assessmentsUi.results.empty.en}
            />
          }
          description={
            <Bi
              en={assessmentsUi.results.emptyHint.en}
              ar={assessmentsUi.results.emptyHint.en}
            />
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">
                  <Bi
                    en={assessmentsUi.results.student.en}
                    ar={assessmentsUi.results.student.en}
                  />
                </th>
                <th className="px-4 py-3">
                  <Bi
                    en={assessmentsUi.results.attempt.en}
                    ar={assessmentsUi.results.attempt.en}
                  />
                </th>
                <th className="px-4 py-3">
                  <Bi
                    en={assessmentsUi.results.status.en}
                    ar={assessmentsUi.results.status.en}
                  />
                </th>
                <th className="px-4 py-3">
                  <Bi
                    en={assessmentsUi.results.score.en}
                    ar={assessmentsUi.results.score.en}
                  />
                </th>
                <th className="px-4 py-3">
                  <Bi
                    en={assessmentsUi.results.submitted.en}
                    ar={assessmentsUi.results.submitted.en}
                  />
                </th>
                <th className="px-4 py-3">
                  <Bi
                    en={assessmentsUi.results.reason.en}
                    ar={assessmentsUi.results.reason.en}
                  />
                </th>
                <th className="px-4 py-3">
                  <Bi
                    en={assessmentsUi.results.flags.en}
                    ar={assessmentsUi.results.flags.en}
                  />
                </th>
                <th className="px-4 py-3">
                  <Bi
                    en={assessmentsUi.results.review.en}
                    ar={assessmentsUi.results.review.en}
                  />
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {result.attempts.map((attempt) => {
                const reviewLabel =
                  attempt.manual_review_status === "pending" ? (
                    <Badge variant="outline">
                      <Bi
                        en={assessmentsUi.results.pending.en}
                        ar={assessmentsUi.results.pending.en}
                      />
                    </Badge>
                  ) : attempt.manual_review_status === "completed" ? (
                    <Badge variant="success">
                      <Bi
                        en={assessmentsUi.results.completed.en}
                        ar={assessmentsUi.results.completed.en}
                      />
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      <Bi
                        en={assessmentsUi.results.notRequired.en}
                        ar={assessmentsUi.results.notRequired.en}
                      />
                    </span>
                  );

                return (
                  <tr
                    key={attempt.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        <Bi
                          en={attempt.student?.full_name_en ?? "—"}
                          ar={
                            attempt.student?.full_name_ar ??
                            attempt.student?.full_name_en ??
                            "—"
                          }
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {attempt.student?.student_number ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      #{attempt.attempt_number}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="muted">
                        <Bi
                          en={attemptStatusCopy[attempt.status].en}
                          ar={attemptStatusCopy[attempt.status].en}
                        />
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {attempt.score === null || attempt.max_score === null ? (
                        "—"
                      ) : (
                        <span>
                          {attempt.score} / {attempt.max_score}
                          {attempt.percentage !== null ? (
                            <span className="text-muted-foreground">
                              {" "}
                              ({attempt.percentage}%)
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatAdminDateTime(attempt.submitted_at)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {attempt.submission_reason ? (
                        <Badge variant="outline">
                          <Bi
                            en={submissionReasonCopy[attempt.submission_reason].en}
                            ar={submissionReasonCopy[attempt.submission_reason].en}
                          />
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {attempt.tab_hidden_count + attempt.focus_loss_count ===
                      0 ? (
                        <Bi
                          en={assessmentsUi.results.noFlags.en}
                          ar={assessmentsUi.results.noFlags.en}
                        />
                      ) : (
                        <span className="inline-flex flex-wrap gap-1">
                          <Badge variant="outline">
                            <Bi
                              en={assessmentsUi.results.tabHidden.en}
                              ar={assessmentsUi.results.tabHidden.en}
                            />
                            : {attempt.tab_hidden_count}
                          </Badge>
                          <Badge variant="outline">
                            <Bi
                              en={assessmentsUi.results.focusLoss.en}
                              ar={assessmentsUi.results.focusLoss.en}
                            />
                            : {attempt.focus_loss_count}
                          </Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{reviewLabel}</td>
                    <td className="px-4 py-3 text-right">
                      {attempt.status === "grading" ||
                      attempt.status === "graded" ? (
                        <Link
                          href={`/teacher/assessments/${assessment.id}/results/${attempt.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                          )}
                        >
                          <PencilLine aria-hidden="true" className="size-3.5" />
                          <Bi
                            en={
                              attempt.manual_review_status === "pending"
                                ? assessmentsUi.results.grade.en
                                : assessmentsUi.results.review.en
                            }
                            ar={
                              attempt.manual_review_status === "pending"
                                ? assessmentsUi.results.grade.en
                                : assessmentsUi.results.review.en
                            }
                          />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <ClipboardList aria-hidden="true" className="size-3.5" />
                          <Bi en="In progress" ar="قيد التنفيذ" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
