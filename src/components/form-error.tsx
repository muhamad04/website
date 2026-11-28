import { Bi } from "@/components/bilingual";
import type { Bilingual } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

/**
 * Inline field error. Unlike FormMessage it takes the copy directly, so
 * server action error codes can be rendered without a second lookup.
 */
export function FormError({
  copy,
  className,
  bilingual = false,
}: {
  copy?: Bilingual | null;
  className?: string;
  bilingual?: boolean;
}) {
  if (!copy) {
    return null;
  }

  return (
    <p
      role="alert"
      className={cn("text-xs font-medium text-destructive", className)}
    >
      <Bi en={copy.en} ar={copy.ar} bilingual={bilingual} />
    </p>
  );
}
