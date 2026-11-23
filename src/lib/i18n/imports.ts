import type { Bilingual } from "@/lib/i18n/dictionary";
import type { ImportConfidence, ImportWarningCode } from "@/lib/import/types";
import type { ImportErrorCode } from "@/lib/import/validation";

const bi = (en: string, ar: string): Bilingual => ({ en, ar });

/**
 * Importer copy. Arabic here is interface copy only; imported Arabic content is
 * never generated and stays empty until the teacher writes it.
 */
export const importsUi = {
  eyebrow: bi("Assessment centre", "مركز الاختبارات"),
  title: bi("Import an assessment", "استيراد اختبار"),
  subtitle: bi(
    "Upload a typed DOCX, text PDF or plain-text paper. Parsing runs on this server with free, local libraries. Optional AI help is off by default and never replaces your review.",
    "ارفع ورقة مكتوبة بصيغة DOCX أو PDF نصي أو نص عادي. تتم المعالجة على هذا الخادم بمكتبات محلية مجانية. مساعدة الذكاء الاصطناعي الاختيارية معطلة افتراضيًا ولا تحل محل مراجعتك.",
  ),
  common: {
    backToAssessments: bi("Back to assessments", "العودة إلى الاختبارات"),
  },
  upload: {
    formTitle: bi("Upload files", "رفع الملفات"),
    formHint: bi(
      "The question file is required. The answer key is optional and stays private to staff.",
      "ملف الأسئلة مطلوب. مفتاح الإجابة اختياري ويبقى خاصًا بالموظفين.",
    ),
    grade: bi("Grade", "الصف"),
    gradeHint: bi(
      "Only students in this grade can ever see the assessment after it is published.",
      "لا يرى الاختبار بعد نشره إلا طلاب هذا الصف.",
    ),
    type: bi("Assessment type", "نوع الاختبار"),
    titleOverride: bi("Title override", "عنوان بديل"),
    titleOverrideHint: bi(
      "Optional. Leave empty to use the title found in the file or its name.",
      "اختياري. اتركه فارغًا لاستخدام العنوان الموجود في الملف أو اسمه.",
    ),
    questionFile: bi("Question file", "ملف الأسئلة"),
    answerFile: bi("Answer key file", "ملف مفتاح الإجابة"),
    optional: bi("Optional", "اختياري"),
    chooseFile: bi("Choose a file", "اختر ملفًا"),
    questionFileHint: bi(
      "DOCX, text-based PDF or TXT. The size limit is shown below.",
      "DOCX أو PDF نصي أو TXT. يظهر حد الحجم أدناه.",
    ),
    answerFileHint: bi(
      "DOCX, text-based PDF or TXT. Never shown to students.",
      "DOCX أو PDF نصي أو TXT. لا يظهر للطلاب إطلاقًا.",
    ),
    limits: bi(
      "Files upload directly to private storage, so large papers are supported. Image-only PDFs need OCR and are not supported in this version.",
      "تُرفع الملفات مباشرة إلى تخزين خاص، لذا تُدعم الأوراق الكبيرة. ملفات PDF المصورة تحتاج OCR وغير مدعومة في هذه النسخة.",
    ),
    privacy: bi(
      "Files go to a private temporary folder, are deleted when you save or cancel, and expire automatically after 24 hours.",
      "تُحفظ الملفات في مجلد خاص مؤقت، وتُحذف عند الحفظ أو الإلغاء، وتنتهي صلاحيتها تلقائيًا بعد 24 ساعة.",
    ),
    reviewRequired: bi(
      "Nothing is published automatically. You review every section, question and answer key first.",
      "لا يُنشر أي شيء تلقائيًا. تراجع كل قسم وسؤال ومفتاح إجابة أولًا.",
    ),
    submit: bi("Extract and review", "استخراج ومراجعة"),
    submitting: bi("Extracting", "جارٍ الاستخراج"),
    preparing: bi("Preparing a secure upload", "جارٍ تجهيز رفع آمن"),
    uploading: bi("Uploading files", "جارٍ رفع الملفات"),
    processing: bi("Parsing on the server", "جارٍ التحليل على الخادم"),
    progressLabel: bi("Upload progress", "تقدم الرفع"),
    maxFile: bi("Maximum per file", "الحد الأقصى لكل ملف"),
    totalMax: bi("Maximum total", "الحد الأقصى الإجمالي"),
    selectedSize: bi("Selected size", "الحجم المحدد"),
    uploadFailed: bi(
      "The upload did not finish. Nothing was saved; try again.",
      "لم يكتمل الرفع. لم يُحفظ أي شيء؛ حاول مرة أخرى.",
    ),
    localOnly: bi("Local processing", "معالجة محلية"),
    recentTitle: bi("Drafts awaiting review", "مسودات بانتظار المراجعة"),
    recentHint: bi(
      "Drafts expire after 24 hours. Open one to finish reviewing it.",
      "تنتهي صلاحية المسودات بعد 24 ساعة. افتح مسودة لإكمال مراجعتها.",
    ),
    recentEmpty: bi(
      "No import drafts are waiting for review.",
      "لا توجد مسودات استيراد بانتظار المراجعة.",
    ),
    openDraft: bi("Open draft", "فتح المسودة"),
    expires: bi("Expires", "تنتهي"),
  },
  review: {
    title: bi("Review imported assessment", "مراجعة الاختبار المستورد"),
    subtitle: bi(
      "Check the extracted text, fix warnings, then save a private unpublished draft. Publishing is a separate, explicit step.",
      "تحقق من النص المستخرج، وعالج التحذيرات، ثم احفظ مسودة خاصة غير منشورة. النشر خطوة منفصلة وصريحة.",
    ),
    stats: bi("Import summary", "ملخص الاستيراد"),
    sectionsCount: bi("sections", "أقسام"),
    questionsCount: bi("questions", "أسئلة"),
    marksCount: bi("marks", "درجات"),
    warningsCount: bi("warnings", "تحذيرات"),
    matchedAnswers: bi("matched answers", "إجابات مطابقة"),
    unmatchedAnswers: bi("answer entries needing attention", "مدخلات إجابة تحتاج مراجعة"),
    settings: bi("Assessment details", "تفاصيل الاختبار"),
    settingsHint: bi(
      "Choose the real grade and rules. Arabic fields stay empty unless you write them.",
      "اختر الصف والقواعد الفعلية. تبقى الحقول العربية فارغة ما لم تكتبها.",
    ),
    titleEn: bi("Title (English)", "العنوان (بالإنجليزية)"),
    titleAr: bi("Title (Arabic)", "العنوان (بالعربية)"),
    instructionsEn: bi("Instructions (English)", "التعليمات (بالإنجليزية)"),
    instructionsAr: bi("Instructions (Arabic)", "التعليمات (بالعربية)"),
    grade: bi("Grade", "الصف"),
    type: bi("Assessment type", "نوع الاختبار"),
    timeLimit: bi("Time limit (minutes)", "المدة (بالدقائق)"),
    visibility: bi("Result visibility", "إظهار النتائج"),
    retakes: bi("Allow retakes", "السماح بالإعادة"),
    yes: bi("Yes", "نعم"),
    no: bi("No", "لا"),
    maxAttempts: bi("Maximum attempts", "الحد الأقصى للمحاولات"),
    availableFrom: bi("Opens at", "يفتح في"),
    availableUntil: bi("Closes at", "يغلق في"),
    availabilityHint: bi(
      "Optional. Leave both empty for no availability window.",
      "اختياري. اتركهما فارغين لعدم تحديد فترة إتاحة.",
    ),
    gradingPreview: bi("Grading mode after save", "طريقة التصحيح بعد الحفظ"),
    gradingPreviewHint: bi(
      "Calculated from the questions: all automatic, all manual, or mixed.",
      "تُحسب من الأسئلة: آلية بالكامل أو يدوية بالكامل أو مختلطة.",
    ),
    warnings: bi("Warnings", "التحذيرات"),
    noWarnings: bi(
      "No warnings. Still review every question before saving.",
      "لا توجد تحذيرات. راجع كل سؤال قبل الحفظ على أي حال.",
    ),
    source: bi("Original extracted text", "النص الأصلي المستخرج"),
    answerSource: bi("Original answer-key text", "نص مفتاح الإجابة الأصلي"),
    showSource: bi("Show extracted text", "إظهار النص المستخرج"),
    hideSource: bi("Hide extracted text", "إخفاء النص المستخرج"),
    sourcePrivate: bi(
      "Visible to staff only. Students never receive this text.",
      "مرئي للموظفين فقط. لا يصل هذا النص إلى الطلاب.",
    ),
    sections: bi("Sections", "الأقسام"),
    addSection: bi("Add section", "إضافة قسم"),
    sectionTitle: bi("Section title (English)", "عنوان القسم (بالإنجليزية)"),
    sectionInstructions: bi("Section instructions", "تعليمات القسم"),
    noSections: bi(
      "No sections were detected. Add one before saving.",
      "لم يُكتشف أي قسم. أضف قسمًا قبل الحفظ.",
    ),
    questions: bi("Questions", "الأسئلة"),
    addQuestion: bi("Add question", "إضافة سؤال"),
    noQuestions: bi(
      "No questions in this section yet.",
      "لا توجد أسئلة في هذا القسم بعد.",
    ),
    questionNumber: bi("Source number", "رقم المصدر"),
    questionType: bi("Type", "النوع"),
    promptEn: bi("Question (English)", "نص السؤال (بالإنجليزية)"),
    promptAr: bi("Question (Arabic)", "نص السؤال (بالعربية)"),
    marks: bi("Marks", "الدرجة"),
    gradingMethod: bi("Grading method", "طريقة التصحيح"),
    automatic: bi("Automatic", "آلي"),
    manual: bi("Manual", "يدوي"),
    options: bi("Answer choices", "خيارات الإجابة"),
    addOption: bi("Add choice", "إضافة خيار"),
    correct: bi("Correct", "صحيحة"),
    pairs: bi("Matching pairs", "أزواج المطابقة"),
    left: bi("Left item", "العنصر الأول"),
    right: bi("Right item", "العنصر المقابل"),
    addPair: bi("Add pair", "إضافة زوج"),
    accepted: bi("Accepted answers", "الإجابات المقبولة"),
    acceptedHint: bi(
      "One answer per line. These are used for automatic grading.",
      "إجابة واحدة في كل سطر. تُستخدم للتصحيح الآلي.",
    ),
    correctValue: bi("Correct answer", "الإجابة الصحيحة"),
    trueLabel: bi("True", "صحيح"),
    falseLabel: bi("False", "خطأ"),
    explanationEn: bi("Explanation (English)", "التفسير (بالإنجليزية)"),
    explanationAr: bi("Explanation (Arabic)", "التفسير (بالعربية)"),
    rawBlock: bi("Original block", "الكتلة الأصلية"),
    moveUp: bi("Move up", "تحريك لأعلى"),
    moveDown: bi("Move down", "تحريك لأسفل"),
    remove: bi("Remove", "إزالة"),
    delete: bi("Delete", "حذف"),
    confirmDeleteQuestion: bi(
      "Delete this question from the draft?",
      "حذف هذا السؤال من المسودة؟",
    ),
    confirmDeleteSection: bi(
      "Delete this section and its questions from the draft?",
      "حذف هذا القسم وأسئلته من المسودة؟",
    ),
    answerKey: bi("Parsed answer key", "مفتاح الإجابة المستخرج"),
    answerKeyHint: bi(
      "Entries are matched by question number only. Unmatched, duplicate or ambiguous entries are never applied silently.",
      "تُطابق المدخلات برقم السؤال فقط. لا تُطبَّق المدخلات غير المطابقة أو المكررة أو الملتبسة بصمت.",
    ),
    noAnswerKey: bi(
      "No answer-key file was uploaded. Missing keys keep questions on manual grading.",
      "لم يُرفع ملف مفتاح إجابة. تبقى الأسئلة بلا مفاتيح على التصحيح اليدوي.",
    ),
    matchedTo: bi("Matched to question", "مطابق للسؤال"),
    notApplied: bi("Not applied", "لم يُطبَّق"),
    publishNote: bi(
      "Saving creates an unpublished draft. You must open it and publish explicitly when it is ready.",
      "الحفظ ينشئ مسودة غير منشورة. يجب فتحها ونشرها صراحةً عندما تكون جاهزة.",
    ),
    save: bi("Save draft assessment", "حفظ مسودة الاختبار"),
    saving: bi("Saving draft", "جارٍ حفظ المسودة"),
    saveProgress: bi("Save review progress", "حفظ تقدم المراجعة"),
    savingProgress: bi("Saving progress", "جارٍ حفظ التقدم"),
    savedProgress: bi(
      "Review progress saved. You can come back within 24 hours.",
      "تم حفظ تقدم المراجعة. يمكنك العودة خلال 24 ساعة.",
    ),
    confirmCancel: bi(
      "Cancel this import? The temporary files and this draft are deleted.",
      "إلغاء هذا الاستيراد؟ تُحذف الملفات المؤقتة وهذه المسودة.",
    ),
    fieldErrors: bi(
      "Some fields need attention. Fix them and try again.",
      "تحتاج بعض الحقول إلى مراجعة. صحّحها وحاول مرة أخرى.",
    ),
    cancel: bi("Cancel import", "إلغاء الاستيراد"),
    cancelling: bi("Cancelling", "جارٍ الإلغاء"),
    parserConfidence: bi("Parser confidence", "ثقة المحلل"),
    reviewCount: bi("Need review", "تحتاج مراجعة"),
    reviewed: bi("Reviewed", "تمت مراجعته"),
    notReviewed: bi("Not reviewed", "لم تتم مراجعته"),
    filters: bi("Filter questions", "تصفية الأسئلة"),
    filterAll: bi("All", "الكل"),
    filterReview: bi("Needs review", "تحتاج مراجعة"),
    filterLow: bi("Low confidence", "ثقة منخفضة"),
    filterWarnings: bi("Has warnings", "لديها تحذيرات"),
    noMatchingQuestions: bi(
      "No questions match this filter.",
      "لا توجد أسئلة تطابق هذا التصفية.",
    ),
    evidence: bi("Detected from", "اكتُشف من"),
    aiTitle: bi("Optional AI check", "فحص اختياري بالذكاء الاصطناعي"),
    aiHint: bi(
      "Sends only question text and choices to an external AI provider. No student names or files are sent. Every change stays pending until you accept it.",
      "يرسل نص الأسئلة والخيارات فقط إلى مزود ذكاء اصطناعي خارجي. لا تُرسل أسماء طلاب أو ملفات. يبقى كل تغيير معلقًا حتى تقبله.",
    ),
    aiRun: bi("Ask AI to check the parse", "اطلب من الذكاء الاصطناعي فحص التحليل"),
    aiRunning: bi("Checking with AI", "جارٍ الفحص بالذكاء الاصطناعي"),
    aiDone: bi(
      "AI check finished. Review each suggestion before accepting it.",
      "انتهى فحص الذكاء الاصطناعي. راجع كل اقتراح قبل قبوله.",
    ),
    aiNoSuggestions: bi(
      "The AI check found nothing to change.",
      "لم يجد فحص الذكاء الاصطناعي ما يستدعي التغيير.",
    ),
    aiBefore: bi("Current parse", "التحليل الحالي"),
    aiAfter: bi("Suggested", "المقترح"),
    aiAccept: bi("Accept", "قبول"),
    aiReject: bi("Reject", "رفض"),
    aiAccepted: bi("Accepted", "مقبول"),
    aiRejected: bi("Rejected", "مرفوض"),
    aiUnsafe: bi(
      "This suggestion is incomplete and cannot be applied safely.",
      "هذا الاقتراح غير مكتمل ولا يمكن تطبيقه بأمان.",
    ),
    aiRemaining: bi("AI requests remaining", "طلبات الذكاء الاصطناعي المتبقية"),
    aiModel: bi("Model", "النموذج"),
  },
  answerStatus: {
    matched: bi("Matched", "مطابق"),
    unmatched: bi("Unmatched", "غير مطابق"),
    duplicate: bi("Duplicate number", "رقم مكرر"),
    ambiguous: bi("Ambiguous", "ملتبس"),
  },
  confidence: {
    high: bi("High confidence", "ثقة عالية"),
    medium: bi("Check type", "تحقق من النوع"),
    low: bi("Needs review", "يحتاج مراجعة"),
  },
  warnings: {
    alerts: bi("Review warnings", "تحذيرات المراجعة"),
  },
} as const;

