import { Bi } from "@/components/bilingual";
import { copyForValidationMessage } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export function FormMessage({
  message,
  className,
  bilingual = false,
}: {
  message?: string;
  className?: string;
  bilingual?: boolean;
}) {
  if (!message) {
    return null;
  }

  const copy = copyForValidationMessage(message);

  return (
    <p
      className={cn("text-destructive", className)}
      role="alert"
    >
      <Bi
        en={copy.en}
        ar={copy.ar}
        bilingual={bilingual}
        className="text-xs font-medium"
      />
    </p>
  );
}
