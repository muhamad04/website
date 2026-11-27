import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  ListChecks,
  Pencil,
  Plus,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import {
  AssessmentPublishToggle,
  DeleteAssessmentButton,
} from "@/components/assessments/assessment-actions";
import { SectionManager } from "@/components/assessments/section-manager";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/lib/auth/dal";
import {
  getAssessmentDetail,
  listAssessmentAdminEvents,
} from "@/lib/data/assessments";
import {
  assessmentEventCopy,
  assessmentTypeCopy,
  assessmentsUi,
  gradingModeCopy,
  resultsVisibilityCopy,
} from "@/lib/i18n/assessments";
import { formatAdminDateTime } from "@/lib/students/format";
import { isUuid } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Assessment builder · منشئ الاختبار",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AssessmentBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireTeacher();

  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (!isUuid(id)) {
    notFound();
  }

  const detail = await getAssessmentDetail(id);

  if (!detail) {
    notFound();
  }

  const events = await listAssessmentAdminEvents(detail.id);
  const justCreated = Boolean(query.created);
  const justUpdated = Boolean(query.updated);
  const questionSaved = Boolean(query.question);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi en={assessmentsUi.eyebrow.en} ar={assessmentsUi.eyebrow.ar} />
        }
        title={<Bi en={detail.title_en} ar={detail.title_ar} />}
        description={
          detail.instructions_en || detail.instructions_ar ? (
            <Bi
              en={detail.instructions_en ?? ""}
              ar={detail.instructions_ar ?? ""}
            />
          ) : (
            <Bi
              en={assessmentsUi.builder.sectionsHint.en}
              ar={assessmentsUi.builder.sectionsHint.ar}
            />
          )
        }
        actions={
          <>
            <Link
              href={`/teacher/assessments/${detail.id}/edit`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Pencil aria-hidden="true" className="size-4" />
              <Bi
                en={assessmentsUi.actions.edit.en}
                ar={assessmentsUi.actions.edit.ar}
              />
            </Link>
            <Link
              href={`/teacher/assessments/${detail.id}/results`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ListChecks aria-hidden="true" className="size-4" />
              <Bi
                en={assessmentsUi.actions.viewResults.en}
                ar={assessmentsUi.actions.viewResults.ar}
              />
            </Link>
            <AssessmentPublishToggle
              assessmentId={detail.id}
              isPublished={detail.is_published}
            />
            <Link
              href="/teacher/assessments"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <Bi
                en={assessmentsUi.actions.backToList.en}
                ar={assessmentsUi.actions.backToList.ar}
              />
            </Link>
          </>
        }
      />

      {justCreated ? (
        <Alert variant="success">
          <Bi
            en={assessmentsUi.builder.createdSuccess.en}
            ar={assessmentsUi.builder.createdSuccess.ar}
          />
        </Alert>
      ) : null}

      {justUpdated ? (
        <Alert variant="success">
          <Bi
            en={assessmentsUi.builder.updatedSuccess.en}
            ar={assessmentsUi.builder.updatedSuccess.ar}
          />
        </Alert>
      ) : null}

      {questionSaved ? (
        <Alert variant="success">
          <Bi
            en={assessmentsUi.builder.questionCreated.en}
            ar={assessmentsUi.builder.questionCreated.ar}
          />
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={detail.type === "exam" ? "default" : "outline"}>
            <Bi
              en={assessmentTypeCopy[detail.type].en}
              ar={assessmentTypeCopy[detail.type].ar}
            />
          </Badge>
          <Badge variant={detail.is_published ? "success" : "muted"}>
            <Bi
              en={detail.is_published ? "Published" : "Draft"}
              ar={detail.is_published ? "منشور" : "مسودة"}
            />
          </Badge>
          <Badge variant="muted">
            {detail.questionCount}{" "}
            <Bi
              en={assessmentsUi.builder.questions.en}
              ar={assessmentsUi.builder.questions.ar}
            />
          </Badge>
          <Badge variant="muted">
            {detail.totalMarks}{" "}
            <Bi
              en={assessmentsUi.list.marks.en}
              ar={assessmentsUi.list.marks.ar}
            />
          </Badge>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bi
                en={assessmentsUi.form.grade.en}
                ar={assessmentsUi.form.grade.ar}
              />
            </dt>
            <dd className="mt-0.5 font-medium">
              <Bi
                en={detail.grade?.name_en ?? "Grade removed"}
                ar={detail.grade?.name_ar ?? "الصف محذوف"}
              />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bi
                en={assessmentsUi.form.timeLimit.en}
                ar={assessmentsUi.form.timeLimit.ar}
              />
            </dt>
            <dd className="mt-0.5 font-medium">
              {detail.time_limit_minutes}{" "}
              <Bi
                en={assessmentsUi.student.minutes.en}
                ar={assessmentsUi.student.minutes.ar}
              />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bi
                en={assessmentsUi.form.visibility.en}
                ar={assessmentsUi.form.visibility.ar}
              />
            </dt>
            <dd className="mt-0.5 font-medium">
              <Bi
                en={resultsVisibilityCopy[detail.results_visibility].en}
                ar={resultsVisibilityCopy[detail.results_visibility].ar}
              />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bi
                en={assessmentsUi.form.gradingMode.en}
                ar={assessmentsUi.form.gradingMode.ar}
              />
            </dt>
            <dd className="mt-0.5 font-medium">
              <Bi
                en={gradingModeCopy[detail.grading_mode].en}
                ar={gradingModeCopy[detail.grading_mode].ar}
              />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bi
                en={assessmentsUi.form.maxAttempts.en}
                ar={assessmentsUi.form.maxAttempts.ar}
              />
            </dt>
            <dd className="mt-0.5 font-medium">
              {detail.allow_retakes ? (
                <Bi
                  en={`${detail.max_attempts} attempts`}
                  ar={`${detail.max_attempts} محاولات`}
                />
              ) : (
                <Bi
                  en={assessmentsUi.list.noRetakes.en}
                  ar={assessmentsUi.list.noRetakes.ar}
                />
              )}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarClock aria-hidden="true" className="size-3.5" />
              <Bi
                en="Availability"
                ar="التوفر"
                className="ms-1"
              />
            </dt>
            <dd className="mt-0.5 font-medium">
              {detail.available_from || detail.available_until ? (
                <Bi
                  en={`${formatAdminDateTime(detail.available_from)} → ${formatAdminDateTime(detail.available_until)}`}
                  ar={`${formatAdminDateTime(detail.available_from)} ← ${formatAdminDateTime(detail.available_until)}`}
                />
              ) : (
                <Bi
                  en={assessmentsUi.list.openNow.en}
                  ar={assessmentsUi.list.openNow.ar}
                />
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Link
            href={`/teacher/assessments/${detail.id}/questions/new`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            <Bi
              en={assessmentsUi.actions.addQuestion.en}
              ar={assessmentsUi.actions.addQuestion.ar}
            />
          </Link>
          <DeleteAssessmentButton
            assessmentId={detail.id}
            redirectToList
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              <Bi
                en={assessmentsUi.builder.sections.en}
                ar={assessmentsUi.builder.sections.ar}
              />
            </h2>
            <p className="text-sm text-muted-foreground">
              <Bi
                en={assessmentsUi.builder.sectionsHint.en}
                ar={assessmentsUi.builder.sectionsHint.ar}
              />
            </p>
          </div>
          {detail.sections.length === 0 ? (
            <Link
              href={`/teacher/assessments/${detail.id}/questions/new`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              <Bi
                en={assessmentsUi.actions.addQuestion.en}
                ar={assessmentsUi.actions.addQuestion.ar}
              />
            </Link>
          ) : null}
        </div>

        <SectionManager
          assessmentId={detail.id}
          sections={detail.sections.map((section) => ({
            id: section.id,
            kind: section.kind,
            title_en: section.title_en,
            instructions_en: section.instructions_en,
            passage_en: section.passage_en,
            vocabulary_en: section.vocabulary_en,
            source_en: section.source_en,
            dialogue_lines: section.dialogue_lines,
            position: section.position,
            questions: section.questions.map((question) => ({
              id: question.id,
              type: question.type,
              prompt_en: question.prompt_en,
              marks: question.marks,
              position: question.position,
            })),
          }))}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <ClipboardList aria-hidden="true" className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">
            <Bi
              en={assessmentsUi.builder.activityTitle.en}
              ar={assessmentsUi.builder.activityTitle.ar}
            />
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <Bi
            en={assessmentsUi.builder.activityHint.en}
            ar={assessmentsUi.builder.activityHint.ar}
          />
        </p>

        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            <Bi
              en={assessmentsUi.builder.noActivity.en}
              ar={assessmentsUi.builder.noActivity.ar}
            />
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">
                  <Bi
                    en={assessmentEventCopy[event.action].en}
                    ar={assessmentEventCopy[event.action].ar}
                  />
                </span>
                <span className="text-xs text-muted-foreground">
                  {event.actor?.full_name_en ?? "—"} ·{" "}
                  {formatAdminDateTime(event.created_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
