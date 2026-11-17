import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Pencil, Plus, SearchX, Tags } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceCard } from "@/components/resources/resource-card";
import { ResourceFiltersBar } from "@/components/resources/resource-filters-bar";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ResourcePublishToggle,
} from "@/app/(app)/teacher/resources/resource-actions";
import { requireTeacher } from "@/lib/auth/dal";
import {
  listResourceCategories,
  listTeacherResources,
} from "@/lib/data/resources";
import { listGradeOptions } from "@/lib/data/students";
import { resourcesUi } from "@/lib/i18n/resources";
import {
  RESOURCES_PAGE_SIZE,
  buildResourceQuery,
  hasResourceFilters,
  parseResourceFilters,
} from "@/lib/resources/filters";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Resources · المصادر",
};

export const dynamic = "force-dynamic";

export default async function TeacherResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeacher();

  const params = await searchParams;
  const filters = parseResourceFilters(params);
  const [list, grades, categoriesResult] = await Promise.all([
    listTeacherResources(filters),
    listGradeOptions(),
    listResourceCategories(),
  ]);

  const hasFilters = hasResourceFilters(filters);
  const start =
    list.total === 0 ? 0 : (list.page - 1) * RESOURCES_PAGE_SIZE + 1;
  const end = Math.min(list.page * RESOURCES_PAGE_SIZE, list.total);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={resourcesUi.eyebrow.en} ar={resourcesUi.eyebrow.ar} />}
        title={<Bi en={resourcesUi.title.en} ar={resourcesUi.title.ar} />}
        description={
          <Bi en={resourcesUi.subtitle.en} ar={resourcesUi.subtitle.ar} />
        }
        actions={
          <>
            <Link
              href="/teacher/resources/categories"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Tags aria-hidden="true" className="size-4" />
              <Bi
                en={resourcesUi.actions.manageCategories.en}
                ar={resourcesUi.actions.manageCategories.ar}
              />
            </Link>
            <Link
              href="/teacher/resources/new"
              className={cn(buttonVariants())}
            >
              <Plus aria-hidden="true" className="size-4" />
              <Bi
                en={resourcesUi.actions.addResource.en}
                ar={resourcesUi.actions.addResource.ar}
              />
            </Link>
          </>
        }
      />

      {params.deleted === "1" ? (
        <Alert variant="success">
          <Bi
            en={resourcesUi.detail.deletedSuccess.en}
            ar={resourcesUi.detail.deletedSuccess.ar}
          />
        </Alert>
      ) : null}

      {list.hasError ? (
        <Alert variant="error">
          <Bi
            en={resourcesUi.messages.loadFailed.en}
            ar={resourcesUi.messages.loadFailed.ar}
          />
        </Alert>
      ) : null}

      {categoriesResult.hasError ? (
        <Alert variant="error">
          <Bi
            en={resourcesUi.messages.categoriesLoadFailed.en}
            ar={resourcesUi.messages.categoriesLoadFailed.ar}
          />
        </Alert>
      ) : null}

      <ResourceFiltersBar
        basePath="/teacher/resources"
        filters={filters}
        grades={grades}
        categories={categoriesResult.categories}
        showGrade
        showStatus
        idPrefix="teacher-resource"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {list.total === 0 ? (
            <Bi en="No resources found" ar="لم يُعثر على مصادر" />
          ) : (
            <Bi
              en={`Showing ${start}–${end} of ${list.total} resources`}
              ar={`عرض ${start}–${end} من ${list.total} مصدرًا`}
            />
          )}
        </p>
        {list.pageCount > 1 ? (
          <p>
            <Bi
              en={`Page ${list.page} of ${list.pageCount}`}
              ar={`صفحة ${list.page} من ${list.pageCount}`}
            />
          </p>
        ) : null}
      </div>

      {list.resources.length === 0 ? (
        <EmptyState
          icon={hasFilters ? SearchX : FolderOpen}
          title={
            hasFilters ? (
              <Bi
                en={resourcesUi.list.emptyFiltered.en}
                ar={resourcesUi.list.emptyFiltered.ar}
              />
            ) : (
              <Bi en={resourcesUi.list.empty.en} ar={resourcesUi.list.empty.ar} />
            )
          }
          description={
            hasFilters ? (
              <Bi
                en={resourcesUi.list.emptyFilteredHint.en}
                ar={resourcesUi.list.emptyFilteredHint.ar}
              />
            ) : (
              <Bi
                en={resourcesUi.list.emptyHint.en}
                ar={resourcesUi.list.emptyHint.ar}
              />
            )
          }
          action={
            hasFilters ? (
              <Link
                href="/teacher/resources"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Bi
                  en={resourcesUi.filters.clear.en}
                  ar={resourcesUi.filters.clear.ar}
                />
              </Link>
            ) : (
              <Link
                href="/teacher/resources/new"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                <Plus aria-hidden="true" className="size-4" />
                <Bi
                  en={resourcesUi.actions.addResource.en}
                  ar={resourcesUi.actions.addResource.ar}
                />
              </Link>
            )
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.resources.map((resource) => (
            <li key={resource.id}>
              <ResourceCard
                resource={resource}
                href={`/teacher/resources/${resource.id}`}
                showGrade
                actions={
                  <>
                    <Link
                      href={`/teacher/resources/${resource.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      <Bi
                        en={resourcesUi.actions.open.en}
                        ar={resourcesUi.actions.open.ar}
                      />
                    </Link>
                    <Link
                      href={`/teacher/resources/${resource.id}/edit`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                      )}
                    >
                      <Pencil aria-hidden="true" className="size-3.5" />
                      <Bi en="Edit" ar="تعديل" />
                    </Link>
                    <ResourcePublishToggle
                      resourceId={resource.id}
                      isPublished={resource.is_published}
                    />
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {list.pageCount > 1 ? (
        <nav
          aria-label="Pagination / التنقل بين الصفحات"
          className="flex items-center justify-between gap-3"
        >
          {list.page > 1 ? (
            <Link
              href={`/teacher/resources${buildResourceQuery(filters, {
                page: list.page - 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi en={resourcesUi.list.previous.en} ar={resourcesUi.list.previous.ar} />
            </Link>
          ) : (
            <span />
          )}

          <span className="text-xs text-muted-foreground">
            <Bi
              en={`${list.page} / ${list.pageCount}`}
              ar={`${list.page} / ${list.pageCount}`}
              hideSeparator
            />
          </span>

          {list.page < list.pageCount ? (
            <Link
              href={`/teacher/resources${buildResourceQuery(filters, {
                page: list.page + 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi en={resourcesUi.list.next.en} ar={resourcesUi.list.next.ar} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
