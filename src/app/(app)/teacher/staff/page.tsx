import type { Metadata } from "next";
import Link from "next/link";
import {
  History,
  SearchX,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StaffFiltersBar } from "@/app/(app)/teacher/staff/staff-filters";
import { requireAdmin } from "@/lib/auth/dal";
import { listRecentStaffEvents, listStaff } from "@/lib/data/staff";
import { formatAdminDate, formatAdminDateTime } from "@/lib/students/format";
import {
  STAFF_PAGE_SIZE,
  buildStaffQuery,
  hasStaffFilters,
  parseStaffFilters,
} from "@/lib/staff/filters";
import { staffEventCopy, staffUi } from "@/lib/i18n/staff";
import type { StaffRecord } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Staff",
};

export const dynamic = "force-dynamic";

function roleBadge(role: StaffRecord["role"]) {
  return role === "admin" ? (
    <Badge variant="default">
      <Bi
        en={staffUi.roles.admin.en}
        ar={staffUi.roles.admin.en}
        hideSeparator
      />
    </Badge>
  ) : (
    <Badge variant="outline">
      <Bi
        en={staffUi.roles.teacher.en}
        ar={staffUi.roles.teacher.en}
        hideSeparator
      />
    </Badge>
  );
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const filters = parseStaffFilters(await searchParams);
  const [list, recentEvents] = await Promise.all([
    listStaff(filters),
    listRecentStaffEvents(12),
  ]);

  const hasFilters = hasStaffFilters(filters);
  const start =
    list.total === 0 ? 0 : (list.page - 1) * STAFF_PAGE_SIZE + 1;
  const end = Math.min(list.page * STAFF_PAGE_SIZE, list.total);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={staffUi.eyebrow.en} ar={staffUi.eyebrow.en} />}
        title={<Bi en={staffUi.title.en} ar={staffUi.title.en} />}
        description={
          <Bi en={staffUi.subtitle.en} ar={staffUi.subtitle.en} />
        }
        actions={
          <Link href="/teacher/staff/new" className={cn(buttonVariants())}>
            <UserPlus aria-hidden="true" className="size-4" />
            <Bi
              en={staffUi.actions.addStaff.en}
              ar={staffUi.actions.addStaff.en}
            />
          </Link>
        }
      />

      <Alert variant="info">
        <Bi en={staffUi.publicNote.en} ar={staffUi.publicNote.en} />
      </Alert>

      {list.hasError ? (
        <Alert variant="error">
          <Bi
            en="The staff list could not be loaded. Refresh the page or check the database connection."
            ar="تعذّر تحميل قائمة الموظفين. حدّث الصفحة أو تحقق من اتصال قاعدة البيانات."
          />
        </Alert>
      ) : null}

      <StaffFiltersBar filters={filters} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {list.total === 0 ? (
            <Bi en="No staff found" ar="لم يُعثر على موظفين" />
          ) : (
            <Bi
              en={`Showing ${start}–${end} of ${list.total} staff`}
              ar={`عرض ${start}–${end} من ${list.total} موظفًا`}
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

      <Card className="overflow-hidden">
        {list.staff.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={hasFilters ? SearchX : Users}
              title={
                hasFilters ? (
                  <Bi
                    en={staffUi.list.emptyFiltered.en}
                    ar={staffUi.list.emptyFiltered.en}
                  />
                ) : (
                  <Bi
                    en={staffUi.list.empty.en}
                    ar={staffUi.list.empty.en}
                  />
                )
              }
              description={
                hasFilters ? (
                  <Bi
                    en={staffUi.list.emptyFilteredHint.en}
                    ar={staffUi.list.emptyFilteredHint.en}
                  />
                ) : (
                  <Bi
                    en={staffUi.list.emptyHint.en}
                    ar={staffUi.list.emptyHint.en}
                  />
                )
              }
              action={
                hasFilters ? (
                  <Link
                    href="/teacher/staff"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    <Bi
                      en={staffUi.filters.clear.en}
                      ar={staffUi.filters.clear.en}
                    />
                  </Link>
                ) : (
                  <Link
                    href="/teacher/staff/new"
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    <UserPlus aria-hidden="true" className="size-4" />
                    <Bi
                      en={staffUi.actions.addStaff.en}
                      ar={staffUi.actions.addStaff.en}
                    />
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-secondary/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={staffUi.list.staff.en}
                        ar={staffUi.list.staff.en}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={staffUi.list.contact.en}
                        ar={staffUi.list.contact.en}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={staffUi.list.role.en}
                        ar={staffUi.list.role.en}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={staffUi.list.status.en}
                        ar={staffUi.list.status.en}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={staffUi.list.lastReset.en}
                        ar={staffUi.list.lastReset.en}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi en="Actions" ar="إجراءات" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.staff.map((member) => (
                    <tr key={member.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link
                          href={`/teacher/staff/${member.id}`}
                          className="font-semibold text-foreground hover:text-primary"
                        >
                          {member.full_name_en}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p dir="ltr" className="break-all text-xs text-foreground">
                          {member.email ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{roleBadge(member.role)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={member.is_active ? "success" : "muted"}
                        >
                          <Bi
                            en={
                              member.is_active
                                ? staffUi.filters.activeOnly.en
                                : staffUi.filters.inactiveOnly.en
                            }
                            ar={
                              member.is_active
                                ? staffUi.filters.activeOnly.en
                                : staffUi.filters.inactiveOnly.en
                            }
                            hideSeparator
                          />
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {member.access_reset_at ? (
                          formatAdminDate(member.access_reset_at)
                        ) : (
                          <Bi
                            en={staffUi.list.neverReset.en}
                            ar={staffUi.list.neverReset.en}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/teacher/staff/${member.id}`}
                          className={cn(
                            buttonVariants({
                              variant: "outline",
                              size: "sm",
                            }),
                          )}
                        >
                          <Bi
                            en={staffUi.actions.openProfile.en}
                            ar={staffUi.actions.openProfile.en}
                          />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {list.staff.map((member) => (
                <li key={member.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/teacher/staff/${member.id}`}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {member.full_name_en}
                      </Link>
                    </div>
                    <Badge variant={member.is_active ? "success" : "muted"}>
                      <Bi
                        en={
                          member.is_active
                            ? staffUi.filters.activeOnly.en
                            : staffUi.filters.inactiveOnly.en
                        }
                        ar={
                          member.is_active
                            ? staffUi.filters.activeOnly.en
                            : staffUi.filters.inactiveOnly.en
                        }
                        hideSeparator
                      />
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p dir="ltr" className="break-all">
                      {member.email ?? "—"}
                    </p>
                    <p>{roleBadge(member.role)}</p>
                  </div>

                  <Link
                    href={`/teacher/staff/${member.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    <Bi
                      en={staffUi.actions.openProfile.en}
                      ar={staffUi.actions.openProfile.en}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {list.pageCount > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3"
        >
          {list.page > 1 ? (
            <Link
              href={`/teacher/staff${buildStaffQuery(filters, {
                page: list.page - 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi
                en={staffUi.list.previous.en}
                ar={staffUi.list.previous.en}
              />
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
              href={`/teacher/staff${buildStaffQuery(filters, {
                page: list.page + 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi en={staffUi.list.next.en} ar={staffUi.list.next.en} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History aria-hidden="true" className="size-4 text-primary" />
            <Bi
              en={staffUi.detail.recentTitle.en}
              ar={staffUi.detail.recentTitle.en}
            />
          </CardTitle>
          <CardDescription>
            <Bi
              en={staffUi.detail.recentHint.en}
              ar={staffUi.detail.recentHint.en}
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Bi
                en={staffUi.detail.noActivity.en}
                ar={staffUi.detail.noActivity.en}
              />
            </p>
          ) : (
            <ol className="space-y-3">
              {recentEvents.map((event) => (
                <li key={event.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      <Bi
                        en={staffEventCopy[event.action].en}
                        ar={staffEventCopy[event.action].en}
                      />
                      {event.staff ? (
                        <>
                          {" · "}
                          <Link
                            href={`/teacher/staff/${event.staff.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {event.staff.full_name_en}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatAdminDateTime(event.created_at)}
                      {" · "}
                      <Bi
                        en={staffUi.detail.by.en}
                        ar={staffUi.detail.by.en}
                        hideSeparator
                      />{" "}
                      {event.actor?.full_name_en ?? (
                        <Bi
                          en={staffUi.detail.systemActor.en}
                          ar={staffUi.detail.systemActor.en}
                          hideSeparator
                        />
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="size-3.5" />
        <Bi en={staffUi.detail.activityHint.en} ar={staffUi.detail.activityHint.en} />
      </p>
    </div>
  );
}
