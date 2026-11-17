import type { Bilingual } from "@/lib/i18n/dictionary";
import type { StaffAdminAction } from "@/lib/domain/types";
import type { StaffErrorCode } from "@/lib/validation/staff";

const bi = (en: string, ar: string): Bilingual => ({ en, ar });

/**
 * Admin-only staff management copy. Kept in its own module so every string on
 * the staff surface is reviewed in both languages.
 */
export const staffUi = {
  eyebrow: bi("Staff administration", "إدارة الموظفين"),
  title: bi("Staff", "الموظفون"),
  subtitle: bi(
    "Create teacher and admin accounts, change roles, control access and review the audit trail. Staff sign in with email and password.",
    "أنشئ حسابات المعلمين والمديرين، وغيّر الأدوار، وتحكّم في الوصول، وراجع سجل التدقيق. يسجّل الموظفون الدخول بالبريد الإلكتروني وكلمة المرور.",
  ),
  publicNote: bi(
    "Public registration stays closed. Only an active administrator can create or change staff accounts.",
    "يبقى التسجيل العام مغلقًا. لا يمكن إلا لمدير نشط إنشاء حسابات الموظفين أو تعديلها.",
  ),
  roles: {
    teacher: bi("Teacher", "معلم"),
    admin: bi("Administrator", "مدير"),
  },
  actions: {
    addStaff: bi("Add staff", "إضافة موظف"),
    openProfile: bi("Open profile", "فتح الملف"),
    backToList: bi("Back to staff", "العودة إلى الموظفين"),
    save: bi("Save changes", "حفظ التغييرات"),
    create: bi("Create staff account", "إنشاء حساب الموظف"),
    saving: bi("Saving", "جارٍ الحفظ"),
    changing: bi("Working", "جارٍ التنفيذ"),
    resetAccess: bi("Reset access", "إعادة تعيين الوصول"),
    activate: bi("Activate", "تفعيل"),
    deactivate: bi("Deactivate", "إيقاف"),
    changeRole: bi("Change role", "تغيير الدور"),
    copy: bi("Copy", "نسخ"),
    copied: bi("Copied", "تم النسخ"),
  },
  filters: {
    search: bi("Search", "بحث"),
    searchPlaceholder: bi(
      "Name or email",
      "الاسم أو البريد الإلكتروني",
    ),
    role: bi("Role", "الدور"),
    status: bi("Status", "الحالة"),
    allRoles: bi("All roles", "كل الأدوار"),
    allStatuses: bi("All statuses", "كل الحالات"),
    activeOnly: bi("Active", "نشط"),
    inactiveOnly: bi("Inactive", "غير نشط"),
    apply: bi("Apply filters", "تطبيق التصفية"),
    clear: bi("Clear filters", "مسح التصفية"),
  },
  list: {
    staff: bi("Staff member", "الموظف"),
    contact: bi("Email", "البريد الإلكتروني"),
    role: bi("Role", "الدور"),
    status: bi("Status", "الحالة"),
    access: bi("Access", "الوصول"),
    lastReset: bi("Last access reset", "آخر إعادة تعيين للوصول"),
    neverReset: bi("Never reset", "لم تُعَد التعيين بعد"),
    empty: bi("No staff accounts yet", "لا توجد حسابات موظفين بعد"),
    emptyHint: bi(
      "Create the first teacher or admin account to get started.",
      "أنشئ أول حساب معلم أو مدير للبدء.",
    ),
    emptyFiltered: bi(
      "No staff members match these filters",
      "لا يوجد موظفون يطابقون هذه التصفية",
    ),
    emptyFilteredHint: bi(
      "Try a different search, role or status.",
      "جرّب بحثًا أو دورًا أو حالة أخرى.",
    ),
    previous: bi("Previous", "السابق"),
    next: bi("Next", "التالي"),
    page: bi("Page", "صفحة"),
    of: bi("of", "من"),
  },
  form: {
    createTitle: bi("New staff account", "حساب موظف جديد"),
    createSubtitle: bi(
      "The account uses email and password. A single-use setup link is generated after creation; no password is shown or stored in plain text.",
      "يستخدم الحساب البريد الإلكتروني وكلمة المرور. يُنشأ رابط إعداد لمرة واحدة بعد الإنشاء؛ لا تُعرض أي كلمة مرور ولا تُخزَّن كنص صريح.",
    ),
    editTitle: bi("Staff details", "بيانات الموظف"),
    editSubtitle: bi(
      "Update the English and Arabic names or the sign-in email. Roles and access are changed separately so each action is audited.",
      "حدّث الاسم بالإنجليزية والعربية أو بريد تسجيل الدخول. تُغيَّر الأدوار والوصول بشكل منفصل ليُسجَّل كل إجراء في التدقيق.",
    ),
    nameEn: bi("Full name (English)", "الاسم الكامل (بالإنجليزية)"),
    nameAr: bi("Full name (Arabic)", "الاسم الكامل (بالعربية)"),
    email: bi("Email address", "البريد الإلكتروني"),
    emailHint: bi(
      "Used to sign in and to deliver the one-time setup link.",
      "يُستخدم لتسجيل الدخول ولإرسال رابط الإعداد لمرة واحدة.",
    ),
    role: bi("Role", "الدور"),
    roleHint: bi(
      "Teachers manage students, content, assessments and results. Admins also manage staff.",
      "يدير المعلمون الطلاب والمحتوى والتقييمات والنتائج. ويدير المديرون الموظفين أيضًا.",
    ),
    active: bi("Account status", "حالة الحساب"),
    activeHint: bi(
      "Inactive staff keep their history but cannot sign in or open protected pages.",
      "يحتفظ الموظف غير النشط بسجله لكنه لا يستطيع تسجيل الدخول أو فتح الصفحات المحمية.",
    ),
    statusNote: bi(
      "Role and access are managed from the access panel on the profile page.",
      "تُدار الأدوار والوصول من لوحة الوصول في صفحة الملف.",
    ),
  },
  detail: {
    profileTitle: bi("Staff profile", "ملف الموظف"),
    accessTitle: bi("Role & access", "الدور والوصول"),
    accessHint: bi(
      "Change the role, reset a password through a single-use link, or stop access immediately. Every change is audited.",
      "غيّر الدور، أو أعد تعيين كلمة المرور عبر رابط لمرة واحدة، أو أوقف الوصول فورًا. يُسجَّل كل تغيير في التدقيق.",
    ),
    activityTitle: bi("Staff audit history", "سجل تدقيق الموظفين"),
    activityHint: bi(
      "Append-only events recorded by administrators. Passwords, setup links and tokens are never stored.",
      "أحداث إلحاقية يسجّلها المديرون فقط. لا تُخزَّن كلمات المرور أو روابط الإعداد أو الرموز.",
    ),
    recentTitle: bi("Recent staff activity", "نشاط الموظفين الأخير"),
    recentHint: bi(
      "The latest staff-management events across all accounts.",
      "أحدث أحداث إدارة الموظفين عبر جميع الحسابات.",
    ),
    noActivity: bi(
      "No staff audit events recorded yet.",
      "لم تُسجَّل أي أحداث تدقيق للموظفين بعد.",
    ),
    createdOn: bi("Created", "تاريخ الإنشاء"),
    lastInvite: bi("Setup link issued", "أُصدر رابط الإعداد"),
    lastReset: bi("Last access reset", "آخر إعادة تعيين للوصول"),
    never: bi("Never", "أبدًا"),
    by: bi("By", "بواسطة"),
    systemActor: bi("System", "النظام"),
  },
  access: {
    ready: bi("Password setup link ready", "رابط إعداد كلمة المرور جاهز"),
    once: bi(
      "This single-use link is shown once and expires. Share it privately with the staff member.",
      "يُعرض هذا الرابط لمرة واحدة وتنتهي صلاحيته. شاركه مع الموظف بشكل خاص.",
    ),
    missing: bi(
      "The link could not be generated. Try resetting access again.",
      "تعذّر إنشاء الرابط. حاول إعادة تعيين الوصول مرة أخرى.",
    ),
  },
  guards: {
    selfDeactivate: bi(
      "You cannot deactivate your own administrator account.",
      "لا يمكنك إيقاف حساب المدير الخاص بك.",
    ),
    selfRole: bi(
      "You cannot change your own administrator role.",
      "لا يمكنك تغيير دور المدير الخاص بك.",
    ),
    lastAdmin: bi(
      "At least one active administrator must remain.",
      "يجب أن يبقى مدير نشط واحد على الأقل.",
    ),
    inactiveNote: bi(
      "Inactive accounts cannot sign in. Their history remains available.",
      "لا يمكن للحسابات غير النشطة تسجيل الدخول. ويبقى سجلها متاحًا.",
    ),
  },
  messages: {
    created: bi("Staff account created.", "تم إنشاء حساب الموظف."),
    createdNoLink: bi(
      "Staff account created, but the setup link could not be generated. Use Reset access to try again.",
      "أُنشئ حساب الموظف، لكن تعذّر إنشاء رابط الإعداد. استخدم إعادة تعيين الوصول للمحاولة مجددًا.",
    ),
    updated: bi("Staff details updated.", "تم تحديث بيانات الموظف."),
    roleChanged: bi("Role updated.", "تم تحديث الدور."),
    activated: bi(
      "Account activated. The staff member can sign in again.",
      "تم تفعيل الحساب. يمكن للموظف تسجيل الدخول مرة أخرى.",
    ),
    deactivated: bi(
      "Account deactivated. The staff member is blocked from protected pages.",
      "تم إيقاف الحساب. يُمنع الموظف من الصفحات المحمية.",
    ),
    reset: bi(
      "A new single-use password setup link is ready.",
      "رابط إعداد كلمة مرور جديد لمرة واحدة جاهز.",
    ),
    noEmail: bi(
      "This account has no email address, so a setup link cannot be issued.",
      "لا يملك هذا الحساب بريدًا إلكترونيًا، لذا لا يمكن إصدار رابط إعداد.",
    ),
  },
} as const;

