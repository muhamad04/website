"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { studentsUi } from "@/lib/i18n/students";

/**
 * One-time access link. Rendered only from the result of an action; the link is
 * never stored, so a page refresh removes it for good.
 */
export function AccessLinkPanel({ url }: { url: string }) {
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
          en={studentsUi.access.ready.en}
          ar={studentsUi.access.ready.en}
          hideSeparator
        />
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={url}
          aria-label="Access link"
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
            en={copied ? studentsUi.actions.copied.en : studentsUi.actions.copy.en}
            ar={copied ? studentsUi.actions.copied.en : studentsUi.actions.copy.en}
            hideSeparator
          />
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        <Bi en={studentsUi.access.once.en} ar={studentsUi.access.once.en} />
      </p>
    </div>
  );
}
