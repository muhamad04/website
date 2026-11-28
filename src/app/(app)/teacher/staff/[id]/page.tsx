import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, ShieldCheck } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import {
  countOtherActiveAdmins,
  getStaffById,
  listStaffEvents,
} from "@/lib/data/staff";
import { formatAdminDate, formatAdminDateTime } from "@/lib/students/format";
import { staffEventCopy, staffUi } from "@/lib/i18n/staff";
import { cn } from "@/lib/utils";
import { StaffForm } from "@/app/(app)/teacher/staff/staff-form";
import { StaffAccessActions } from "@/app/(app)/teacher/staff/staff-access-actions";

export const metadata: Metadata = {
  title: "Staff profile",
};

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const staff = await getStaffById(id);

  if (!staff) {
    notFound();
  }

  const [events, otherActiveAdmins] = await Promise.all([
    listStaffEvents(staff.id),
    staff.role === "admin" && staff.is_active
      ? countOtherActiveAdmins(staff.id)
      : Promise.resolve(0),
  ]);

  const isSelf = staff.id === admin.id;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi
            en={staffUi.detail.profileTitle.en}
            ar={staffUi.detail.profileTitle.en}
          />
        }
        title={
          <Bi
            en={staff.full_name_en}
            ar={staff.full_name_ar ?? staff.full_name_en}
            layout="stacked"
          />
        }
        description={
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span dir="ltr">
              {staff.email ?? (
                <Bi
                  en="No email address"
                  ar="لا يوجد بريد إلكتروني"
                  hideSeparator
                />
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <Bi
                en={
                  staff.role === "admin"
                    ? staffUi.roles.admin.en
                    : staffUi.roles.teacher.en
                }
                ar={
                  staff.role === "admin"
                    ? staffUi.roles.admin.en
                    : staffUi.roles.teacher.en
                }
                hideSeparator
              />
            </span>
          </span>
        }
        actions={
          <>
            <Badge variant={staff.is_active ? "success" : "muted"}>
              <Bi
                en={
                  staff.is_active
                    ? staffUi.filters.activeOnly.en
                    : staffUi.filters.inactiveOnly.en
                }
                ar={
                  staff.is_active
                    ? staffUi.filters.activeOnly.en
                    : staffUi.filters.inactiveOnly.en
                }
                hideSeparator
              />
            </Badge>
            <Link
              href="/teacher/staff"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <Bi
                en={staffUi.actions.backToList.en}
                ar={staffUi.actions.backToList.en}
              />
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <Bi
                en={staffUi.form.editTitle.en}
                ar={staffUi.form.editTitle.en}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en={staffUi.form.editSubtitle.en}
                ar={staffUi.form.editSubtitle.en}
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StaffForm mode="edit" staff={staff} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                <Bi
                  en={staffUi.detail.accessTitle.en}
                  ar={staffUi.detail.accessTitle.en}
                />
              </CardTitle>
              <CardDescription>
                <Bi
                  en={staffUi.detail.accessHint.en}
                  ar={staffUi.detail.accessHint.en}
                />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <Bi
                      en={staffUi.detail.lastInvite.en}
                      ar={staffUi.detail.lastInvite.en}
                    />
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatAdminDate(staff.invitation_sent_at)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <Bi
                      en={staffUi.detail.lastReset.en}
                      ar={staffUi.detail.lastReset.en}
                    />
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatAdminDate(staff.access_reset_at)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <Bi
                      en={staffUi.detail.createdOn.en}
                      ar={staffUi.detail.createdOn.en}
                    />
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatAdminDate(staff.created_at)}
                  </dd>
                </div>
              </dl>

              <StaffAccessActions
                staffId={staff.id}
                role={staff.role}
                isActive={staff.is_active}
                isSelf={isSelf}
                otherActiveAdmins={otherActiveAdmins}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History aria-hidden="true" className="size-4 text-primary" />
                <Bi
                  en={staffUi.detail.activityTitle.en}
                  ar={staffUi.detail.activityTitle.en}
                />
              </CardTitle>
              <CardDescription>
                <Bi
                  en={staffUi.detail.activityHint.en}
                  ar={staffUi.detail.activityHint.en}
                />
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Bi
                    en={staffUi.detail.noActivity.en}
                    ar={staffUi.detail.noActivity.en}
                  />
                </p>
              ) : (
                <ol className="space-y-3">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-start gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          <Bi
                            en={staffEventCopy[event.action].en}
                            ar={staffEventCopy[event.action].en}
                          />
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
        </div>
      </div>
    </div>
  );
}