export const importConfidenceCopy: Record<ImportConfidence, Bilingual> = {
  high: importsUi.confidence.high,
  medium: importsUi.confidence.medium,
  low: importsUi.confidence.low,
};

export const importWarningCopy: Record<ImportWarningCode, Bilingual> = {
  no_title_detected: bi(
    "No title was detected, so the file name was used. Edit the title.",
    "لم يُكتشف عنوان، لذلك استُخدم اسم الملف. عدّل العنوان.",
  ),
  no_questions_detected: bi(
    "No numbered questions were detected. Add sections and questions manually.",
    "لم تُكتشف أسئلة مرقمة. أضف الأقسام والأسئلة يدويًا.",
  ),
  empty_section: bi(
    "This section has no questions. Add one or delete the section.",
    "لا توجد أسئلة في هذا القسم. أضف سؤالًا أو احذف القسم.",
  ),
  duplicate_question_number: bi(
    "The same question number appears more than once. Answers are not assigned to duplicates.",
    "يتكرر رقم السؤال أكثر من مرة. لا تُسنَد الإجابات إلى الأرقام المكررة.",
  ),
  missing_answer: bi(
    "No reliable answer key was found. This question defaults to manual grading.",
    "لم يُعثر على مفتاح إجابة موثوق. يُضبط هذا السؤال على التصحيح اليدوي افتراضيًا.",
  ),
  unmatched_answer: bi(
    "This answer entry does not match any question number and was not applied.",
    "مدخل الإجابة هذا لا يطابق أي رقم سؤال ولم يُطبَّق.",
  ),
  duplicate_answer_number: bi(
    "The answer key repeats this number. No answer was applied until you choose one.",
    "يكرر مفتاح الإجابة هذا الرقم. لم تُطبَّق أي إجابة حتى تختار واحدة.",
  ),
  ambiguous_answer: bi(
    "More than one answer or question matches. Nothing was overwritten; choose the answer manually.",
    "تطابق أكثر من إجابة أو سؤال. لم يُستبدل أي شيء؛ اختر الإجابة يدويًا.",
  ),
  answer_mismatch: bi(
    "The answer text does not match any detected choice. Check the question or type the answer manually.",
    "نص الإجابة لا يطابق أي خيار مستخرج. تحقق من السؤال أو اكتب الإجابة يدويًا.",
  ),
  answer_text_mismatch: bi(
    "The answer key prints a letter and text that disagree. The letter was applied; check the choice.",
    "يعرض مفتاح الإجابة حرفًا ونصًا متعارضين. طُبّق الحرف؛ تحقق من الخيار.",
  ),
  unsupported_question_type: bi(
    "This question did not match a supported type. Confirm the type before saving.",
    "لم يطابق هذا السؤال نوعًا مدعومًا. أكّد النوع قبل الحفظ.",
  ),
  section_marks_distributed: bi(
    "The section total does not divide evenly across its questions. Check the marks.",
    "لا تتوزع درجات القسم بالتساوي على أسئلته. تحقق من الدرجات.",
  ),
  ai_partial: bi(
    "AI suggestions covered only part of the paper. Deterministic results remain for the rest.",
    "غطّت اقتراحات الذكاء الاصطناعي جزءًا من الورقة فقط. تبقى النتائج المحلية لبقية الأسئلة.",
  ),
  ai_invalid_response: bi(
    "The AI service returned an unusable response. Nothing was changed.",
    "أعادت خدمة الذكاء الاصطناعي استجابة غير صالحة. لم يتغير شيء.",
  ),
  ai_unavailable: bi(
    "AI assistance is unavailable. The deterministic parse is still complete.",
    "مساعدة الذكاء الاصطناعي غير متاحة. التحليل المحلي ما زال مكتملًا.",
  ),
  matching_answer_not_applied: bi(
    "This matching answer could not be mapped to every pair. Check the pairs manually.",
    "تعذّر ربط إجابة المطابقة بجميع الأزواج. تحقق من الأزواج يدويًا.",
  ),
  manual_type_answer_ignored: bi(
    "Essays and file uploads are graded manually, so this answer entry was not applied.",
    "تُصحح المقالات والملفات يدويًا، لذلك لم يُطبَّق مدخل الإجابة هذا.",
  ),
  low_confidence_type: bi(
    "The question type is uncertain. Confirm or change it.",
    "نوع السؤال غير مؤكد. أكّده أو غيّره.",
  ),
  multiple_choice_missing_options: bi(
    "This looks like a multiple-choice question but fewer than two choices were detected. Add the choices or change the type.",
    "يبدو هذا سؤال اختيار من متعدد لكن أُقل من خيارين. أضف الخيارات أو غيّر النوع.",
  ),
  matching_incomplete: bi(
    "Fewer than two complete matching pairs were detected. Complete the pairs or change the type.",
    "أُقل من زوجين مكتملين للمطابقة. أكمل الأزواج أو غيّر النوع.",
  ),
  marks_defaulted: bi(
    "No marks were found, so this question uses 1 mark. Edit it if needed.",
    "لم تُوجد درجة، لذلك يستخدم السؤال درجة واحدة. عدّلها عند الحاجة.",
  ),
  answer_key_in_question_file: bi(
    "An answer line was found inside the question file. It was applied but is shown here for checking.",
    "وُجد سطر إجابة داخل ملف الأسئلة. طُبّق لكنه معروض هنا للتحقق.",
  ),
  text_truncated: bi(
    "The extracted text was longer than the limit and was truncated. Review the end of the paper manually.",
    "النص المستخرج أطول من الحد وتم اقتطاعه. راجع نهاية الورقة يدويًا.",
  ),
  file_empty: bi(
    "The file contained no readable text.",
    "لم يحتوي الملف على نص قابل للقراءة.",
  ),
};

