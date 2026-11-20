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
  title: "Assessment · الاختبار",
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
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi
            en={assessmentTypeCopy[assessment.type].en}
            ar={assessmentTypeCopy[assessment.type].ar}
          />
        }
        title={<Bi en={assessment.title_en} ar={assessment.title_ar} />}
        description={
          assessment.instructions_en || assessment.instructions_ar ? (
            <Bi
              en={assessment.instructions_en ?? ""}
              ar={assessment.instructions_ar ?? ""}
            />
          ) : (
            <Bi
              en={assessmentsUi.student.autoSubmit.en}
              ar={assessmentsUi.student.autoSubmit.ar}
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
                ar={assessmentsUi.student.backToAssessments.ar}
              />
            </Link>
          </>
        }
      />

      {notOpen ? (
        <Alert variant="info">
          <Bi
            en={`${assessmentsUi.student.notOpenYet.en} ${assessmentsUi.list.availableFrom.en} ${formatAdminDateTime(assessment.available_from)}`}
            ar={`${assessmentsUi.student.notOpenYet.ar} ${assessmentsUi.list.availableFrom.ar} ${formatAdminDateTime(assessment.available_from)}`}
          />
        </Alert>
      ) : null}

      {closed ? (
        <Alert variant="error">
          <Bi
            en={`${assessmentsUi.student.closed.en} ${formatAdminDateTime(assessment.available_until)}`}
            ar={`${assessmentsUi.student.closed.ar} ${formatAdminDateTime(assessment.available_until)}`}
          />
        </Alert>
      ) : null}

      {assessment.strict_exam_mode ? (
        <Alert variant="error">
          <Bi
            en={assessmentsUi.strict.warning.en}
            ar={assessmentsUi.strict.warning.ar}
          />
        </Alert>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <ListChecks aria-hidden="true" className="size-4 text-primary" />
          <Bi
            en={assessmentsUi.student.rules.en}
            ar={assessmentsUi.student.rules.ar}
          />
        </h2>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-2">
            <Clock3 aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Bi
                  en={assessmentsUi.student.timeLimit.en}
                  ar={assessmentsUi.student.timeLimit.ar}
                />
              </dt>
              <dd className="font-medium">
                {assessment.time_limit_minutes}{" "}
                <Bi
                  en={assessmentsUi.student.minutes.en}
                  ar={assessmentsUi.student.minutes.ar}
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
                  ar={assessmentsUi.student.attemptsAllowed.ar}
                />
              </dt>
              <dd className="font-medium">
                {assessment.attempts_used}/{assessment.max_attempts}
                {assessment.allow_retakes ? (
                  <span className="ms-1 text-xs text-muted-foreground">
                    <Bi
                      en={assessmentsUi.list.unlimited.en}
                      ar={assessmentsUi.list.unlimited.ar}
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
                  ar={assessmentsUi.student.results.ar}
                />
              </dt>
              <dd className="font-medium">
                <Bi
                  en={resultsVisibilityCopy[assessment.results_visibility].en}
                  ar={resultsVisibilityCopy[assessment.results_visibility].ar}
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
                  ar={assessmentsUi.form.gradingMode.ar}
                />
              </dt>
              <dd className="font-medium">
                <Bi
                  en={gradingModeCopy[assessment.grading_mode].en}
                  ar={gradingModeCopy[assessment.grading_mode].ar}
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
                  ar={assessmentsUi.list.availableUntil.ar}
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
                ar={assessmentsUi.actions.openResult.ar}
              />
            </Link>
          ) : null}

          {!canStart && !closed && attemptsLeft === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Bi
                en={assessmentsUi.student.noAttemptsLeft.en}
                ar={assessmentsUi.student.noAttemptsLeft.ar}
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
            ar={assessmentsUi.student.introTitle.ar}
          />
        </h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
          <li>
            <Bi
              en={assessmentsUi.student.autoSubmit.en}
              ar={assessmentsUi.student.autoSubmit.ar}
            />
          </li>
          <li>
            <Bi
              en={assessmentsUi.student.submitHint.en}
              ar={assessmentsUi.student.submitHint.ar}
            />
          </li>
          <li>
            <Bi
              en={assessmentsUi.student.inProgressHint.en}
              ar={assessmentsUi.student.inProgressHint.ar}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}
