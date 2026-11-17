import type { Bilingual } from "@/lib/i18n/dictionary";
import type { ResourceAdminAction, ResourceType } from "@/lib/domain/types";
import type { ResourceErrorCode } from "@/lib/validation/resources";

const bi = (en: string, ar: string): Bilingual => ({ en, ar });

/**
 * Resource-management copy, kept separate from the student-administration
 * dictionary so both surfaces stay easy to review in each language.
 */
export const resourcesUi = {
  eyebrow: bi("Resource library", "مكتبة المصادر"),
  title: bi("Teaching resources", "المصادر التعليمية"),
  subtitle: bi(
    "Upload PDFs, images and YouTube videos, organise them by grade and category, and publish them to students.",
    "ارفع ملفات PDF والصور ومقاطع يوتيوب، ونظّمها حسب الصف والفئة، وانشرها للطلاب.",
  ),
  actions: {
    addResource: bi("Add resource", "إضافة مصدر"),
    manageCategories: bi("Categories", "الفئات"),
    edit: bi("Edit resource", "تعديل المصدر"),
    open: bi("Open resource", "فتح المصدر"),
    backToList: bi("Back to resources", "العودة إلى المصادر"),
    save: bi("Save changes", "حفظ التغييرات"),
    create: bi("Create resource", "إنشاء المصدر"),
    saving: bi("Saving", "جارٍ الحفظ"),
    working: bi("Working", "جارٍ التنفيذ"),
    publish: bi("Publish", "نشر"),
    unpublish: bi("Unpublish", "إلغاء النشر"),
    delete: bi("Delete", "حذف"),
    deleting: bi("Deleting", "جارٍ الحذف"),
    confirmDelete: bi("Delete this resource?", "حذف هذا المصدر؟"),
    deleteWarning: bi(
      "The file will be removed from private storage. This cannot be undone.",
      "سيُحذف الملف من مساحة التخزين الخاصة. لا يمكن التراجع عن هذا الإجراء.",
    ),
  },
  filters: {
    search: bi("Search", "بحث"),
    searchPlaceholder: bi(
      "Title or description",
      "العنوان أو الوصف",
    ),
    grade: bi("Grade", "الصف"),
    category: bi("Category", "الفئة"),
    type: bi("Type", "النوع"),
    status: bi("Status", "الحالة"),
    allGrades: bi("All grades", "كل الصفوف"),
    allCategories: bi("All categories", "كل الفئات"),
    allTypes: bi("All types", "كل الأنواع"),
    allStatuses: bi("All statuses", "كل الحالات"),
    publishedOnly: bi("Published", "منشور"),
    draftsOnly: bi("Drafts", "مسودات"),
    apply: bi("Apply filters", "تطبيق التصفية"),
    clear: bi("Clear filters", "مسح التصفية"),
  },
  list: {
    resource: bi("Resource", "المصدر"),
    placement: bi("Grade & category", "الصف والفئة"),
    status: bi("Status", "الحالة"),
    type: bi("Type", "النوع"),
    updated: bi("Updated", "آخر تحديث"),
    empty: bi("No resources yet", "لا توجد مصادر بعد"),
    emptyHint: bi(
      "Upload the first PDF, image or YouTube video for your students.",
      "ارفع أول ملف PDF أو صورة أو فيديو يوتيوب لطلابك.",
    ),
    emptyFiltered: bi(
      "No resources match these filters",
      "لا توجد مصادر تطابق هذه التصفية",
    ),
    emptyFilteredHint: bi(
      "Try a different search, or clear the filters.",
      "جرّب بحثًا آخر أو امسح التصفية.",
    ),
    studentEmpty: bi(
      "No published resources yet",
      "لا توجد مصادر منشورة بعد",
    ),
    studentEmptyHint: bi(
      "Your teacher will publish resources for your grade here.",
      "سينشر معلمك مصادر صفك هنا.",
    ),
    results: bi("resources found", "مصدرًا"),
    previous: bi("Previous", "السابق"),
    next: bi("Next", "التالي"),
    page: bi("Page", "صفحة"),
    of: bi("of", "من"),
    forGrade: bi("Published for", "منشور لـ"),
  },
  form: {
    createTitle: bi("New resource", "مصدر جديد"),
    createSubtitle: bi(
      "Choose a type, add bilingual details, then upload or link the content.",
      "اختر النوع، وأضف التفاصيل باللغتين، ثم ارفع المحتوى أو اربطه.",
    ),
    editTitle: bi("Edit resource", "تعديل المصدر"),
    editSubtitle: bi(
      "Titles, descriptions, category and grade can be changed at any time.",
      "يمكن تغيير العناوين والأوصاف والفئة والصف في أي وقت.",
    ),
    titleEn: bi("Title (English)", "العنوان (بالإنجليزية)"),
    titleAr: bi("Title (Arabic)", "العنوان (بالعربية)"),
    descriptionEn: bi("Description (English)", "الوصف (بالإنجليزية)"),
    descriptionAr: bi("Description (Arabic)", "الوصف (بالعربية)"),
    grade: bi("Grade", "الصف"),
    gradeHint: bi(
      "Only students in this grade can open a published resource.",
      "لا يمكن إلا لطلاب هذا الصف فتح المصدر المنشور.",
    ),
    category: bi("Category", "الفئة"),
    categoryHint: bi(
      "Optional. Categories are shared across grades.",
      "اختياري. تُشارك الفئات بين جميع الصفوف.",
    ),
    noCategory: bi("No category", "بدون فئة"),
    type: bi("Resource type", "نوع المصدر"),
    typeHint: bi(
      "The type cannot be changed after creation. Delete and create a new resource to change it.",
      "لا يمكن تغيير النوع بعد الإنشاء. احذف المصدر وأنشئ واحدًا جديدًا لتغييره.",
    ),
    youtubeUrl: bi("YouTube link", "رابط يوتيوب"),
    youtubeHint: bi(
      "Paste a youtube.com or youtu.be link, or an 11-character video ID.",
      "الصق رابط youtube.com أو youtu.be أو معرّف فيديو من 11 حرفًا.",
    ),
    file: bi("File", "الملف"),
    fileHint: bi(
      "PDF, JPEG, PNG or WebP up to 25 MB.",
      "PDF أو JPEG أو PNG أو WebP بحد أقصى 25 ميجابايت.",
    ),
    fileButton: bi("Choose a file", "اختر ملفًا"),
    noFileChosen: bi("No file chosen", "لم يُختر ملف"),
    fileReplaceHint: bi(
      "The file cannot be replaced after creation. Delete and create a new resource to change it.",
      "لا يمكن استبدال الملف بعد الإنشاء. احذف المصدر وأنشئ واحدًا جديدًا لتغييره.",
    ),
    existingFile: bi("Current file", "الملف الحالي"),
    sortOrder: bi("Order", "الترتيب"),
    publish: bi("Publish immediately", "نشر فورًا"),
    publishHint: bi(
      "Published resources are visible to students in the selected grade.",
      "تظهر المصادر المنشورة لطلاب الصف المحدد.",
    ),
    status: bi("Published", "منشور"),
    statusHint: bi(
      "Unpublished resources stay private to staff.",
      "تبقى المصادر غير المنشورة خاصة بالموظفين.",
    ),
    optional: bi("Optional", "اختياري"),
    required: bi("Required", "مطلوب"),
    preparing: bi("Preparing upload", "جارٍ تجهيز الرفع"),
    uploading: bi("Uploading file", "جارٍ رفع الملف"),
    savingResource: bi("Saving resource", "جارٍ حفظ المصدر"),
  },
  detail: {
    previewTitle: bi("Preview", "المعاينة"),
    detailsTitle: bi("Resource details", "تفاصيل المصدر"),
    descriptionTitle: bi("Description", "الوصف"),
    activityTitle: bi("Recent activity", "النشاط الأخير"),
    activityHint: bi(
      "Administration events only. Signed URLs and upload tokens are never recorded.",
      "أحداث الإدارة فقط. لا تُسجَّل روابط الوصول الموقعة أو رموز الرفع.",
    ),
    noActivity: bi(
      "No administration activity recorded yet.",
      "لم يُسجَّل أي نشاط إداري بعد.",
    ),
    createdAt: bi("Created", "تاريخ الإنشاء"),
    updatedAt: bi("Updated", "آخر تحديث"),
    grade: bi("Grade", "الصف"),
    category: bi("Category", "الفئة"),
    type: bi("Type", "النوع"),
    status: bi("Status", "الحالة"),
    noCategory: bi("Uncategorized", "بدون فئة"),
    published: bi("Published", "منشور"),
    draft: bi("Draft", "مسودة"),
    previewUnavailable: bi("Preview unavailable", "المعاينة غير متاحة"),
    previewUnavailableHint: bi(
      "The private file could not be opened. Reload the page or check that it still exists.",
      "تعذّر فتح الملف الخاص. حدّث الصفحة أو تحقق من وجوده.",
    ),
    noDownload: bi(
      "Resources are for viewing only. Downloading from this screen is disabled.",
      "المصادر للعرض فقط. التنزيل من هذه الشاشة معطّل.",
    ),
    reloadHint: bi(
      "If a preview link has expired, reload the page to refresh it.",
      "إذا انتهت صلاحية رابط المعاينة، حدّث الصفحة لتجديده.",
    ),
    fileResource: bi("Private file", "ملف خاص"),
    youtubeResource: bi("YouTube video", "فيديو يوتيوب"),
    createdSuccess: bi("Resource created.", "تم إنشاء المصدر."),
    updatedSuccess: bi("Resource updated.", "تم تحديث المصدر."),
    publishedSuccess: bi("Resource published.", "تم نشر المصدر."),
    unpublishedSuccess: bi(
      "Resource unpublished. Students can no longer open it.",
      "أُلغي نشر المصدر. لم يعد بإمكان الطلاب فتحه.",
    ),
    deletedSuccess: bi("Resource deleted.", "تم حذف المصدر."),
  },
  categories: {
    eyebrow: bi("Resource library", "مكتبة المصادر"),
    title: bi("Resource categories", "فئات المصادر"),
    subtitle: bi(
      "Categories group resources across all grades. Deleting a category keeps its resources and marks them uncategorized.",
      "تجمع الفئات المصادر عبر جميع الصفوف. حذف الفئة يُبقي مصادرها ويجعلها بدون فئة.",
    ),
    addCategory: bi("Add category", "إضافة فئة"),
    editCategory: bi("Edit category", "تعديل الفئة"),
    nameEn: bi("Name (English)", "الاسم (بالإنجليزية)"),
    nameAr: bi("Name (Arabic)", "الاسم (بالعربية)"),
    slug: bi("Slug", "المعرّف"),
    slugHint: bi(
      "Lowercase letters, numbers and dashes. Generated from the English name when left empty.",
      "أحرف صغيرة وأرقام وشرطات. يُولَّد من الاسم الإنجليزي إذا تُرك فارغًا.",
    ),
    descriptionEn: bi("Description (English)", "الوصف (بالإنجليزية)"),
    descriptionAr: bi("Description (Arabic)", "الوصف (بالعربية)"),
    sortOrder: bi("Order", "الترتيب"),
    active: bi("Active", "نشطة"),
    inactive: bi("Inactive", "غير نشطة"),
    activeHint: bi(
      "Inactive categories stay on existing resources but are hidden from student filters.",
      "تبقى الفئات غير النشطة على المصادر الحالية لكنها مخفية من تصفية الطلاب.",
    ),
    create: bi("Create category", "إنشاء الفئة"),
    save: bi("Save category", "حفظ الفئة"),
    cancel: bi("Cancel", "إلغاء"),
    edit: bi("Edit", "تعديل"),
    delete: bi("Delete", "حذف"),
    confirmDelete: bi("Delete this category?", "حذف هذه الفئة؟"),
    deleteWarning: bi(
      "Its resources will become uncategorized. This cannot be undone.",
      "ستصبح مصادرها بدون فئة. لا يمكن التراجع عن هذا الإجراء.",
    ),
    count: bi("resources", "مصادر"),
    empty: bi("No categories yet", "لا توجد فئات بعد"),
    emptyHint: bi(
      "Create the first category to group resources.",
      "أنشئ أول فئة لتجميع المصادر.",
    ),
    created: bi("Category created.", "تم إنشاء الفئة."),
    updated: bi("Category updated.", "تم تحديث الفئة."),
    deleted: bi("Category deleted.", "تم حذف الفئة."),
  },
  student: {
    title: bi("Resources", "المصادر"),
    subtitle: bi(
      "Published resources for your grade only. Files open privately in the browser.",
      "المصادر المنشورة لصفك فقط. تُفتح الملفات بشكل خاص داخل المتصفح.",
    ),
    gradeLocked: bi("Grade-locked content", "محتوى مقيّد بالصف"),
  },
  messages: {
    forbidden: bi(
      "You do not have permission to manage resources.",
      "ليس لديك إذن لإدارة المصادر.",
    ),
    storageUnavailable: bi(
      "Private storage is not configured on the server.",
      "مساحة التخزين الخاصة غير مهيأة على الخادم.",
    ),
    loadFailed: bi(
      "Resources could not be loaded. Refresh the page or check the database connection.",
      "تعذّر تحميل المصادر. حدّث الصفحة أو تحقق من اتصال قاعدة البيانات.",
    ),
    categoriesLoadFailed: bi(
      "Categories could not be loaded. Refresh the page or check the database connection.",
      "تعذّر تحميل الفئات. حدّث الصفحة أو تحقق من اتصال قاعدة البيانات.",
    ),
    noGrades: bi("No grades yet", "لا توجد صفوف بعد"),
    noGradesHint: bi(
      "Create a grade and class before adding resources.",
      "أنشئ صفًا وفصلًا قبل إضافة المصادر.",
    ),
  },
} as const;

