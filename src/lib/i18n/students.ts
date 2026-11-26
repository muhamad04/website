import type { Bilingual } from "@/lib/i18n/dictionary";
import type {
  PasswordErrorCode,
  StudentErrorCode,
} from "@/lib/validation/students";
import type { StudentAdminAction } from "@/lib/domain/types";

const bi = (en: string, ar: string): Bilingual => ({ en, ar });

/**
 * Student administration copy. Kept separate from the shared dictionary so the
 * Phase 2 surface stays easy to review in both languages.
 */
export const studentsUi = {
  eyebrow: bi("Student administration", "إدارة الطلاب"),
  title: bi("Students", "الطلاب"),
  subtitle: bi(
    "Create accounts, assign grades and classes, and control access. Students never register themselves.",
    "أنشئ الحسابات، ووزّع الصفوف والفصول، وتحكّم في الوصول. لا يسجّل الطلاب أنفسهم أبدًا.",
  ),
  actions: {
    addStudent: bi("Add student", "إضافة طالب"),
    manageClasses: bi("Grades & classes", "الصفوف والفصول"),
    edit: bi("Edit", "تعديل"),
    open: bi("Open profile", "فتح الملف"),
    backToList: bi("Back to students", "العودة إلى الطلاب"),
    resetAccess: bi("Reset password", "إعادة تعيين كلمة المرور"),
    resendInvite: bi("New setup link", "رابط إعداد جديد"),
    deactivate: bi("Deactivate", "إيقاف الحساب"),
    activate: bi("Activate", "تفعيل الحساب"),
    copy: bi("Copy", "نسخ"),
    copied: bi("Copied", "تم النسخ"),
    save: bi("Save changes", "حفظ التغييرات"),
    create: bi("Create student", "إنشاء حساب الطالب"),
    saving: bi("Saving", "جارٍ الحفظ"),
    working: bi("Working", "جارٍ التنفيذ"),
  },
  filters: {
    search: bi("Search", "بحث"),
    searchPlaceholder: bi(
      "Name, email or student ID",
      "الاسم أو البريد الإلكتروني أو رقم الطالب",
    ),
    grade: bi("Grade", "الصف"),
    class: bi("Class", "الفصل"),
    status: bi("Status", "الحالة"),
    allGrades: bi("All grades", "كل الصفوف"),
    allClasses: bi("All classes", "كل الفصول"),
    allStatuses: bi("All statuses", "كل الحالات"),
    activeOnly: bi("Active", "نشط"),
    inactiveOnly: bi("Inactive", "غير نشط"),
    apply: bi("Apply filters", "تطبيق التصفية"),
    clear: bi("Clear filters", "مسح التصفية"),
  },
  list: {
    student: bi("Student", "الطالب"),
    contact: bi("Contact", "التواصل"),
    placement: bi("Grade & class", "الصف والفصل"),
    access: bi("Access", "الوصول"),
    lastInvite: bi("Last invite", "آخر دعوة"),
    neverInvited: bi("Not invited yet", "لم يُدعَ بعد"),
    results: bi("students found", "طالبًا"),
    empty: bi("No students yet", "لا يوجد طلاب بعد"),
    emptyHint: bi(
      "Create the first student account to get started.",
      "أنشئ أول حساب طالب للبدء.",
    ),
    emptyFiltered: bi(
      "No students match these filters",
      "لا يوجد طلاب يطابقون هذه التصفية",
    ),
    emptyFilteredHint: bi(
      "Try a different search, or clear the filters.",
      "جرّب بحثًا آخر أو امسح التصفية.",
    ),
    previous: bi("Previous", "السابق"),
    next: bi("Next", "التالي"),
    page: bi("Page", "صفحة"),
    of: bi("of", "من"),
  },
  form: {
    createTitle: bi("New student", "طالب جديد"),
    createSubtitle: bi(
      "Every student needs an English name, Arabic name, Student ID, grade and class. The optional email is for contact only; students sign in with their Student ID.",
      "يحتاج كل طالب إلى اسم بالإنجليزية واسم بالعربية ورقم طالب وصف وفصل. البريد الإلكتروني اختياري للتواصل فقط؛ يسجّل الطلاب الدخول برقم الطالب.",
    ),
    editTitle: bi("Edit student", "تعديل بيانات الطالب"),
    editSubtitle: bi(
      "Names, optional contact email, Student ID and placement can be changed here. Changing the Student ID moves the private sign-in identity safely on the server.",
      "يمكن تغيير الأسماء والبريد الاختياري ورقم الطالب والصف والفصل هنا. تغيير رقم الطالب ينقل هوية الدخول الخاصة بأمان على الخادم.",
    ),
    nameEn: bi("Full name (English)", "الاسم الكامل (بالإنجليزية)"),
    nameAr: bi("Full name (Arabic)", "الاسم الكامل (بالعربية)"),
    email: bi("Email (optional)", "البريد الإلكتروني (اختياري)"),
    emailHint: bi(
      "For contact and reporting only. Students never need it to sign in.",
      "للاتصال والتقارير فقط. لا يحتاجه الطالب لتسجيل الدخول.",
    ),
    username: bi("Username", "اسم المستخدم"),
    usernameHint: bi(
      "Optional. 3–40 letters, numbers, dots, dashes or underscores, and unique.",
      "اختياري. من 3 إلى 40 حرفًا أو رقمًا أو نقطة أو شرطة، ويجب أن يكون فريدًا.",
    ),
    studentNumber: bi("Student ID", "رقم الطالب"),
    studentNumberHint: bi(
      "Required and globally unique. 2–40 letters, numbers, dots, dashes or underscores. Students use it with their password to sign in.",
      "مطلوب وفريد على مستوى المدرسة. من 2 إلى 40 حرفًا أو رقمًا أو نقطة أو شرطة. يستخدمه الطالب مع كلمة المرور لتسجيل الدخول.",
    ),
    grade: bi("Grade", "الصف"),
    class: bi("Class", "الفصل"),
    noGrade: bi("Select a grade", "اختر الصف"),
    noClass: bi("Select a class", "اختر الفصل"),
    classHint: bi(
      "Required. Only classes in the selected grade can be chosen.",
      "مطلوب. لا يمكن اختيار إلا فصول الصف المحدد.",
    ),
    passwordTitle: bi("Initial password", "كلمة المرور الأولية"),
    passwordSubtitle: bi(
      "Choose how the student gets access. Passwords are never displayed or stored in plain text.",
      "اختر كيف يحصل الطالب على الوصول. لا تُعرض كلمات المرور ولا تُخزَّن كنص صريح.",
    ),
    passwordModeLink: bi("Generate a setup link", "إنشاء رابط إعداد"),
    passwordModeLinkHint: bi(
      "Recommended. A random password is created and the student sets their own through a one-time link.",
      "موصى به. تُنشأ كلمة مرور عشوائية ويضبط الطالب كلمته عبر رابط لمرة واحدة.",
    ),
    passwordModeSet: bi("Set an initial password", "تعيين كلمة مرور أولية"),
    passwordModeSetHint: bi(
      "The student can sign in immediately. You will not see the password again.",
      "يمكن للطالب تسجيل الدخول فورًا. لن ترى كلمة المرور مرة أخرى.",
    ),
    initialPassword: bi("Initial password", "كلمة المرور الأولية"),
    initialPasswordHint: bi(
      "At least 10 characters. Never displayed after the account is created.",
      "10 أحرف على الأقل. لا تُعرض أبدًا بعد إنشاء الحساب.",
    ),
    optional: bi("Optional", "اختياري"),
    required: bi("Required", "مطلوب"),
  },
  detail: {
    profileTitle: bi("Student profile", "ملف الطالب"),
    accessTitle: bi("Account access", "الوصول إلى الحساب"),
    activityTitle: bi("Recent activity", "النشاط الأخير"),
    activityHint: bi(
      "Administration events only. Passwords and links are never recorded.",
      "أحداث الإدارة فقط. لا تُسجَّل كلمات المرور أو الروابط.",
    ),
    noActivity: bi(
      "No administration activity recorded yet.",
      "لم يُسجَّل أي نشاط إداري بعد.",
    ),
    createdOn: bi("Created", "تاريخ الإنشاء"),
    lastInvite: bi("Last invite", "آخر دعوة"),
    lastReset: bi("Last reset", "آخر إعادة تعيين"),
    never: bi("Never", "أبدًا"),
  },
  access: {
    ready: bi("Password setup link ready", "رابط إعداد كلمة المرور جاهز"),
    once: bi(
      "This one-time link is shown once and expires. Share it privately with the student.",
      "يُعرض هذا الرابط لمرة واحدة وتنتهي صلاحيته. شاركه مع الطالب بشكل خاص.",
    ),
    missing: bi(
      "The link could not be generated. Try again.",
      "تعذّر إنشاء الرابط. حاول مرة أخرى.",
    ),
  },
  classes: {
    eyebrow: bi("Structure", "الهيكل"),
    title: bi("Grades & classes", "الصفوف والفصول"),
    subtitle: bi(
      "Create the grade levels and class groups that students are assigned to.",
      "أنشئ الصفوف الدراسية والفصول التي يُوزَّع إليها الطلاب.",
    ),
    addGrade: bi("Add grade", "إضافة صف"),
    addClass: bi("Add class", "إضافة فصل"),
    gradeNameEn: bi("Grade name (English)", "اسم الصف (بالإنجليزية)"),
    gradeNameAr: bi("Grade name (Arabic)", "اسم الصف (بالعربية)"),
    classNameEn: bi("Class name (English)", "اسم الفصل (بالإنجليزية)"),
    classNameAr: bi("Class name (Arabic)", "اسم الفصل (بالعربية)"),
    slug: bi("Slug", "المعرّف"),
    slugHint: bi(
      "Lowercase letters, numbers and dashes. Generated from the English name when left empty.",
      "أحرف صغيرة وأرقام وشرطات. يُولَّد من الاسم الإنجليزي إذا تُرك فارغًا.",
    ),
    sortOrder: bi("Order", "الترتيب"),
    academicYear: bi("Academic year", "العام الدراسي"),
    grade: bi("Grade", "الصف"),
    noGrades: bi("No grades yet", "لا توجد صفوف بعد"),
    noGradesHint: bi(
      "Create a grade before adding classes or students.",
      "أنشئ صفًا قبل إضافة الفصول أو الطلاب.",
    ),
    noClasses: bi("No classes yet", "لا توجد فصول بعد"),
    noClassesHint: bi(
      "Classes keep students grouped inside a grade.",
      "تُبقي الفصول الطلاب مجمّعين داخل الصف.",
    ),
    classesCount: bi("classes", "فصلًا"),
    studentsCount: bi("students", "طالبًا"),
    inactive: bi("Inactive", "غير نشط"),
  },
  password: {
    title: bi("Set your password", "عيّن كلمة المرور"),
    subtitle: bi(
      "Choose a password for your account. You will use it to sign in from now on.",
      "اختر كلمة مرور لحسابك. ستستخدمها لتسجيل الدخول من الآن.",
    ),
    newPassword: bi("New password", "كلمة المرور الجديدة"),
    confirmPassword: bi("Confirm password", "تأكيد كلمة المرور"),
    hint: bi("At least 10 characters.", "10 أحرف على الأقل."),
    submit: bi("Save password", "حفظ كلمة المرور"),
    saving: bi("Saving password", "جارٍ حفظ كلمة المرور"),
    success: bi("Your password is saved.", "تم حفظ كلمة المرور."),
    continue: bi("Continue to dashboard", "المتابعة إلى لوحة التحكم"),
    expired: bi(
      "This link has expired or was already used. Ask your teacher for a new access link.",
      "انتهت صلاحية هذا الرابط أو استُخدم سابقًا. اطلب من معلمك رابط وصول جديدًا.",
    ),
  },
  messages: {
    created: bi("Student account created.", "تم إنشاء حساب الطالب."),
    updated: bi("Student details updated.", "تم تحديث بيانات الطالب."),
    activated: bi(
      "Account activated. The student can sign in again.",
      "تم تفعيل الحساب. يمكن للطالب تسجيل الدخول مرة أخرى.",
    ),
    deactivated: bi(
      "Account deactivated. The student is blocked from protected pages.",
      "تم إيقاف الحساب. يُمنع الطالب من الصفحات المحمية.",
    ),
    reset: bi(
      "A new one-time password setup link is ready.",
      "رابط إعداد كلمة مرور جديد لمرة واحدة جاهز.",
    ),
    inviteResent: bi("A new setup link is ready.", "رابط إعداد جديد جاهز."),
    forbidden: bi(
      "You do not have permission to manage students.",
      "ليس لديك إذن لإدارة الطلاب.",
    ),
    notStudent: bi(
      "That account is not a student. Staff accounts are managed separately.",
      "هذا الحساب ليس حساب طالب. تُدار حسابات الموظفين بشكل منفصل.",
    ),
  },
} as const;

