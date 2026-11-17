import type { ReactNode } from "react";
import { Bi } from "@/components/bilingual";
import { FormError } from "@/components/form-error";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { studentErrorCopy } from "@/lib/i18n/students";
import type { Bilingual } from "@/lib/i18n/dictionary";
import type { StudentErrorCode } from "@/lib/validation/students";

/** Label + control + hint + bilingual field error. */
export function FormField({
  id,
  label,
  hint,
  error,
  errorCopy,
  children,
  className,
}: {
  id: string;
  label: Bilingual;
  hint?: Bilingual;
  error?: string;
  /** Error-code dictionary for this form. Defaults to the student copy. */
  errorCopy?: Record<string, Bilingual>;
  children: ReactNode;
  className?: string;
}) {
  const dictionary: Record<string, Bilingual> = errorCopy ?? studentErrorCopy;
  const copy =
    error && error in dictionary
      ? dictionary[error as StudentErrorCode]
      : null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        <Bi en={label.en} ar={label.ar} />
      </Label>
      {children}
      {hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <Bi en={hint.en} ar={hint.ar} />
        </p>
      ) : null}
      <FormError copy={copy} />
    </div>
  );
}
