import type { Bilingual } from "@/lib/i18n/dictionary";
import type {
  AssessmentAdminAction,
  AssessmentType,
  AttemptStatus,
  GradingMode,
  QuestionType,
  ResultsVisibility,
  SubmissionReason,
} from "@/lib/domain/types";
import type { AssessmentErrorCode } from "@/lib/validation/assessments";

const bi = (en: string, ar: string): Bilingual => ({ en, ar });

/**
 * Assessment copy kept in one place so the teacher builder, the timed runner
 * and the result screens stay consistent in both languages.
 */
export const assessmentsUi = {
  eyebrow: bi("Assessment centre", "مركز الاختبارات"),
  title: bi("Assessments", "الاختبارات"),
  subtitle: bi(
    "Build quizzes and exams with sections, timed attempts, automatic or manual grading, and controlled result visibility.",
    "أنشئ الاختبارات القصيرة والنهائية بأقسام ومحاولات موقوتة وتصحيح آلي أو يدوي وتحكم في إظهار النتائج.",
  ),
  actions: {
    addAssessment: bi("New assessment", "اختبار جديد"),
    importAssessment: bi("Import assessment", "استيراد اختبار"),
    edit: bi("Edit details", "تعديل التفاصيل"),
    open: bi("Open builder", "فتح المنشئ"),
    save: bi("Save changes", "حفظ التغييرات"),
    create: bi("Create assessment", "إنشاء الاختبار"),
    creating: bi("Creating", "جارٍ الإنشاء"),
    saving: bi("Saving", "جارٍ الحفظ"),
    working: bi("Working", "جارٍ التنفيذ"),
    publish: bi("Publish", "نشر"),
    unpublish: bi("Unpublish", "إلغاء النشر"),
    delete: bi("Delete", "حذف"),
    deleting: bi("Deleting", "جارٍ الحذف"),
    confirmDelete: bi("Delete this assessment?", "حذف هذا الاختبار؟"),
    deleteWarning: bi(
      "Sections and questions are removed with it. Assessments with attempts cannot be deleted.",
      "تُحذف معه الأقسام والأسئلة. لا يمكن حذف اختبار له محاولات.",
    ),
    viewResults: bi("Results", "النتائج"),
    backToList: bi("Back to assessments", "العودة إلى الاختبارات"),
    backToBuilder: bi("Back to builder", "العودة إلى المنشئ"),
    addSection: bi("Add section", "إضافة قسم"),
    saveSection: bi("Save section", "حفظ القسم"),
    cancel: bi("Cancel", "إلغاء"),
    addQuestion: bi("Add question", "إضافة سؤال"),
    editQuestion: bi("Edit question", "تعديل السؤال"),
    saveQuestion: bi("Save question", "حفظ السؤال"),
    moveUp: bi("Move up", "تحريك لأعلى"),
    moveDown: bi("Move down", "تحريك لأسفل"),
    start: bi("Start attempt", "بدء المحاولة"),
    starting: bi("Starting", "جارٍ البدء"),
    resume: bi("Resume attempt", "متابعة المحاولة"),
    openResult: bi("View result", "عرض النتيجة"),
    submit: bi("Submit answers", "تسليم الإجابات"),
    submitting: bi("Submitting", "جارٍ التسليم"),
    confirmSubmit: bi(
      "Submit this attempt now? You cannot change your answers afterwards.",
      "هل تريد تسليم هذه المحاولة الآن؟ لا يمكنك تغيير إجاباتك بعد ذلك.",
    ),
    upload: bi("Upload file", "رفع ملف"),
    uploading: bi("Uploading", "جارٍ الرفع"),
    uploadReplace: bi("Replace file", "استبدال الملف"),
    grade: bi("Save grades", "حفظ الدرجات"),
    grading: bi("Saving grades", "جارٍ حفظ الدرجات"),
  },
  filters: {
    search: bi("Search", "بحث"),
    searchPlaceholder: bi("Title or instructions", "العنوان أو التعليمات"),
    grade: bi("Grade", "الصف"),
    type: bi("Type", "النوع"),
    status: bi("Status", "الحالة"),
    allGrades: bi("All grades", "كل الصفوف"),
    allTypes: bi("All types", "كل الأنواع"),
    allStatuses: bi("All statuses", "كل الحالات"),
    publishedOnly: bi("Published", "منشور"),
    draftsOnly: bi("Drafts", "مسودات"),
    apply: bi("Apply filters", "تطبيق التصفية"),
    clear: bi("Clear filters", "مسح التصفية"),
    quizOnly: bi("Quizzes", "الاختبارات القصيرة"),
    examOnly: bi("Exams", "الاختبارات النهائية"),
  },
  list: {
    grade: bi("Grade", "الصف"),
    type: bi("Type", "النوع"),
    status: bi("Status", "الحالة"),
    time: bi("Time limit", "المدة"),
    attempts: bi("Attempts", "المحاولات"),
    questions: bi("Questions", "الأسئلة"),
    marks: bi("Total marks", "الدرجة الكلية"),
    empty: bi("No assessments yet", "لا توجد اختبارات بعد"),
    emptyHint: bi(
      "Create a quiz or an exam for one grade, then add sections and questions.",
      "أنشئ اختبارًا قصيرًا أو نهائيًا لصف واحد، ثم أضف الأقسام والأسئلة.",
    ),
    emptyFiltered: bi(
      "No assessments match these filters",
      "لا توجد اختبارات تطابق هذه التصفية",
    ),
    emptyFilteredHint: bi(
      "Try a different search, or clear the filters.",
      "جرّب بحثًا آخر أو امسح التصفية.",
    ),
    studentEmpty: bi("No assessments yet", "لا توجد اختبارات بعد"),
    studentEmptyHint: bi(
      "Published quizzes and exams for your grade will appear here.",
      "ستظهر هنا الاختبارات المنشورة لصفك.",
    ),
    studentEmptyCompleted: bi(
      "No completed attempts yet",
      "لا توجد محاولات مكتملة بعد",
    ),
    studentEmptyCompletedHint: bi(
      "Finish an assessment and your result will appear here.",
      "أكمل اختبارًا وستظهر نتيجتك هنا.",
    ),
    notStarted: bi("Not started", "لم تبدأ"),
    inProgress: bi("In progress", "قيد التنفيذ"),
    awaitingReview: bi("Awaiting review", "بانتظار المراجعة"),
    resultReady: bi("Result available", "النتيجة متاحة"),
    resultHidden: bi("Result hidden", "النتيجة مخفية"),
    attemptsUsed: bi("attempts used", "محاولات مستخدمة"),
    unlimited: bi("Retakes allowed", "يُسمح بالإعادة"),
    noRetakes: bi("No retakes", "لا إعادة"),
    availableFrom: bi("Opens", "يفتح"),
    availableUntil: bi("Closes", "يغلق"),
    openNow: bi("Open now", "متاح الآن"),
  },
  form: {
    createTitle: bi("New assessment", "اختبار جديد"),
    createSubtitle: bi(
      "Choose the type and rules first. You can add sections and questions after saving.",
      "اختر النوع والقواعد أولًا. يمكنك إضافة الأقسام والأسئلة بعد الحفظ.",
    ),
    editTitle: bi("Assessment details", "تفاصيل الاختبار"),
    editSubtitle: bi(
      "Changing rules affects attempts started after saving. Existing attempts keep their original timer.",
      "تغيير القواعد يؤثر على المحاولات التي تبدأ بعد الحفظ. تحتفظ المحاولات الحالية بمؤقتها الأصلي.",
    ),
    type: bi("Assessment type", "نوع الاختبار"),
    typeHint: bi(
      "Quizzes are short checks; exams are formal and default to one attempt.",
      "الاختبارات القصيرة تقييمات سريعة، والنهائية رسمية وتكون بمحاولة واحدة افتراضيًا.",
    ),
    titleEn: bi("Title (English)", "العنوان (بالإنجليزية)"),
    titleAr: bi("Title (Arabic)", "العنوان (بالعربية)"),
    instructionsEn: bi("Instructions (English)", "التعليمات (بالإنجليزية)"),
    instructionsAr: bi("Instructions (Arabic)", "التعليمات (بالعربية)"),
    grade: bi("Grade", "الصف"),
    gradeHint: bi(
      "Only students in this grade see a published assessment.",
      "لا يرى الاختبار المنشور إلا طلاب هذا الصف.",
    ),
    timeLimit: bi("Time limit (minutes)", "المدة (بالدقائق)"),
    timeLimitHint: bi(
      "Between 1 and 600 minutes. The timer starts when the student begins.",
      "من دقيقة إلى 600 دقيقة. يبدأ المؤقت عند بدء الطالب.",
    ),
    visibility: bi("Result visibility", "إظهار النتائج"),
    visibilityImmediately: bi("Show immediately", "إظهار فورًا"),
    visibilityAfterReview: bi("After teacher review", "بعد مراجعة المعلم"),
    visibilityHidden: bi("Hidden from students", "مخفية عن الطلاب"),
    visibilityHint: bi(
      "Hidden scores are never sent to the student, even after submission.",
      "لا تُرسل الدرجات المخفية إلى الطالب حتى بعد التسليم.",
    ),
    gradingMode: bi("Grading", "التصحيح"),
    gradingAutomatic: bi("Automatic", "آلي"),
    gradingManual: bi("Manual", "يدوي"),
    gradingMixed: bi("Mixed", "مختلط"),
    gradingHint: bi(
      "Automatic questions are marked on submission; essays and uploads always need a teacher.",
      "تُصحح الأسئلة الآلية عند التسليم؛ المقالات والملفات تحتاج إلى المعلم دائمًا.",
    ),
    allowRetakes: bi("Allow retakes", "السماح بالإعادة"),
    allowRetakesHint: bi(
      "When disabled, a student gets exactly one attempt.",
      "عند التعطيل يحصل الطالب على محاولة واحدة فقط.",
    ),
    maxAttempts: bi("Maximum attempts", "الحد الأقصى للمحاولات"),
    maxAttemptsHint: bi(
      "Between 2 and 10 attempts when retakes are enabled.",
      "من 2 إلى 10 محاولات عند تفعيل الإعادة.",
    ),
    availableFrom: bi("Opens at", "يفتح في"),
    availableUntil: bi("Closes at", "يغلق في"),
    availabilityHint: bi(
      "Optional. Leave both empty to keep the assessment available indefinitely.",
      "اختياري. اتركهما فارغين ليبقى الاختبار متاحًا دائمًا.",
    ),
    publish: bi("Publish immediately", "نشر فورًا"),
    publishHint: bi(
      "Unpublished assessments stay private to staff; students never see a draft.",
      "تبقى الاختبارات غير المنشورة خاصة بالموظفين، ولا يرى الطالب المسودات.",
    ),
    optional: bi("Optional", "اختياري"),
    required: bi("Required", "مطلوب"),
  },
  builder: {
    details: bi("Assessment details", "تفاصيل الاختبار"),
    settings: bi("Rules", "القواعد"),
    sections: bi("Sections", "الأقسام"),
    questions: bi("questions", "أسئلة"),
    sectionsHint: bi(
      "Sections group questions and control their order. Reordering happens immediately.",
      "تجمع الأقسام الأسئلة وتتحكم بترتيبها. يُحفظ الترتيب فورًا.",
    ),
    emptySections: bi("No sections yet", "لا توجد أقسام بعد"),
    emptySectionsHint: bi(
      "Add the first section before writing questions.",
      "أضف القسم الأول قبل كتابة الأسئلة.",
    ),
    sectionTitle: bi("Section title", "عنوان القسم"),
    sectionInstructions: bi("Section instructions", "تعليمات القسم"),
    sectionKind: bi("Section type", "نوع القسم"),
    kindStandard: bi("Questions only", "أسئلة فقط"),
    kindReadingPassage: bi("Reading passage", "نص قراءة"),
    kindDialogue: bi("Dialogue", "حوار"),
    addReadingPassage: bi("Add reading passage", "إضافة نص قراءة"),
    addDialogue: bi("Add dialogue", "إضافة حوار"),
    addEssay: bi("Add essay", "إضافة مقال"),
    addParagraph: bi("Add paragraph", "إضافة فقرة"),
    passageText: bi("Passage text", "نص القطعة"),
    vocabulary: bi("Vocabulary / help (optional)", "المفردات / المساعدة (اختياري)"),
    source: bi("Source / reference (optional)", "المصدر / المرجع (اختياري)"),
    dialogueLines: bi("Dialogue lines", "أسطر الحوار"),
    speaker: bi("Speaker", "المتحدث"),
    dialogueText: bi("Line", "السطر"),
    addLine: bi("Add line", "إضافة سطر"),
    removeLine: bi("Remove line", "إزالة السطر"),
    collapse: bi("Collapse", "طي"),
    expand: bi("Expand", "توسيع"),
    moveToGroup: bi("Move to group", "نقل إلى قسم"),
    groupContentHint: bi(
      "Students read this content once, then answer the questions attached to the group.",
      "يقرأ الطالب هذا المحتوى مرة واحدة، ثم يجيب عن الأسئلة المرتبطة بالقسم.",
    ),
    noQuestions: bi("No questions in this section", "لا توجد أسئلة في هذا القسم"),
    addFirstQuestion: bi(
      "Add the first question to this section.",
      "أضف أول سؤال إلى هذا القسم.",
    ),
    confirmDeleteSection: bi(
      "Delete this section and all of its questions?",
      "حذف هذا القسم وجميع أسئلته؟",
    ),
    confirmDeleteQuestion: bi(
      "Delete this question?",
      "حذف هذا السؤال؟",
    ),
    questionMarks: bi("marks", "درجات"),
    activityTitle: bi("Recent activity", "النشاط الأخير"),
    activityHint: bi(
      "Assessment administration events only. Answer keys are never recorded.",
      "أحداث إدارة الاختبارات فقط. لا تُسجَّل مفاتيح الإجابات.",
    ),
    noActivity: bi("No activity recorded yet.", "لم يُسجَّل أي نشاط بعد."),
    createdSuccess: bi("Assessment created.", "تم إنشاء الاختبار."),
    updatedSuccess: bi("Assessment updated.", "تم تحديث الاختبار."),
    publishedSuccess: bi("Assessment published.", "تم نشر الاختبار."),
    unpublishedSuccess: bi(
      "Assessment unpublished. Students can no longer open it.",
      "أُلغي نشر الاختبار. لم يعد بإمكان الطلاب فتحه.",
    ),
    deletedSuccess: bi("Assessment deleted.", "تم حذف الاختبار."),
    questionCreated: bi("Question created.", "تم إنشاء السؤال."),
    questionUpdated: bi("Question updated.", "تم تحديث السؤال."),
    sectionCreated: bi("Section created.", "تم إنشاء القسم."),
    sectionUpdated: bi("Section updated.", "تم تحديث القسم."),
    sectionDeleted: bi("Section deleted.", "تم حذف القسم."),
    questionDeleted: bi("Question deleted.", "تم حذف السؤال."),
    reordered: bi("Order saved.", "تم حفظ الترتيب."),
  },
  questionForm: {
    newTitle: bi("New question", "سؤال جديد"),
    newSubtitle: bi(
      "Pick the type first, then fill in the prompt, marks and answer key.",
      "اختر النوع أولًا، ثم املأ نص السؤال والدرجات ومفتاح الإجابة.",
    ),
    editTitle: bi("Edit question", "تعديل السؤال"),
    editSubtitle: bi(
      "Answer keys are private to staff and never included in a student payload.",
      "مفاتيح الإجابات خاصة بالموظفين ولا تُضمَّن في بيانات الطالب إطلاقًا.",
    ),
    type: bi("Question type", "نوع السؤال"),
    typeLocked: bi(
      "The type cannot change after students have answered this question.",
      "لا يمكن تغيير النوع بعد إجابة الطلاب على هذا السؤال.",
    ),
    promptEn: bi("Question (English)", "نص السؤال (بالإنجليزية)"),
    promptAr: bi("Question (Arabic)", "نص السؤال (بالعربية)"),
    helpEn: bi("Hint (English)", "تلميح (بالإنجليزية)"),
    helpAr: bi("Hint (Arabic)", "تلميح (بالعربية)"),
    marks: bi("Marks", "الدرجة"),
    required: bi("Answer is required", "الإجابة مطلوبة"),
    gradingMethod: bi("Grading method", "طريقة التصحيح"),
    automatic: bi("Automatic", "آلي"),
    manual: bi("Manual", "يدوي"),
    gradingForcedManual: bi(
      "Essays and file uploads are always graded by a teacher.",
      "تُصحح المقالات والملفات بواسطة المعلم دائمًا.",
    ),
    options: bi("Options", "الخيارات"),
    optionsHint: bi(
      "Add two to ten options, then mark the correct one.",
      "أضف من خيارين إلى عشرة، ثم حدد الخيار الصحيح.",
    ),
    option: bi("Option", "خيار"),
    correct: bi("Correct answer", "الإجابة الصحيحة"),
    addOption: bi("Add option", "إضافة خيار"),
    remove: bi("Remove", "إزالة"),
    trueLabel: bi("True", "صحيح"),
    falseLabel: bi("False", "خطأ"),
    pairs: bi("Matching pairs", "أزواج المطابقة"),
    pairsHint: bi(
      "Students see the left items and the shuffled right items, then connect them.",
      "يرى الطالب العناصر اليمنى والعناصر اليسرى مبعثرة، ثم يربط بينها.",
    ),
    left: bi("Left item", "العنصر الأول"),
    right: bi("Right item", "العنصر المقابل"),
    addPair: bi("Add pair", "إضافة زوج"),
    accepted: bi("Accepted answers", "الإجابات المقبولة"),
    acceptedHint: bi(
      "One answer per line. Matching ignores capitals and extra spaces unless case sensitivity is enabled.",
      "إجابة واحدة في كل سطر. يُهمَل اختلاف الأحرف الكبيرة والمسافات الإضافية ما لم تُفعَّل حساسية الأحرف.",
    ),
    caseSensitive: bi("Case sensitive", "حساس لحالة الأحرف"),
    explanationEn: bi("Explanation (English)", "التفسير (بالإنجليزية)"),
    explanationAr: bi("Explanation (Arabic)", "التفسير (بالعربية)"),
    explanationHint: bi(
      "Optional. Shown with the result when results are visible.",
      "اختياري. يظهر مع النتيجة عند إتاحتها.",
    ),
    essayHint: bi(
      "Students write a long answer. A teacher grades it manually.",
      "يكتب الطالب إجابة مطوّلة ويصححها المعلم يدويًا.",
    ),
    paragraphHint: bi(
      "Students write a focused paragraph. A teacher grades it manually.",
      "يكتب الطالب فقرة مركّزة ويصححها المعلم يدويًا.",
    ),
    topic: bi("Topic / title (optional)", "الموضوع / العنوان (اختياري)"),
    minWords: bi("Minimum words (optional)", "الحد الأدنى للكلمات (اختياري)"),
    maxWords: bi("Maximum words (optional)", "الحد الأقصى للكلمات (اختياري)"),
    wordLimitsHint: bi(
      "Guidance shown to the student. It does not block submission.",
      "إرشاد يظهر للطالب ولا يمنع التسليم.",
    ),
    rubric: bi("Marking rubric (optional)", "معايير التصحيح (اختياري)"),
    rubricHint: bi(
      "Shown to the student and used when a teacher grades the answer manually.",
      "تظهر للطالب ويستخدمها المعلم عند التصحيح اليدوي.",
    ),
    fileHint: bi(
      "Students upload a PDF or image. A teacher grades it manually.",
      "يرفع الطالب ملف PDF أو صورة ويصححها المعلم يدويًا.",
    ),
    selectTypeHint: bi(
      "The answer fields change based on the selected type.",
      "تتغير حقول الإجابة حسب النوع المحدد.",
    ),
  },
  student: {
    title: bi("Assessments", "الاختبارات"),
    subtitle: bi(
      "Quizzes and exams for your grade only. Attempts are timed and submitted automatically at the end.",
      "الاختبارات القصيرة والنهائية لصفك فقط. المحاولات موقوتة وتُسلَّم تلقائيًا عند انتهاء الوقت.",
    ),
    gradeLocked: bi("Grade-locked", "مقيّدة بالصف"),
    introTitle: bi("Before you start", "قبل أن تبدأ"),
    rules: bi("Attempt rules", "قواعد المحاولة"),
    timeLimit: bi("Time limit", "المدة"),
    minutes: bi("minutes", "دقيقة"),
    attemptsAllowed: bi("Attempts allowed", "المحاولات المسموحة"),
    results: bi("Results", "النتائج"),
    autoSubmit: bi(
      "Your answers are saved automatically. When the timer reaches zero the attempt is submitted as-is.",
      "تُحفظ إجاباتك تلقائيًا. عند وصول المؤقت إلى الصفر تُسلَّم المحاولة كما هي.",
    ),
    startedAt: bi("Started", "بدأت"),
    timeRemaining: bi("Time remaining", "الوقت المتبقي"),
    answered: bi("answered", "تمت الإجابة"),
    saved: bi("Saved", "تم الحفظ"),
    saving: bi("Saving", "جارٍ الحفظ"),
    notSaved: bi("Not saved yet", "لم يُحفظ بعد"),
    saveFailed: bi("Answer could not be saved. Try again.", "تعذّر حفظ الإجابة. حاول مرة أخرى."),
    timeExpired: bi(
      "Time is up. Your attempt is being submitted.",
      "انتهى الوقت. يتم تسليم محاولتك.",
    ),
    submitHint: bi(
      "Review your answers before submitting. Unanswered questions score zero.",
      "راجع إجاباتك قبل التسليم. الأسئلة غير المجابة تحصل على صفر.",
    ),
    chooseOption: bi("Choose one option", "اختر خيارًا واحدًا"),
    chooseTrueFalse: bi("Choose true or false", "اختر صحيحًا أو خطأ"),
    matchHint: bi(
      "Choose the matching item for every row.",
      "اختر العنصر المطابق لكل صف.",
    ),
    writeAnswer: bi("Write your answer", "اكتب إجابتك"),
    essayAnswer: bi("Write your essay", "اكتب مقالتك"),
    paragraphAnswer: bi("Write your paragraph", "اكتب فقرتك"),
    words: bi("words", "كلمة"),
    wordCount: bi("Word count", "عدد الكلمات"),
    minWordsHint: bi("At least", "على الأقل"),
    maxWordsHint: bi("Up to", "حتى"),
    rubric: bi("Marking rubric", "معايير التصحيح"),
    passage: bi("Reading passage", "نص القراءة"),
    vocabulary: bi("Vocabulary", "المفردات"),
    source: bi("Source", "المصدر"),
    dialogue: bi("Dialogue", "حوار"),
    fileAnswer: bi("Upload your file", "ارفع ملفك"),
    fileHint: bi(
      "PDF, JPEG, PNG or WebP up to 25 MB.",
      "PDF أو JPEG أو PNG أو WebP بحد أقصى 25 ميجابايت.",
    ),
    fileAttached: bi("File attached", "الملف مرفق"),
    noFile: bi("No file attached", "لا يوجد ملف مرفق"),
    question: bi("Question", "السؤال"),
    resultTitle: bi("Attempt result", "نتيجة المحاولة"),
    score: bi("Score", "الدرجة"),
    percentage: bi("Percentage", "النسبة"),
    submittedAt: bi("Submitted", "تاريخ التسليم"),
    pendingReview: bi(
      "Your answers were submitted and are waiting for teacher review.",
      "تم تسليم إجاباتك وهي بانتظار مراجعة المعلم.",
    ),
    hiddenResult: bi(
      "Results for this assessment are not shown to students.",
      "نتائج هذا الاختبار لا تُعرض للطلاب.",
    ),
    hiddenResultHint: bi(
      "Your attempt was received. Ask your teacher if you need feedback.",
      "تم استلام محاولتك. اسأل معلمك إذا كنت بحاجة إلى ملاحظات.",
    ),
    yourAnswer: bi("Your answer", "إجابتك"),
    noAnswer: bi("No answer", "بدون إجابة"),
    feedback: bi("Teacher feedback", "ملاحظات المعلم"),
    correct: bi("Correct", "صحيحة"),
    incorrect: bi("Incorrect", "غير صحيحة"),
    partiallyCorrect: bi("Reviewed", "تمت المراجعة"),
    autoGraded: bi("Automatically graded", "مصحح آليًا"),
    manualGraded: bi("Reviewed by teacher", "راجعها المعلم"),
    backToAssessments: bi("Back to assessments", "العودة إلى الاختبارات"),
    attemptNumber: bi("Attempt", "المحاولة"),
    noAttemptsLeft: bi(
      "No attempts remaining for this assessment.",
      "لا توجد محاولات متبقية لهذا الاختبار.",
    ),
    notOpenYet: bi("This assessment has not opened yet.", "لم يُفتح هذا الاختبار بعد."),
    closed: bi("This assessment is closed.", "أُغلق هذا الاختبار."),
    inProgressHint: bi(
      "You already have an attempt in progress.",
      "لديك محاولة قيد التنفيذ بالفعل.",
    ),
  },
  strict: {
    title: bi("Strict exam mode", "وضع الاختبار الصارم"),
    settingsHint: bi(
      "Strict mode closes the attempt when the student leaves the page, switches tabs or loses the connection. It cannot prevent every kind of cheating: a student may still use another device.",
      "يُغلق الوضع الصارم المحاولة عندما يغادر الطالب الصفحة أو يبدّل التبويب أو ينقطع اتصاله. لا يمكنه منع كل أنواع الغش: قد يستخدم الطالب جهازًا آخر.",
    ),
    enabled: bi("Enable strict exam mode", "تفعيل وضع الاختبار الصارم"),
    enabledHint: bi(
      "Enabled by default for exams. Quizzes keep the normal behaviour unless you enable it.",
      "مفعّل افتراضيًا للاختبارات النهائية. تحتفظ الاختبارات القصيرة بالسلوك العادي ما لم تفعّله.",
    ),
    tabHidden: bi("Submit when the tab is hidden", "التسليم عند إخفاء التبويب"),
    tabHiddenHint: bi(
      "Switching tabs or minimising the browser closes the attempt.",
      "يؤدي تبديل التبويب أو تصغير المتصفح إلى إغلاق المحاولة.",
    ),
    navigation: bi("Submit on navigation or page close", "التسليم عند الانتقال أو إغلاق الصفحة"),
    navigationHint: bi(
      "Refreshing, closing the page or navigating away closes the attempt when the browser reports it.",
      "يؤدي تحديث الصفحة أو إغلاقها أو الانتقال منها إلى إغلاق المحاولة عندما يبلّغ المتصفح بذلك.",
    ),
    heartbeat: bi("Heartbeat timeout (seconds)", "مهلة نبض الاتصال (ثانية)"),
    heartbeatHint: bi(
      "If the browser stops sending heartbeats for this long, the server closes the attempt.",
      "إذا توقف المتصفح عن إرسال نبض الاتصال لهذه المدة، يغلق الخادم المحاولة.",
    ),
    allowResume: bi(
      "Allow resuming after a connection loss",
      "السماح بالاستئناف بعد انقطاع الاتصال",
    ),
    allowResumeHint: bi(
      "Leave off for exams so a lost connection closes the attempt. Turn on for quizzes.",
      "اتركه معطّلًا للاختبارات النهائية ليُغلق الاتصال المفقود المحاولة. فعّله للاختبارات القصيرة.",
    ),
    randomizeQuestions: bi("Randomize question order", "عشوائية ترتيب الأسئلة"),
    randomizeQuestionsHint: bi(
      "Each attempt gets a stable shuffled order. Question marks and answers are unchanged.",
      "تحصل كل محاولة على ترتيب عشوائي ثابت. لا تتغير الدرجات أو الإجابات.",
    ),
    randomizeOptions: bi(
      "Randomize multiple-choice options",
      "عشوائية خيارات الاختيار من متعدد",
    ),
    randomizeOptionsHint: bi(
      "Options are shuffled per attempt. The stored answer still points at the same option.",
      "تُخلط الخيارات لكل محاولة. تظل الإجابة المحفوظة مرتبطة بالخيار نفسه.",
    ),
    warning: bi(
      "Leaving this assessment, switching tabs, minimizing the browser, or closing the page may submit your attempt automatically.",
      "قد يؤدي مغادرة هذا الاختبار أو تبديل علامة التبويب أو تصغير المتصفح أو إغلاق الصفحة إلى إرسال محاولتك تلقائيًا.",
    ),
    notFoolproof: bi(
      "Strict mode reduces simple page-switching, but it cannot prevent every kind of cheating. A student can still use another device.",
      "يقلل الوضع الصارم من تبديل الصفحات البسيط، لكنه لا يمنع كل أنواع الغش. لا يزال بإمكان الطالب استخدام جهاز آخر.",
    ),
    confirmationTitle: bi("Confirm and start", "التأكيد والبدء"),
    confirmationIntro: bi(
      "Check these rules before the timer starts.",
      "راجع هذه القواعد قبل بدء المؤقت.",
    ),
    timed: bi("This is a timed assessment.", "هذا اختبار موقوت."),
    attempts: bi("Attempts allowed", "المحاولات المسموحة"),
    leaving: bi("Leaving the page submits the attempt", "مغادرة الصفحة تسلّم المحاولة"),
    leavingNo: bi("Leaving the page does not submit", "مغادرة الصفحة لا تسلّم المحاولة"),
    resultsRule: bi("Result visibility", "إظهار النتيجة"),
    startConfirm: bi("Start now", "ابدأ الآن"),
    back: bi("Not yet", "ليس الآن"),
    runnerBanner: bi(
      "Strict exam mode is active. Leaving, switching tabs, minimising the browser or closing the page may submit this attempt.",
      "وضع الاختبار الصارم مفعّل. قد تؤدي المغادرة أو تبديل التبويب أو تصغير المتصفح أو إغلاق الصفحة إلى تسليم هذه المحاولة.",
    ),
    runnerConnection: bi(
      "If the connection drops, the server submits the attempt after the heartbeat timeout.",
      "إذا انقطع الاتصال، يسلّم الخادم المحاولة بعد انتهاء مهلة نبض الاتصال.",
    ),
    copyBlocked: bi(
      "Copying and pasting are disabled during this strict assessment.",
      "تم تعطيل النسخ واللصق أثناء هذا الاختبار الصارم.",
    ),
    noCheatClaim: bi(
      "This control does not guarantee that cheating is impossible.",
      "لا يضمن هذا الإجراء استحالة الغش.",
    ),
  },
  results: {
    title: bi("Attempts & grading", "المحاولات والتصحيح"),
    subtitle: bi(
      "Every attempt for this assessment. Manual answers wait here until a teacher reviews them.",
      "كل محاولات هذا الاختبار. تنتظر الإجابات اليدوية هنا حتى يراجعها المعلم.",
    ),
    student: bi("Student", "الطالب"),
    attempt: bi("Attempt", "المحاولة"),
    status: bi("Status", "الحالة"),
    score: bi("Score", "الدرجة"),
    submitted: bi("Submitted", "تاريخ التسليم"),
    reason: bi("Submission reason", "سبب التسليم"),
    flags: bi("Suspicious events", "الأحداث المشبوهة"),
    tabHidden: bi("Tab hidden", "إخفاء التبويب"),
    focusLoss: bi("Focus loss", "فقدان التركيز"),
    noFlags: bi("None", "لا يوجد"),
    review: bi("Review", "المراجعة"),
    grade: bi("Grade attempt", "تصحيح المحاولة"),
    empty: bi("No attempts yet", "لا توجد محاولات بعد"),
    emptyHint: bi(
      "Attempts appear as soon as students start the assessment.",
      "تظهر المحاولات بمجرد أن يبدأ الطلاب الاختبار.",
    ),
    pending: bi("Needs review", "يحتاج مراجعة"),
    completed: bi("Graded", "مصححة"),
    notRequired: bi("No manual review", "لا تحتاج مراجعة"),
    autoScore: bi("Automatic marks", "الدرجات الآلية"),
    responseTitle: bi("Student answer", "إجابة الطالب"),
    manualMarks: bi("Marks for this answer", "درجة هذه الإجابة"),
    feedbackEn: bi("Feedback (English)", "الملاحظات (بالإنجليزية)"),
    feedbackAr: bi("Feedback (Arabic)", "الملاحظات (بالعربية)"),
    saved: bi("Grades saved.", "تم حفظ الدرجات."),
    gradingTitle: bi("Grade attempt", "تصحيح المحاولة"),
    gradingSubtitle: bi(
      "Award marks within each question's maximum, add feedback, then save.",
      "امنح الدرجات ضمن الحد الأقصى لكل سؤال، وأضف الملاحظات، ثم احفظ.",
    ),
    outOf: bi("out of", "من"),
    awaitingManual: bi(
      "This answer needs a teacher's marks.",
      "تحتاج هذه الإجابة إلى درجات المعلم.",
    ),
    fileAnswer: bi("Uploaded file", "ملف مرفوع"),
    noAnswer: bi("Not answered", "لم تُجب"),
    backToResults: bi("Back to results", "العودة إلى النتائج"),
  },
  messages: {
    loadFailed: bi(
      "Assessments could not be loaded. Refresh the page or check the database connection.",
      "تعذّر تحميل الاختبارات. حدّث الصفحة أو تحقق من اتصال قاعدة البيانات.",
    ),
    notFound: bi(
      "That assessment no longer exists.",
      "لم يعد هذا الاختبار موجودًا.",
    ),
    forbidden: bi(
      "You do not have permission for this action.",
      "ليس لديك إذن لهذا الإجراء.",
    ),
    serviceUnavailable: bi(
      "Private storage is not configured on the server.",
      "مساحة التخزين الخاصة غير مهيأة على الخادم.",
    ),
    noGrades: bi("No grades yet", "لا توجد صفوف بعد"),
    noGradesHint: bi(
      "Create a grade and class before adding assessments.",
      "أنشئ صفًا وفصلًا قبل إضافة الاختبارات.",
    ),
    noStudents: bi("No students yet", "لا يوجد طلاب بعد"),
  },
} as const;