export const studentErrorCopy: Record<StudentErrorCode, Bilingual> = {
  validation_failed: bi(
    "Please check the highlighted fields.",
    "يرجى التحقق من الحقول المحددة.",
  ),
  student_id_required: bi(
    "Enter the Student ID.",
    "أدخل رقم الطالب.",
  ),
  student_id_invalid: bi(
    "Use 2–40 letters, numbers, dots, dashes or underscores. It must start and end with a letter or number.",
    "استخدم من 2 إلى 40 حرفًا أو رقمًا أو نقطة أو شرطة، ويجب أن يبدأ وينتهي بحرف أو رقم.",
  ),
  student_id_taken: bi(
    "This Student ID is already used by another student.",
    "رقم الطالب هذا مستخدم بالفعل لطالب آخر.",
  ),
  grade_required: bi("Select a grade.", "اختر الصف."),
  class_required: bi("Select a class.", "اختر الفصل."),
  email_required: bi(
    "Enter the student's email address.",
    "أدخل البريد الإلكتروني للطالب.",
  ),
  email_invalid: bi("Enter a valid email address.", "أدخل بريدًا إلكترونيًا صالحًا."),
  name_required: bi("Enter a name.", "أدخل الاسم."),
  name_too_long: bi("This value is too long.", "هذه القيمة طويلة جدًا."),
  username_invalid: bi(
    "Usernames use 3–40 letters, numbers, dots, dashes or underscores.",
    "يجب أن يتكون اسم المستخدم من 3 إلى 40 حرفًا أو رقمًا أو نقطة أو شرطة.",
  ),
  username_taken: bi(
    "This username is already taken.",
    "اسم المستخدم هذا مستخدم بالفعل.",
  ),
  name_taken: bi(
    "A record with this name already exists.",
    "يوجد سجل بهذا الاسم بالفعل.",
  ),
  slug_taken: bi("This slug is already used.", "هذا المعرّف مستخدم بالفعل."),
  grade_class_mismatch: bi(
    "The selected class does not belong to that grade.",
    "الفصل المحدد لا يتبع هذا الصف.",
  ),
  not_found: bi("That record no longer exists.", "لم يعد هذا السجل موجودًا."),
  not_a_student: bi("That account is not a student.", "هذا الحساب ليس حساب طالب."),
  forbidden: bi(
    "You do not have permission for this action.",
    "ليس لديك إذن لهذا الإجراء.",
  ),
  service_unavailable: bi(
    "Account provisioning is not configured on the server.",
    "إعداد الحسابات غير مهيأ على الخادم.",
  ),
  rate_limited: bi(
    "Too many attempts. Wait a moment and try again.",
    "محاولات كثيرة جدًا. انتظر قليلًا ثم حاول مرة أخرى.",
  ),
  reset_failed: bi(
    "A new password setup link could not be created.",
    "تعذّر إنشاء رابط إعداد كلمة المرور الجديد.",
  ),
  unknown: bi(
    "Something went wrong. Please try again.",
    "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
  ),
};

