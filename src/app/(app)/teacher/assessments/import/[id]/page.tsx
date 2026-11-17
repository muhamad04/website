import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { AlertCircle } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { ImportReview } from "@/components/assessments/import-review";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/lib/auth/dal";
import { getAssessmentImport } from "@/lib/data/imports";
import { listGradeOptions } from "@/lib/data/students";
import { cleanupExpiredImports } from "@/lib/import/cleanup";
import { isImportDueForCleanup } from "@/lib/import/retention";
import type { ImportDraft } from "@/lib/import/types";
import { importErrorCopy, importsUi } from "@/lib/i18n/imports";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Review imported assessment · مراجعة اختبار مستورد",
};

export const dynamic = "force-dynamic";

function isReviewableDraft(value: unknown): value is ImportDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Partial<ImportDraft>;

  return Boolean(
    draft.settings &&
      typeof draft.settings === "object" &&
      Array.isArray(draft.sections) &&
      Array.isArray(draft.warnings) &&
      Array.isArray(draft.answerKey),
  );
}

export default async function ImportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireTeacher();
  const { id } = await params;
  const row = await getAssessmentImport(id);

  if (!row) {
    notFound();
  }

  if (row.created_by !== staff.id && staff.role !== "admin") {
    notFound();
  }

  after(cleanupExpiredImports);

  const expired =
    row.status !== "saved" && isImportDueForCleanup(row);

  if (row.status === "cancelled" || expired) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow={<Bi en={importsUi.eyebrow.en} ar={importsUi.eyebrow.ar} />}
          title={<Bi en={importsUi.title.en} ar={importsUi.title.ar} />}
        />
        <Alert variant="error">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-semibold">
              <AlertCircle aria-hidden="true" className="size-4" />
              <Bi
                en={importErrorCopy.expired.en}
                ar={importErrorCopy.expired.ar}
              />
            </p>
          </div>
        </Alert>
        <Link
          href="/teacher/assessments/import"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Bi
            en={importsUi.common.backToAssessments.en}
            ar={importsUi.common.backToAssessments.ar}
          />
        </Link>
      </div>
    );
  }

  if (row.status === "saved") {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow={<Bi en={importsUi.eyebrow.en} ar={importsUi.eyebrow.ar} />}
          title={<Bi en={importsUi.title.en} ar={importsUi.title.ar} />}
        />
        <Alert variant="success">
          <Bi
            en={importErrorCopy.already_saved.en}
            ar={importErrorCopy.already_saved.ar}
          />
        </Alert>
        {row.assessment_id ? (
          <Link
            href={`/teacher/assessments/${row.assessment_id}`}
            className={cn(buttonVariants())}
          >
            <Bi
              en="Open the assessment"
              ar="فتح الاختبار"
            />
          </Link>
        ) : (
          <Link
            href="/teacher/assessments/import"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Bi
              en={importsUi.common.backToAssessments.en}
              ar={importsUi.common.backToAssessments.ar}
            />
          </Link>
        )}
      </div>
    );
  }

  if (!isReviewableDraft(row.draft)) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow={<Bi en={importsUi.eyebrow.en} ar={importsUi.eyebrow.ar} />}
          title={<Bi en={importsUi.title.en} ar={importsUi.title.ar} />}
        />
        <Alert variant="error">
          <Bi
            en={importErrorCopy.not_found.en}
            ar={importErrorCopy.not_found.ar}
          />
        </Alert>
        <Link
          href="/teacher/assessments/import"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Bi
            en={importsUi.common.backToAssessments.en}
            ar={importsUi.common.backToAssessments.ar}
          />
        </Link>
      </div>
    );
  }

  const grades = await listGradeOptions();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={importsUi.eyebrow.en} ar={importsUi.eyebrow.ar} />}
        title={<Bi en={importsUi.review.title.en} ar={importsUi.review.title.ar} />}
        description={
          <Bi
            en={importsUi.review.subtitle.en}
            ar={importsUi.review.subtitle.ar}
          />
        }
      />

      <ImportReview
        importId={row.id}
        initialDraft={row.draft}
        grades={grades}
      />
    </div>
  );
}
