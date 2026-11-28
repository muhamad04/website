import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceForm } from "@/app/(app)/teacher/resources/resource-form";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireTeacher } from "@/lib/auth/dal";
import { listResourceCategories } from "@/lib/data/resources";
import { listGradeOptions } from "@/lib/data/students";
import { resourcesUi } from "@/lib/i18n/resources";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "New resource",
};

export const dynamic = "force-dynamic";

export default async function NewResourcePage() {
  await requireTeacher();

  const [grades, categoriesResult] = await Promise.all([
    listGradeOptions(),
    listResourceCategories(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={resourcesUi.eyebrow.en} ar={resourcesUi.eyebrow.en} />}
        title={
          <Bi en={resourcesUi.form.createTitle.en} ar={resourcesUi.form.createTitle.en} />
        }
        description={
          <Bi
            en={resourcesUi.form.createSubtitle.en}
            ar={resourcesUi.form.createSubtitle.en}
          />
        }
        actions={
          <Link
            href="/teacher/resources"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <Bi
              en={resourcesUi.actions.backToList.en}
              ar={resourcesUi.actions.backToList.en}
            />
          </Link>
        }
      />

      {categoriesResult.hasError ? (
        <Alert variant="error">
          <Bi
            en={resourcesUi.messages.categoriesLoadFailed.en}
            ar={resourcesUi.messages.categoriesLoadFailed.en}
          />
        </Alert>
      ) : null}

      {grades.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={
            <Bi
              en={resourcesUi.messages.noGrades.en}
              ar={resourcesUi.messages.noGrades.en}
            />
          }
          description={
            <Bi
              en={resourcesUi.messages.noGradesHint.en}
              ar={resourcesUi.messages.noGradesHint.en}
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
          <ResourceForm
            mode="create"
            grades={grades}
            categories={categoriesResult.categories}
          />
        </div>
      )}
    </div>
  );
}