export const passwordErrorCopy: Record<PasswordErrorCode, Bilingual> = {
  password_required: bi("Enter a password.", "أدخل كلمة المرور."),
  password_short: bi(
    "Use at least 10 characters.",
    "استخدم 10 أحرف على الأقل.",
  ),
  password_too_long: bi(
    "Use 200 characters or fewer.",
    "استخدم 200 حرف أو أقل.",
  ),
  password_weak: bi(
    "Choose a less predictable password.",
    "اختر كلمة مرور أقل توقعًا.",
  ),
  password_mismatch: bi(
    "The two passwords do not match.",
    "كلمتا المرور غير متطابقتين.",
  ),
  session_expired: bi(
    "This access link has expired. Ask your teacher for a new one.",
    "انتهت صلاحية رابط الوصول. اطلب رابطًا جديدًا من معلمك.",
  ),
  rate_limited: bi(
    "Too many attempts. Wait a moment and try again.",
    "محاولات كثيرة جدًا. انتظر قليلًا ثم حاول مرة أخرى.",
  ),
  unknown: bi(
    "The password could not be saved. Please try again.",
    "تعذّر حفظ كلمة المرور. يرجى المحاولة مرة أخرى.",
  ),
};

export const studentEventCopy: Record<StudentAdminAction, Bilingual> = {
  created: bi("Account created", "أُنشئ الحساب"),
  invited: bi("Password setup link issued", "أُصدر رابط إعداد كلمة المرور"),
  invite_resent: bi("Setup link re-issued", "أُعيد إصدار رابط الإعداد"),
  access_reset: bi("Access link reset", "أُعيد تعيين رابط الوصول"),
  password_reset: bi(
    "Password reset link issued",
    "أُصدر رابط إعادة تعيين كلمة المرور",
  ),
  student_id_changed: bi("Student ID changed", "تغيّر رقم الطالب"),
  updated: bi("Details updated", "حُدّثت البيانات"),
  activated: bi("Account activated", "فُعّل الحساب"),
  deactivated: bi("Account deactivated", "أُوقف الحساب"),
};
