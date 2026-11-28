"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { resourceErrorCopy, resourcesUi } from "@/lib/i18n/resources";
import type { ResourceErrorCode } from "@/lib/validation/resources";
import {
  deleteResourceAction,
  setResourcePublishedAction,
} from "@/app/(app)/teacher/resources/actions";

export function ResourcePublishToggle({
  resourceId,
  isPublished,
}: {
  resourceId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<ResourceErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    setError(null);

    startTransition(async () => {
      const outcome = await setResourcePublishedAction({
        resource_id: resourceId,
        is_published: isPublished ? "false" : "true",
      });

      if (!outcome.ok) {
        setError(outcome.error ?? "unknown");
        return;
      }

      router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={toggle}
      >
        {isPublished ? (
          <EyeOff aria-hidden="true" className="size-3.5" />
        ) : (
          <Eye aria-hidden="true" className="size-3.5" />
        )}
        <Bi
          en={
            pending
              ? resourcesUi.actions.working.en
              : isPublished
                ? resourcesUi.actions.unpublish.en
                : resourcesUi.actions.publish.en
          }
          ar={
            pending
              ? resourcesUi.actions.working.en
              : isPublished
                ? resourcesUi.actions.unpublish.en
                : resourcesUi.actions.publish.en
          }
        />
      </Button>
      {error ? (
        <span role="alert" className="text-[11px] text-destructive">
          <Bi en={resourceErrorCopy[error].en} ar={resourceErrorCopy[error].en} />
        </span>
      ) : null}
    </span>
  );
}

export function DeleteResourceButton({
  resourceId,
  redirectToList = false,
}: {
  resourceId: string;
  redirectToList?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<ResourceErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    const confirmed = window.confirm(
      `${resourcesUi.actions.confirmDelete.en}\n${resourcesUi.actions.deleteWarning.en}`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const outcome = await deleteResourceAction({ resource_id: resourceId });

      if (!outcome.ok) {
        setError(outcome.error ?? "unknown");
        return;
      }

      if (redirectToList) {
        router.push("/teacher/resources?deleted=1");
      } else {
        router.refresh();
      }
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={remove}
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
        <Bi
          en={
            pending
              ? resourcesUi.actions.deleting.en
              : resourcesUi.actions.delete.en
          }
          ar={
            pending
              ? resourcesUi.actions.deleting.en
              : resourcesUi.actions.delete.en
          }
        />
      </Button>
      {error ? (
        <span role="alert" className="text-[11px] text-destructive">
          <Bi en={resourceErrorCopy[error].en} ar={resourceErrorCopy[error].en} />
        </span>
      ) : null}
    </span>
  );
}
