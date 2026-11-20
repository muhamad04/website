import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutDashboard,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { AttemptsTable } from "@/components/reporting/attempts-table";
import { ReportFiltersBar } from "@/components/reporting/report-filters";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireTeacher } from "@/lib/auth/dal";
import { maybeFinalizeStaleAttempts } from "@/lib/assessments/lazy-sweep";
import {
  getTeacherResults,
  listReportingOptions,
} from "@/lib/data/reporting";
import { reportingUi } from "@/lib/i18n/reporting";
import {
  REPORTING_PAGE_SIZE,
  buildReportQuery,
  hasReportFilters,
  parseReportFilters,
} from "@/lib/reporting/filters";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Results reporting · تقارير النتائج",
};

export const dynamic = "force-dynamic";

export default async function TeacherResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeacher();
  await maybeFinalizeStaleAttempts(25);
  const filters = parseReportFilters(await searchParams);
  const [results, options] = await Promise.all([
    getTeacherResults(filters),
    listReportingOptions(),
  ]);
  const filtered = hasReportFilters(filters);
  const start =
    results.total === 0 ? 0 : (results.page - 1) * REPORTING_PAGE_SIZE + 1;
  const end = Math.min(results.page * REPORTING_PAGE_SIZE, results.total);
  const exportHref = `/teacher/results/export${buildReportQuery(filters, {
    page: 1,
  })}`;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi
            en={reportingUi.results.eyebrow.en}
            ar={reportingUi.results.eyebrow.ar}
          />
        }
        title={
          <Bi
            en={reportingUi.results.title.en}
            ar={reportingUi.results.title.ar}
          />
        }
        description={
          <Bi
            en={reportingUi.results.subtitle.en}
            ar={reportingUi.results.subtitle.ar}
          />
        }
        actions={
          <>
            <Link
              href="/teacher"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <LayoutDashboard aria-hidden="true" className="size-4" />
              <Bi en="Dashboard" ar="لوحة التحكم" />
            </Link>
            <Link
              href={exportHref}
              prefetch={false}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Download aria-hidden="true" className="size-4" />
              <Bi
                en={reportingUi.results.exportCsv.en}
                ar={reportingUi.results.exportCsv.ar}
              />
            </Link>
          </>
        }
      />

      {results.hasError ? (
        <Alert variant="error">
          <Bi
            en={reportingUi.results.error.en}
            ar={reportingUi.results.error.ar}
          />
        </Alert>
      ) : null}

      <ReportFiltersBar
        action="/teacher/results"
        filters={filters}
        options={options}
        showSearch
        idPrefix="results"
      />

      <p className="text-xs text-muted-foreground">
        <Bi
          en={reportingUi.results.exportHint.en}
          ar={reportingUi.results.exportHint.ar}
        />
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">
          {results.total === 0 ? (
            <Bi
              en={reportingUi.results.noRows.en}
              ar={reportingUi.results.noRows.ar}
            />
          ) : (
            <Bi
              en={`${reportingUi.results.showing.en} ${start}–${end} ${reportingUi.results.of.en} ${results.total}`}
              ar={`${reportingUi.results.showing.ar} ${start}–${end} ${reportingUi.results.of.ar} ${results.total}`}
            />
          )}
        </p>
        {results.pageCount > 1 ? (
          <p>
            <Bi
              en={`${reportingUi.results.page.en} ${results.page} ${reportingUi.results.of.en} ${results.pageCount}`}
              ar={`${reportingUi.results.page.ar} ${results.page} ${reportingUi.results.of.ar} ${results.pageCount}`}
            />
          </p>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <AttemptsTable rows={results.rows} emptyFiltered={filtered} />
      </Card>

      {results.pageCount > 1 ? (
        <nav
          aria-label="Results pagination / ترقيم صفحات النتائج"
          className="flex items-center justify-between gap-2"
        >
          {results.page > 1 ? (
            <Link
              href={`/teacher/results${buildReportQuery(filters, {
                page: results.page - 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
              <Bi
                en={reportingUi.results.previous.en}
                ar={reportingUi.results.previous.ar}
              />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "pointer-events-none opacity-50",
              )}
            >
              <ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
              <Bi
                en={reportingUi.results.previous.en}
                ar={reportingUi.results.previous.ar}
              />
            </span>
          )}

          {results.page < results.pageCount ? (
            <Link
              href={`/teacher/results${buildReportQuery(filters, {
                page: results.page + 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi
                en={reportingUi.results.next.en}
                ar={reportingUi.results.next.ar}
              />
              <ChevronRight aria-hidden="true" className="size-4 rtl:rotate-180" />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "pointer-events-none opacity-50",
              )}
            >
              <Bi
                en={reportingUi.results.next.en}
                ar={reportingUi.results.next.ar}
              />
              <ChevronRight aria-hidden="true" className="size-4 rtl:rotate-180" />
            </span>
          )}
        </nav>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
        <Link href="/teacher/assessments" className="underline underline-offset-2">
          <Bi en="Manage assessments" ar="إدارة التقييمات" />
        </Link>
      </p>
    </div>
  );
}
