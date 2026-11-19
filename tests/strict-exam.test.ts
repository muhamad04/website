import { describe, expect, it } from "vitest";
import {
  ATTEMPT_SIGNALS,
  AUTOMATIC_SUBMISSION_REASONS,
  SUBMISSION_REASONS,
  autoSubmitReason,
  buildStartConfirmation,
  clampHeartbeatSeconds,
  heartbeatIntervalMs,
  isAutomaticReason,
  isSubmissionReason,
  reasonForSignal,
  resolveStrictSettings,
  strictDefaultsForType,
} from "@/lib/assessments/strict";
import {
  attemptSignalSchema,
  createAssessmentSchema,
  heartbeatAttemptSchema,
  submitAttemptSchema,
} from "@/lib/validation/assessments";
import {
  RESULTS_CSV_HEADERS,
  resultsCsvRows,
} from "@/lib/reporting/results-csv";
import { buildCsv } from "@/lib/reporting/csv";
import {
  assessmentsUi,
  submissionReasonCopy,
} from "@/lib/i18n/assessments";
import type { ReportingAttemptRow } from "@/lib/data/reporting";

const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const ASSESSMENT_ID = "22000000-0000-4000-8000-000000000001";
const ATTEMPT_ID = "66000000-0000-4000-8000-000000000001";
const STUDENT_ID = "77000000-0000-4000-8000-000000000001";

const assessmentBase = {
  type: "quiz",
  title_en: "Unit 3 quiz",
  title_ar: "اختبار الوحدة الثالثة",
  instructions_en: "",
  instructions_ar: "",
  grade_id: GRADE_ID,
  time_limit_minutes: "30",
  results_visibility: "after_review",
  grading_mode: "automatic",
  allow_retakes: "false",
  max_attempts: "1",
  available_from: "",
  available_until: "",
  is_published: "false",
};

const strictExam = {
  ...strictDefaultsForType("exam"),
};

describe("strict exam defaults", () => {
  it("turns strict mode on for exams and off for quizzes", () => {
    expect(strictDefaultsForType("exam").strict_exam_mode).toBe(true);
    expect(strictDefaultsForType("exam").allow_resume_after_connection_loss).toBe(
      false,
    );
    expect(strictDefaultsForType("quiz").strict_exam_mode).toBe(false);
    expect(strictDefaultsForType("quiz").allow_resume_after_connection_loss).toBe(
      true,
    );
  });

  it("keeps tab-hidden, navigation and a 60 second heartbeat on by default", () => {
    for (const type of ["exam", "quiz"] as const) {
      const defaults = strictDefaultsForType(type);
      expect(defaults.submit_on_tab_hidden).toBe(true);
      expect(defaults.submit_on_navigation).toBe(true);
      expect(defaults.heartbeat_timeout_seconds).toBe(60);
    }
  });

  it("falls back to type-aware defaults for partial payloads", () => {
    expect(resolveStrictSettings("exam", {})).toEqual(strictExam);
    expect(
      resolveStrictSettings("quiz", {
        strict_exam_mode: true,
        heartbeat_timeout_seconds: 2,
      }),
    ).toMatchObject({
      strict_exam_mode: true,
      heartbeat_timeout_seconds: 15,
      allow_resume_after_connection_loss: true,
    });
  });

  it("clamps the heartbeat timeout to the supported range", () => {
    expect(clampHeartbeatSeconds(0)).toBe(15);
    expect(clampHeartbeatSeconds(60)).toBe(60);
    expect(clampHeartbeatSeconds(10_000)).toBe(600);
    expect(clampHeartbeatSeconds(Number.NaN)).toBe(60);
    expect(heartbeatIntervalMs(60)).toBeLessThan(60_000);
    expect(heartbeatIntervalMs(15)).toBe(5_000);
    expect(heartbeatIntervalMs(600)).toBe(20_000);
  });
});

