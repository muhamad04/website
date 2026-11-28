"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { reportingUi } from "@/lib/i18n/reporting";
import {
  checkReportingConnectivityAction,
  retryAllFailedSyncAction,
  retrySyncAction,
  syncAttemptNowAction,
} from "@/app/(app)/teacher/reporting/actions";

function Feedback({
  ok,
  message,
}: {
  ok: boolean;
  message: string | null;
}) {
  if (!message) {
    return null;
  }

  return (
    <span
      role="status"
      className={
        ok ? "text-xs font-medium text-success" : "text-xs font-medium text-destructive"
      }
    >
      {message}
    </span>
  );
}

export function ConnectivityButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const check = () => {
    setResult(null);

    startTransition(async () => {
      const outcome = await checkReportingConnectivityAction();

      setResult({
        ok: outcome.ok,
        message: outcome.message ?? "",
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={check} disabled={pending}>
        <RefreshCw aria-hidden="true" className="size-3.5" />
        <Bi
          en={pending ? reportingUi.admin.checking.en : reportingUi.admin.checkConnectivity.en}
          ar={pending ? reportingUi.admin.checking.en : reportingUi.admin.checkConnectivity.en}
        />
      </Button>
      {result ? (
        result.ok ? (
          <Feedback
            ok
            message={`${reportingUi.admin.connectivityOk.en}`}
          />
        ) : (
          <Feedback
            ok={false}
            message={`${reportingUi.admin.connectivityFailed.en}`}
          />
        )
      ) : null}
      {result && !result.ok && result.message ? (
        <span className="w-full break-words text-[11px] text-muted-foreground">
          {result.message}
        </span>
      ) : null}
    </div>
  );
}

export function RetrySyncButton({
  attemptId,
  mode = "retry",
}: {
  attemptId: string;
  mode?: "retry" | "manual";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"ok" | "error" | null>(null);

  const retry = () => {
    setOutcome(null);

    startTransition(async () => {
      const result =
        mode === "retry"
          ? await retrySyncAction({ attempt_id: attemptId })
          : await syncAttemptNowAction({ attempt_id: attemptId });
      setOutcome(result.ok ? "ok" : "error");
      router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" onClick={retry} disabled={pending}>
        <RefreshCw aria-hidden="true" className="size-3.5" />
        <Bi
          en={
            pending
              ? reportingUi.admin.retrying.en
              : mode === "retry"
                ? reportingUi.admin.retry.en
                : reportingUi.admin.syncNow.en
          }
          ar={
            pending
              ? reportingUi.admin.retrying.en
              : mode === "retry"
                ? reportingUi.admin.retry.en
                : reportingUi.admin.syncNow.en
          }
        />
      </Button>
      {outcome ? (
        <span
          role="status"
          className={
            outcome === "ok"
              ? "text-[11px] text-success"
              : "text-[11px] text-destructive"
          }
        >
          <Bi
            en={
              outcome === "ok"
                ? reportingUi.admin.retryQueued.en
                : reportingUi.admin.retryFailed.en
            }
            ar={
              outcome === "ok"
                ? reportingUi.admin.retryQueued.en
                : reportingUi.admin.retryFailed.en
            }
          />
        </span>
      ) : null}
    </span>
  );
}

export function RetryAllSyncButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"ok" | "error" | null>(null);

  const retry = () => {
    setOutcome(null);

    startTransition(async () => {
      const result = await retryAllFailedSyncAction();
      setOutcome(result.ok ? "ok" : "error");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={retry}
        disabled={pending || count === 0}
      >
        <RefreshCw aria-hidden="true" className="size-3.5" />
        <Bi
          en={pending ? reportingUi.admin.retrying.en : reportingUi.admin.retryAll.en}
          ar={pending ? reportingUi.admin.retrying.en : reportingUi.admin.retryAll.en}
        />
        {count > 0 ? (
          <span className="rounded-full bg-secondary px-1.5 text-[10px] font-bold text-secondary-foreground">
            {count}
          </span>
        ) : null}
      </Button>
      {outcome ? (
        <Feedback
          ok={outcome === "ok"}
          message={
            outcome === "ok"
              ? `${reportingUi.admin.retryQueued.en}`
              : `${reportingUi.admin.retryFailed.en}`
          }
        />
      ) : null}
    </div>
  );
}
