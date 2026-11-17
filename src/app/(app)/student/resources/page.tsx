import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, SearchX } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceCard } from "@/components/resources/resource-card";
import { ResourceFiltersBar } from "@/components/resources/resource-filters-bar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStudent } from "@/lib/auth/dal";
import {
  listResourceCategories,
  listStudentResources,
} from "@/lib/data/resources";
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

export default async function StudentResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireStudent();
  const grade = profile.grade!;
  const filters = parseResourceFilters(await searchParams, {
    allowStatus: false,
  });

  const [list, categoriesResult] = await Promise.all([
    listStudentResources(grade.id, filters),
    listResourceCategories({ activeOnly: true }),
  ]);

  const hasFilters = hasResourceFilters(filters);
  const start =
    list.total === 0 ? 0 : (list.page - 1) * RESOURCES_PAGE_SIZE + 1;
  const end = Math.min(list.page * RESOURCES_PAGE_SIZE, list.total);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi en={resourcesUi.eyebrow.en} ar={resourcesUi.eyebrow.ar} />
        }
        title={<Bi en={resourcesUi.student.title.en} ar={resourcesUi.student.title.ar} />}
        description={
          <Bi
            en={`${resourcesUi.student.subtitle.en} ${grade.name_en}.`}
            ar={`${resourcesUi.student.subtitle.ar} ${grade.name_ar}.`}
          />
        }
        actions={
          <Badge variant="success">
            <Bi
              en={resourcesUi.student.gradeLocked.en}
              ar={resourcesUi.student.gradeLocked.ar}
            />
          </Badge>
        }
      />

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
        basePath="/student/resources"
        filters={filters}
        categories={categoriesResult.categories}
        showGrade={false}
        showStatus={false}
        idPrefix="student-resource"
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
          icon={hasFilters ? SearchX : BookOpenCheck}
          title={
            hasFilters ? (
              <Bi
                en={resourcesUi.list.emptyFiltered.en}
                ar={resourcesUi.list.emptyFiltered.ar}
              />
            ) : (
              <Bi
                en={resourcesUi.list.studentEmpty.en}
                ar={resourcesUi.list.studentEmpty.ar}
              />
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
                en={resourcesUi.list.studentEmptyHint.en}
                ar={resourcesUi.list.studentEmptyHint.ar}
              />
            )
          }
          action={
            hasFilters ? (
              <Link
                href="/student/resources"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Bi
                  en={resourcesUi.filters.clear.en}
                  ar={resourcesUi.filters.clear.ar}
                />
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.resources.map((resource) => (
            <li key={resource.id}>
              <ResourceCard
                resource={resource}
                href={`/student/resources/${resource.id}`}
                showStatus={false}
                showGrade={false}
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
              href={`/student/resources${buildResourceQuery(
                filters,
                { page: list.page - 1 },
                { includeStatus: false, includeGrade: false },
              )}`}
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
              href={`/student/resources${buildResourceQuery(
                filters,
                { page: list.page + 1 },
                { includeStatus: false, includeGrade: false },
              )}`}
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
