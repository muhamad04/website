import { redirect } from "next/navigation";
import {
  BookOpenCheck,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { Bi } from "@/components/bilingual";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthShell } from "@/components/layout/auth-shell";
import { SupabaseSetupNotice } from "@/components/layout/supabase-setup-notice";
import { LoginForm } from "@/app/login/login-form";
import { getCurrentProfile, getSessionUser } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";
import { dashboardPathForRole } from "@/lib/domain/roles";
import { ui } from "@/lib/i18n/dictionary";
import { AUTH_ERROR_CODES, type AuthErrorCode } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Sign in · تسجيل الدخول",
};

export const dynamic = "force-dynamic";

const features = [
  {
    icon: BookOpenCheck,
    en: "Grade-scoped resources",
    ar: "مصادر مخصّصة لكل صف",
  },
  {
    icon: Clock3,
    en: "Timed quizzes and exams",
    ar: "اختبارات وامتحانات بوقت محدد",
  },
  {
    icon: ClipboardCheck,
    en: "Automatic and manual grading",
    ar: "تصحيح تلقائي ويدوي",
  },
  {
    icon: Users,
    en: "Clear results for teacher and student",
    ar: "نتائج واضحة للمعلم والطالب",
  },
];

const callbackNotice = {
  en: "That sign-in link is invalid or has expired. Ask your teacher for a new one.",
  ar: "رابط تسجيل الدخول غير صالح أو منتهي. اطلب رابطًا جديدًا من معلمك.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
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

  if (user) {
    const profile = await getCurrentProfile();

    if (profile) {
      redirect(
        profile.is_active ? dashboardPathForRole(profile.role) : "/account-disabled",
      );
    }

    redirect("/account-pending");
  }

  const params = await searchParams;
  const rawError = params.error;
  const initialError: AuthErrorCode | undefined =
    rawError &&
    rawError !== "auth_callback_failed" &&
    AUTH_ERROR_CODES.includes(rawError as AuthErrorCode)
      ? (rawError as AuthErrorCode)
      : undefined;

  return (
    <AuthShell
      aside={
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <GraduationCap aria-hidden="true" className="size-4" />
            <Bi bilingual
              en="Bilingual teaching platform"
              ar="منصة تعليمية ثنائية اللغة"
            />
          </div>

          <div className="space-y-4">
            <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-foreground">
              <Bi bilingual
                en="A calm home for English teaching and learning."
                ar="مساحة هادئة لتعليم وتعلّم اللغة الإنجليزية."
                layout="stacked"
              />
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              <Bi bilingual
                en="Resources, timed assessments and results stay organised by grade, in English and Arabic together."
                ar="تبقى المصادر والاختبارات المحددة بوقت والنتائج منظمة حسب الصف، باللغتين الإنجليزية والعربية معًا."
              />
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <li
                key={feature.en}
                className="flex items-start gap-3 rounded-xl border border-border bg-card/80 p-3.5 shadow-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <feature.icon aria-hidden="true" className="size-4" />
                </span>
                <Bi bilingual
                  en={feature.en}
                  ar={feature.ar}
                  layout="stacked"
                  className="text-sm font-semibold text-foreground"
                  arClassName="font-medium text-muted-foreground"
                />
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            <Bi bilingual
              en="Role-based access · Private grade content"
              ar="صلاحيات حسب الدور · محتوى خاص بكل صف"
            />
          </div>
        </div>
      }
    >
      <Card className="shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl">
            <Bi bilingual
              en={ui.login.title.en}
              ar={ui.login.title.ar}
              layout="stacked"
            />
          </CardTitle>
          <CardDescription>
            <Bi bilingual
              en={ui.login.subtitle.en}
              ar={ui.login.subtitle.ar}
              layout="stacked"
            />
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {rawError === "auth_callback_failed" ? (
            <Alert variant="error">
              <Bi bilingual
                en={callbackNotice.en}
                ar={callbackNotice.ar}
                layout="stacked"
              />
            </Alert>
          ) : null}

          <LoginForm initialError={initialError} />

          <div className="space-y-2 border-t border-border/70 pt-4 text-xs leading-relaxed text-muted-foreground">
            <Bi bilingual
              en={ui.login.noRegistration.en}
              ar={ui.login.noRegistration.ar}
              layout="stacked"
            />
            <Bi bilingual
              en={ui.login.needHelp.en}
              ar={ui.login.needHelp.ar}
              layout="stacked"
            />
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
