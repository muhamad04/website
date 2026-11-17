import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Bilingual } from "@/lib/i18n/dictionary";
import { Bi } from "@/components/bilingual";
import { cn } from "@/lib/utils";

type StatCardProps = {
  icon: LucideIcon;
  label: Bilingual;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
};

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Bi en={label.en} ar={label.ar} layout="stacked" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {value}
          </div>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
      {hint ? (
        <div className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