describe("strict submission policy", () => {
  it("submits a strict attempt for every leaving signal", () => {
    expect(autoSubmitReason(strictExam, "tab_hidden")).toBe("tab_hidden");
    expect(autoSubmitReason(strictExam, "left_assessment")).toBe(
      "left_assessment",
    );
    expect(autoSubmitReason(strictExam, "page_unloaded")).toBe("page_unloaded");
    expect(autoSubmitReason(strictExam, "navigation")).toBe("page_unloaded");
    expect(autoSubmitReason(strictExam, "connection_lost")).toBe(
      "connection_lost",
    );
  });

  it("never submits a quiz that has strict mode off", () => {
    const quiz = strictDefaultsForType("quiz");

    for (const signal of ATTEMPT_SIGNALS) {
      expect(autoSubmitReason(quiz, signal)).toBeNull();
    }
  });

  it("respects each individual strict setting", () => {
    expect(
      autoSubmitReason({ ...strictExam, submit_on_tab_hidden: false }, "tab_hidden"),
    ).toBeNull();
    expect(
      autoSubmitReason(
        { ...strictExam, submit_on_navigation: false },
        "left_assessment",
      ),
    ).toBeNull();
    expect(
      autoSubmitReason(
        { ...strictExam, submit_on_navigation: false },
        "page_unloaded",
      ),
    ).toBeNull();
  });

  it("does not submit after a connection loss when resume is allowed", () => {
    expect(
      autoSubmitReason(
        { ...strictExam, allow_resume_after_connection_loss: true },
        "connection_lost",
      ),
    ).toBeNull();
  });

  it("tracks focus loss without submitting", () => {
    expect(reasonForSignal("focus_lost")).toBeNull();
    expect(autoSubmitReason(strictExam, "focus_lost")).toBeNull();
  });

  it("maps navigation and page hide to a page-unloaded reason", () => {
    expect(reasonForSignal("navigation")).toBe("page_unloaded");
    expect(reasonForSignal("page_unloaded")).toBe("page_unloaded");
  });

  it("uses only the documented submission reasons", () => {
    expect(SUBMISSION_REASONS).toHaveLength(7);
    expect(SUBMISSION_REASONS).toContain("student_submitted");
    expect(AUTOMATIC_SUBMISSION_REASONS).not.toContain("student_submitted");
    expect(isSubmissionReason("heartbeat_expired")).toBe(true);
    expect(isSubmissionReason("made_up")).toBe(false);
    expect(isAutomaticReason("student_submitted")).toBe(false);
    expect(isAutomaticReason("time_expired")).toBe(true);
  });
});

describe("pre-start confirmation", () => {
  it("shows timing, attempts, leaving policy and result visibility", () => {
    expect(
      buildStartConfirmation({
        strict: strictExam,
        timeLimitMinutes: 45,
        maxAttempts: 2,
        attemptsUsed: 1,
        resultsVisibility: "after_review",
      }),
    ).toEqual({
      timed: true,
      timeLimitMinutes: 45,
      maxAttempts: 2,
      attemptsUsed: 1,
      leavingSubmits: true,
      resultsVisibility: "after_review",
      strictWarning: true,
    });
  });

  it("does not claim that leaving submits in a normal quiz", () => {
    const confirmation = buildStartConfirmation({
      strict: strictDefaultsForType("quiz"),
      timeLimitMinutes: 10,
      maxAttempts: 1,
      attemptsUsed: 0,
      resultsVisibility: "immediately",
    });

    expect(confirmation.leavingSubmits).toBe(false);
    expect(confirmation.strictWarning).toBe(false);
    expect(confirmation.resultsVisibility).toBe("immediately");
  });
});

describe("strict validation", () => {
  it("coerces strict settings from form strings", () => {
    const parsed = createAssessmentSchema.safeParse({
      ...assessmentBase,
      type: "exam",
      strict_exam_mode: "true",
      submit_on_tab_hidden: "false",
      submit_on_navigation: "true",
      heartbeat_timeout_seconds: "90",
      allow_resume_after_connection_loss: "false",
      randomize_question_order: "true",
      randomize_option_order: "true",
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.strict_exam_mode).toBe(true);
      expect(parsed.data.submit_on_tab_hidden).toBe(false);
      expect(parsed.data.heartbeat_timeout_seconds).toBe(90);
      expect(parsed.data.allow_resume_after_connection_loss).toBe(false);
      expect(parsed.data.randomize_question_order).toBe(true);
    }
  });

  it("omitted strict fields stay undefined so the server can apply defaults", () => {
    const parsed = createAssessmentSchema.safeParse(assessmentBase);

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.strict_exam_mode).toBeUndefined();
      expect(parsed.data.heartbeat_timeout_seconds).toBeUndefined();
    }
  });

  it("rejects out-of-range heartbeat timeouts", () => {
    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        heartbeat_timeout_seconds: "14",
      }).success,
    ).toBe(false);
    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        heartbeat_timeout_seconds: "601",
      }).success,
    ).toBe(false);
  });

  it("accepts only known signals and submission reasons", () => {
    expect(
      attemptSignalSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        signal: "tab_hidden",
      }).success,
    ).toBe(true);

    for (const signal of ATTEMPT_SIGNALS) {
      expect(
        attemptSignalSchema.safeParse({ attempt_id: ATTEMPT_ID, signal })
          .success,
      ).toBe(true);
    }

    expect(
      attemptSignalSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        signal: "devtools_open",
      }).success,
    ).toBe(false);

    expect(
      submitAttemptSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        reason: "time_expired",
      }).success,
    ).toBe(true);

    expect(
      submitAttemptSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        reason: "heartbeat_expired",
      }).success,
    ).toBe(true);

    expect(
      submitAttemptSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        reason: "not_really",
      }).success,
    ).toBe(false);

    expect(
      heartbeatAttemptSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        focus_lost: "true",
      }).success,
    ).toBe(true);
  });
});

