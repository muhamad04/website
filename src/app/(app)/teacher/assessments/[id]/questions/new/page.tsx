import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderPlus } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionForm } from "@/components/assessments/question-form";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/lib/auth/dal";
import { getAssessmentDetail } from "@/lib/data/assessments";
import { assessmentsUi } from "@/lib/i18n/assessments";
import { isUuid } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "New question · سؤال جديد",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewQuestionPage({
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

  const rawSection = Array.isArray(query.section_id)
    ? query.section_id[0]
    : query.section_id;
  const section =
    detail.sections.find((candidate) => candidate.id === rawSection) ??
    detail.sections[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={detail.title_en} ar={detail.title_ar} />}
        title={
          <Bi
            en={assessmentsUi.questionForm.newTitle.en}
            ar={assessmentsUi.questionForm.newTitle.ar}
          />
        }
        description={
          <Bi
            en={assessmentsUi.questionForm.newSubtitle.en}
            ar={assessmentsUi.questionForm.newSubtitle.ar}
          />
        }
        actions={
          <Link
            href={`/teacher/assessments/${detail.id}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <Bi
              en={assessmentsUi.actions.backToBuilder.en}
              ar={assessmentsUi.actions.backToBuilder.ar}
            />
          </Link>
        }
      />

      {!section ? (
        <EmptyState
          icon={FolderPlus}
          title={
            <Bi
              en={assessmentsUi.builder.emptySections.en}
              ar={assessmentsUi.builder.emptySections.ar}
            />
          }
          description={
            <Bi
              en={assessmentsUi.builder.emptySectionsHint.en}
              ar={assessmentsUi.builder.emptySectionsHint.ar}
            />
          }
          action={
            <Link
              href={`/teacher/assessments/${detail.id}`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Bi
                en={assessmentsUi.actions.addSection.en}
                ar={assessmentsUi.actions.addSection.ar}
              />
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <QuestionForm
            mode="create"
            assessmentId={detail.id}
            sectionId={section.id}
            gradingMode={detail.grading_mode}
          />
        </div>
      )}
    </div>
  );
}
