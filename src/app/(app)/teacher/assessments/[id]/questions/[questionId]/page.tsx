import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionForm } from "@/components/assessments/question-form";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/lib/auth/dal";
import {
  getAssessmentDetail,
  questionHasAnswers,
} from "@/lib/data/assessments";
import { assessmentsUi } from "@/lib/i18n/assessments";
import { isUuid } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Edit question",
};

export const dynamic = "force-dynamic";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string; questionId: string }>;
}) {
  await requireTeacher();

  const { id, questionId } = await params;

  if (!isUuid(id) || !isUuid(questionId)) {
    notFound();
  }

  const detail = await getAssessmentDetail(id);

  if (!detail) {
    notFound();
  }

  const section = detail.sections.find((candidate) =>
    candidate.questions.some((question) => question.id === questionId),
  );
  const question = section?.questions.find(
    (candidate) => candidate.id === questionId,
  );

  if (!section || !question) {
    notFound();
  }

  const hasAnswers = await questionHasAnswers(question.id);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={detail.title_en} ar={detail.title_ar} />}
        title={
          <Bi
            en={assessmentsUi.questionForm.editTitle.en}
            ar={assessmentsUi.questionForm.editTitle.en}
          />
        }
        description={
          <Bi
            en={assessmentsUi.questionForm.editSubtitle.en}
            ar={assessmentsUi.questionForm.editSubtitle.en}
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
              ar={assessmentsUi.actions.backToBuilder.en}
            />
          </Link>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <QuestionForm
          mode="edit"
          assessmentId={detail.id}
          sectionId={section.id}
          gradingMode={detail.grading_mode}
          question={question}
          typeLocked={hasAnswers}
        />
      </div>
    </div>
  );
}
