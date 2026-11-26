import type { Bilingual } from "@/lib/i18n/dictionary";
import type { AuthErrorCode } from "@/lib/validation/auth";

export const authErrorCopy: Record<AuthErrorCode, Bilingual> = {
  validation_failed: {
    en: "Please check the highlighted fields.",
    ar: "يرجى التحقق من الحقول المحددة.",
  },
  invalid_credentials: {
    en: "The Student ID or password is incorrect. Staff should sign in with their email.",
    ar: "رقم الطالب أو كلمة المرور غير صحيحة. يسجّل الموظفون الدخول ببريدهم الإلكتروني.",
  },
  email_not_confirmed: {
    en: "This account still needs email confirmation. Ask your teacher for help.",
    ar: "لا يزال هذا الحساب بحاجة إلى تأكيد البريد الإلكتروني. اطلب المساعدة من معلمك.",
  },
  rate_limited: {
    en: "Too many attempts. Wait a moment, then try again.",
    ar: "محاولات كثيرة جدًا. انتظر قليلًا ثم حاول مرة أخرى.",
  },
  profile_missing: {
    en: "Your account is not fully set up yet. Please contact your teacher.",
    ar: "لم يكتمل إعداد حسابك بعد. يرجى التواصل مع معلمك.",
  },
  config_missing: {
    en: "The site is not connected to its database yet.",
    ar: "لم يُربط الموقع بقاعدة البيانات بعد.",
  },
  unknown: {
    en: "Something went wrong. Please try again.",
    ar: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
  },
};

export const validationMessageCopy: Record<string, Bilingual> = {
  student_id_required: {
    en: "Enter your Student ID.",
    ar: "أدخل رقم الطالب.",
  },
  student_id_invalid: {
    en: "Use 2–40 letters, numbers, dots, dashes or underscores.",
    ar: "استخدم من 2 إلى 40 حرفًا أو رقمًا أو نقطة أو شرطة.",
  },
  email_required: {
    en: "Enter your email address.",
    ar: "أدخل بريدك الإلكتروني.",
  },
  email_invalid: {
    en: "Enter a valid email address.",
    ar: "أدخل بريدًا إلكترونيًا صالحًا.",
  },
  password_required: {
    en: "Enter your password.",
    ar: "أدخل كلمة المرور.",
  },
  password_short: {
    en: "Password must be at least 6 characters.",
    ar: "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.",
  },
};

export function copyForValidationMessage(message?: string): Bilingual {
  if (message && message in validationMessageCopy) {
    return validationMessageCopy[message];
  }

  return {
    en: "Please check this field.",
    ar: "يرجى التحقق من هذا الحقل.",
  };
}