function mapOf<T extends string>(entries: Record<T, Bilingual>) {
  return entries;
}

export const assessmentTypeCopy = mapOf<AssessmentType>({
  quiz: bi("Quiz", "اختبار قصير"),
  exam: bi("Exam", "اختبار نهائي"),
});

export const resultsVisibilityCopy = mapOf<ResultsVisibility>({
  immediately: bi("Shown immediately", "تُعرض فورًا"),
  after_review: bi("After teacher review", "بعد مراجعة المعلم"),
  hidden: bi("Hidden from students", "مخفية عن الطلاب"),
});

export const gradingModeCopy = mapOf<GradingMode>({
  automatic: bi("Automatic", "آلي"),
  manual: bi("Manual", "يدوي"),
  mixed: bi("Mixed", "مختلط"),
});

export const attemptStatusCopy = mapOf<AttemptStatus>({
  in_progress: bi("In progress", "قيد التنفيذ"),
  submitted: bi("Submitted", "مُسلَّمة"),
  grading: bi("Awaiting review", "بانتظار المراجعة"),
  graded: bi("Graded", "مصححة"),
  expired: bi("Expired", "منتهية"),
});

export const submissionReasonCopy = mapOf<SubmissionReason>({
  student_submitted: bi("Student submitted", "سلّمها الطالب"),
  time_expired: bi("Time expired", "انتهى الوقت"),
  left_assessment: bi("Left the assessment", "غادر الاختبار"),
  tab_hidden: bi("Tab hidden", "أُخفي التبويب"),
  page_unloaded: bi("Page closed or refreshed", "أُغلقت الصفحة أو حُدّثت"),
  heartbeat_expired: bi("Connection timed out", "انتهت مهلة الاتصال"),
  connection_lost: bi("Connection lost", "انقطع الاتصال"),
});

