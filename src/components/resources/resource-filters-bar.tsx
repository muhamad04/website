import Link from "next/link";
import { Search } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { GradeSummary } from "@/lib/domain/types";
import type { ResourceCategorySummary } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import {
  resourceTypeCopy,
  resourcesUi,
} from "@/lib/i18n/resources";
import {
  RESOURCE_TYPE_FILTERS,
  type ResourceFilters,
} from "@/lib/resources/filters";

/**
 * Plain GET filter form: shareable URLs that work without JavaScript. Values
 * are re-parsed and sanitised server-side on every request.
 */
export function ResourceFiltersBar({
  basePath,
  filters,
  grades,
  categories,
  showGrade,
  showStatus,
  idPrefix,
}: {
  basePath: string;
  filters: ResourceFilters;
  grades?: GradeSummary[];
  categories: ResourceCategorySummary[];
  showGrade: boolean;
  showStatus: boolean;
  idPrefix: string;
}) {
  const columns = showGrade && showStatus ? "lg:grid-cols-6" : "lg:grid-cols-5";

  return (
    <form
      action={basePath}
      method="get"
      className={cn(
        "grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2",
        columns,
        "lg:items-end",
      )}
    >
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
        <Label htmlFor={`${idPrefix}-search`}>
          <Bi en={resourcesUi.filters.search.en} ar={resourcesUi.filters.search.ar} />
        </Label>
        <Input
          id={`${idPrefix}-search`}
          name="q"
          type="search"
          defaultValue={filters.search ?? ""}
          placeholder={`${resourcesUi.filters.searchPlaceholder.en} / ${resourcesUi.filters.searchPlaceholder.ar}`}
        />
      </div>

      {showGrade && grades ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-grade`}>
            <Bi en={resourcesUi.filters.grade.en} ar={resourcesUi.filters.grade.ar} />
          </Label>
          <Select
            id={`${idPrefix}-grade`}
            name="grade"
            defaultValue={filters.gradeId ?? ""}
          >
            <option value="">{resourcesUi.filters.allGrades.en}</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name_en} · {grade.name_ar}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>
          <Bi
            en={resourcesUi.filters.category.en}
            ar={resourcesUi.filters.category.ar}
          />
        </Label>
        <Select
          id={`${idPrefix}-category`}
          name="category"
          defaultValue={filters.categoryId ?? ""}
        >
          <option value="">{resourcesUi.filters.allCategories.en}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name_en} · {category.name_ar}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-type`}>
          <Bi en={resourcesUi.filters.type.en} ar={resourcesUi.filters.type.ar} />
        </Label>
        <Select id={`${idPrefix}-type`} name="type" defaultValue={filters.type}>
          <option value="all">{resourcesUi.filters.allTypes.en}</option>
          {RESOURCE_TYPE_FILTERS.filter((type) => type !== "all").map(
            (type) => (
              <option key={type} value={type}>
                {resourceTypeCopy[type].en} · {resourceTypeCopy[type].ar}
              </option>
            ),
          )}
        </Select>
      </div>

      {showStatus ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-status`}>
            <Bi
              en={resourcesUi.filters.status.en}
              ar={resourcesUi.filters.status.ar}
            />
          </Label>
          <Select
            id={`${idPrefix}-status`}
            name="status"
            defaultValue={filters.status}
          >
            <option value="all">{resourcesUi.filters.allStatuses.en}</option>
            <option value="published">
              {resourcesUi.filters.publishedOnly.en}
            </option>
            <option value="draft">{resourcesUi.filters.draftsOnly.en}</option>
          </Select>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-full">
        <Button type="submit" size="sm">
          <Search aria-hidden="true" className="size-3.5" />
          <Bi en={resourcesUi.filters.apply.en} ar={resourcesUi.filters.apply.ar} />
        </Button>
        <Link
          href={basePath}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <Bi en={resourcesUi.filters.clear.en} ar={resourcesUi.filters.clear.ar} />
        </Link>
      </div>
    </form>
  );
}
