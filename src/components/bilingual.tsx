import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BilingualTextProps = {
  en: ReactNode;
  ar: ReactNode;
  /** Inline keeps both languages on one line; stacked is better for headings. */
  layout?: "inline" | "stacked";
  className?: string;
  enClassName?: string;
  arClassName?: string;
  hideSeparator?: boolean;
};

/**
 * Renders English and Arabic together. Arabic is always marked with lang/dir
 * so screen readers and browsers shape it correctly inside an LTR page.
 */
export function Bi({
  en,
  ar,
  layout = "inline",
  className,
  enClassName,
  arClassName,
  hideSeparator = false,
}: BilingualTextProps) {
  return (
    <span
      className={cn(
        "inline-flex gap-x-2 gap-y-0.5",
        layout === "inline"
          ? "flex-wrap items-baseline"
          : "flex-col items-start",
        className,
      )}
    >
      <span lang="en" className={enClassName}>
        {en}
      </span>
      {!hideSeparator && layout === "inline" ? (
        <span aria-hidden="true" className="opacity-40">
          ·
        </span>
      ) : null}
      <span
        lang="ar"
        dir="rtl"
        className={cn(
          "font-arabic leading-relaxed",
          layout === "stacked" && "text-[0.82em] font-medium",
          arClassName,
        )}
      >
        {ar}
      </span>
    </span>
  );
}

/** Arabic-only text with the correct direction and font. */
export function Ar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span lang="ar" dir="rtl" className={cn("font-arabic", className)}>
      {children}
    </span>
  );
}
