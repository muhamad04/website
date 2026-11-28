import { redirect } from "next/navigation";
import { LogOut, ShieldAlert } from "lucide-react";
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
  title: "Account inactive · الحساب غير نشط",
};

export const dynamic = "force-dynamic";

export default async function AccountDisabledPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-12"
      >
        <SupabaseSetupNotice bilingual />
      </main>
    );
  }

  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/account-pending");
  }

  if (profile.is_active) {
    redirect(dashboardPathForRole(profile.role));
  }

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldAlert aria-hidden="true" className="size-5" />
          </span>
          <CardTitle className="mt-2 text-xl">
            <Bi bilingual
              en="This account is inactive"
              ar="هذا الحساب غير نشط"
              layout="stacked"
            />
          </CardTitle>
          <CardDescription>
            <Bi bilingual
              en="Access has been paused by the teacher. If you think this is a mistake, please contact your teacher to reactivate your account."
              ar="تم إيقاف الوصول بواسطة المعلم. إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع معلمك لإعادة تنشيط حسابك."
            />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bi bilingual en="Account" ar="الحساب" />
            </p>
            <p className="mt-1 break-all font-semibold">
              {profile.full_name_en}
            </p>
            {profile.email ? (
              <p className="break-all text-xs text-muted-foreground">
                {profile.email}
              </p>
            ) : null}
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full">
              <LogOut aria-hidden="true" />
              <Bi bilingual en="Sign out" ar="تسجيل الخروج" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