function reportingRow(
  overrides: Partial<ReportingAttemptRow> = {},
): ReportingAttemptRow {
  return {
    id: ATTEMPT_ID,
    assessment_id: ASSESSMENT_ID,
    student_id: STUDENT_ID,
    attempt_number: 1,
    status: "graded",
    started_at: "2026-11-19T09:00:00.000Z",
    expires_at: "2026-11-19T09:30:00.000Z",
    submitted_at: "2026-11-19T09:20:00.000Z",
    score: 8,
    max_score: 10,
    percentage: 80,
    manual_review_status: "not_required",
    submission_reason: "tab_hidden",
    tab_hidden_count: 2,
    focus_loss_count: 1,
    signal_count: 3,
    assessment: {
      id: ASSESSMENT_ID,
      title_en: "Unit 3 exam",
      title_ar: "اختبار الوحدة الثالثة",
      type: "exam",
      grading_mode: "automatic",
      results_visibility: "after_review",
      grade_id: GRADE_ID,
    },
    student: {
      id: STUDENT_ID,
      full_name_en: "Sara Ahmed",
      full_name_ar: "سارة أحمد",
      student_number: "S-001",
      grade_id: GRADE_ID,
      class_id: null,
      grade: {
        id: GRADE_ID,
        name_en: "Grade 10",
        name_ar: "الصف العاشر",
        slug: "grade-10",
      },
      class: null,
    },
    ...overrides,
  };
}

describe("results CSV submission reasons", () => {
  it("exports the reason and suspicious-event counts", () => {
    const rows = resultsCsvRows([reportingRow()]);
    const culture = buildCsv(RESULTS_CSV_HEADERS, rows);

    expect(rows[0]).toHaveLength(RESULTS_CSV_HEADERS.length);
    expect(culture).toContain("Submission reason");
    expect(culture).toContain("tab_hidden");
    expect(culture).toContain("Tab hidden events");
    expect(culture).toContain(",2,1,3");
  });

  it("leaves the reason blank for legacy attempts", () => {
    const rows = resultsCsvRows([reportingRow({ submission_reason: null })]);

    expect(rows[0][RESULTS_CSV_HEADERS.indexOf("Submission reason")]).toBe("");
  });
});

describe("bilingual strict copy", () => {
  it("uses the exact required pre-start warning", () => {
    expect(assessmentsUi.strict.warning.en).toBe(
      "Leaving this assessment, switching tabs, minimizing the browser, or closing the page may submit your attempt automatically.",
    );
    expect(assessmentsUi.strict.warning.ar).toBe(
      "قد يؤدي مغادرة هذا الاختبار أو تبديل علامة التبويب أو تصغير المتصفح أو إغلاق الصفحة إلى إرسال محاولتك تلقائيًا.",
    );
  });

  it("states that strict mode cannot prevent all cheating", () => {
    expect(assessmentsUi.strict.notFoolproof.en).toContain(
      "cannot prevent every kind of cheating",
    );
    expect(assessmentsUi.strict.notFoolproof.ar).toContain(
      "لا يمنع كل أنواع الغش",
    );
  });

  it("labels every submission reason in both languages", () => {
    for (const reason of SUBMISSION_REASONS) {
      expect(submissionReasonCopy[reason].en.trim()).not.toBe("");
      expect(submissionReasonCopy[reason].ar.trim()).not.toBe("");
    }
  });
});
