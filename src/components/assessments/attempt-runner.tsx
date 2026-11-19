"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock3, Paperclip, UploadCloud } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  heartbeatAttemptAction,
  prepareSubmissionUploadAction,
  saveAnswerAction,
  submitAttemptAction,
} from "@/app/(app)/student/assessments/actions";
import type {
  StudentAssessmentSection,
  StudentQuestion,
  SubmissionReason,
} from "@/lib/domain/types";
import { assessmentsUi, questionTypeCopy } from "@/lib/i18n/assessments";
import { heartbeatIntervalMs } from "@/lib/assessments/strict";
import {
  ASSESSMENT_MAX_FILE_BYTES,
  isAllowedSubmissionMime,
} from "@/lib/assessments/files";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { AssessmentErrorCode } from "@/lib/validation/assessments";

type AnswerState = {
  response: Record<string, unknown>;
  file_path: string | null;
  file_name: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function emptyAnswer(): AnswerState {
  return { response: {}, file_path: null, file_name: null };
}

function hasResponse(question: StudentQuestion, answer: AnswerState): boolean {
  if (question.type === "file_upload") {
    return Boolean(answer.file_path);
  }

  const response = answer.response;

  if (question.type === "multiple_choice") {
    return typeof response.selectedOptionId === "string";
  }

  if (question.type === "true_false") {
    return typeof response.value === "boolean";
  }

  if (question.type === "matching") {
    const pairs =
      response.pairs && typeof response.pairs === "object"
        ? (response.pairs as Record<string, string>)
        : {};

    return (
      question.left_items.length > 0 &&
      question.left_items.every((item) => Boolean(pairs[item.id]))
    );
  }

  return typeof response.text === "string" && response.text.trim() !== "";
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (part: number) => String(part).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

export function AttemptRunner({
  attemptId,
  assessmentId,
  expiresAt,
  serverTime,
  sections,
  initialAnswers,
  strictExamMode = false,
  submitOnTabHidden = false,
  submitOnNavigation = false,
  heartbeatTimeoutSeconds = 60,
  allowResumeAfterConnectionLoss = true,
}: {
  attemptId: string;
  assessmentId: string;
  expiresAt: string;
  serverTime: string;
  sections: StudentAssessmentSection[];
  initialAnswers: Array<{
    question_id: string;
    response: Record<string, unknown>;
    file_path: string | null;
    file_name?: string | null;
  }>;
  strictExamMode?: boolean;
  submitOnTabHidden?: boolean;
  submitOnNavigation?: boolean;
  heartbeatTimeoutSeconds?: number;
  allowResumeAfterConnectionLoss?: boolean;
}) {
  const router = useRouter();
  const questions = useMemo(
    () => sections.flatMap((section) => section.questions),
    [sections],
  );
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const initial: Record<string, AnswerState> = {};

    for (const answer of initialAnswers) {
      initial[answer.question_id] = {
        response: answer.response ?? {},
        file_path: answer.file_path,
        file_name: answer.file_name ?? null,
      };
    }

    return initial;
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<AssessmentErrorCode | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Date.parse(expiresAt) - Date.parse(serverTime)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [expired, startExpiryTransition] = useTransition();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  const lastFocusSignal = useRef(0);
  const unloadSignalSent = useRef(false);
  const resultUrl = `/student/assessments/${assessmentId}/attempt/${attemptId}/result`;

  const answeredCount = questions.filter((question) =>
    hasResponse(question, answers[question.id] ?? emptyAnswer()),
  ).length;

  const flushAnswers = useCallback(async () => {
    for (const question of questions) {
      const answer = answersRef.current[question.id];

      if (!answer || !hasResponse(question, answer)) {
        continue;
      }

      await saveAnswerAction({
        attempt_id: attemptId,
        question_id: question.id,
        response: answer.response,
        file_path: answer.file_path ?? undefined,
      });
    }
  }, [attemptId, questions]);

  const submit = useCallback(
    async (reason: SubmissionReason) => {
      if (submittedRef.current) {
        return;
      }

      submittedRef.current = true;
      setSubmitting(true);
      setError(null);

      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
      timers.current.clear();

      // Flush the latest answers before the attempt closes. After expiry the
      // database rejects writes, which is why the client also submits at zero.
      if (reason === "student_submitted") {
        await flushAnswers();
      }

      const outcome = await submitAttemptAction({
        attempt_id: attemptId,
        reason,
      });

      if (!outcome.ok) {
        submittedRef.current = false;
        setSubmitting(false);
        setError(outcome.error ?? "unknown");
        return;
      }

      router.push(resultUrl);
      router.refresh();
    },
    [attemptId, flushAnswers, resultUrl, router],
  );

  useEffect(() => {
    const deadline = Date.parse(expiresAt);
    const offset = Date.parse(serverTime) - Date.now();

    const tick = () => {
      const left = Math.max(0, deadline - (Date.now() + offset));
      setRemaining(left);

      if (left <= 0 && !submittedRef.current) {
        startExpiryTransition(() => {
          void submit("time_expired");
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, serverTime, submit]);

  const sendSignal = useCallback(
    async (
      signal: "tab_hidden" | "left_assessment" | "page_unloaded" | "connection_lost" | "focus_lost",
      options: { flush?: boolean; keepalive?: boolean } = {},
    ) => {
      if (submittedRef.current) {
        return;
      }

      if (options.flush) {
        await flushAnswers();
      }

      try {
        const response = await fetch(
          `/api/student/attempts/${attemptId}/signal`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ signal }),
            keepalive: Boolean(options.keepalive),
          },
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          submitted?: boolean;
          redirectTo?: string | null;
        };

        if (payload.submitted) {
          submittedRef.current = true;
          router.push(payload.redirectTo ?? resultUrl);
          router.refresh();
        }
      } catch {
        // Offline or the tab is already gone; the server heartbeat sweep is the
        // fallback. The browser signal is only a hint.
      }
    },
    [attemptId, flushAnswers, resultUrl, router],
  );

  useEffect(() => {
    if (!strictExamMode) {
      return;
    }

    let active = true;

    const beat = async () => {
      if (!active || submittedRef.current) {
        return;
      }

      const outcome = await heartbeatAttemptAction({ attempt_id: attemptId });

      if (!active) {
        return;
      }

      if (outcome.ok && outcome.closed) {
        submittedRef.current = true;
        router.push(resultUrl);
        router.refresh();
        return;
      }

      if (!outcome.ok && outcome.error === "attempt_closed") {
        submittedRef.current = true;
        router.push(resultUrl);
        router.refresh();
      }
    };

    void beat();
    const interval = setInterval(
      () => void beat(),
      heartbeatIntervalMs(heartbeatTimeoutSeconds),
    );

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    attemptId,
    heartbeatTimeoutSeconds,
    resultUrl,
    router,
    strictExamMode,
  ]);

  useEffect(() => {
    if (!strictExamMode) {
      return;
    }

    let visibilityTimer: ReturnType<typeof setTimeout> | null = null;

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (visibilityTimer !== null) {
          clearTimeout(visibilityTimer);
          visibilityTimer = null;
        }
        return;
      }

      if (unloadSignalSent.current) {
        return;
      }

      // Give `pagehide`/`beforeunload` a moment to win so closing a tab is
      // recorded as a page unload, not as a tab switch. Either way the server
      // is the authority on whether the attempt closes.
      visibilityTimer = setTimeout(() => {
        visibilityTimer = null;
        void sendSignal("tab_hidden", { flush: true });
      }, 250);
    };

    const clearVisibilityTimer = () => {
      if (visibilityTimer !== null) {
        clearTimeout(visibilityTimer);
        visibilityTimer = null;
      }
    };

    const onPageHide = () => {
      clearVisibilityTimer();

      if (unloadSignalSent.current) {
        return;
      }

      unloadSignalSent.current = true;
      void sendSignal("page_unloaded", { keepalive: true });
    };

    const onBeforeUnload = () => {
      clearVisibilityTimer();

      if (unloadSignalSent.current) {
        return;
      }

      unloadSignalSent.current = true;
      void sendSignal("page_unloaded", { keepalive: true });
    };

    const onOffline = () => {
      void sendSignal("connection_lost", { keepalive: true });
    };

    const onBlur = () => {
      const now = Date.now();

      if (now - lastFocusSignal.current < 15_000) {
        return;
      }

      lastFocusSignal.current = now;
      void sendSignal("focus_lost");
    };

    // Client-side navigation does not fire `beforeunload`. Catch links that
    // leave this page and back/forward navigation, and let the server decide.
    const onDocumentClick = (event: MouseEvent) => {
      if (!submitOnNavigation) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;

      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");

      if (!href || href.startsWith("#")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);

      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      void sendSignal("left_assessment", { keepalive: true });
    };

    const onPopState = () => {
      if (!submitOnNavigation) {
        return;
      }

      void sendSignal("left_assessment", { keepalive: true });
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("offline", onOffline);
    window.addEventListener("blur", onBlur);
    window.addEventListener("popstate", onPopState);

    return () => {
      clearVisibilityTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("popstate", onPopState);
    };
  }, [sendSignal, strictExamMode, submitOnNavigation]);

  useEffect(() => {
    const pending = timers.current;

    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);

  const persist = (questionId: string, next: AnswerState) => {
    setSaveState("saving");
    const existing = timers.current.get(questionId);

    if (existing) {
      clearTimeout(existing);
    }

    timers.current.set(
      questionId,
      setTimeout(async () => {
        timers.current.delete(questionId);
        const outcome = await saveAnswerAction({
          attempt_id: attemptId,
          question_id: questionId,
          response: next.response,
          file_path: next.file_path ?? undefined,
        });

        if (!outcome.ok) {
          setSaveState("error");
          setError(outcome.error ?? "unknown");
          return;
        }

        setSaveState("saved");
        setError(null);
      }, 700),
    );
  };

  const updateAnswer = (
    questionId: string,
    patch: Partial<AnswerState>,
    options: { save?: boolean } = {},
  ) => {
    const current = answersRef.current[questionId] ?? emptyAnswer();
    const next = { ...current, ...patch };
    const updated = { ...answersRef.current, [questionId]: next };
    answersRef.current = updated;
    setAnswers(updated);

    if (options.save !== false) {
      persist(questionId, next);
    }
  };

  const uploadFile = async (question: StudentQuestion, file: File) => {
    setError(null);

    if (!isAllowedSubmissionMime(file.type)) {
      setError("file_type_invalid");
      return;
    }

    if (file.size <= 0 || file.size > ASSESSMENT_MAX_FILE_BYTES) {
      setError("file_too_large");
      return;
    }

    setUploadingId(question.id);

    const prepared = await prepareSubmissionUploadAction({
      attempt_id: attemptId,
      question_id: question.id,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    });

    if (!prepared.ok || !prepared.upload) {
      setUploadingId(null);
      setError(prepared.error ?? "upload_failed");
      return;
    }

    const supabase = createBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from(prepared.upload.bucket)
      .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, {
        contentType: file.type,
      });

    if (uploadError) {
      setUploadingId(null);
      setError("upload_failed");
      return;
    }

    const next: AnswerState = {
      response: {},
      file_path: prepared.upload.path,
      file_name: file.name,
    };
    setAnswers((previous) => ({ ...previous, [question.id]: next }));
    answersRef.current = {
      ...answersRef.current,
      [question.id]: next,
    };

    const saved = await saveAnswerAction({
      attempt_id: attemptId,
      question_id: question.id,
      response: {},
      file_path: prepared.upload.path,
    });

    setUploadingId(null);

    if (!saved.ok) {
      setError(saved.error ?? "unknown");
      return;
    }

    setSaveState("saved");
  };

  const renderQuestion = (question: StudentQuestion, index: number) => {
    const answer = answers[question.id] ?? emptyAnswer();
    const response = answer.response;

    if (question.type === "multiple_choice") {
      return (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={response.selectedOptionId === option.id}
                onChange={() =>
                  updateAnswer(question.id, {
                    response: { selectedOptionId: option.id },
                  })
                }
                className="mt-0.5 size-4"
              />
              <Bi en={option.text_en} ar={option.text_ar ?? option.text_en} />
            </label>
          ))}
        </div>
      );
    }

    if (question.type === "true_false") {
      return (
        <div className="flex flex-wrap gap-4">
          {[true, false].map((value) => (
            <label
              key={String(value)}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-4 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={response.value === value}
                onChange={() =>
                  updateAnswer(question.id, { response: { value } })
                }
                className="size-4"
              />
              <Bi
                en={value ? "True" : "False"}
                ar={value ? "صحيح" : "خطأ"}
              />
            </label>
          ))}
        </div>
      );
    }

    if (question.type === "matching") {
      const pairs =
        response.pairs && typeof response.pairs === "object"
          ? (response.pairs as Record<string, string>)
          : {};

      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            <Bi
              en={assessmentsUi.student.matchHint.en}
              ar={assessmentsUi.student.matchHint.ar}
            />
          </p>
          {question.left_items.map((left) => (
            <div
              key={left.id}
              className="grid gap-2 rounded-lg border border-border/70 bg-background/60 p-3 sm:grid-cols-2 sm:items-center"
            >
              <div className="text-sm font-medium">
                <Bi en={left.text_en} ar={left.text_ar ?? left.text_en} />
              </div>
              <Select
                aria-label={`${left.text_en} match`}
                value={pairs[left.id] ?? ""}
                onChange={(event) => {
                  const nextPairs = { ...pairs };

                  if (event.target.value) {
                    nextPairs[left.id] = event.target.value;
                  } else {
                    delete nextPairs[left.id];
                  }

                  updateAnswer(question.id, {
                    response: Object.keys(nextPairs).length
                      ? { pairs: nextPairs }
                      : {},
                  });
                }}
              >
                <option value="">—</option>
                {question.right_items.map((right) => (
                  <option key={right.id} value={right.id}>
                    {right.text_en}
                    {right.text_ar ? ` · ${right.text_ar}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      );
    }

    if (question.type === "file_upload") {
      return (
        <div className="space-y-2">
          <p className="text-sm">
            {answer.file_path ? (
              <span className="inline-flex items-center gap-2 font-medium text-foreground">
                <Paperclip aria-hidden="true" className="size-4" />
                <Bi
                  en={answer.file_name ?? assessmentsUi.student.fileAttached.en}
                  ar={assessmentsUi.student.fileAttached.ar}
                  hideSeparator
                />
              </span>
            ) : (
              <span className="text-muted-foreground">
                <Bi
                  en={assessmentsUi.student.noFile.en}
                  ar={assessmentsUi.student.noFile.ar}
                />
              </span>
            )}
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold shadow-xs hover:bg-secondary">
            <UploadCloud aria-hidden="true" className="size-4" />
            <Bi
              en={
                uploadingId === question.id
                  ? assessmentsUi.actions.uploading.en
                  : answer.file_path
                    ? assessmentsUi.actions.uploadReplace.en
                    : assessmentsUi.actions.upload.en
              }
              ar={
                uploadingId === question.id
                  ? assessmentsUi.actions.uploading.ar
                  : answer.file_path
                    ? assessmentsUi.actions.uploadReplace.ar
                    : assessmentsUi.actions.upload.ar
              }
            />
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploadingId === question.id || submitting || expired}
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  void uploadFile(question, file);
                }

                event.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            <Bi
              en={assessmentsUi.student.fileHint.en}
              ar={assessmentsUi.student.fileHint.ar}
            />
          </p>
        </div>
      );
    }

    return (
      <Textarea
        value={typeof response.text === "string" ? response.text : ""}
        onChange={(event) =>
          updateAnswer(question.id, { response: { text: event.target.value } })
        }
        placeholder={
          question.type === "essay"
            ? `${assessmentsUi.student.essayAnswer.en} · ${assessmentsUi.student.essayAnswer.ar}`
            : `${assessmentsUi.student.writeAnswer.en} · ${assessmentsUi.student.writeAnswer.ar}`
        }
        className="min-h-32"
        maxLength={20000}
        aria-label={`${assessmentsUi.student.question.en} ${index + 1}`}
      />
    );
  };

  return (
    <div
      className="space-y-5"
      onCopy={strictExamMode ? (event) => event.preventDefault() : undefined}
      onCut={strictExamMode ? (event) => event.preventDefault() : undefined}
      onPaste={strictExamMode ? (event) => event.preventDefault() : undefined}
      onContextMenu={
        strictExamMode ? (event) => event.preventDefault() : undefined
      }
    >
      <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={remaining < 300000 ? "outline" : "default"}>
            <Clock3 aria-hidden="true" className="size-3.5" />
            <span className="font-mono tabular-nums">
              {formatRemaining(remaining)}
            </span>
          </Badge>
          <span className="text-xs text-muted-foreground">
            <Bi
              en={`${answeredCount}/${questions.length} ${assessmentsUi.student.answered.en}`}
              ar={`${answeredCount}/${questions.length} ${assessmentsUi.student.answered.ar}`}
            />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            {saveState === "saving" ? (
              <Bi en={assessmentsUi.student.saving.en} ar={assessmentsUi.student.saving.ar} />
            ) : saveState === "saved" ? (
              <Bi en={assessmentsUi.student.saved.en} ar={assessmentsUi.student.saved.ar} />
            ) : saveState === "error" ? (
              <Bi
                en={assessmentsUi.student.saveFailed.en}
                ar={assessmentsUi.student.saveFailed.ar}
              />
            ) : (
              <Bi
                en={assessmentsUi.student.notSaved.en}
                ar={assessmentsUi.student.notSaved.ar}
              />
            )}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={submitting || uploadingId !== null || expired}
            onClick={() => {
              if (
                window.confirm(
                  `${assessmentsUi.actions.confirmSubmit.en}\n${assessmentsUi.actions.confirmSubmit.ar}`,
                )
              ) {
                void submit("student_submitted");
              }
            }}
          >
            <Bi
              en={
                submitting
                  ? assessmentsUi.actions.submitting.en
                  : assessmentsUi.actions.submit.en
              }
              ar={
                submitting
                  ? assessmentsUi.actions.submitting.ar
                  : assessmentsUi.actions.submit.ar
              }
            />
          </Button>
        </div>
      </div>

      {remaining <= 0 ? (
        <Alert variant="error">
          <Bi
            en={assessmentsUi.student.timeExpired.en}
            ar={assessmentsUi.student.timeExpired.ar}
          />
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="error">
          <Bi
            en={assessmentsUi.student.saveFailed.en}
            ar={assessmentsUi.student.saveFailed.ar}
          />
        </Alert>
      ) : null}

      <Alert variant="info">
        <Bi
          en={assessmentsUi.student.submitHint.en}
          ar={assessmentsUi.student.submitHint.ar}
        />
      </Alert>

      {strictExamMode ? (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">
            <Bi
              en={assessmentsUi.strict.runnerBanner.en}
              ar={assessmentsUi.strict.runnerBanner.ar}
            />
          </p>
          <ul className="list-disc space-y-1 ps-5 text-xs">
            {submitOnTabHidden ? (
              <li>
                <Bi
                  en={assessmentsUi.strict.tabHidden.en}
                  ar={assessmentsUi.strict.tabHidden.ar}
                />
              </li>
            ) : null}
            {submitOnNavigation ? (
              <li>
                <Bi
                  en={assessmentsUi.strict.navigation.en}
                  ar={assessmentsUi.strict.navigation.ar}
                />
              </li>
            ) : null}
            {!allowResumeAfterConnectionLoss ? (
              <li>
                <Bi
                  en={assessmentsUi.strict.runnerConnection.en}
                  ar={assessmentsUi.strict.runnerConnection.ar}
                />
              </li>
            ) : null}
            <li>
              <Bi
                en={assessmentsUi.strict.copyBlocked.en}
                ar={assessmentsUi.strict.copyBlocked.ar}
              />
            </li>
          </ul>
          <p className="text-xs">
            <Bi
              en={assessmentsUi.strict.notFoolproof.en}
              ar={assessmentsUi.strict.notFoolproof.ar}
            />
          </p>
        </div>
      ) : null}

      {sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <h2 className="text-base font-bold text-foreground">
              <Bi en={section.title_en} ar={section.title_ar} />
            </h2>
            {section.instructions_en || section.instructions_ar ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <Bi
                  en={section.instructions_en ?? ""}
                  ar={section.instructions_ar ?? ""}
                />
              </p>
            ) : null}
          </div>

          <ol className="space-y-3">
            {section.questions.map((question, index) => (
              <li
                key={question.id}
                className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs">
                        {index + 1}
                      </span>
                      <Bi
                        en={question.prompt_en}
                        ar={question.prompt_ar ?? question.prompt_en}
                      />
                    </p>
                    {question.help_text_en || question.help_text_ar ? (
                      <p className="mt-1 ps-8 text-xs text-muted-foreground">
                        <Bi
                          en={question.help_text_en ?? ""}
                          ar={question.help_text_ar ?? ""}
                        />
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span>
                      {question.marks}{" "}
                      {assessmentsUi.builder.questionMarks.en}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      <Bi
                        en={questionTypeCopy[question.type].en}
                        ar={questionTypeCopy[question.type].ar}
                      />
                    </span>
                    {question.is_required ? (
                      <Badge variant="outline" className="ms-1">
                        <Bi
                          en={assessmentsUi.form.required.en}
                          ar={assessmentsUi.form.required.ar}
                        />
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 ps-0 sm:ps-8">{renderQuestion(question, index)}</div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {questions.length === 0 ? (
        <Alert variant="error">
          <AlertCircle aria-hidden="true" className="size-4" />
          <Bi
            en="This assessment has no questions yet."
            ar="لا يحتوي هذا الاختبار على أسئلة بعد."
          />
        </Alert>
      ) : null}
    </div>
  );
}
