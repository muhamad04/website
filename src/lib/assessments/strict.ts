import type {
  AssessmentType,
  ResultsVisibility,
  SubmissionReason,
} from "@/lib/domain/types";

/**
 * Pure Strict Exam Mode policy. The server route/action is the authority; the
 * browser only reports a signal and never decides the outcome.
 */
export type StrictSettings = {
  strict_exam_mode: boolean;
  submit_on_tab_hidden: boolean;
  submit_on_navigation: boolean;
  heartbeat_timeout_seconds: number;
  allow_resume_after_connection_loss: boolean;
  randomize_question_order: boolean;
  randomize_option_order: boolean;
};

export const STRICT_MIN_HEARTBEAT_SECONDS = 15;
export const STRICT_MAX_HEARTBEAT_SECONDS = 600;

export const SUBMISSION_REASONS = [
  "student_submitted",
  "time_expired",
  "left_assessment",
  "tab_hidden",
  "page_unloaded",
  "heartbeat_expired",
  "connection_lost",
] as const satisfies readonly SubmissionReason[];

export const AUTOMATIC_SUBMISSION_REASONS = SUBMISSION_REASONS.filter(
  (reason) => reason !== "student_submitted",
);

/** Signals the browser may report. None of them close an attempt by itself. */
export const ATTEMPT_SIGNALS = [
  "tab_hidden",
  "left_assessment",
  "page_unloaded",
  "navigation",
  "connection_lost",
  "focus_lost",
] as const;

export type AttemptSignal = (typeof ATTEMPT_SIGNALS)[number];

export function strictDefaultsForType(type: AssessmentType): StrictSettings {
  const exam = type === "exam";

  return {
    strict_exam_mode: exam,
    submit_on_tab_hidden: true,
    submit_on_navigation: true,
    heartbeat_timeout_seconds: 60,
    allow_resume_after_connection_loss: !exam,
    randomize_question_order: false,
    randomize_option_order: false,
  };
}

/** Completes partial settings from a form or an older client payload. */
export function resolveStrictSettings(
  type: AssessmentType,
  input: Partial<StrictSettings>,
): StrictSettings {
  const defaults = strictDefaultsForType(type);

  return {
    strict_exam_mode: input.strict_exam_mode ?? defaults.strict_exam_mode,
    submit_on_tab_hidden:
      input.submit_on_tab_hidden ?? defaults.submit_on_tab_hidden,
    submit_on_navigation:
      input.submit_on_navigation ?? defaults.submit_on_navigation,
    heartbeat_timeout_seconds: clampHeartbeatSeconds(
      input.heartbeat_timeout_seconds ?? defaults.heartbeat_timeout_seconds,
    ),
    allow_resume_after_connection_loss:
      input.allow_resume_after_connection_loss ??
      defaults.allow_resume_after_connection_loss,
    randomize_question_order:
      input.randomize_question_order ?? defaults.randomize_question_order,
    randomize_option_order:
      input.randomize_option_order ?? defaults.randomize_option_order,
  };
}

export function clampHeartbeatSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return 60;
  }

  return Math.min(
    STRICT_MAX_HEARTBEAT_SECONDS,
    Math.max(STRICT_MIN_HEARTBEAT_SECONDS, Math.round(value)),
  );
}

export function isSubmissionReason(value: string): value is SubmissionReason {
  return (SUBMISSION_REASONS as readonly string[]).includes(value);
}

export function isAutomaticReason(reason: SubmissionReason): boolean {
  return reason !== "student_submitted";
}

/**
 * Maps a browser signal to the reason it would record if the server decides to
 * submit. Focus loss is tracked only; it is too easy to trigger accidentally
 * (accessibility tools, browser UI) to be a submission signal.
 */
export function reasonForSignal(signal: AttemptSignal): SubmissionReason | null {
  switch (signal) {
    case "tab_hidden":
      return "tab_hidden";
    case "left_assessment":
      return "left_assessment";
    case "page_unloaded":
    case "navigation":
      return "page_unloaded";
    case "connection_lost":
      return "connection_lost";
    case "focus_lost":
      return null;
  }
}

/**
 * The single policy decision used by the signal route, the runner and tests.
 * Returns the reason the server should use, or null when the attempt must stay
 * open.
 */
export function autoSubmitReason(
  settings: Pick<
    StrictSettings,
    | "strict_exam_mode"
    | "submit_on_tab_hidden"
    | "submit_on_navigation"
    | "allow_resume_after_connection_loss"
  >,
  signal: AttemptSignal,
): SubmissionReason | null {
  if (!settings.strict_exam_mode) {
    return null;
  }

  const reason = reasonForSignal(signal);

  if (!reason) {
    return null;
  }

  if (reason === "tab_hidden") {
    return settings.submit_on_tab_hidden ? reason : null;
  }

  if (reason === "page_unloaded" || reason === "left_assessment") {
    return settings.submit_on_navigation ? reason : null;
  }

  if (reason === "connection_lost") {
    return settings.allow_resume_after_connection_loss ? null : reason;
  }

  return null;
}

/** Heartbeat cadence: frequent enough to stay inside the timeout. */
export function heartbeatIntervalMs(timeoutSeconds: number): number {
  return Math.max(5_000, Math.min(20_000, timeoutSeconds * 1000 * 0.33));
}

export type StartConfirmation = {
  timed: boolean;
  timeLimitMinutes: number;
  maxAttempts: number;
  attemptsUsed: number;
  leavingSubmits: boolean;
  resultsVisibility: ResultsVisibility;
  strictWarning: boolean;
};

export function buildStartConfirmation(input: {
  strict: StrictSettings;
  timeLimitMinutes: number;
  maxAttempts: number;
  attemptsUsed: number;
  resultsVisibility: ResultsVisibility;
}): StartConfirmation {
  return {
    timed: input.timeLimitMinutes > 0,
    timeLimitMinutes: input.timeLimitMinutes,
    maxAttempts: input.maxAttempts,
    attemptsUsed: input.attemptsUsed,
    leavingSubmits:
      input.strict.strict_exam_mode &&
      (input.strict.submit_on_tab_hidden || input.strict.submit_on_navigation),
    resultsVisibility: input.resultsVisibility,
    strictWarning: input.strict.strict_exam_mode,
  };
}
