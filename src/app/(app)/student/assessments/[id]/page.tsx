import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlarmClock,
  ArrowLeft,
  Clock3,
  Eye,
  FileText,
  ListChecks,
  Lock,
  RotateCcw,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { StartAttemptButton } from "@/components/assessments/assessment-actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/lib/auth/dal";
import { getStudentAssessmentOverviewRow } from "@/lib/data/assessments";
import { finalizeAttempt } from "@/lib/assessments/finalize";
import { nowMs } from "@/lib/assessments/time";
import { buildStartConfirmation } from "@/lib/assessments/strict";
import {
  assessmentTypeCopy,
  assessmentsUi,
  gradingModeCopy,
  resultsVisibilityCopy,
} from "@/lib/i18n/assessments";
import { formatAdminDateTime } from "@/lib/students/format";
import { isUuid } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Assessment",
};

export const dynamic = "force-dynamic";

export default async function StudentAssessmentIntroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const student = await requireStudent();
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const assessment = await getStudentAssessmentOverviewRow(id);

  if (!assessment) {
    notFound();
  }

  const now = nowMs();
  const expiresAt = assessment.in_progress_expires_at
    ? Date.parse(assessment.in_progress_expires_at)
    : null;

  if (assessment.in_progress_attempt_id) {
    if (expiresAt !== null && expiresAt <= now) {
      const outcome = await finalizeAttempt({
        attemptId: assessment.in_progress_attempt_id,
        studentId: student.id,
      });

      if (!outcome.ok) {
        notFound();
      }

      redirect(
        `/student/assessments/${assessment.id}/attempt/${assessment.in_progress_attempt_id}/result`,
      );
    }

    redirect(
      `/student/assessments/${assessment.id}/attempt/${assessment.in_progress_attempt_id}`,
    );
  }

  const notOpen =
    assessment.available_from !== null &&
    Date.parse(assessment.available_from) > now;
  const closed =
    assessment.available_until !== null &&
    Date.parse(assessment.available_until) < now;
  const attemptsLeft = Math.max(
    0,
    assessment.max_attempts - assessment.attempts_used,
  );
  const canStart = !notOpen && !closed && attemptsLeft > 0;
  const confirmation = buildStartConfirmation({
    strict: assessment,
    timeLimitMinutes: assessment.time_limit_minutes,
    maxAttempts: assessment.max_attempts,
    attemptsUsed: assessment.attempts_used,
    resultsVisibility: assessment.results_visibility,
  });

  return (
    <div translate="no" className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi
            en={assessmentTypeCopy[assessment.type].en}
            ar={assessmentTypeCopy[assessment.type].en}
          />
        }
        title={<Bi en={assessment.title_en} ar="" hideSeparator />}
        description={
          assessment.instructions_en ? (
            <Bi en={assessment.instructions_en} ar="" hideSeparator />
          ) : (
            <Bi
              en={assessmentsUi.student.autoSubmit.en}
              ar={assessmentsUi.student.autoSubmit.en}
            />
          )
        }
        actions={
          <>
            <Badge variant="muted">
              <Lock aria-hidden="true" className="size-3.5" />
              <Bi
                en={student.grade?.name_en ?? "Your grade"}
                ar={student.grade?.name_ar ?? "صفك"}
              />
            </Badge>
            <Link
              href="/student/assessments"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <Bi
                en={assessmentsUi.student.backToAssessments.en}
                ar={assessmentsUi.student.backToAssessments.en}
              />
            </Link>
          </>
        }
      />

      {notOpen ? (
        <Alert variant="info">
          <Bi
            en={`${assessmentsUi.student.notOpenYet.en} ${assessmentsUi.list.availableFrom.en} ${formatAdminDateTime(assessment.available_from)}`}
            ar={`${assessmentsUi.student.notOpenYet.en} ${assessmentsUi.list.availableFrom.en} ${formatAdminDateTime(assessment.available_from)}`}
          />
        </Alert>
      ) : null}

      {closed ? (
        <Alert variant="error">
          <Bi
            en={`${assessmentsUi.student.closed.en} ${formatAdminDateTime(assessment.available_until)}`}
            ar={`${assessmentsUi.student.closed.en} ${formatAdminDateTime(assessment.available_until)}`}
          />
        </Alert>
      ) : null}

      {assessment.strict_exam_mode ? (
        <Alert variant="error">
          <Bi
            en={assessmentsUi.strict.warning.en}
            ar={assessmentsUi.strict.warning.en}
          />
        </Alert>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <ListChecks aria-hidden="true" className="size-4 text-primary" />
          <Bi
            en={assessmentsUi.student.rules.en}
            ar={assessmentsUi.student.rules.en}
          />
        </h2>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-2">
            <Clock3 aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Bi
                  en={assessmentsUi.student.timeLimit.en}
                  ar={assessmentsUi.student.timeLimit.en}
                />
              </dt>
              <dd className="font-medium">
                {assessment.time_limit_minutes}{" "}
                <Bi
                  en={assessmentsUi.student.minutes.en}
                  ar={assessmentsUi.student.minutes.en}
                />
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <RotateCcw aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Bi
                  en={assessmentsUi.student.attemptsAllowed.en}
                  ar={assessmentsUi.student.attemptsAllowed.en}
                />
              </dt>
              <dd className="font-medium">
                {assessment.attempts_used}/{assessment.max_attempts}
                {assessment.allow_retakes ? (
                  <span className="ms-1 text-xs text-muted-foreground">
                    <Bi
                      en={assessmentsUi.list.unlimited.en}
                      ar={assessmentsUi.list.unlimited.en}
                    />
                  </span>
                ) : null}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Eye aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Bi
                  en={assessmentsUi.student.results.en}
                  ar={assessmentsUi.student.results.en}
                />
              </dt>
              <dd className="font-medium">
                <Bi
                  en={resultsVisibilityCopy[assessment.results_visibility].en}
                  ar={resultsVisibilityCopy[assessment.results_visibility].en}
                />
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <FileText aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Bi
                  en={assessmentsUi.form.gradingMode.en}
                  ar={assessmentsUi.form.gradingMode.en}
                />
              </dt>
              <dd className="font-medium">
                <Bi
                  en={gradingModeCopy[assessment.grading_mode].en}
                  ar={gradingModeCopy[assessment.grading_mode].en}
                />
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <AlarmClock aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Bi
                  en={assessmentsUi.list.availableUntil.en}
                  ar={assessmentsUi.list.availableUntil.en}
                />
              </dt>
              <dd className="font-medium">
                {formatAdminDateTime(assessment.available_until)}
              </dd>
            </div>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {canStart ? (
            <StartAttemptButton
              assessmentId={assessment.id}
              label={assessmentsUi.actions.start}
              confirmation={confirmation}
            />
          ) : assessment.result_visible && assessment.last_attempt_id ? (
            <Link
              href={`/student/assessments/${assessment.id}/attempt/${assessment.last_attempt_id}/result`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Eye aria-hidden="true" className="size-3.5" />
              <Bi
                en={assessmentsUi.actions.openResult.en}
                ar={assessmentsUi.actions.openResult.en}
              />
            </Link>
          ) : null}

          {!canStart && !closed && attemptsLeft === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Bi
                en={assessmentsUi.student.noAttemptsLeft.en}
                ar={assessmentsUi.student.noAttemptsLeft.en}
              />
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <AlarmClock aria-hidden="true" className="size-4 text-primary" />
          <Bi
            en={assessmentsUi.student.introTitle.en}
            ar={assessmentsUi.student.introTitle.en}
          />
        </h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
          <li>
            <Bi
              en={assessmentsUi.student.autoSubmit.en}
              ar={assessmentsUi.student.autoSubmit.en}
            />
          </li>
          <li>
            <Bi
              en={assessmentsUi.student.submitHint.en}
              ar={assessmentsUi.student.submitHint.en}
            />
          </li>
          <li>
            <Bi
              en={assessmentsUi.student.inProgressHint.en}
              ar={assessmentsUi.student.inProgressHint.en}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}
