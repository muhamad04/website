import { Bi } from "@/components/bilingual";
import type { Bilingual } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

/**
 * Bilingual inline error. Unlike FormMessage it takes the copy directly, so
 * server action error codes can be rendered without a second lookup.
 */
export function FormError({
  copy,
  className,
}: {
  copy?: Bilingual | null;
  className?: string;
}) {
  if (!copy) {
    return null;
  }

  return (
    <p
      role="alert"
      className={cn("text-xs font-medium text-destructive", className)}
    >
      <Bi en={copy.en} ar={copy.ar} />
    </p>
  );
}
