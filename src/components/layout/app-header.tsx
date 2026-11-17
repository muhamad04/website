import Link from "next/link";
import { BookOpenCheck, LogOut } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { isStaffRole } from "@/lib/domain/roles";
import type { ProfileWithRelations } from "@/lib/domain/types";
import { ui, type Bilingual } from "@/lib/i18n/dictionary";

type NavItem = {
  href: string | null;
  label: Bilingual;
};

const staffNavigation: NavItem[] = [
  { href: "/teacher/students", label: ui.nav.students },
  { href: "/teacher/classes", label: ui.nav.classes },
  { href: "/teacher/resources", label: ui.nav.resources },
  { href: "/teacher/assessments", label: ui.nav.assessments },
  { href: "/teacher/results", label: ui.nav.results },
];

const adminNavigation: NavItem[] = [
  { href: "/teacher/reporting", label: ui.nav.reporting },
  { href: "/teacher/staff", label: ui.nav.staff },
];

const studentNavigation: NavItem[] = [
  { href: "/student/resources", label: ui.nav.resources },
  { href: "/student/assessments?type=quiz", label: ui.nav.quizzes },
  { href: "/student/assessments?type=exam", label: ui.nav.exams },
  { href: "/student/assessments?view=completed", label: ui.nav.results },
];

export function AppHeader({ profile }: { profile: ProfileWithRelations }) {
  const staff = isStaffRole(profile.role);
  const roleLabels = ui.roles[profile.role];
  const dashboardHref = staff ? "/teacher" : "/student";
  const navigation = staff
    ? [
        ...staffNavigation,
        ...(profile.role === "admin" ? adminNavigation : []),
      ]
    : studentNavigation;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <Link
          href={dashboardHref}
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BookOpenCheck aria-hidden="true" className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-foreground">
              {ui.appName.en}
            </span>
            <span
              lang="ar"
              dir="rtl"
              className="font-arabic block text-xs text-muted-foreground"
            >
              {ui.appName.ar}
            </span>
          </span>
        </Link>

        <nav
          aria-label="Main navigation / التنقل الرئيسي"
          className="order-3 -mx-1 w-full overflow-x-auto pb-0.5 md:order-none md:mx-0 md:w-auto md:flex-1"
        >
          <ul className="flex min-w-max items-center gap-1 px-1">
            <li>
              <Link
                href={dashboardHref}
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Bi en={ui.nav.dashboard.en} ar={ui.nav.dashboard.ar} />
              </Link>
            </li>
            {navigation.map((item) => (
              <li key={item.label.en}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Bi
                      en={item.label.en}
                      ar={item.label.ar}
                      hideSeparator
                    />
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title="Coming in a later phase / ستتوفر في مرحلة لاحقة"
                    className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground/70"
                  >
                    <Bi
                      en={item.label.en}
                      ar={item.label.ar}
                      hideSeparator
                    />
                    <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                      <Bi
                        en={ui.common.soon.en}
                        ar={ui.common.soon.ar}
                        hideSeparator
                      />
                    </Badge>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <div className="hidden min-w-0 max-w-52 text-right sm:block">
            <div className="truncate text-sm font-semibold text-foreground">
              <Bi
                en={profile.full_name_en}
                ar={profile.full_name_ar ?? profile.full_name_en}
                hideSeparator
              />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center justify-end gap-x-1.5 text-xs text-muted-foreground">
              <Bi en={roleLabels.en} ar={roleLabels.ar} />
              {profile.grade ? (
                <>
                  <span aria-hidden="true">·</span>
                  <Bi
                    en={profile.grade.name_en}
                    ar={profile.grade.name_ar}
                    hideSeparator
                  />
                </>
              ) : null}
            </div>
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut aria-hidden="true" className="size-3.5" />
              <Bi en={ui.common.signOut.en} ar={ui.common.signOut.ar} />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
