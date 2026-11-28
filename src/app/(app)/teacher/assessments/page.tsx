import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardList,
  Clock3,
  FileUp,
  ListChecks,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AssessmentPublishToggle } from "@/components/assessments/assessment-actions";
import { requireTeacher } from "@/lib/auth/dal";
import { listTeacherAssessments } from "@/lib/data/assessments";
import { listGradeOptions } from "@/lib/data/students";
import {
  assessmentTypeCopy,
  assessmentsUi,
  resultsVisibilityCopy,
} from "@/lib/i18n/assessments";
import {
  buildAssessmentQuery,
  hasAssessmentFilters,
  parseAssessmentFilters,
} from "@/lib/assessments/filters";
import { formatAdminDateTime } from "@/lib/students/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Assessments",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TeacherAssessmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireTeacher();

  const params = await searchParams;
  const filters = parseAssessmentFilters(params);
  const [result, grades] = await Promise.all([
    listTeacherAssessments(filters),
    listGradeOptions(),
  ]);
  const filtered = hasAssessmentFilters(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi en={assessmentsUi.eyebrow.en} ar={assessmentsUi.eyebrow.en} />
        }
        title={<Bi en={assessmentsUi.title.en} ar={assessmentsUi.title.en} />}
        description={
          <Bi
            en={assessmentsUi.subtitle.en}
            ar={assessmentsUi.subtitle.en}
          />
        }
        actions={
          <>
            <Link
              href="/teacher/assessments/import"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <FileUp aria-hidden="true" className="size-4" />
              <Bi
                en={assessmentsUi.actions.importAssessment.en}
                ar={assessmentsUi.actions.importAssessment.en}
              />
            </Link>
            <Link
              href="/teacher/assessments/new"
              className={cn(buttonVariants())}
            >
              <Plus aria-hidden="true" className="size-4" />
              <Bi
                en={assessmentsUi.actions.addAssessment.en}
                ar={assessmentsUi.actions.addAssessment.en}
              />
            </Link>
          </>
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

      <form
        method="get"
        action="/teacher/assessments"
        className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground lg:col-span-2">
          <span className="inline-flex items-center gap-1">
            <Search aria-hidden="true" className="size-3.5" />
            <Bi
              en={assessmentsUi.filters.search.en}
              ar={assessmentsUi.filters.search.en}
            />
          </span>
          <Input
            name="q"
            defaultValue={filters.search}
            placeholder={assessmentsUi.filters.searchPlaceholder.en}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <Bi
            en={assessmentsUi.filters.grade.en}
            ar={assessmentsUi.filters.grade.en}
          />
          <Select name="grade" defaultValue={filters.gradeId}>
            <option value="">{assessmentsUi.filters.allGrades.en}</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name_en}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <Bi
            en={assessmentsUi.filters.type.en}
            ar={assessmentsUi.filters.type.en}
          />
          <Select name="type" defaultValue={filters.type}>
            <option value="all">{assessmentsUi.filters.allTypes.en}</option>
            <option value="quiz">{assessmentTypeCopy.quiz.en}</option>
            <option value="exam">{assessmentTypeCopy.exam.en}</option>
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <Bi
            en={assessmentsUi.filters.status.en}
            ar={assessmentsUi.filters.status.en}
          />
          <Select name="status" defaultValue={filters.status}>
            <option value="all">{assessmentsUi.filters.allStatuses.en}</option>
            <option value="published">
              {assessmentsUi.filters.publishedOnly.en}
            </option>
            <option value="draft">Drafts</option>
          </Select>
        </label>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className={cn(buttonVariants({ size: "sm" }))}>
            <SlidersHorizontal aria-hidden="true" className="size-3.5" />
            <Bi
              en={assessmentsUi.filters.apply.en}
              ar={assessmentsUi.filters.apply.en}
            />
          </button>
          {filtered ? (
            <Link
              href="/teacher/assessments"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              <Bi
                en={assessmentsUi.filters.clear.en}
                ar={assessmentsUi.filters.clear.en}
              />
            </Link>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {result.total}{" "}
            <Bi
              en={result.total === 1 ? "assessment" : "assessments"}
              ar={result.total === 1 ? "assessment" : "assessments"}
            />
          </span>
        </div>
      </form>

      {result.assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            <Bi
              en={
                filtered
                  ? assessmentsUi.list.emptyFiltered.en
                  : assessmentsUi.list.empty.en
              }
              ar={
                filtered
                  ? assessmentsUi.list.emptyFiltered.en
                  : assessmentsUi.list.empty.en
              }
            />
          }
          description={
            <Bi
              en={
                filtered
                  ? assessmentsUi.list.emptyFilteredHint.en
                  : assessmentsUi.list.emptyHint.en
              }
              ar={
                filtered
                  ? assessmentsUi.list.emptyFilteredHint.en
                  : assessmentsUi.list.emptyHint.en
              }
            />
          }
          action={
            filtered ? (
              <Link
                href="/teacher/assessments"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Bi
                  en={assessmentsUi.filters.clear.en}
                  ar={assessmentsUi.filters.clear.en}
                />
              </Link>
            ) : (
              <Link
                href="/teacher/assessments/new"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                <Plus aria-hidden="true" className="size-3.5" />
                <Bi
                  en={assessmentsUi.actions.addAssessment.en}
                  ar={assessmentsUi.actions.addAssessment.en}
                />
              </Link>
            )
          }
        />
      ) : (
        <ul className="grid gap-3">
          {result.assessments.map((assessment) => (
            <li
              key={assessment.id}
              className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/teacher/assessments/${assessment.id}`}
                      className="text-base font-bold text-foreground underline-offset-4 hover:underline"
                    >
                      <Bi
                        en={assessment.title_en}
                        ar={assessment.title_ar}
                      />
                    </Link>
                    <Badge
                      variant={assessment.type === "exam" ? "default" : "outline"}
                    >
                      <Bi
                        en={assessmentTypeCopy[assessment.type].en}
                        ar={assessmentTypeCopy[assessment.type].en}
                      />
                    </Badge>
                    <Badge
                      variant={assessment.is_published ? "success" : "muted"}
                    >
                      <Bi
                        en={assessment.is_published ? "Published" : "Draft"}
                        ar={assessment.is_published ? "منشور" : "مسودة"}
                      />
                    </Badge>
                  </div>

                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      <Bi
                        en={assessment.grade?.name_en ?? "Grade removed"}
                        ar={assessment.grade?.name_ar ?? "الصف محذوف"}
                      />
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 aria-hidden="true" className="size-3.5" />
                      {assessment.time_limit_minutes}{" "}
                      <Bi
                        en={assessmentsUi.student.minutes.en}
                        ar={assessmentsUi.student.minutes.en}
                      />
                    </span>
                    <span>
                      <Bi
                        en={resultsVisibilityCopy[assessment.results_visibility].en}
                        ar={resultsVisibilityCopy[assessment.results_visibility].en}
                      />
                    </span>
                    <span>
                      {assessment.allow_retakes ? (
                        <Bi
                          en={`${assessment.max_attempts} attempts`}
                          ar={`${assessment.max_attempts} محاولات`}
                        />
                      ) : (
                        <Bi
                          en={assessmentsUi.list.noRetakes.en}
                          ar={assessmentsUi.list.noRetakes.en}
                        />
                      )}
                    </span>
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    <Bi
                      en={`Updated ${formatAdminDateTime(assessment.updated_at)}`}
                      ar={`آخر تحديث ${formatAdminDateTime(assessment.updated_at)}`}
                    />
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/teacher/assessments/${assessment.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                    <Bi
                      en={assessmentsUi.actions.open.en}
                      ar={assessmentsUi.actions.open.en}
                    />
                  </Link>
                  <Link
                    href={`/teacher/assessments/${assessment.id}/results`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <ListChecks aria-hidden="true" className="size-3.5" />
                    <Bi
                      en={assessmentsUi.actions.viewResults.en}
                      ar={assessmentsUi.actions.viewResults.en}
                    />
                  </Link>
                  <AssessmentPublishToggle
                    assessmentId={assessment.id}
                    isPublished={assessment.is_published}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 ? (
        <nav
          aria-label="Assessment pages"
          className="flex items-center justify-between gap-3"
        >
          {result.page > 1 ? (
            <Link
              href={`/teacher/assessments${buildAssessmentQuery(filters, {
                page: result.page - 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi en="Previous" ar="Previous" />
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            {result.page} / {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link
              href={`/teacher/assessments${buildAssessmentQuery(filters, {
                page: result.page + 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi en="Next" ar="Next" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
