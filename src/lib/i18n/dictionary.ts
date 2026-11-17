export type Bilingual = {
  en: string;
  ar: string;
};

const bi = (en: string, ar: string): Bilingual => ({ en, ar });

export const ui = {
  appName: bi("English Hub", "منصة الإنجليزية"),
  appTagline: bi(
    "Teaching resources & assessments",
    "مصادر تعليمية واختبارات",
  ),
  nav: {
    dashboard: bi("Dashboard", "لوحة التحكم"),
    resources: bi("Resources", "المصادر"),
    assessments: bi("Assessments", "التقييمات"),
    quizzes: bi("Quizzes", "الاختبارات القصيرة"),
    exams: bi("Exams", "الامتحانات"),
    students: bi("Students", "الطلاب"),
    classes: bi("Classes", "الفصول"),
    results: bi("Results", "النتائج"),
    reporting: bi("Reporting", "التقارير"),
    staff: bi("Staff", "الموظفون"),
  },
  common: {
    signIn: bi("Sign in", "تسجيل الدخول"),
    signOut: bi("Sign out", "تسجيل الخروج"),
    email: bi("Email", "البريد الإلكتروني"),
    password: bi("Password", "كلمة المرور"),
    studentId: bi("Student ID", "رقم الطالب"),
    optional: bi("Optional", "اختياري"),
    loading: bi("Loading", "جارٍ التحميل"),
    save: bi("Save", "حفظ"),
    cancel: bi("Cancel", "إلغاء"),
    submit: bi("Submit", "إرسال"),
    retry: bi("Try again", "حاول مرة أخرى"),
    soon: bi("Soon", "قريبًا"),
    comingSoon: bi("Coming soon", "قريبًا"),
    backToDashboard: bi("Back to dashboard", "العودة إلى لوحة التحكم"),
    remainingTime: bi("Remaining time", "الوقت المتبقي"),
    grade: bi("Grade", "الصف"),
    class: bi("Class", "الفصل"),
    status: bi("Status", "الحالة"),
    active: bi("Active", "نشط"),
    inactive: bi("Inactive", "غير نشط"),
    notAssigned: bi("Not assigned", "غير مُسنَد"),
    phase: bi("Phase 1", "المرحلة الأولى"),
  },
  roles: {
    teacher: bi("Teacher", "معلم"),
    admin: bi("Administrator", "مدير"),
    student: bi("Student", "طالب"),
  },
  login: {
    title: bi("Welcome back", "أهلًا بعودتك"),
    subtitle: bi(
      "Sign in with your Student ID or your staff email.",
      "سجّل الدخول برقم الطالب أو البريد الإلكتروني للموظفين.",
    ),
    studentTab: bi("Student", "طالب"),
    staffTab: bi("Teacher / Admin", "معلم / مدير"),
    studentSubtitle: bi(
      "Use the Student ID and password your teacher gave you.",
      "استخدم رقم الطالب وكلمة المرور التي منحك إياها معلمك.",
    ),
    staffSubtitle: bi(
      "Staff accounts continue to sign in with email and password.",
      "تستمر حسابات الموظفين في تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.",
    ),
    noRegistration: bi(
      "Student accounts are created by the teacher. Public registration is closed.",
      "يُنشئ المعلم حسابات الطلاب. التسجيل العام مغلق.",
    ),
    signingIn: bi("Signing in", "جارٍ تسجيل الدخول"),
    needHelp: bi(
      "Forgot your password? Ask your teacher to reset it from the student dashboard.",
      "نسيت كلمة المرور؟ اطلب من معلمك إعادة تعيينها من لوحة الطلاب.",
    ),
  },
} as const;

export type UiDictionary = typeof ui;
