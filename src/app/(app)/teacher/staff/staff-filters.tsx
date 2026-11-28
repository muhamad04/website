import Link from "next/link";
import { Search } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { staffUi } from "@/lib/i18n/staff";
import type { StaffFilters } from "@/lib/staff/filters";

/**
 * Plain GET form: staff filters stay shareable and work without JavaScript.
 * Values are re-parsed and sanitised server-side on every request.
 */
export function StaffFiltersBar({ filters }: { filters: StaffFilters }) {
  return (
    <form
      action="/teacher/staff"
      method="get"
      className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1.7fr)_repeat(2,minmax(0,1fr))] lg:items-end"
    >
      <div className="space-y-1.5">
        <Label htmlFor="staff-search">
          <Bi en={staffUi.filters.search.en} ar={staffUi.filters.search.en} />
        </Label>
        <Input
          id="staff-search"
          name="q"
          type="search"
          defaultValue={filters.search ?? ""}
          placeholder={staffUi.filters.searchPlaceholder.en}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="staff-role-filter">
          <Bi en={staffUi.filters.role.en} ar={staffUi.filters.role.en} />
        </Label>
        <Select id="staff-role-filter" name="role" defaultValue={filters.role}>
          <option value="all">{staffUi.filters.allRoles.en}</option>
          <option value="teacher">{staffUi.roles.teacher.en}</option>
          <option value="admin">{staffUi.roles.admin.en}</option>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="staff-status-filter">
          <Bi en={staffUi.filters.status.en} ar={staffUi.filters.status.en} />
        </Label>
        <Select
          id="staff-status-filter"
          name="status"
          defaultValue={filters.status}
        >
          <option value="all">{staffUi.filters.allStatuses.en}</option>
          <option value="active">{staffUi.filters.activeOnly.en}</option>
          <option value="inactive">{staffUi.filters.inactiveOnly.en}</option>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm">
          <Search aria-hidden="true" className="size-3.5" />
          <Bi en={staffUi.filters.apply.en} ar={staffUi.filters.apply.en} />
        </Button>
        <Link
          href="/teacher/staff"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <Bi en={staffUi.filters.clear.en} ar={staffUi.filters.clear.en} />
        </Link>
      </div>
    </form>
  );
}
