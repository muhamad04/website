import { redirect } from "next/navigation";
import { Clock3, LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Bi } from "@/components/bilingual";
import { AuthShell } from "@/components/layout/auth-shell";
import { SupabaseSetupNotice } from "@/components/layout/supabase-setup-notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signOutAction } from "@/lib/auth/actions";
import { getCurrentProfile, getSessionUser } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";
import { dashboardPathForRole } from "@/lib/domain/roles";

export const metadata: Metadata = {
  title: "Account pending · الحساب قيد الإعداد",
};

export const dynamic = "force-dynamic";

export default async function AccountPendingPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-12"
      >
        <SupabaseSetupNotice />
      </main>
    );
  }

  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentProfile();

  if (profile && !profile.is_active) {
    redirect("/account-disabled");
  }

  if (
    profile &&
    (profile.role !== "student" || (profile.grade_id && profile.grade))
  ) {
    redirect(dashboardPathForRole(profile.role));
  }

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Clock3 aria-hidden="true" className="size-5" />
          </span>
          <CardTitle className="mt-2 text-xl">
            <Bi
              en="Your account is almost ready"
              ar="حسابك على وشك الجاهزية"
              layout="stacked"
            />
          </CardTitle>
          <CardDescription>
            {profile ? (
              <Bi
                en="Your sign-in worked, but your teacher still needs to assign your grade before resources and assessments can appear."
                ar="تم تسجيل الدخول بنجاح، لكن معلمك لا يزال بحاجة إلى تحديد صفك قبل ظهور المصادر والتقييمات."
              />
            ) : (
              <Bi
                en="Your sign-in worked, but no profile record was found yet. Ask your teacher to finish setting up your account."
                ar="تم تسجيل الدخول بنجاح، لكن لم يُعثر على ملف تعريفي بعد. اطلب من معلمك إكمال إعداد حسابك."
              />
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bi en="Signed in as" ar="مسجّل الدخول باسم" />
            </p>
            <p className="mt-1 break-all font-semibold">
              {profile?.full_name_en ?? (
                <Bi en="Your account" ar="حسابك" hideSeparator />
              )}
            </p>
            {profile?.email ? (
              <p className="break-all text-xs text-muted-foreground">
                {profile.email}
              </p>
            ) : null}
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full">
              <LogOut aria-hidden="true" />
              <Bi en="Sign out" ar="تسجيل الخروج" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
