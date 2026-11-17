"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="flex flex-1 items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold">
          <Bi
            en="Something went wrong"
            ar="حدث خطأ ما"
            layout="stacked"
          />
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <Bi
            en="The page could not be loaded. Your data is safe. Try again, or return to your dashboard."
            ar="تعذّر تحميل الصفحة. بياناتك آمنة. حاول مرة أخرى أو عد إلى لوحة التحكم."
          />
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset}>
            <Bi en="Try again" ar="حاول مرة أخرى" />
          </Button>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Bi en="Back to dashboard" ar="العودة إلى لوحة التحكم" />
          </Link>
        </div>
      </div>
    </main>
  );
}
