import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { AssessmentForm } from "@/components/assessments/assessment-form";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/lib/auth/dal";
import { getTeacherAssessmentById } from "@/lib/data/assessments";
import { listGradeOptions } from "@/lib/data/students";
import { assessmentsUi } from "@/lib/i18n/assessments";
import { isUuid } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Edit assessment · تعديل الاختبار",
};

export const dynamic = "force-dynamic";

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const [assessment, grades] = await Promise.all([
    getTeacherAssessmentById(id),
    listGradeOptions(),
  ]);

  if (!assessment) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi en={assessmentsUi.eyebrow.en} ar={assessmentsUi.eyebrow.ar} />
        }
        title={
          <Bi
            en={assessmentsUi.form.editTitle.en}
            ar={assessmentsUi.form.editTitle.ar}
          />
        }
        description={
          <Bi
            en={assessmentsUi.form.editSubtitle.en}
            ar={assessmentsUi.form.editSubtitle.ar}
          />
        }
        actions={
          <>
            <Link
              href={`/teacher/assessments/${assessment.id}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              <Bi
                en={assessmentsUi.actions.open.en}
                ar={assessmentsUi.actions.open.ar}
              />
            </Link>
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

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <AssessmentForm mode="edit" assessment={assessment} grades={grades} />
      </div>

      <div>
        <Link
          href={`/teacher/assessments/${assessment.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Bi
            en={assessmentsUi.actions.backToBuilder.en}
            ar={assessmentsUi.actions.backToBuilder.ar}
          />
        </Link>
      </div>
    </div>
  );
}
