import type { StaffRole, UserRole } from "@/lib/domain/roles";

export type GradeSummary = {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
};

export type ClassSummary = {
  id: string;
  name_en: string;
  name_ar: string;
};

export type GradeRow = GradeSummary & {
  description_en: string | null;
  description_ar: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ClassRow = ClassSummary & {
  grade_id: string;
  academic_year: string | null;
  is_active: boolean;
};

export type GradeWithClasses = GradeRow & {
  classes: ClassRow[];
};

/** Shape returned by the student administration list queries. */
export type StudentRecord = {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  email: string | null;
  username: string | null;
  student_number: string | null;
  grade_id: string | null;
  class_id: string | null;
  is_active: boolean;
  invitation_sent_at: string | null;
  access_reset_at: string | null;
  created_at: string;
  updated_at: string;
  grade: GradeSummary | null;
  class: ClassSummary | null;
};

export type StudentAdminAction =
  | "created"
  | "invited"
  | "invite_resent"
  | "access_reset"
  | "password_reset"
  | "student_id_changed"
  | "updated"
  | "activated"
  | "deactivated";

export type StudentAdminEvent = {
  id: string;
  student_id: string;
  actor_id: string | null;
  action: StudentAdminAction;
  detail: Record<string, unknown>;
  created_at: string;
};

/** Row returned by the admin-only staff list queries. */
export type StaffRecord = {
  id: string;
  role: StaffRole;
  full_name_en: string;
  full_name_ar: string | null;
  email: string | null;
  is_active: boolean;
  invitation_sent_at: string | null;
  access_reset_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffAdminAction =
  | "created"
  | "updated"
  | "role_changed"
  | "activated"
  | "deactivated"
  | "access_reset";

export type StaffAdminEvent = {
  id: string;
  staff_id: string;
  actor_id: string | null;
  action: StaffAdminAction;
  detail: Record<string, unknown>;
  created_at: string;
  actor?: {
    id: string;
    full_name_en: string;
    full_name_ar: string | null;
  } | null;
  staff?: {
    id: string;
    full_name_en: string;
    full_name_ar: string | null;
  } | null;
};

export type Profile = {
  id: string;
  role: UserRole;
  full_name_en: string;
  full_name_ar: string | null;
  email: string | null;
  username: string | null;
  grade_id: string | null;
  class_id: string | null;
  student_number: string | null;
  is_active: boolean;
  invitation_sent_at: string | null;
  access_reset_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileWithRelations = Profile & {
  grade: GradeSummary | null;
  class: ClassSummary | null;
};

export type ResourceType = "pdf" | "image" | "youtube";

export type ResourceCategory = {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
  description_en: string | null;
  description_ar: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ResourceCategoryWithCount = ResourceCategory & {
  resourceCount: number;
};

export type ResourceRecord = {
  id: string;
  grade_id: string;
  category_id: string | null;
  type: ResourceType;
  title_en: string;
  title_ar: string;
  description_en: string | null;
  description_ar: string | null;
  storage_path: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  grade: GradeSummary | null;
  category: ResourceCategorySummary | null;
};

export type ResourceCategorySummary = {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
};

export type ResourceAdminAction =
  | "created"
  | "updated"
  | "published"
  | "unpublished"
  | "deleted"
  | "category_created"
  | "category_updated"
  | "category_deleted";

export type ResourceAdminEvent = {
  id: string;
  resource_id: string | null;
  category_id: string | null;
  actor_id: string | null;
  action: ResourceAdminAction;
  detail: Record<string, unknown>;
  created_at: string;
};

export type AssessmentType = "quiz" | "exam";
export type GradingMode = "automatic" | "manual" | "mixed";
export type GradingMethod = "automatic" | "manual";
export type ResultsVisibility = "immediately" | "after_review" | "hidden";
export type AttemptStatus =
  | "in_progress"
  | "submitted"
  | "grading"
  | "graded"
  | "expired";
export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "short_answer"
  | "essay"
  | "file_upload"
  | "rewrite"
  | "find_the_mistake";
export type ManualReviewStatus = "not_required" | "pending" | "completed";

/** Answer key shapes stored in questions.correct_answer. */
export type TrueFalseAnswer = { value: boolean };
export type AcceptedAnswer = {
  accepted: string[];
  caseSensitive?: boolean;
};

export type QuestionOptionRecord = {
  id: string;
  question_id: string;
  label: string;
  text_en: string;
  text_ar: string | null;
  is_correct: boolean;
  position: number;
};

export type MatchingPairRecord = {
  id: string;
  question_id: string;
  left_text_en: string;
  left_text_ar: string | null;
  right_text_en: string;
  right_text_ar: string | null;
  right_key: string;
  position: number;
};

export type QuestionRecord = {
  id: string;
  section_id: string;
  type: QuestionType;
  prompt_en: string;
  prompt_ar: string | null;
  help_text_en: string | null;
  help_text_ar: string | null;
  marks: number;
  is_required: boolean;
  position: number;
  correct_answer: unknown;
  grading_method: GradingMethod;
  explanation_en: string | null;
  explanation_ar: string | null;
  created_at: string;
  updated_at: string;
  options: QuestionOptionRecord[];
  pairs: MatchingPairRecord[];
};

export type AssessmentSectionRecord = {
  id: string;
  assessment_id: string;
  title_en: string;
  title_ar: string;
  instructions_en: string | null;
  instructions_ar: string | null;
  position: number;
  questions: QuestionRecord[];
};

export type AssessmentRecord = {
  id: string;
  grade_id: string;
  type: AssessmentType;
  title_en: string;
  title_ar: string;
  instructions_en: string | null;
  instructions_ar: string | null;
  time_limit_minutes: number;
  results_visibility: ResultsVisibility;
  grading_mode: GradingMode;
  allow_retakes: boolean;
  max_attempts: number;
  is_published: boolean;
  available_from: string | null;
  available_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  grade: GradeSummary | null;
};

export type AssessmentDetail = AssessmentRecord & {
  sections: AssessmentSectionRecord[];
  questionCount: number;
  totalMarks: number;
};

export type AssessmentAdminAction =
  | "created"
  | "updated"
  | "published"
  | "unpublished"
  | "deleted"
  | "section_created"
  | "section_updated"
  | "section_deleted"
  | "sections_reordered"
  | "question_created"
  | "question_updated"
  | "question_deleted"
  | "questions_reordered"
  | "attempt_graded"
  | "import_started"
  | "import_draft_created"
  | "import_draft_edited"
  | "import_published";

export type AssessmentAdminEvent = {
  id: string;
  assessment_id: string | null;
  actor_id: string | null;
  action: AssessmentAdminAction;
  detail: Record<string, unknown>;
  created_at: string;
  actor?: {
    id: string;
    full_name_en: string;
    full_name_ar: string | null;
  } | null;
};

/** Row returned by public.student_assessment_overview(). */
export type StudentAssessmentOverview = {
  id: string;
  type: AssessmentType;
  title_en: string;
  title_ar: string;
  instructions_en: string | null;
  instructions_ar: string | null;
  time_limit_minutes: number;
  results_visibility: ResultsVisibility;
  grading_mode: GradingMode;
  allow_retakes: boolean;
  max_attempts: number;
  available_from: string | null;
  available_until: string | null;
  attempts_used: number;
  in_progress_attempt_id: string | null;
  in_progress_expires_at: string | null;
  last_attempt_id: string | null;
  last_attempt_status: AttemptStatus | null;
  last_submitted_at: string | null;
  last_score: number | null;
  last_max_score: number | null;
  last_percentage: number | null;
  result_visible: boolean;
  manual_review_status: ManualReviewStatus | null;
};

/** One question inside a sanitized student attempt payload. */
export type StudentQuestion = {
  id: string;
  type: QuestionType;
  prompt_en: string;
  prompt_ar: string | null;
  help_text_en: string | null;
  help_text_ar: string | null;
  marks: number;
  is_required: boolean;
  position: number;
  options: Array<{
    id: string;
    label: string;
    text_en: string;
    text_ar: string | null;
  }>;
  left_items: Array<{
    id: string;
    text_en: string;
    text_ar: string | null;
  }>;
  right_items: Array<{
    id: string;
    text_en: string;
    text_ar: string | null;
  }>;
};

export type StudentAssessmentSection = {
  id: string;
  title_en: string;
  title_ar: string;
  instructions_en: string | null;
  instructions_ar: string | null;
  position: number;
  questions: StudentQuestion[];
};

export type StudentAttemptPayload = {
  assessment: {
    id: string;
    type: AssessmentType;
    title_en: string;
    title_ar: string;
    instructions_en: string | null;
    instructions_ar: string | null;
    time_limit_minutes: number;
    allow_retakes: boolean;
    max_attempts: number;
    results_visibility: ResultsVisibility;
  };
  attempt: {
    id: string;
    number: number;
    started_at: string;
    expires_at: string;
    submitted_at: string | null;
  };
  answers: Array<{
    question_id: string;
    response: Record<string, unknown>;
    file_path: string | null;
  }>;
  sections: StudentAssessmentSection[];
  server_time: string;
};

export type StudentAttemptResult = {
  attempt_id: string;
  attempt_number: number;
  assessment_id: string;
  title_en: string;
  title_ar: string;
  type: AssessmentType;
  status: AttemptStatus;
  results_visibility: ResultsVisibility;
  visible: boolean;
  submitted_at: string | null;
  server_time: string;
  score?: number | null;
  max_score?: number | null;
  percentage?: number | null;
  manual_review_status?: ManualReviewStatus | null;
  graded_at?: string | null;
  sections?: Array<{
    id: string;
    title_en: string;
    title_ar: string;
    position: number;
    questions: Array<{
      id: string;
      type: QuestionType;
      prompt_en: string;
      prompt_ar: string | null;
      marks: number;
      position: number;
      grading_method: GradingMethod;
      answer: {
        response: Record<string, unknown>;
        file_path: string | null;
        marks_awarded: number | null;
        is_correct: boolean | null;
        feedback_en: string | null;
        feedback_ar: string | null;
      } | null;
    }>;
  }>;
};

/** Teacher-facing attempt list row. */
export type AssessmentAttemptRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  attempt_number: number;
  status: AttemptStatus;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  manual_review_status: ManualReviewStatus;
  student: {
    id: string;
    full_name_en: string;
    full_name_ar: string | null;
    student_number: string | null;
  } | null;
};
