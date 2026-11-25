import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { FileUp, History } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { ImportUploadForm } from "@/components/assessments/import-upload-form";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireTeacher } from "@/lib/auth/dal";
import { listRecentImportDrafts } from "@/lib/data/imports";
import { listGradeOptions } from "@/lib/data/students";
import { cleanupExpiredImports } from "@/lib/import/cleanup";
import { getImportMaxBytes, getImportMaxTotalBytes } from "@/lib/import/config";
import { importsUi } from "@/lib/i18n/imports";
import { formatAdminDateTime } from "@/lib/students/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Import an assessment · استيراد اختبار",
};

export const dynamic = "force-dynamic";

export default async function AssessmentImportPage() {
  await requireTeacher();

  const [grades, drafts] = await Promise.all([
    listGradeOptions(),
    listRecentImportDrafts(5),
  ]);

  after(cleanupExpiredImports);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={importsUi.eyebrow.en} ar={importsUi.eyebrow.ar} />}
        title={<Bi en={importsUi.title.en} ar={importsUi.title.ar} />}
        description={
          <Bi en={importsUi.subtitle.en} ar={importsUi.subtitle.ar} />
        }
        actions={
          <Link
            href="/teacher/assessments"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Bi
              en={importsUi.common.backToAssessments.en}
              ar={importsUi.common.backToAssessments.ar}
            />
          </Link>
        }
      />

      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FileUp aria-hidden="true" className="size-4 text-primary" />
            <Bi
              en={importsUi.upload.formTitle.en}
              ar={importsUi.upload.formTitle.ar}
            />
          </h2>
          <p className="text-sm text-muted-foreground">
            <Bi
              en={importsUi.upload.formHint.en}
              ar={importsUi.upload.formHint.ar}
            />
          </p>
        </div>

        <ImportUploadForm
          grades={grades}
          maxBytes={getImportMaxBytes()}
          maxTotalBytes={getImportMaxTotalBytes()}
        />
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <History aria-hidden="true" className="size-4 text-primary" />
            <Bi
              en={importsUi.upload.recentTitle.en}
              ar={importsUi.upload.recentTitle.ar}
            />
          </h2>
          <p className="text-sm text-muted-foreground">
            <Bi
              en={importsUi.upload.recentHint.en}
              ar={importsUi.upload.recentHint.ar}
            />
          </p>
        </div>

        {drafts.length === 0 ? (
          <EmptyState
            icon={History}
            title={
              <Bi
                en={importsUi.upload.recentEmpty.en}
                ar={importsUi.upload.recentEmpty.ar}
              />
            }
            description={
              <Bi
                en={importsUi.upload.recentHint.en}
                ar={importsUi.upload.recentHint.ar}
              />
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    <Bi
                      en={
                        draft.draft?.settings?.titleEn ||
                        draft.source_file_name
                      }
                      ar=""
                      hideSeparator
                    />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Bi
                      en={`${draft.draft?.stats?.questionCount ?? 0} questions · expires ${formatAdminDateTime(draft.expires_at)}`}
                      ar={`${draft.draft?.stats?.questionCount ?? 0} سؤال · تنتهي ${formatAdminDateTime(draft.expires_at)}`}
                    />
                  </p>
                </div>
                <Link
                  href={`/teacher/assessments/import/${draft.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  <Bi
                    en={importsUi.upload.openDraft.en}
                    ar={importsUi.upload.openDraft.ar}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
