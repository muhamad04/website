import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { AuthShell } from "@/components/layout/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile, getSessionUser } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";
import { dashboardPathForRole } from "@/lib/domain/roles";
import { studentsUi } from "@/lib/i18n/students";
import { ui } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { SetPasswordForm } from "@/app/set-password/set-password-form";

export const metadata: Metadata = {
  title: "Set password · تعيين كلمة المرور",
};

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=config");
  }

  const user = await getSessionUser();

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound aria-hidden="true" className="size-5" />
          </div>
          <CardTitle className="text-xl">
            <Bi
              en={studentsUi.password.title.en}
              ar={studentsUi.password.title.ar}
              layout="stacked"
            />
          </CardTitle>
          <CardDescription>
            <Bi
              en={
                user
                  ? studentsUi.password.subtitle.en
                  : studentsUi.password.expired.en
              }
              ar={
                user
                  ? studentsUi.password.subtitle.ar
                  : studentsUi.password.expired.ar
              }
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <SetPasswordForm
              nextPath={await nextPathForUser()}
            />
          ) : (
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              <Bi en={ui.common.signIn.en} ar={ui.common.signIn.ar} />
            </Link>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}

async function nextPathForUser(): Promise<string> {
  const profile = await getCurrentProfile();
  return profile ? dashboardPathForRole(profile.role) : "/";
}
