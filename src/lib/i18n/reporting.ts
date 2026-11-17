import type { Bilingual } from "@/lib/i18n/dictionary";
import type { ManualReviewStatus } from "@/lib/domain/types";
import type { ReportingErrorCode } from "@/lib/validation/reporting";

const bi = (en: string, ar: string): Bilingual => ({ en, ar });

/**
 * Phase 4 copy. Dashboard, results, student and admin reporting surfaces share
 * these keys so both languages stay consistent and testable.
 */
export const reportingUi = {
  teacher: {
    eyebrow: bi("Teacher workspace", "مساحة المعلم"),
    title: bi("Dashboard", "لوحة التحكم"),
    subtitle: bi(
      "A live view of students, resources, assessments, results and the grading queue.",
      "نظرة مباشرة على الطلاب والمصادر والتقييمات والنتائج وقائمة التصحيح.",
    ),
    welcome: bi("Welcome back", "أهلًا بعودتك"),
  },
  student: {
    eyebrow: bi("Student workspace", "مساحة الطالب"),
    title: bi("Dashboard", "لوحة التحكم"),
    subtitle: bi(
      "Your grade, your resources, your assessments and the feedback your teacher has shared.",
      "صفك ومصادرك وتقييماتك وملاحظات معلمك التي شاركها معك.",
    ),
    hello: bi("Hello", "مرحبًا"),
    placement: bi("Your grade and class", "صفك وفصلك"),
    availableResources: bi("Available resources", "المصادر المتاحة"),
    availableAssessments: bi("Available assessments", "التقييمات المتاحة"),
    completedAssessments: bi("Completed assessments", "التقييمات المكتملة"),
    pendingAssessments: bi("Pending assessments", "التقييمات المعلّقة"),
    scoresVisible: bi("Scores visible", "الدرجات الظاهرة"),
    averageVisible: bi("Average visible score", "متوسط الدرجات الظاهرة"),
    pendingReview: bi("Pending teacher review", "بانتظار مراجعة المعلم"),
    teacherFeedback: bi("Teacher feedback", "ملاحظات المعلم"),
    noFeedback: bi("No feedback shared yet", "لا توجد ملاحظات مشتركة بعد"),
    noFeedbackHint: bi(
      "Feedback appears here when your teacher reviews a result and the result is visible to you.",
      "تظهر الملاحظات هنا عندما يراجع معلمك النتيجة وتكون النتيجة ظاهرة لك.",
    ),
    recentActivity: bi("Recent activity", "النشاط الأخير"),
    noActivity: bi("No assessment activity yet", "لا يوجد نشاط تقييم بعد"),
    noActivityHint: bi(
      "Published quizzes and exams for your grade will appear in your assessment list.",
      "ستظهر الاختبارات القصيرة والامتحانات المنشورة لصفك في قائمة التقييمات.",
    ),
    recentResources: bi("Recently added resources", "أحدث المصادر المضافة"),
    noResources: bi("No resources published yet", "لا توجد مصادر منشورة بعد"),
    notStarted: bi("Not started", "لم يبدأ"),
    inProgress: bi("In progress", "قيد التنفيذ"),
    viewResult: bi("View result", "عرض النتيجة"),
    openAssessment: bi("Open assessment", "فتح التقييم"),
    browseResources: bi("Browse resources", "تصفح المصادر"),
    resultHidden: bi("Hidden until review", "مخفية حتى المراجعة"),
    awaitingReview: bi("Awaiting teacher review", "بانتظار مراجعة المعلم"),
    attemptsUsed: bi("Attempts used", "المحاولات المستخدمة"),
    of: bi("of", "من"),
    gradeLocked: bi("Only your grade", "صفك فقط"),
    gradeLockedHint: bi(
      "Your grade is checked on every request. Resources and assessments from other grades are not readable through the site or its API.",
      "يتم التحقق من صفك في كل طلب. لا يمكن قراءة المصادر والتقييمات من الصفوف الأخرى عبر الموقع أو واجهة البيانات.",
    ),
  },
  filters: {
    title: bi("Filters", "عوامل التصفية"),
    grade: bi("Grade", "الصف"),
    class: bi("Class", "الفصل"),
    student: bi("Student", "الطالب"),
    assessment: bi("Assessment", "التقييم"),
    type: bi("Type", "النوع"),
    grading: bi("Grading status", "حالة التصحيح"),
    from: bi("From", "من تاريخ"),
    to: bi("To", "إلى تاريخ"),
    search: bi("Student search", "بحث عن طالب"),
    searchPlaceholder: bi(
      "Name, email or student ID",
      "الاسم أو البريد أو رقم الطالب",
    ),
    allGrades: bi("All grades", "جميع الصفوف"),
    allClasses: bi("All classes", "جميع الفصول"),
    allStudents: bi("All students", "جميع الطلاب"),
    allAssessments: bi("All assessments", "جميع التقييمات"),
    allTypes: bi("Quizzes and exams", "الاختبارات القصيرة والامتحانات"),
    quizOnly: bi("Quizzes only", "الاختبارات القصيرة فقط"),
    examOnly: bi("Exams only", "الامتحانات فقط"),
    allGrading: bi("All grading states", "جميع حالات التصحيح"),
    pendingReview: bi("Pending review", "بانتظار المراجعة"),
    reviewCompleted: bi("Review completed", "اكتملت المراجعة"),
    notRequired: bi("No review needed", "لا تحتاج مراجعة"),
    apply: bi("Apply filters", "تطبيق عوامل التصفية"),
    clear: bi("Clear filters", "مسح عوامل التصفية"),
  },
  stats: {
    students: bi("Active students", "الطلاب النشطون"),
    studentsHint: bi("Matching the current filters", "حسب عوامل التصفية الحالية"),
    studentsByGrade: bi("Students by grade", "الطلاب حسب الصف"),
    studentsByClass: bi("Students by class", "الطلاب حسب الفصل"),
    resources: bi("Resources", "المصادر"),
    resourcesHint: bi("Published and unpublished", "منشورة وغير منشورة"),
    published: bi("Published", "منشور"),
    unpublished: bi("Unpublished", "غير منشور"),
    quizzes: bi("Quizzes", "الاختبارات القصيرة"),
    exams: bi("Exams", "الامتحانات"),
    assessmentsHint: bi("Drafts included", "تشمل المسودات"),
    attempts: bi("Attempts", "المحاولات"),
    attemptsHint: bi("All attempt states", "جميع حالات المحاولات"),
    averageScore: bi("Average score", "متوسط الدرجات"),
    averageHint: bi("Graded attempts only", "المحاولات المصححة فقط"),
    pendingReview: bi("Pending manual grading", "بانتظار التصحيح اليدوي"),
    pendingHint: bi("Awaiting a teacher decision", "بانتظار قرار المعلم"),
    noAverage: bi("No grades yet", "لا توجد درجات بعد"),
  },
  sections: {
    recentActivity: bi("Recent student activity", "نشاط الطلاب الأخير"),
    recentResults: bi("Recent assessment results", "نتائج التقييمات الأخيرة"),
    recentActivityHint: bi(
      "The latest starts, submissions and grades across the filtered assessments.",
      "أحدث البدء والإرسال والتصحيح في التقييمات المصفّاة.",
    ),
    recentResultsHint: bi(
      "Graded attempts, newest first. Hidden results stay hidden from students.",
      "المحاولات المصححة، الأحدث أولًا. تبقى النتائج المخفية مخفية عن الطلاب.",
    ),
    noActivity: bi("No activity matches these filters", "لا يوجد نشاط يطابق عوامل التصفية"),
    noResults: bi("No graded results yet", "لا توجد نتائج مصححة بعد"),
    emptyHint: bi(
      "Try widening the date range or clearing a filter.",
      "جرّب توسيع نطاق التاريخ أو مسح أحد عوامل التصفية.",
    ),
    viewAllResults: bi("All results", "جميع النتائج"),
    openAttempt: bi("Open attempt", "فتح المحاولة"),
    student: bi("Student", "الطالب"),
    assessment: bi("Assessment", "التقييم"),
    submitted: bi("Submitted", "تم الإرسال"),
    score: bi("Score", "الدرجة"),
    status: bi("Status", "الحالة"),
  },
  results: {
    eyebrow: bi("Results reporting", "تقارير النتائج"),
    title: bi("Assessment results", "نتائج التقييمات"),
    subtitle: bi(
      "Every attempt with its student, assessment, score, grading state and visibility. Export the filtered view to CSV.",
      "كل محاولة مع الطالب والتقييم والدرجة وحالة التصحيح والظهور. صدّر العرض المصفّى إلى CSV.",
    ),
    exportCsv: bi("Export CSV", "تصدير CSV"),
    exportHint: bi(
      "The export uses the same filters. It contains scores and is for staff only.",
      "يستخدم التصدير عوامل التصفية نفسها. يحتوي على الدرجات ومخصص للمعلمين فقط.",
    ),
    empty: bi("No attempts match these filters", "لا توجد محاولات تطابق عوامل التصفية"),
    emptyHint: bi(
      "Clear a filter or choose a wider date range.",
      "امسح أحد عوامل التصفية أو اختر نطاقًا زمنيًا أوسع.",
    ),
    error: bi(
      "The results list could not be loaded. Refresh the page or check the database connection.",
      "تعذّر تحميل قائمة النتائج. حدّث الصفحة أو تحقق من اتصال قاعدة البيانات.",
    ),
    columns: {
      student: bi("Student", "الطالب"),
      placement: bi("Grade & class", "الصف والفصل"),
      assessment: bi("Assessment", "التقييم"),
      submitted: bi("Submitted", "تاريخ الإرسال"),
      score: bi("Score", "الدرجة"),
      grading: bi("Grading", "التصحيح"),
      visibility: bi("Visibility", "الظهور"),
      review: bi("Manual review", "المراجعة اليدوية"),
      details: bi("Details", "التفاصيل"),
      attempt: bi("Attempt", "المحاولة"),
    },
    showing: bi("Showing", "عرض"),
    noRows: bi("No results found", "لا توجد نتائج"),
    page: bi("Page", "صفحة"),
    of: bi("of", "من"),
    previous: bi("Previous", "السابق"),
    next: bi("Next", "التالي"),
    automatic: bi("Automatic", "آلي"),
    manual: bi("Manual", "يدوي"),
    notSubmitted: bi("Not submitted", "لم يُرسل"),
    attemptNumber: bi("Attempt", "المحاولة"),
  },
  admin: {
    eyebrow: bi("Administration", "الإدارة"),
    title: bi("Google Sheets reporting", "تقارير Google Sheets"),
    subtitle: bi(
      "Configure the sync, check the connection and review every row the server has written or retried.",
      "اضبط المزامنة وتحقق من الاتصال وراجع كل صف كتبه الخادم أو أعاد محاولته.",
    ),
    settings: bi("Reporting settings", "إعدادات التقارير"),
    settingsHint: bi(
      "These switches are stored in the database. Credentials stay in server environment variables and are never shown.",
      "تُحفظ هذه المفاتيح في قاعدة البيانات. تبقى بيانات الاعتماد في متغيرات بيئة الخادم ولا تُعرض أبدًا.",
    ),
    syncEnabled: bi("Synchronise finalized attempts", "مزامنة المحاولات المكتملة"),
    syncEnabledHint: bi(
      "When off, attempts are logged as skipped and nothing is sent to Google.",
      "عند الإيقاف، تُسجّل المحاولات كمتخطاة ولا يُرسل شيء إلى Google.",
    ),
    mockMode: bi("Mock mode", "الوضع التجريبي"),
    mockModeHint: bi(
      "Rows are prepared and logged but not sent to Google. Useful before the sheet is shared.",
      "يتم تجهيز الصفوف وتسجيلها دون إرسالها إلى Google. مفيد قبل مشاركة الجدول.",
    ),
    sheetName: bi("Sheet tab name", "اسم ورقة العمل"),
    sheetNameHint: bi(
      "Must match a tab inside the spreadsheet, for example Results.",
      "يجب أن يطابق اسمًا داخل جدول البيانات، مثل Results.",
    ),
    save: bi("Save settings", "حفظ الإعدادات"),
    saving: bi("Saving", "جارٍ الحفظ"),
    saved: bi("Reporting settings saved", "تم حفظ إعدادات التقارير"),
    saveFailed: bi(
      "The settings could not be saved. Check the values and try again.",
      "تعذّر حفظ الإعدادات. تحقق من القيم وحاول مرة أخرى.",
    ),
    credentials: bi("Server credentials", "بيانات اعتماد الخادم"),
    credentialsHint: bi(
      "Status only. The service-account email, private key and spreadsheet ID are never displayed.",
      "الحالة فقط. لا يُعرض بريد حساب الخدمة ولا المفتاح الخاص ولا معرّف جدول البيانات.",
    ),
    clientEmail: bi("Service-account email", "بريد حساب الخدمة"),
    privateKey: bi("Private key", "المفتاح الخاص"),
    spreadsheet: bi("Spreadsheet ID", "معرّف جدول البيانات"),
    configured: bi("Configured", "مهيأ"),
    notConfigured: bi("Not configured", "غير مهيأ"),
    checkConnectivity: bi("Check connection", "التحقق من الاتصال"),
    checking: bi("Checking", "جارٍ التحقق"),
    connectivityOk: bi(
      "Connected to the spreadsheet and the configured tab.",
      "تم الاتصال بجدول البيانات وورقة العمل المحددة.",
    ),
    connectivityFailed: bi(
      "The connection check failed. Review the server credentials and the tab name.",
      "فشل التحقق من الاتصال. راجع بيانات اعتماد الخادم واسم ورقة العمل.",
    ),
    connectivitySkipped: bi(
      "Connection checks are unavailable while mock mode is on.",
      "التحقق من الاتصال غير متاح أثناء تشغيل الوضع التجريبي.",
    ),
    logs: bi("Sync log", "سجل المزامنة"),
    logsHint: bi(
      "One row per attempt. Failed rows can be retried without creating duplicates.",
      "صف واحد لكل محاولة. يمكن إعادة محاولة الصفوف الفاشلة دون إنشاء صفوف مكررة.",
    ),
    noLogs: bi("No sync attempts yet", "لا توجد محاولات مزامنة بعد"),
    noLogsHint: bi(
      "Finalize an attempt or use the retry action to create the first log row.",
      "أكمل محاولة أو استخدم إعادة المحاولة لإنشاء أول صف في السجل.",
    ),
    retry: bi("Retry", "إعادة المحاولة"),
    syncNow: bi("Sync now", "مزامنة الآن"),
    retrying: bi("Retrying", "جارٍ إعادة المحاولة"),
    retryAll: bi("Retry all failed", "إعادة محاولة كل الفاشلة"),
    retryQueued: bi("Retry completed", "تمت إعادة المحاولة"),
    retryFailed: bi("Retry failed", "فشلت إعادة المحاولة"),
    logsError: bi(
      "The sync log could not be loaded. Check the database connection.",
      "تعذّر تحميل سجل المزامنة. تحقق من اتصال قاعدة البيانات.",
    ),
    columns: {
      attempt: bi("Attempt", "المحاولة"),
      status: bi("Status", "الحالة"),
      tries: bi("Tries", "المحاولات"),
      updated: bi("Updated", "آخر تحديث"),
      error: bi("Last error", "آخر خطأ"),
      action: bi("Action", "الإجراء"),
    },
    events: bi("Administration audit", "سجل إدارة التقارير"),
    eventsHint: bi(
      "Manual sync, retry, settings changes and connection checks. Append-only.",
      "المزامنة اليدوية وإعادة المحاولة وتغيير الإعدادات وفحص الاتصال. سجل غير قابل للتعديل.",
    ),
    noEvents: bi("No administration events yet", "لا توجد أحداث إدارية بعد"),
    eventsError: bi(
      "The audit log could not be loaded.",
      "تعذّر تحميل سجل الإدارة.",
    ),
    eventsColumns: {
      action: bi("Action", "الإجراء"),
      actor: bi("Actor", "المستخدم"),
      when: bi("When", "الوقت"),
      detail: bi("Detail", "التفاصيل"),
    },
    actionLabels: {
      sync_manual: bi("Manual sync", "مزامنة يدوية"),
      sync_retry: bi("Retry", "إعادة محاولة"),
      settings_updated: bi("Settings updated", "تحديث الإعدادات"),
      connectivity_checked: bi("Connection checked", "فحص الاتصال"),
    },
    accessDenied: bi(
      "Only administrators can open reporting settings.",
      "يمكن للمسؤولين فقط فتح إعدادات التقارير.",
    ),
  },
  syncStatus: {
    pending: bi("Pending", "بانتظار"),
    synced: bi("Synced", "تمت المزامنة"),
    failed: bi("Failed", "فشلت"),
    skipped: bi("Skipped", "تم التخطي"),
  },
  manualReview: {
    not_required: bi("Not required", "غير مطلوب"),
    pending: bi("Pending review", "بانتظار المراجعة"),
    completed: bi("Review completed", "اكتملت المراجعة"),
  },
  errors: {
    validation_failed: bi(
      "Some values are invalid. Check the form and try again.",
      "بعض القيم غير صالحة. تحقق من النموذج وحاول مرة أخرى.",
    ),
    forbidden: bi(
      "You do not have permission to do that.",
      "ليس لديك صلاحية للقيام بذلك.",
    ),
    not_found: bi(
      "The attempt could not be found.",
      "تعذّر العثور على المحاولة.",
    ),
    settings_save_failed: bi(
      "The reporting settings could not be saved.",
      "تعذّر حفظ إعدادات التقارير.",
    ),
    connectivity_failed: bi(
      "The Google Sheets connection check failed.",
      "فشل التحقق من الاتصال بـ Google Sheets.",
    ),
    retry_failed: bi(
      "The sync retry failed. Review the sync log for the server error.",
      "فشلت إعادة محاولة المزامنة. راجع سجل المزامنة لخطأ الخادم.",
    ),
    sync_disabled: bi(
      "Sync is disabled in the reporting settings.",
      "المزامنة معطلة في إعدادات التقارير.",
    ),
    unknown: bi(
      "Something went wrong. Try again or check the server log.",
      "حدث خطأ. حاول مرة أخرى أو راجع سجل الخادم.",
    ),
  },
} as const;

export function manualReviewCopy(status: ManualReviewStatus): Bilingual {
  return reportingUi.manualReview[status];
}

export function reportingErrorCopy(code: ReportingErrorCode): Bilingual {
  return reportingUi.errors[code];
}
