import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Bi } from "@/components/bilingual";
import { ui } from "@/lib/i18n/dictionary";

export function AuthShell({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border/70 bg-background/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
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
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            <Bi bilingual
              en={ui.appTagline.en}
              ar={ui.appTagline.ar}
              layout="stacked"
            />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-8 sm:px-6 sm:py-12"
      >
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_minmax(0,26rem)]">
          <div className="hidden lg:block">{aside}</div>
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </main>

      <footer className="border-t border-border/70 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <Bi bilingual
            en="English teaching resources & assessments · Egypt"
            ar="مصادر وتقييمات لتعليم اللغة الإنجليزية · مصر"
          />
        </div>
      </footer>
    </div>
  );
}
