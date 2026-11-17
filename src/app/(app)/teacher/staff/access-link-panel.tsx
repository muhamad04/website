"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staffUi } from "@/lib/i18n/staff";

/**
 * One-time staff setup link. Rendered only from an action result; the link is
 * never stored, so a refresh removes it permanently.
 */
export function StaffAccessLinkPanel({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-success/25 bg-success/5 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Link2 aria-hidden="true" className="size-4 text-success" />
        <Bi
          en={staffUi.access.ready.en}
          ar={staffUi.access.ready.ar}
          hideSeparator
        />
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={url}
          aria-label="Staff setup link / رابط إعداد الموظف"
          onFocus={(event) => event.currentTarget.select()}
          className="h-9 font-mono text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copy}
          className="shrink-0"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : (
            <Copy aria-hidden="true" className="size-3.5" />
          )}
          <Bi
            en={copied ? staffUi.actions.copied.en : staffUi.actions.copy.en}
            ar={copied ? staffUi.actions.copied.ar : staffUi.actions.copy.ar}
            hideSeparator
          />
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        <Bi en={staffUi.access.once.en} ar={staffUi.access.once.ar} />
      </p>
    </div>
  );
}