export const questionTypeCopy = mapOf<QuestionType>({
  multiple_choice: bi("Multiple choice", "اختيار من متعدد"),
  true_false: bi("True / false", "صحيح / خطأ"),
  matching: bi("Matching", "مطابقة"),
  short_answer: bi("Short answer", "إجابة قصيرة"),
  essay: bi("Essay", "مقال"),
  paragraph: bi("Paragraph", "فقرة"),
  file_upload: bi("File upload", "رفع ملف"),
  rewrite: bi("Rewrite", "إعادة صياغة"),
  find_the_mistake: bi("Find the mistake", "اكتشف الخطأ"),
});

export const assessmentEventCopy = mapOf<AssessmentAdminAction>({
  created: bi("Assessment created", "أُنشئ الاختبار"),
  updated: bi("Assessment updated", "حُدّث الاختبار"),
  published: bi("Assessment published", "نُشر الاختبار"),
  unpublished: bi("Assessment unpublished", "أُلغي نشر الاختبار"),
  deleted: bi("Assessment deleted", "حُذف الاختبار"),
  section_created: bi("Section created", "أُنشئ القسم"),
  section_updated: bi("Section updated", "حُدّث القسم"),
  section_deleted: bi("Section deleted", "حُذف القسم"),
  sections_reordered: bi("Sections reordered", "أُعيد ترتيب الأقسام"),
  question_created: bi("Question created", "أُنشئ السؤال"),
  question_updated: bi("Question updated", "حُدّث السؤال"),
  question_deleted: bi("Question deleted", "حُذف السؤال"),
  question_moved: bi("Question moved", "نُقل السؤال"),
  questions_reordered: bi("Questions reordered", "أُعيد ترتيب الأسئلة"),
  attempt_graded: bi("Attempt graded", "صُححت المحاولة"),
  attempt_auto_submitted: bi(
    "Attempt submitted automatically",
    "تم تسليم المحاولة تلقائيًا",
  ),
  import_started: bi("Assessment import started", "بدأ استيراد اختبار"),
  import_draft_created: bi("Imported draft created", "أُنشئت مسودة مستوردة"),
  import_draft_edited: bi("Imported draft edited", "عُدّلت المسودة المستوردة"),
  import_published: bi("Imported assessment published", "نُشر الاختبار المستورد"),
});