export const importErrorCopy: Record<ImportErrorCode, Bilingual> = {
  validation_failed: bi(
    "Please check the highlighted fields.",
    "يرجى التحقق من الحقول المحددة.",
  ),
  forbidden: bi(
    "Only teachers and administrators can import assessments.",
    "لا يمكن استيراد الاختبارات إلا للمعلمين والمديرين.",
  ),
  not_found: bi(
    "That import draft no longer exists.",
    "لم تعد مسودة الاستيراد هذه موجودة.",
  ),
  expired: bi(
    "This import draft expired. Upload the files again.",
    "انتهت صلاحية مسودة الاستيراد. ارفع الملفات مرة أخرى.",
  ),
  already_saved: bi(
    "This draft was already saved as an assessment.",
    "حُفظت هذه المسودة كاختبار بالفعل.",
  ),
  file_required: bi(
    "Choose the question file to upload.",
    "اختر ملف الأسئلة لرفعه.",
  ),
  file_type_invalid: bi(
    "Use a DOCX, text-based PDF or TXT file. Image-only PDFs are not supported.",
    "استخدم ملف DOCX أو PDF نصي أو TXT. لا تُدعم ملفات PDF المصورة.",
  ),
  file_too_large: bi(
    "This file is larger than the configured limit.",
    "حجم هذا الملف يتجاوز الحد المسموح به.",
  ),
  file_name_invalid: bi(
    "That file name is not allowed. Rename it without paths, symbols or an executable extension.",
    "اسم الملف غير مسموح. أعد تسميته دون مسارات أو رموز أو امتداد تنفيذي.",
  ),
  file_empty: bi(
    "The file is empty.",
    "الملف فارغ.",
  ),
  no_text_extracted: bi(
    "No readable text was found. Scanned PDFs need OCR and are not supported in this version.",
    "لم يُعثر على نص قابل للقراءة. ملفات PDF الممسوحة تحتاج OCR وغير مدعومة في هذه النسخة.",
  ),
  parse_failed: bi(
    "The file could not be parsed. Check that it opens normally, then try again.",
    "تعذّر تحليل الملف. تحقق من أنه يفتح بشكل طبيعي ثم حاول مرة أخرى.",
  ),
  grade_required: bi("Choose a grade.", "اختر صفًا."),
  grade_not_found: bi(
    "That grade no longer exists.",
    "لم يعد هذا الصف موجودًا.",
  ),
  type_invalid: bi("Choose quiz or exam.", "اختر اختبارًا قصيرًا أو نهائيًا."),
  upload_failed: bi(
    "The private upload failed. Try again.",
    "تعذّر الرفع الخاص. حاول مرة أخرى.",
  ),
  storage_failed: bi(
    "Private storage is unavailable right now. Try again in a moment.",
    "مساحة التخزين الخاصة غير متاحة الآن. حاول بعد قليل.",
  ),
  service_unavailable: bi(
    "Private storage is not configured on the server.",
    "مساحة التخزين الخاصة غير مهيأة على الخادم.",
  ),
  ai_disabled: bi(
    "AI assistance is turned off on this server. The local parser is still available.",
    "مساعدة الذكاء الاصطناعي معطلة على هذا الخادم. المحلل المحلي ما زال متاحًا.",
  ),
  ai_limit_reached: bi(
    "This import reached its AI request limit. Review the existing suggestions or save the draft.",
    "وصل هذا الاستيراد إلى حد طلبات الذكاء الاصطناعي. راجع الاقتراحات الحالية أو احفظ المسودة.",
  ),
  save_failed: bi(
    "The draft assessment could not be saved. No partial assessment was kept.",
    "تعذّر حفظ مسودة الاختبار. لم يُحتفظ بأي اختبار جزئي.",
  ),
  unknown: bi(
    "Something went wrong. Please try again.",
    "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
  ),
};

/** Human-readable MiB label, e.g. 50 MB. */
export function formatImportBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
  return `${rounded} MB`;
}

/** Bilingual, size-aware message used by the upload form and server errors. */
export function importFileTooLargeCopy(maxBytes: number): Bilingual {
  const size = formatImportBytes(maxBytes);

  return bi(
    `Each file must be ${size} or smaller.`,
    `يجب أن يكون حجم كل ملف ${size} أو أقل.`,
  );
}

/** Total-request limit message for a two-file upload. */
export function importTotalTooLargeCopy(maxTotalBytes: number): Bilingual {
  const size = formatImportBytes(maxTotalBytes);

  return bi(
    `The files together must be ${size} or smaller.`,
    `يجب أن يكون مجموع الملفات ${size} أو أقل.`,
  );
}
