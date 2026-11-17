/* eslint-disable @next/next/no-img-element -- signed Supabase URLs are private and short-lived, so the Next image loader is not used. */

import { FileQuestion } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import type { ResourceType } from "@/lib/domain/types";
import { resourcesUi } from "@/lib/i18n/resources";
import { buildYouTubeInfo } from "@/lib/resources/youtube";

/**
 * Private file / YouTube viewer. It never renders a download control: PDFs are
 * embedded without the viewer toolbar, images are display-only, and YouTube
 * uses the privacy-enhanced nocookie player.
 */
export function ResourceViewer({
  type,
  signedUrl,
  youtubeId,
  titleEn,
  titleAr,
}: {
  type: ResourceType;
  signedUrl: string | null;
  youtubeId: string | null;
  titleEn: string;
  titleAr: string;
}) {
  const title = `${titleEn} / ${titleAr}`;

  if (type === "youtube") {
    if (!youtubeId) {
      return <PreviewUnavailable />;
    }

    return (
      <div className="aspect-video overflow-hidden rounded-xl border border-border bg-black">
        <iframe
          src={buildYouTubeInfo(youtubeId).embedUrl}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  if (!signedUrl) {
    return <PreviewUnavailable />;
  }

  if (type === "pdf") {
    return (
      <div className="space-y-2">
        <iframe
          src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title={title}
          className="h-[70vh] min-h-[420px] w-full rounded-xl border border-border bg-secondary/30"
        />
        <p className="text-xs text-muted-foreground">
          <Bi
            en={resourcesUi.detail.reloadHint.en}
            ar={resourcesUi.detail.reloadHint.ar}
          />
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-2 sm:p-4">
      <img
        src={signedUrl}
        alt={title}
        className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
      />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        <Bi
          en={resourcesUi.detail.reloadHint.en}
          ar={resourcesUi.detail.reloadHint.ar}
        />
      </p>
    </div>
  );
}

function PreviewUnavailable() {
  return (
    <div className="space-y-3">
      <Alert variant="error">
        <Bi
          en={resourcesUi.detail.previewUnavailableHint.en}
          ar={resourcesUi.detail.previewUnavailableHint.ar}
        />
      </Alert>
      <EmptyState
        icon={FileQuestion}
        title={
          <Bi
            en={resourcesUi.detail.previewUnavailable.en}
            ar={resourcesUi.detail.previewUnavailable.ar}
          />
        }
        description={
          <Bi
            en={resourcesUi.detail.previewUnavailableHint.en}
            ar={resourcesUi.detail.previewUnavailableHint.ar}
          />
        }
      />
    </div>
  );
}