export const resourceTypeCopy: Record<ResourceType, Bilingual> = {
  pdf: bi("PDF document", "مستند PDF"),
  image: bi("Image", "صورة"),
  youtube: bi("YouTube video", "فيديو يوتيوب"),
};

export const resourceStatusCopy: Record<"published" | "draft", Bilingual> = {
  published: bi("Published", "منشور"),
  draft: bi("Draft", "مسودة"),
};

export const resourceErrorCopy: Record<ResourceErrorCode, Bilingual> = {
  validation_failed: bi(
    "Please check the highlighted fields.",
    "يرجى التحقق من الحقول المحددة.",
  ),
  title_required: bi(
    "Enter a title in both languages.",
    "أدخل عنوانًا باللغتين.",
  ),
  title_too_long: bi(
    "Titles can be up to 160 characters.",
    "يمكن أن يتكون العنوان من 160 حرفًا كحد أقصى.",
  ),
  description_too_long: bi(
    "Descriptions can be up to 2,000 characters.",
    "يمكن أن يتكون الوصف من 2000 حرف كحد أقصى.",
  ),
  grade_required: bi("Choose a grade.", "اختر صفًا."),
  grade_not_found: bi(
    "That grade no longer exists.",
    "لم يعد هذا الصف موجودًا.",
  ),
  category_not_found: bi(
    "That category no longer exists.",
    "لم تعد هذه الفئة موجودة.",
  ),
  type_invalid: bi("Choose a resource type.", "اختر نوع المصدر."),
  youtube_url_required: bi("Enter a YouTube link.", "أدخل رابط يوتيوب."),
  youtube_url_invalid: bi(
    "Enter a valid YouTube video link.",
    "أدخل رابط فيديو يوتيوب صالحًا.",
  ),
  file_required: bi("Choose a file to upload.", "اختر ملفًا لرفعه."),
  file_name_invalid: bi(
    "The file path or name is not valid.",
    "مسار الملف أو اسمه غير صالح.",
  ),
  file_type_invalid: bi(
    "Use a PDF, JPEG, PNG or WebP file.",
    "استخدم ملف PDF أو JPEG أو PNG أو WebP.",
  ),
  file_too_large: bi(
    "The file is larger than 25 MB.",
    "حجم الملف أكبر من 25 ميجابايت.",
  ),
  file_empty: bi("The file is empty.", "الملف فارغ."),
  upload_failed: bi(
    "The file could not be uploaded. Try again.",
    "تعذّر رفع الملف. حاول مرة أخرى.",
  ),
  upload_missing: bi(
    "The uploaded file could not be verified. Try again.",
    "تعذّر التحقق من الملف المرفوع. حاول مرة أخرى.",
  ),
  upload_conflict: bi(
    "This file is already attached to another resource.",
    "هذا الملف مرتبط بمصدر آخر بالفعل.",
  ),
  storage_failed: bi(
    "Private storage is unavailable right now. Try again in a moment.",
    "مساحة التخزين الخاصة غير متاحة الآن. حاول بعد قليل.",
  ),
  service_unavailable: bi(
    "Private storage is not configured on the server.",
    "مساحة التخزين الخاصة غير مهيأة على الخادم.",
  ),
  not_found: bi(
    "That resource no longer exists.",
    "لم يعد هذا المصدر موجودًا.",
  ),
  type_immutable: bi(
    "A resource type cannot be changed. Create a new resource instead.",
    "لا يمكن تغيير نوع المصدر. أنشئ مصدرًا جديدًا بدلًا من ذلك.",
  ),
  slug_invalid: bi(
    "Use 2–60 lowercase letters, numbers or dashes.",
    "استخدم من 2 إلى 60 حرفًا صغيرًا أو رقمًا أو شرطة.",
  ),
  slug_taken: bi("This slug is already used.", "هذا المعرّف مستخدم بالفعل."),
  category_name_required: bi(
    "Enter a name in both languages.",
    "أدخل اسمًا باللغتين.",
  ),
  category_name_too_long: bi(
    "Category names can be up to 80 characters.",
    "يمكن أن يتكون اسم الفئة من 80 حرفًا كحد أقصى.",
  ),
  forbidden: bi(
    "You do not have permission for this action.",
    "ليس لديك إذن لهذا الإجراء.",
  ),
  unknown: bi(
    "Something went wrong. Please try again.",
    "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
  ),
};

export const resourceEventCopy: Record<ResourceAdminAction, Bilingual> = {
  created: bi("Resource created", "أُنشئ المصدر"),
  updated: bi("Resource updated", "حُدّث المصدر"),
  published: bi("Resource published", "نُشر المصدر"),
  unpublished: bi("Resource unpublished", "أُلغي نشر المصدر"),
  deleted: bi("Resource deleted", "حُذف المصدر"),
  category_created: bi("Category created", "أُنشئت الفئة"),
  category_updated: bi("Category updated", "حُدّثت الفئة"),
  category_deleted: bi("Category deleted", "حُذفت الفئة"),
};
