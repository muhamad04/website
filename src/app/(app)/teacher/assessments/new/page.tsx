import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { AssessmentForm } from "@/components/assessments/assessment-form";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/lib/auth/dal";
import { listGradeOptions } from "@/lib/data/students";
import { assessmentsUi } from "@/lib/i18n/assessments";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "New assessment · اختبار جديد",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireTeacher();

  const [grades, params] = await Promise.all([
    listGradeOptions(),
    searchParams,
  ]);
  const rawGrade = Array.isArray(params.grade)
    ? params.grade[0]
    : params.grade;
  const defaultGradeId =
    rawGrade && grades.some((grade) => grade.id === rawGrade)
      ? rawGrade
      : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi en={assessmentsUi.eyebrow.en} ar={assessmentsUi.eyebrow.ar} />
        }
        title={
          <Bi
            en={assessmentsUi.form.createTitle.en}
            ar={assessmentsUi.form.createTitle.ar}
          />
        }
        description={
          <Bi
            en={assessmentsUi.form.createSubtitle.en}
            ar={assessmentsUi.form.createSubtitle.ar}
          />
        }
        actions={
          <Link
            href="/teacher/assessments"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <Bi
              en={assessmentsUi.actions.backToList.en}
              ar={assessmentsUi.actions.backToList.ar}
            />
          </Link>
        }
      />

      {grades.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={
            <Bi
              en={assessmentsUi.messages.noGrades.en}
              ar={assessmentsUi.messages.noGrades.ar}
            />
          }
          description={
            <Bi
              en={assessmentsUi.messages.noGradesHint.en}
              ar={assessmentsUi.messages.noGradesHint.ar}
            />
          }
          action={
            <Link
              href="/teacher/classes"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Bi en="Grades & classes" ar="الصفوف والفصول" />
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <AssessmentForm
            mode="create"
            grades={grades}
            defaultGradeId={defaultGradeId}
          />
        </div>
      )}
    </div>
  );
}
