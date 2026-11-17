import type { Metadata } from "next";
import Link from "next/link";
import {
  AlarmClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  History,
  Lock,
  Play,
  SearchX,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  StartAttemptButton,
} from "@/components/assessments/assessment-actions";
import { requireStudent } from "@/lib/auth/dal";
import { listStudentAssessments } from "@/lib/data/assessments";
import { finalizeAttempt } from "@/lib/assessments/finalize";
import { nowMs } from "@/lib/assessments/time";
import {
  assessmentTypeCopy,
  assessmentsUi,
} from "@/lib/i18n/assessments";
import {
  buildStudentAssessmentQuery,
  parseStudentAssessmentFilters,
} from "@/lib/assessments/filters";
import { formatAdminDateTime } from "@/lib/students/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Assessments · الاختبارات",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function StudentAssessmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const student = await requireStudent();
  const params = await searchParams;
  const filters = parseStudentAssessmentFilters(params);

  let result = await listStudentAssessments();

  // Expired attempts are finalized lazily: there is no scheduled job, so any
  // student page that loads the overview closes stale attempts first.
  if (!result.hasError) {
    let finalized = false;
    const now = nowMs();

    for (const row of result.assessments) {
      if (
        row.in_progress_attempt_id &&
        row.in_progress_expires_at &&
        Date.parse(row.in_progress_expires_at) <= now
      ) {
        const outcome = await finalizeAttempt({
          attemptId: row.in_progress_attempt_id,
          studentId: student.id,
        });

        if (outcome.ok) {
          finalized = true;
        }
      }
    }

    if (finalized) {
      result = await listStudentAssessments();
    }
  }

  const visible = result.assessments.filter((row) => {
    if (filters.type !== "all" && row.type !== filters.type) {
      return false;
    }

    if (filters.view === "completed") {
      return (
        row.last_attempt_status !== null &&
        row.last_attempt_status !== "in_progress"
      );
    }

    return true;
  });
  const now = nowMs();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi en={assessmentsUi.eyebrow.en} ar={assessmentsUi.eyebrow.ar} />
        }
        title={
          <Bi
            en={assessmentsUi.student.title.en}
            ar={assessmentsUi.student.title.ar}
          />
        }
        description={
          <Bi
            en={assessmentsUi.student.subtitle.en}
            ar={assessmentsUi.student.subtitle.ar}
          />
        }
        actions={
          <Badge variant="muted">
            <Lock aria-hidden="true" className="size-3.5" />
            <Bi
              en={
                student.grade?.name_en ??
                assessmentsUi.student.gradeLocked.en
              }
              ar={
                student.grade?.name_ar ??
                assessmentsUi.student.gradeLocked.ar
              }
            />
          </Badge>
        }
      />

      {result.hasError ? (
        <Alert variant="error">
          <Bi
            en={assessmentsUi.messages.loadFailed.en}
            ar={assessmentsUi.messages.loadFailed.ar}
          />
        </Alert>
      ) : null}

      <form
        method="get"
        action="/student/assessments"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-xs"
      >
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <Bi
            en={assessmentsUi.filters.type.en}
            ar={assessmentsUi.filters.type.ar}
          />
          <Select name="type" defaultValue={filters.type}>
            <option value="all">
              {assessmentsUi.filters.allTypes.en} ·{" "}
              {assessmentsUi.filters.allTypes.ar}
            </option>
            <option value="quiz">Quiz · اختبار قصير</option>
            <option value="exam">Exam · اختبار نهائي</option>
          </Select>
        </label>

        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <Bi en="View" ar="العرض" />
          <Select name="view" defaultValue={filters.view}>
            <option value="all">All · الكل</option>
            <option value="completed">Completed · المكتملة</option>
          </Select>
        </label>

        <button type="submit" className={cn(buttonVariants({ size: "sm" }))}>
          <Bi
            en={assessmentsUi.filters.apply.en}
            ar={assessmentsUi.filters.apply.ar}
          />
        </button>
        {filters.type !== "all" || filters.view !== "all" ? (
          <Link
            href="/student/assessments"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <Bi
              en={assessmentsUi.filters.clear.en}
              ar={assessmentsUi.filters.clear.ar}
            />
          </Link>
        ) : null}
      </form>

      {visible.length === 0 ? (
        <EmptyState
          icon={filters.view === "completed" ? History : SearchX}
          title={
            <Bi
              en={
                filters.view === "completed"
                  ? assessmentsUi.list.studentEmptyCompleted.en
                  : assessmentsUi.list.studentEmpty.en
              }
              ar={
                filters.view === "completed"
                  ? assessmentsUi.list.studentEmptyCompleted.ar
                  : assessmentsUi.list.studentEmpty.ar
              }
            />
          }
          description={
            <Bi
              en={
                filters.view === "completed"
                  ? assessmentsUi.list.studentEmptyCompletedHint.en
                  : assessmentsUi.list.studentEmptyHint.en
              }
              ar={
                filters.view === "completed"
                  ? assessmentsUi.list.studentEmptyCompletedHint.ar
                  : assessmentsUi.list.studentEmptyHint.ar
              }
            />
          }
          action={
            filters.view === "completed" ? (
              <Link
                href={`/student/assessments${buildStudentAssessmentQuery(filters, { view: "all" })}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Bi en="All assessments" ar="كل الاختبارات" />
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="grid gap-3">
          {visible.map((assessment) => {
            const expiresAt = assessment.in_progress_expires_at
              ? Date.parse(assessment.in_progress_expires_at)
              : null;
            const inProgress =
              Boolean(assessment.in_progress_attempt_id) &&
              (expiresAt === null || expiresAt > now);
            const attemptsLeft = Math.max(
              0,
              assessment.max_attempts - assessment.attempts_used,
            );
            const notOpen =
              assessment.available_from !== null &&
              Date.parse(assessment.available_from) > now;
            const closed =
              assessment.available_until !== null &&
              Date.parse(assessment.available_until) < now;
            const canStart =
              !inProgress &&
              !notOpen &&
              !closed &&
              attemptsLeft > 0;

            return (
              <li
                key={assessment.id}
                className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/student/assessments/${assessment.id}`}
                        className="text-base font-bold text-foreground underline-offset-4 hover:underline"
                      >
                        <Bi
                          en={assessment.title_en}
                          ar={assessment.title_ar}
                        />
                      </Link>
                      <Badge
                        variant={
                          assessment.type === "exam" ? "default" : "outline"
                        }
                      >
                        <Bi
                          en={assessmentTypeCopy[assessment.type].en}
                          ar={assessmentTypeCopy[assessment.type].ar}
                        />
                      </Badge>
                      {inProgress ? (
                        <Badge variant="outline">
                          <AlarmClock aria-hidden="true" className="size-3.5" />
                          <Bi
                            en={assessmentsUi.list.inProgress.en}
                            ar={assessmentsUi.list.inProgress.ar}
                          />
                        </Badge>
                      ) : assessment.result_visible ? (
                        <Badge variant="success">
                          <CheckCircle2
                            aria-hidden="true"
                            className="size-3.5"
                          />
                          <Bi
                            en={assessmentsUi.list.resultReady.en}
                            ar={assessmentsUi.list.resultReady.ar}
                          />
                        </Badge>
                      ) : assessment.last_attempt_status === "grading" ? (
                        <Badge variant="muted">
                          <Bi
                            en={assessmentsUi.list.awaitingReview.en}
                            ar={assessmentsUi.list.awaitingReview.ar}
                          />
                        </Badge>
                      ) : assessment.last_attempt_id ? (
                        <Badge variant="muted">
                          <Bi
                            en={assessmentsUi.list.resultHidden.en}
                            ar={assessmentsUi.list.resultHidden.ar}
                          />
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 aria-hidden="true" className="size-3.5" />
                        {assessment.time_limit_minutes}{" "}
                        <Bi
                          en={assessmentsUi.student.minutes.en}
                          ar={assessmentsUi.student.minutes.ar}
                        />
                      </span>
                      <span>
                        {assessment.attempts_used}/{assessment.max_attempts}{" "}
                        <Bi
                          en={assessmentsUi.list.attemptsUsed.en}
                          ar={assessmentsUi.list.attemptsUsed.ar}
                        />
                      </span>
                      {assessment.allow_retakes ? (
                        <span>
                          <Bi
                            en={assessmentsUi.list.unlimited.en}
                            ar={assessmentsUi.list.unlimited.ar}
                          />
                        </span>
                      ) : (
                        <span>
                          <Bi
                            en={assessmentsUi.list.noRetakes.en}
                            ar={assessmentsUi.list.noRetakes.ar}
                          />
                        </span>
                      )}
                      {assessment.available_until ? (
                        <span>
                          <Bi
                            en={`${assessmentsUi.list.availableUntil.en} ${formatAdminDateTime(assessment.available_until)}`}
                            ar={`${assessmentsUi.list.availableUntil.ar} ${formatAdminDateTime(assessment.available_until)}`}
                          />
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {inProgress && assessment.in_progress_attempt_id ? (
                      <StartAttemptButton
                        assessmentId={assessment.id}
                        label={assessmentsUi.actions.resume}
                      />
                    ) : assessment.result_visible &&
                      assessment.last_attempt_id ? (
                      <Link
                        href={`/student/assessments/${assessment.id}/attempt/${assessment.last_attempt_id}/result`}
                        className={cn(buttonVariants({ size: "sm" }))}
                      >
                        <Eye aria-hidden="true" className="size-3.5" />
                        <Bi
                          en={assessmentsUi.actions.openResult.en}
                          ar={assessmentsUi.actions.openResult.ar}
                        />
                      </Link>
                    ) : canStart ? (
                      <StartAttemptButton
                        assessmentId={assessment.id}
                        label={assessmentsUi.actions.start}
                      />
                    ) : null}

                    <Link
                      href={`/student/assessments/${assessment.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      <ClipboardList aria-hidden="true" className="size-3.5" />
                      <Bi
                        en={assessmentsUi.student.introTitle.en}
                        ar={assessmentsUi.student.introTitle.ar}
                      />
                    </Link>
                  </div>
                </div>

                {notOpen ? (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    <Bi
                      en={assessmentsUi.student.notOpenYet.en}
                      ar={assessmentsUi.student.notOpenYet.ar}
                    />
                  </p>
                ) : closed ? (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    <Bi
                      en={assessmentsUi.student.closed.en}
                      ar={assessmentsUi.student.closed.ar}
                    />
                  </p>
                ) : !inProgress && attemptsLeft === 0 ? (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    <Bi
                      en={assessmentsUi.student.noAttemptsLeft.en}
                      ar={assessmentsUi.student.noAttemptsLeft.ar}
                    />
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Play aria-hidden="true" className="size-3.5" />
        <Bi
          en={assessmentsUi.student.autoSubmit.en}
          ar={assessmentsUi.student.autoSubmit.ar}
        />
      </div>
    </div>
  );
}
