import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Settings2,
  Sheet,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/dal";
import {
  countFailedSyncs,
  getReportingSettingsForPage,
  listReportingEvents,
  listSyncLogs,
} from "@/lib/data/reporting";
import { getSheetsCredentialStatus } from "@/lib/reporting/sheets";
import { reportingUi } from "@/lib/i18n/reporting";
import { formatAdminDateTime } from "@/lib/students/format";
import { REPORTING_ERROR_CODES } from "@/lib/validation/reporting";
import { cn } from "@/lib/utils";
import { updateReportingSettingsAction } from "@/app/(app)/teacher/reporting/actions";
import {
  ConnectivityButton,
  RetryAllSyncButton,
  RetrySyncButton,
} from "@/app/(app)/teacher/reporting/reporting-actions";

export const metadata: Metadata = {
  title: "Google Sheets reporting · تقارير Google Sheets",
};

export const dynamic = "force-dynamic";

function syncVariant(
  status: "pending" | "synced" | "failed" | "skipped",
): "success" | "outline" | "muted" {
  if (status === "synced") {
    return "success";
  }

  if (status === "failed") {
    return "outline";
  }

  return "muted";
}

function detailSummary(detail: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(detail)) {
    if (parts.length >= 4) {
      break;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const text = String(value).slice(0, 60);
      parts.push(`${key}: ${text}`);
    }
  }

  return parts.join(" · ");
}

function errorCode(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;

  return REPORTING_ERROR_CODES.find((code) => code === raw) ?? null;
}