export const assessmentErrorCopy: Record<AssessmentErrorCode, Bilingual> = {
  validation_failed: bi(
    "Please check the highlighted fields.",
    "يرجى التحقق من الحقول المحددة.",
  ),
  forbidden: bi(
    "You do not have permission for this action.",
    "ليس لديك إذن لهذا الإجراء.",
  ),
  not_found: bi(
    "That item no longer exists.",
    "لم يعد هذا العنصر موجودًا.",
  ),
  title_required: bi(
    "Enter a title in both languages.",
    "أدخل عنوانًا باللغتين.",
  ),
  title_too_long: bi(
    "Titles can be up to 200 characters.",
    "يمكن أن يتكون العنوان من 200 حرف كحد أقصى.",
  ),
  instructions_too_long: bi(
    "Instructions can be up to 4,000 characters.",
    "يمكن أن تصل التعليمات إلى 4000 حرف.",
  ),
  grade_required: bi("Choose a grade.", "اختر صفًا."),
  grade_not_found: bi(
    "That grade no longer exists.",
    "لم يعد هذا الصف موجودًا.",
  ),
  type_invalid: bi("Choose quiz or exam.", "اختر اختبارًا قصيرًا أو نهائيًا."),
  time_limit_invalid: bi(
    "The time limit must be between 1 and 600 minutes.",
    "يجب أن تكون المدة بين دقيقة و600 دقيقة.",
  ),
  heartbeat_invalid: bi(
    "The heartbeat timeout must be between 15 and 600 seconds.",
    "يجب أن تكون مهلة نبض الاتصال بين 15 و600 ثانية.",
  ),
  reason_invalid: bi(
    "That submission reason is not valid.",
    "سبب التسليم هذا غير صالح.",
  ),
  visibility_invalid: bi(
    "Choose a valid result visibility.",
    "اختر طريقة صحيحة لإظهار النتائج.",
  ),
  grading_mode_invalid: bi(
    "Choose a valid grading mode.",
    "اختر طريقة تصحيح صحيحة.",
  ),
  grading_method_invalid: bi(
    "Choose automatic or manual grading.",
    "اختر تصحيحًا آليًا أو يدويًا.",
  ),
  grading_method_requires_manual: bi(
    "Essays, paragraphs and file uploads must be graded manually.",
    "يجب تصحيح المقالات والفقرات والملفات يدويًا.",
  ),
  automatic_grading_not_supported: bi(
    "This question type cannot be graded automatically.",
    "لا يمكن تصحيح هذا النوع من الأسئلة آليًا.",
  ),
  retake_invalid: bi(
    "Retakes need a maximum between 2 and 10; otherwise the maximum must be 1.",
    "تتطلب الإعادة حدًا أقصى بين 2 و10، وإلا يجب أن يكون الحد الأقصى 1.",
  ),
  availability_invalid: bi(
    "The closing time must be after the opening time.",
    "يجب أن يكون وقت الإغلاق بعد وقت الفتح.",
  ),
  assessment_has_attempts: bi(
    "Students have already attempted this assessment, so it cannot be deleted.",
    "بدأ الطلاب هذا الاختبار بالفعل، لذا لا يمكن حذفه.",
  ),
  assessment_no_questions: bi(
    "Add at least one question before publishing.",
    "أضف سؤالًا واحدًا على الأقل قبل النشر.",
  ),
  assessment_no_gradable_questions: bi(
    "Add at least one question with marks before publishing.",
    "أضف سؤالًا واحدًا بدرجة على الأقل قبل النشر.",
  ),
  section_not_found: bi(
    "That section no longer exists.",
    "لم يعد هذا القسم موجودًا.",
  ),
  section_title_required: bi(
    "Enter a section title in both languages.",
    "أدخل عنوان القسم باللغتين.",
  ),
  section_has_answers: bi(
    "Students have answered questions in this section, so it cannot be deleted.",
    "أجاب الطلاب على أسئلة في هذا القسم، لذا لا يمكن حذفه.",
  ),
  section_kind_invalid: bi(
    "Choose a valid section type.",
    "اختر نوع قسم صالحًا.",
  ),
  section_content_required: bi(
    "Add the passage or at least one dialogue line before saving.",
    "أضف النص أو سطر حوار واحدًا على الأقل قبل الحفظ.",
  ),
  section_has_questions: bi(
    "Move the questions to another group before deleting this one.",
    "انقل الأسئلة إلى قسم آخر قبل حذف هذا القسم.",
  ),
  question_not_found: bi(
    "That question no longer exists.",
    "لم يعد هذا السؤال موجودًا.",
  ),
  question_type_invalid: bi(
    "Choose a valid question type.",
    "اختر نوع سؤال صالحًا.",
  ),
  question_prompt_required: bi(
    "Enter the question text in English.",
    "أدخل نص السؤال بالإنجليزية.",
  ),
  question_marks_invalid: bi(
    "Marks must be between 0.01 and 100, with at most two decimals.",
    "يجب أن تكون الدرجة بين 0.01 و100 بحد أقصى منزلتين عشريتين.",
  ),
  question_word_limits_invalid: bi(
    "Word limits must be whole numbers, and the maximum cannot be below the minimum.",
    "يجب أن تكون حدود الكلمات أعدادًا صحيحة، ولا يمكن أن يكون الحد الأقصى أقل من الحد الأدنى.",
  ),
  question_options_invalid: bi(
    "Add between 2 and 10 options.",
    "أضف من خيارين إلى عشرة خيارات.",
  ),
  question_option_required: bi(
    "Fill in each option and mark the correct one.",
    "املأ كل خيار وحدد الخيار الصحيح.",
  ),
  question_pairs_invalid: bi(
    "Add between 2 and 10 complete matching pairs.",
    "أضف من زوجين إلى عشرة أزواج مطابقة مكتملة.",
  ),
  question_answer_required: bi(
    "Add at least one accepted answer.",
    "أضف إجابة مقبولة واحدة على الأقل.",
  ),
  question_has_answers: bi(
    "Students have answered this question, so it cannot be deleted.",
    "أجاب الطلاب على هذا السؤال، لذا لا يمكن حذفه.",
  ),
  invalid_order: bi(
    "The order could not be saved. Reload the page and try again.",
    "تعذّر حفظ الترتيب. حدّث الصفحة وحاول مرة أخرى.",
  ),
  attempt_not_available: bi(
    "This assessment is not available right now.",
    "هذا الاختبار غير متاح الآن.",
  ),
  attempt_not_found: bi(
    "That attempt could not be found.",
    "تعذّر العثور على هذه المحاولة.",
  ),
  attempt_not_submitted: bi(
    "The attempt must be submitted before it can be graded.",
    "يجب تسليم المحاولة قبل تصحيحها.",
  ),
  attempt_closed: bi(
    "This attempt is already closed.",
    "هذه المحاولة مغلقة بالفعل.",
  ),
  retakes_not_allowed: bi(
    "Retakes are not allowed for this assessment.",
    "الإعادة غير مسموحة لهذا الاختبار.",
  ),
  max_attempts_reached: bi(
    "You have used all allowed attempts.",
    "لقد استخدمت جميع المحاولات المسموحة.",
  ),
  answer_invalid: bi(
    "That answer is not valid for this question.",
    "هذه الإجابة غير صالحة لهذا السؤال.",
  ),
  answer_too_long: bi(
    "Your answer is too long.",
    "إجابتك طويلة جدًا.",
  ),
  file_required: bi("Choose a file to upload.", "اختر ملفًا لرفعه."),
  file_type_invalid: bi(
    "Use a PDF, JPEG, PNG or WebP file.",
    "استخدم ملف PDF أو JPEG أو PNG أو WebP.",
  ),
  file_too_large: bi(
    "The file is larger than 25 MB.",
    "حجم الملف أكبر من 25 ميجابايت.",
  ),
  upload_failed: bi(
    "The file could not be uploaded. Try again.",
    "تعذّر رفع الملف. حاول مرة أخرى.",
  ),
  upload_missing: bi(
    "The uploaded file could not be verified. Try again.",
    "تعذّر التحقق من الملف المرفوع. حاول مرة أخرى.",
  ),
  storage_failed: bi(
    "Private storage is unavailable right now. Try again in a moment.",
    "مساحة التخزين الخاصة غير متاحة الآن. حاول بعد قليل.",
  ),
  service_unavailable: bi(
    "Private storage is not configured on the server.",
    "مساحة التخزين الخاصة غير مهيأة على الخادم.",
  ),
  unknown: bi(
    "Something went wrong. Please try again.",
    "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
  ),
};
