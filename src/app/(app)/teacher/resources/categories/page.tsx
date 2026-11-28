import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Tags } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import {
  CategoryCreateForm,
  CategoryRow,
} from "@/app/(app)/teacher/resources/categories/category-manager";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireTeacher } from "@/lib/auth/dal";
import { listResourceCategories } from "@/lib/data/resources";
import { resourcesUi } from "@/lib/i18n/resources";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Resource categories",
};

export const dynamic = "force-dynamic";

export default async function ResourceCategoriesPage() {
  await requireTeacher();

  const { categories, hasError } = await listResourceCategories({
    withCounts: true,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi
            en={resourcesUi.categories.eyebrow.en}
            ar={resourcesUi.categories.eyebrow.en}
          />
        }
        title={
          <Bi
            en={resourcesUi.categories.title.en}
            ar={resourcesUi.categories.title.en}
          />
        }
        description={
          <Bi
            en={resourcesUi.categories.subtitle.en}
            ar={resourcesUi.categories.subtitle.en}
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

      {hasError ? (
        <Alert variant="error">
          <Bi
            en={resourcesUi.messages.categoriesLoadFailed.en}
            ar={resourcesUi.messages.categoriesLoadFailed.en}
          />
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags aria-hidden="true" className="size-4 text-primary" />
            <Bi
              en={resourcesUi.categories.addCategory.en}
              ar={resourcesUi.categories.addCategory.en}
            />
          </CardTitle>
          <CardDescription>
            <Bi
              en={resourcesUi.categories.subtitle.en}
              ar={resourcesUi.categories.subtitle.en}
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Bi
              en={resourcesUi.categories.title.en}
              ar={resourcesUi.categories.title.en}
            />
          </CardTitle>
          <CardDescription>
            <Bi
              en={resourcesUi.categories.activeHint.en}
              ar={resourcesUi.categories.activeHint.en}
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <EmptyState
              icon={Tags}
              title={
                <Bi
                  en={resourcesUi.categories.empty.en}
                  ar={resourcesUi.categories.empty.en}
                />
              }
              description={
                <Bi
                  en={resourcesUi.categories.emptyHint.en}
                  ar={resourcesUi.categories.emptyHint.en}
                />
              }
            />
          ) : (
            <ul className="space-y-3">
              {categories.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
