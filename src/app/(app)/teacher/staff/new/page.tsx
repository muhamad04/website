import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { staffUi } from "@/lib/i18n/staff";
import { cn } from "@/lib/utils";
import { StaffForm } from "@/app/(app)/teacher/staff/staff-form";

export const metadata: Metadata = {
  title: "New staff",
};

export const dynamic = "force-dynamic";

export default async function NewStaffPage() {
  await requireAdmin();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={staffUi.eyebrow.en} ar={staffUi.eyebrow.en} />}
        title={
          <Bi
            en={staffUi.form.createTitle.en}
            ar={staffUi.form.createTitle.en}
          />
        }
        description={
          <Bi
            en={staffUi.form.createSubtitle.en}
            ar={staffUi.form.createSubtitle.en}
          />
        }
        actions={
          <Link
            href="/teacher/staff"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Bi
              en={staffUi.actions.backToList.en}
              ar={staffUi.actions.backToList.en}
            />
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            <Bi en="Account details" ar="بيانات الحساب" />
          </CardTitle>
          <CardDescription>
            <Bi
              en="Passwords are never shown or stored in plain text. The staff member receives a single-use setup link."
              ar="لا تُعرض كلمات المرور ولا تُخزَّن كنص صريح. يتلقى الموظف رابط إعداد لمرة واحدة."
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaffForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
