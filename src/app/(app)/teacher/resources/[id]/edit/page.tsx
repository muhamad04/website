import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceForm } from "@/app/(app)/teacher/resources/resource-form";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/lib/auth/dal";
import {
  getTeacherResourceById,
  listResourceCategories,
} from "@/lib/data/resources";
import { listGradeOptions } from "@/lib/data/students";
import { resourcesUi } from "@/lib/i18n/resources";
import { isUuid } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Edit resource · تعديل المصدر",
};

export const dynamic = "force-dynamic";

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const [resource, grades, categoriesResult] = await Promise.all([
    getTeacherResourceById(id),
    listGradeOptions(),
    listResourceCategories(),
  ]);

  if (!resource) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={resourcesUi.eyebrow.en} ar={resourcesUi.eyebrow.ar} />}
        title={
          <Bi en={resourcesUi.form.editTitle.en} ar={resourcesUi.form.editTitle.ar} />
        }
        description={
          <Bi
            en={resourcesUi.form.editSubtitle.en}
            ar={resourcesUi.form.editSubtitle.ar}
          />
        }
        actions={
          <>
            <Link
              href={`/teacher/resources/${resource.id}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              <Bi
                en={resourcesUi.actions.open.en}
                ar={resourcesUi.actions.open.ar}
              />
            </Link>
            <Link
              href="/teacher/resources"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <Bi
                en={resourcesUi.actions.backToList.en}
                ar={resourcesUi.actions.backToList.ar}
              />
            </Link>
          </>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <ResourceForm
          mode="edit"
          resource={resource}
          grades={grades}
          categories={categoriesResult.categories}
        />
      </div>

      <div className="flex justify-start">
        <Link
          href={`/teacher/resources/${resource.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Bi
            en={resourcesUi.actions.backToList.en}
            ar={resourcesUi.actions.backToList.ar}
          />
        </Link>
      </div>
    </div>
  );
}