export default async function ReportingAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const saved = (Array.isArray(params.saved) ? params.saved[0] : params.saved) === "1";
  const failureCode = errorCode(params.error);

  const [settings, credentials, logs, events, failedCount] = await Promise.all([
    getReportingSettingsForPage(),
    Promise.resolve(getSheetsCredentialStatus()),
    listSyncLogs(30),
    listReportingEvents(25),
    countFailedSyncs(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Bi
            en={reportingUi.admin.eyebrow.en}
            ar={reportingUi.admin.eyebrow.ar}
          />
        }
        title={
          <Bi en={reportingUi.admin.title.en} ar={reportingUi.admin.title.ar} />
        }
        description={
          <Bi
            en={reportingUi.admin.subtitle.en}
            ar={reportingUi.admin.subtitle.ar}
          />
        }
        actions={
          <>
            <Link
              href="/teacher/results"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
              <Bi en="Results" ar="النتائج" />
            </Link>
            <Badge variant="muted">
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              <Bi en="Administrators only" ar="للمسؤولين فقط" />
            </Badge>
          </>
        }
      />

      {saved ? (
        <Alert variant="success">
          <Bi
            en={reportingUi.admin.saved.en}
            ar={reportingUi.admin.saved.ar}
          />
        </Alert>
      ) : null}

      {failureCode ? (
        <Alert variant="error">
          <Bi
            en={reportingUi.errors[failureCode].en}
            ar={reportingUi.errors[failureCode].ar}
          />
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 aria-hidden="true" className="size-4 text-primary" />
              <Bi
                en={reportingUi.admin.settings.en}
                ar={reportingUi.admin.settings.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en={reportingUi.admin.settingsHint.en}
                ar={reportingUi.admin.settingsHint.ar}
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateReportingSettingsAction} className="space-y-4">
              <label className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <input
                  type="checkbox"
                  name="sync_enabled"
                  defaultChecked={settings.syncEnabled}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span className="space-y-0.5">
                  <span className="block font-semibold text-foreground">
                    <Bi
                      en={reportingUi.admin.syncEnabled.en}
                      ar={reportingUi.admin.syncEnabled.ar}
                    />
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    <Bi
                      en={reportingUi.admin.syncEnabledHint.en}
                      ar={reportingUi.admin.syncEnabledHint.ar}
                    />
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <input
                  type="checkbox"
                  name="mock_mode"
                  defaultChecked={settings.mockMode}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span className="space-y-0.5">
                  <span className="block font-semibold text-foreground">
                    <Bi
                      en={reportingUi.admin.mockMode.en}
                      ar={reportingUi.admin.mockMode.ar}
                    />
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    <Bi
                      en={reportingUi.admin.mockModeHint.en}
                      ar={reportingUi.admin.mockModeHint.ar}
                    />
                  </span>
                </span>
              </label>

              <div className="space-y-1.5">
                <Label htmlFor="sheet-name">
                  <Bi
                    en={reportingUi.admin.sheetName.en}
                    ar={reportingUi.admin.sheetName.ar}
                  />
                </Label>
                <Input
                  id="sheet-name"
                  name="sheet_name"
                  defaultValue={settings.sheetName}
                  maxLength={100}
                  required
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  <Bi
                    en={reportingUi.admin.sheetNameHint.en}
                    ar={reportingUi.admin.sheetNameHint.ar}
                  />
                </p>
              </div>

              <Button type="submit" size="sm">
                <Settings2 aria-hidden="true" className="size-3.5" />
                <Bi en={reportingUi.admin.save.en} ar={reportingUi.admin.save.ar} />
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound aria-hidden="true" className="size-4 text-primary" />
              <Bi
                en={reportingUi.admin.credentials.en}
                ar={reportingUi.admin.credentials.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en={reportingUi.admin.credentialsHint.en}
                ar={reportingUi.admin.credentialsHint.ar}
              />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 text-sm">
              {[
                {
                  label: reportingUi.admin.clientEmail,
                  value: credentials.clientEmailConfigured,
                },
                {
                  label: reportingUi.admin.privateKey,
                  value: credentials.privateKeyConfigured,
                },
                {
                  label: reportingUi.admin.spreadsheet,
                  value: credentials.spreadsheetConfigured,
                },
              ].map((row) => (
                <div
                  key={row.label.en}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2"
                >
                  <dt className="min-w-0">
                    <Bi en={row.label.en} ar={row.label.ar} />
                  </dt>
                  <dd>
                    <Badge variant={row.value ? "success" : "outline"}>
                      {row.value ? (
                        <CheckCircle2 aria-hidden="true" className="size-3" />
                      ) : (
                        <TriangleAlert aria-hidden="true" className="size-3" />
                      )}
                      <Bi
                        en={
                          row.value
                            ? reportingUi.admin.configured.en
                            : reportingUi.admin.notConfigured.en
                        }
                        ar={
                          row.value
                            ? reportingUi.admin.configured.ar
                            : reportingUi.admin.notConfigured.ar
                        }
                        hideSeparator
                      />
                    </Badge>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  <Bi
                    en={reportingUi.admin.sheetName.en}
                    ar={reportingUi.admin.sheetName.ar}
                  />
                </p>
                <p dir="ltr" className="break-all">
                  {settings.sheetName}
                </p>
              </div>
              {settings.mockMode ? (
                <Badge variant="muted">
                  <Bi
                    en={reportingUi.admin.connectivitySkipped.en}
                    ar={reportingUi.admin.connectivitySkipped.ar}
                    hideSeparator
                  />
                </Badge>
              ) : (
                <ConnectivityButton />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  <Bi
                    en={reportingUi.admin.logs.en}
                    ar={reportingUi.admin.logs.ar}
                  />
                </p>
                <p>
                  <Bi
                    en={`${failedCount} failed row${failedCount === 1 ? "" : "s"} waiting for a retry`}
                    ar={`${failedCount} صف فاشل بانتظار إعادة المحاولة`}
                    hideSeparator
                  />
                </p>
              </div>
              <RetryAllSyncButton count={failedCount} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sheet aria-hidden="true" className="size-4 text-primary" />
              <Bi en={reportingUi.admin.logs.en} ar={reportingUi.admin.logs.ar} />
            </CardTitle>
            <CardDescription>
              <Bi
                en={reportingUi.admin.logsHint.en}
                ar={reportingUi.admin.logsHint.ar}
              />
            </CardDescription>
          </div>
          <RefreshCw
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-0 sm:pb-0">
          {logs.hasError ? (
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <Alert variant="error">
                <Bi
                  en={reportingUi.admin.logsError.en}
                  ar={reportingUi.admin.logsError.ar}
                />
              </Alert>
            </div>
          ) : logs.logs.length === 0 ? (
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <EmptyState
                icon={Sheet}
                title={
                  <Bi
                    en={reportingUi.admin.noLogs.en}
                    ar={reportingUi.admin.noLogs.ar}
                  />
                }
                description={
                  <Bi
                    en={reportingUi.admin.noLogsHint.en}
                    ar={reportingUi.admin.noLogsHint.ar}
                  />
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[54rem] text-sm">
                <caption className="sr-only">
                  Sync log / سجل المزامنة
                </caption>
                <thead className="bg-secondary/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.columns.attempt.en}
                        ar={reportingUi.admin.columns.attempt.ar}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.columns.status.en}
                        ar={reportingUi.admin.columns.status.ar}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.columns.tries.en}
                        ar={reportingUi.admin.columns.tries.ar}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.columns.updated.en}
                        ar={reportingUi.admin.columns.updated.ar}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.columns.error.en}
                        ar={reportingUi.admin.columns.error.ar}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.columns.action.en}
                        ar={reportingUi.admin.columns.action.ar}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.logs.map((log) => (
                    <tr key={log.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {log.attempt?.assessment?.title_en ?? log.attempt_id}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {log.attempt?.student?.full_name_en ?? "—"}
                          {log.attempt?.submitted_at
                            ? ` · ${formatAdminDateTime(log.attempt.submitted_at)}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={syncVariant(log.status)}>
                          <Bi
                            en={reportingUi.syncStatus[log.status].en}
                            ar={reportingUi.syncStatus[log.status].ar}
                            hideSeparator
                          />
                        </Badge>
                        {log.row_reference ? (
                          <p
                            dir="ltr"
                            className="mt-1 text-[11px] text-muted-foreground"
                          >
                            {log.row_reference}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {log.attempt_count}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatAdminDateTime(log.last_attempted_at)}
                      </td>
                      <td className="max-w-64 px-4 py-3 text-xs text-muted-foreground">
                        <span className="line-clamp-3 break-words">
                          {log.last_error ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.status === "failed" ? (
                          <RetrySyncButton attemptId={log.attempt_id} />
                        ) : (
                          <RetrySyncButton
                            attemptId={log.attempt_id}
                            mode="manual"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            <Bi
              en={reportingUi.admin.events.en}
              ar={reportingUi.admin.events.ar}
            />
          </CardTitle>
          <CardDescription>
            <Bi
              en={reportingUi.admin.eventsHint.en}
              ar={reportingUi.admin.eventsHint.ar}
            />
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-0 sm:pb-0">
          {events.hasError ? (
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <Alert variant="error">
                <Bi
                  en={reportingUi.admin.eventsError.en}
                  ar={reportingUi.admin.eventsError.ar}
                />
              </Alert>
            </div>
          ) : events.events.length === 0 ? (
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <EmptyState
                icon={ShieldCheck}
                title={
                  <Bi
                    en={reportingUi.admin.noEvents.en}
                    ar={reportingUi.admin.noEvents.ar}
                  />
                }
                description={
                  <Bi
                    en={reportingUi.admin.eventsHint.en}
                    ar={reportingUi.admin.eventsHint.ar}
                  />
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">
                  Reporting audit / سجل إدارة التقارير
                </caption>
                <thead className="bg-secondary/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.eventsColumns.action.en}
                        ar={reportingUi.admin.eventsColumns.action.ar}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.eventsColumns.actor.en}
                        ar={reportingUi.admin.eventsColumns.actor.ar}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.eventsColumns.when.en}
                        ar={reportingUi.admin.eventsColumns.when.ar}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={reportingUi.admin.eventsColumns.detail.en}
                        ar={reportingUi.admin.eventsColumns.detail.ar}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {events.events.map((event) => (
                    <tr key={event.id} className="align-top">
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          <Bi
                            en={reportingUi.admin.actionLabels[event.action].en}
                            ar={reportingUi.admin.actionLabels[event.action].ar}
                            hideSeparator
                          />
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {event.actor?.full_name_en ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatAdminDateTime(event.created_at)}
                      </td>
                      <td className="max-w-80 px-4 py-3 text-xs text-muted-foreground">
                        <span className="break-words">
                          {detailSummary(event.detail) || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
