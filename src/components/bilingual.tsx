import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BilingualTextProps = {
  en: ReactNode;
  ar: ReactNode;
  /**
   * Opt in to the bilingual rendering used by the login/authentication screens
   * and the main navigation. Everywhere else the site is English-only.
   */
  bilingual?: boolean;
  /** Inline keeps both languages on one line; stacked is better for headings. */
  layout?: "inline" | "stacked";
  className?: string;
  enClassName?: string;
  arClassName?: string;
  hideSeparator?: boolean;
};

/**
 * Renders interface copy. The default is English-only; approved areas
 * (authentication and the main navigation) pass `bilingual` to show Arabic
 * beside the English text.
 */
export function Bi({
  en,
  ar,
  bilingual = false,
  layout = "inline",
  className,
  enClassName,
  arClassName,
  hideSeparator = false,
}: BilingualTextProps) {
  if (!bilingual) {
    return (
      <span
        lang="en"
        className={cn(
          layout === "stacked" ? "block" : "inline",
          className,
          enClassName,
        )}
      >
        {en}
      </span>
    );
  }

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