export const staffErrorCopy: Record<StaffErrorCode, Bilingual> = {
  validation_failed: bi(
    "Please check the highlighted fields.",
    "يرجى التحقق من الحقول المحددة.",
  ),
  email_required: bi("Enter an email address.", "أدخل بريدًا إلكترونيًا."),
  email_invalid: bi(
    "Enter a valid email address.",
    "أدخل بريدًا إلكترونيًا صالحًا.",
  ),
  email_taken: bi(
    "An account with this email already exists.",
    "يوجد حساب بهذا البريد الإلكتروني بالفعل.",
  ),
  name_required: bi("Enter a name.", "أدخل الاسم."),
  name_too_long: bi("This value is too long.", "هذه القيمة طويلة جدًا."),
  role_invalid: bi(
    "Choose teacher or administrator.",
    "اختر معلمًا أو مديرًا.",
  ),
  not_found: bi("That account no longer exists.", "لم يعد هذا الحساب موجودًا."),
  not_staff: bi(
    "That account is not a staff account.",
    "هذا الحساب ليس حساب موظف.",
  ),
  forbidden: bi(
    "Only an active administrator can manage staff.",
    "لا يمكن إلا لمدير نشط إدارة الموظفين.",
  ),
  self_role_change_forbidden: bi(
    "You cannot change your own administrator role.",
    "لا يمكنك تغيير دور المدير الخاص بك.",
  ),
  self_deactivation_forbidden: bi(
    "You cannot deactivate your own administrator account.",
    "لا يمكنك إيقاف حساب المدير الخاص بك.",
  ),
  last_admin_protected: bi(
    "At least one active administrator must remain.",
    "يجب أن يبقى مدير نشط واحد على الأقل.",
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

export const staffEventCopy: Record<StaffAdminAction, Bilingual> = {
  created: bi("Account created", "أُنشئ الحساب"),
  updated: bi("Details updated", "حُدّثت البيانات"),
  role_changed: bi("Role changed", "تغيّر الدور"),
  activated: bi("Account activated", "فُعّل الحساب"),
  deactivated: bi("Account deactivated", "أُوقف الحساب"),
  access_reset: bi(
    "Password setup link issued",
    "أُصدر رابط إعداد كلمة المرور",
  ),
};
